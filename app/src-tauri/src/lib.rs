// Mister X – Desktop-Hülle (Tauri 2): ein Fenster, das die Live-Web-App vom Server lädt.
// Zuerst die lokale Startseite (`start/`), die den Server prüft und dann weiterleitet (E-58, docs/DESKTOP-APP.md).
use tauri::{
    webview::NewWindowResponse, AppHandle, Manager, Monitor, Url, UserAttentionType, WebviewUrl,
    WebviewWindow, WebviewWindowBuilder,
};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;

/// Server-Adresse, zur Compile-Zeit festgelegt: `MRX_SERVER_URL=https://… npm run desktop:build`
fn server_url() -> &'static str {
    match option_env!("MRX_SERVER_URL") {
        Some(url) if !url.is_empty() => url, // leere Variable (CI) zählt als nicht gesetzt
        _ => STANDARD_SERVER,
    }
}
#[cfg(debug_assertions)]
const STANDARD_SERVER: &str = "http://localhost:5173";
#[cfg(not(debug_assertions))]
const STANDARD_SERVER: &str = "https://mister-x.mr-x-ooe.workers.dev";

/// F11 = Vollbild an/aus. WebView2 hat kein F11 wie der Browser, darum über die Fenster-Befehle von Tauri
/// (erlaubt in capabilities/*.json: core:window:allow-is-fullscreen, core:window:allow-set-fullscreen).
const VOLLBILD_SKRIPT: &str = r#"
window.addEventListener("keydown", function (e) {
  if (e.key !== "F11" || e.repeat) return;
  e.preventDefault();
  var t = window.__TAURI_INTERNALS__;
  if (!t) return;
  // Label des eigenen Fensters („main“ oder „grossbild“)
  var m = t.metadata && t.metadata.currentWindow;
  var label = (m && m.label) || "main";
  t.invoke("plugin:window|is_fullscreen", { label: label })
    .then(function (an) { return t.invoke("plugin:window|set_fullscreen", { label: label, value: !an }); })
    .catch(function () {});
}, true);
"#;

/// Linksklick auf externe Links mit target="_blank" (Kartenhinweis, Maps-Links) im Standardbrowser öffnen.
/// on_new_window greift unter Windows/WebView2 nur beim Rechtsklick „In neuem Tab öffnen“, nicht beim normalen Klick.
/// Erlaubt in capabilities/server.json: opener:allow-open-url mit opener:allow-default-urls (nur http(s), mailto, tel).
const LINK_SKRIPT: &str = r#"
document.addEventListener("click", function (e) {
  if (e.button !== 0) return;
  var a = e.target instanceof Element ? e.target.closest("a[href]") : null;
  if (!a || a.target !== "_blank") return;
  var url = new URL(a.href, location.href);
  if (url.origin === location.origin) return;
  var t = window.__TAURI_INTERNALS__;
  if (!t) return;
  e.preventDefault();
  t.invoke("plugin:opener|open_url", { url: url.href }).catch(function () {});
}, true);
"#;

/// Nur http(s), mailto und tel gehen an den Standardbrowser bzw. das Standardprogramm.
fn extern_oeffnen(app: &AppHandle, url: &Url) {
    if matches!(url.scheme(), "http" | "https" | "mailto" | "tel") {
        let _ = app.opener().open_url(url.as_str(), None::<&str>);
    }
}

/// Initialisierungsskript: Serveradresse nur für die lokale Startseite, Desktop-Kennung nur für die Server-Seite
/// (native.ts: DESKTOP). Läuft bei jeder Seite in jedem Fenster.
fn init_skript(adresse: &str, version: &str) -> String {
    format!(
        "(function(){{var s={server};if(location.origin===new URL(s).origin){{window.__MRX_DESKTOP__={version};}}else{{window.__MRX_SERVER__=s;}}}})();",
        server = serde_json::to_string(adresse).unwrap_or_default(),
        version = serde_json::to_string(version).unwrap_or_default(),
    )
}

/// Gemeinsamer Fensterbau für Hauptfenster und Großbild: gleiche Skripte, gleiche Navigationsregeln.
/// Navigation nur auf die lokale Startseite und den Server; alles andere und alle neuen Fenster in den Browser.
fn fenster_bauen<'a>(
    app: &'a AppHandle,
    label: &'a str,
    url: WebviewUrl,
    server: &Url,
) -> WebviewWindowBuilder<'a, tauri::Wry, AppHandle> {
    let version = app.package_info().version.to_string();
    let handle_nav = app.clone();
    let handle_neu = app.clone();
    let server_nav = server.clone();

    WebviewWindowBuilder::new(app, label, url)
        .initialization_script(init_skript(server_url(), &version))
        .initialization_script(VOLLBILD_SKRIPT)
        .initialization_script(LINK_SKRIPT)
        .on_navigation(move |url| {
            let lokal = matches!(
                (url.scheme(), url.host_str()),
                ("tauri", Some("localhost")) | ("http" | "https", Some("tauri.localhost"))
            );
            if lokal || url.as_str() == "about:blank" || url.origin() == server_nav.origin() {
                return true;
            }
            extern_oeffnen(&handle_nav, url);
            false
        })
        .on_new_window(move |url, _features| {
            extern_oeffnen(&handle_neu, &url);
            NewWindowResponse::Deny
        })
}

/// Großbild: eigenes Fenster (Label `grossbild`) mit einer Seite der Server-Origin, im Vollbild auf einem anderen
/// Bildschirm (Beamer) als das Hauptfenster. Rückgabe: "beamer" oder "gleicher-bildschirm".
/// Muss `async` sein: ein Fenster aus einem synchronen Befehl zu bauen, blockiert unter Windows (Tauri-Doku).
#[tauri::command]
async fn grossbild_oeffnen(app: AppHandle, url: String) -> Result<&'static str, String> {
    let ziel = Url::parse(&url).map_err(|e| format!("Ungültige Adresse: {e}"))?;
    let server = Url::parse(server_url()).map_err(|e| e.to_string())?;
    if ziel.origin() != server.origin() {
        return Err("Adresse gehört nicht zum Mister-X-Server".into());
    }

    let fenster: WebviewWindow = match app.get_webview_window("grossbild") {
        Some(w) => {
            w.navigate(ziel).map_err(|e| e.to_string())?;
            w
        }
        None => fenster_bauen(&app, "grossbild", WebviewUrl::External(ziel), &server)
            .title("Mister X – Großbild")
            .inner_size(1280.0, 720.0)
            .center()
            .build()
            .map_err(|e| e.to_string())?,
    };

    // Bildschirm wählen: nicht der des Hauptfensters, bei mehreren der größte
    let haupt = app.get_webview_window("main").and_then(|w| w.current_monitor().ok().flatten());
    let gleich = |a: &Monitor, b: &Monitor| a.position() == b.position() && a.size() == b.size();
    let beamer = app
        .available_monitors()
        .map_err(|e| e.to_string())?
        .into_iter()
        .filter(|m| haupt.as_ref().map_or(true, |h| !gleich(m, h)))
        .max_by_key(|m| m.size().width as u64 * m.size().height as u64);

    let _ = fenster.set_fullscreen(false); // aus dem Vollbild heraus wirkt set_position nicht
    if let Some(m) = &beamer {
        let _ = fenster.set_position(*m.position());
    }
    let _ = fenster.unminimize();
    let _ = fenster.show();
    let _ = fenster.set_fullscreen(true);
    let _ = fenster.set_focus();
    Ok(if beamer.is_some() { "beamer" } else { "gleicher-bildschirm" })
}

/// Native Benachrichtigung; ist das Hauptfenster nicht im Fokus, zusätzlich Taskleiste blinken bzw. Dock hüpfen.
#[tauri::command]
fn melden(app: AppHandle, titel: String, text: String) -> Result<(), String> {
    app.notification()
        .builder()
        .title(titel)
        .body(text)
        .show()
        .map_err(|e| e.to_string())?;
    if let Some(w) = app.get_webview_window("main") {
        if !w.is_focused().unwrap_or(true) {
            let _ = w.request_user_attention(Some(UserAttentionType::Informational));
        }
    }
    Ok(())
}

pub fn run() {
    let adresse = server_url();
    let server = Url::parse(adresse).expect("MRX_SERVER_URL ist keine gültige Adresse");

    let mut builder = tauri::Builder::default();

    // Muss als erstes Plugin stehen: zweiter Start holt das vorhandene Fenster nach vorne
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.show();
                let _ = w.set_focus();
            }
        }));
        // Das Großbild-Fenster soll Position/Größe/Vollbild nicht speichern
        builder = builder.plugin(
            tauri_plugin_window_state::Builder::default()
                .with_denylist(&["grossbild"])
                .build(),
        );
    }

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![grossbild_oeffnen, melden])
        .setup(move |app| {
            // Erster Start (noch kein gespeicherter Fensterzustand von window-state): maximiert öffnen.
            // Danach stellt window-state den letzten Zustand wieder her.
            let erster_start = app
                .path()
                .app_config_dir()
                .map(|d| !d.join(".window-state.json").exists())
                .unwrap_or(true);

            fenster_bauen(app.handle(), "main", WebviewUrl::App("index.html".into()), &server)
                .title("Mister X")
                .inner_size(1280.0, 800.0)
                .min_inner_size(900.0, 600.0)
                .center()
                .maximized(erster_start)
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Mister X konnte nicht gestartet werden");
}
