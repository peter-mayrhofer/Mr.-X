# Desktop-App (Windows · macOS · Linux) – Plan

Stand: 2026-11-08. Status: **Phasen 1–3 umgesetzt, erster Windows-Build in GitHub Actions ausstehend.** Entscheidung: E-58 in `ENTSCHEIDUNGEN.md`.

Organisator, Spielleitung und Großbild arbeiten am Laptop – bisher nur im Browser. Ziel: eine eigene App
(Windows-`.exe`, später macOS und Linux) und ein Download-Knopf, der im Browser das passende System erkennt –
so wie heute schon die Android-APK (E-44).

## Entscheidungen

| Frage | Entscheidung | Warum |
|---|---|---|
| Technik | **Tauri 2** | Installer ≈ 3–10 MB (Electron 80–150 MB). Cloudflare liefert pro Datei höchstens 25 MiB aus (`CLOUDFLARE-LIMITS.md`) – nur so kommt die App wie die APK von der eigenen Adresse statt aus dem privaten GitHub-Repo. |
| Inhalt | **Hülle lädt die Live-Web-App vom Server** | Gleiche Adresse wie die Website → keine CORS-Erweiterung, kein `VITE_API_URL`, Einladungslinks stimmen, kein Versionsversatz. E-31 verwarf das nur für Capacitor/Android (Hintergrund-Drosselung) – gilt am Laptop nicht. Ohne Internet: eingebaute Seite „Keine Verbindung – erneut versuchen“. |
| Reihenfolge | **Windows zuerst**, dann macOS/Linux | Die meisten Laptops der Organisatoren. |
| Pakete | Windows: NSIS-Setup `.exe` · macOS: Universal-`.dmg` · Linux: `.deb` | MSI lehnt die Version `2.0.0-beta.1` ab; AppImage (~80 MB) ist zu groß für den Worker. |
| Signieren | vorerst unsigniert, Hinweis am Download-Knopf | Windows: SmartScreen → „Weitere Informationen“ → „Trotzdem ausführen“. macOS ohne Apple-Konto (99 $/Jahr, offen): Systemeinstellungen › Datenschutz & Sicherheit › „Dennoch öffnen“. |

## Geräteerkennung (`shared/src/geraet.ts`)

```
Startseite im Browser
 ├─ läuft schon in der App (Capacitor/Tauri)? → kein Knopf
 ├─ erkenneSystem(): navigator.userAgentData.platform, sonst userAgent
 │    Android → mister-x.apk                Windows → download/Mister-X-Setup.exe
 │    macOS   → download/Mister-X.dmg       Linux   → download/mister-x.deb
 │    iPhone/iPad/ChromeOS/unbekannt → kein Knopf (Web-App)
 └─ /downloads.json → Knopf nur, wenn die Datei für dieses System am Server liegt
```

- Reihenfolge der Prüfung: Android vor Linux (Android-UA enthält „Linux“), iPad meldet sich als Mac
  (`maxTouchPoints > 1`), ChromeOS („CrOS“) bekommt keine Linux-Datei.
- `/downloads.json` entsteht beim Bauen aus den Dateien, die in `app/public` liegen (Datei + Größe). Sie ersetzt die
  HEAD-Prüfung aus E-44: eine Anfrage, dazu Größe für den Knopf.
- Feste Dateinamen ohne Version – Links und Flyer bleiben gültig.

## Desktop-Funktionen

**Erste Version:** eigenes Fenster und Taskleistensymbol, nur eine Instanz, Fenster merkt sich Größe/Position;
Benachrichtigungen für die Spielleitung über die Live-Verbindung (wie Android, E-34 – Web Push geht in Desktop-WebViews
nicht) mit Zähler am Symbol; Hinweis „Neue Desktop-Version“ (Version der Hülle gegen `downloads.json`).

**Danach:** Großbild mit einem Klick im Vollbild auf dem zweiten Bildschirm/Beamer; „Speichern unter“ für CSV-, GeoJSON-
und Replay-Exporte; optional 1-Klick-Update (Tauri-Updater, signiert) und `mister-x://`-Links.

**Sicherheit:** Tauri-Rechte nur für die eigene https-Adresse und nur Benachrichtigung/Fenster – kein Dateisystem, keine
Shell für die Webseite.

## Build und Verteilung

- Ordner `app/src-tauri/` neben `app/android/`; Version aus `app/package.json` (wie die APK).
- Workflow `desktop.yml`: nur bei Tags `v*` oder Handstart (privates Repo: macOS-Minuten zählen 10-fach, Windows 2-fach),
  hängt die Dateien ans GitHub-Release.
- `deploy.yml`: holt die Dateien des letzten Releases nach `app/public/download/` (in `.gitignore`); `downloads.json`
  entsteht beim Bauen automatisch. Weil die Hülle live lädt, schadet es nicht, dass sie seltener gebaut wird.
- Lokal einmalig für Phase 2: Rust (rustup) und Visual Studio Build Tools „Desktopentwicklung mit C++“
  (WebView2 ist bei Windows 11 dabei).

## Phasen

| Phase | Inhalt | Stand |
|---|---|---|
| 0 | Fremddateien aus `app/public` entfernt (wären mit `npm run deploy` öffentlich geworden), `app/public/download/` ignoriert | ✅ |
| 1 | `shared/src/geraet.ts` + Test, `downloads.json` beim Bauen, Download-Karte auf Startseite und Laptop-Logins, Texte, E2E-Test | ✅ |
| 2 | `app/src-tauri/` (Windows), Offline-Seite, `native.ts` kennt `desktop` | ✅ geschrieben – kompiliert erst in CI (kein Rust lokal) |
| 3 | `desktop.yml`, `deploy.yml`, BETRIEB.md | ✅ |
| 4 | Beamer-Knopf, Benachrichtigungen + Zähler, Speichern unter, Updater, macOS/Linux | offen |
