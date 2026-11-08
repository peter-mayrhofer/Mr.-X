// Mister X – Desktop-Hülle (Tauri 2): ein Fenster, das die Live-Web-App vom Server lädt.
// Zuerst die lokale Startseite (`start/`), die den Server prüft und dann weiterleitet (E-58, docs/DESKTOP-APP.md).
use tauri::{
    webview::NewWindowResponse, AppHandle, Manager, Url, WebviewUrl, WebviewWindowBuilder,
};
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
  t.invoke("plugin:window|is_fullscreen", { label: "main" })
    .then(function (an) { return t.invoke("plugin:window|set_fullscreen", { label: "main", value: !an }); })
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
        builder = builder.plugin(tauri_plugin_window_state::Builder::default().build());
    }

    builder
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            let version = app.package_info().version.to_string();
            // Läuft bei jeder Seite im Hauptfenster: Serveradresse nur für die lokale Startseite,
            // Desktop-Kennung nur für die Server-Seite (native.ts: DESKTOP)
            let script = format!(
                "(function(){{var s={server};if(location.origin===new URL(s).origin){{window.__MRX_DESKTOP__={version};}}else{{window.__MRX_SERVER__=s;}}}})();",
                server = serde_json::to_string(adresse)?,
                version = serde_json::to_string(&version)?,
            );

            // Erster Start (noch kein gespeicherter Fensterzustand von window-state): maximiert öffnen.
            // Danach stellt window-state den letzten Zustand wieder her.
            let erster_start = app
                .path()
                .app_config_dir()
                .map(|d| !d.join(".window-state.json").exists())
                .unwrap_or(true);

            let handle_nav = app.handle().clone();
            let handle_neu = app.handle().clone();
            let server_nav = server.clone();

            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Mister X")
                .inner_size(1280.0, 800.0)
                .min_inner_size(900.0, 600.0)
                .center()
                .maximized(erster_start)
                .initialization_script(script)
                .initialization_script(VOLLBILD_SKRIPT)
                .initialization_script(LINK_SKRIPT)
                // Navigation nur auf die lokale Startseite und den Server; alles andere in den Browser
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
                // Neue Fenster (target=_blank, window.open) nie in der App, sondern im Browser
                .on_new_window(move |url, _features| {
                    extern_oeffnen(&handle_neu, &url);
                    NewWindowResponse::Deny
                })
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Mister X konnte nicht gestartet werden");
}
