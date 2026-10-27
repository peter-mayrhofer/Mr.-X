# Mister X – Rote Falken (Neubau)

Live-Geländespiel der Roten Falken / Kinderfreunde Oberösterreich in der Linzer Innenstadt.
Dieser Branch enthält den **Neubau** nach [`PROMPT-NEUBAU.md`](PROMPT-NEUBAU.md).

> **Die bisherige App bleibt unverändert online** (`https://mr-x-ooe.web.app`). Ihr Code liegt hier nur noch zur
> Referenz unter [`legacy/`](legacy/) und wird weiter vom Branch `claude/vibrant-darwin-2gk2cj` aus veröffentlicht.

## Stand

| Meilenstein | Inhalt | Status |
|---|---|---|
| 1 – Konzept | [`docs/KONZEPT.md`](docs/KONZEPT.md), [`docs/ENTSCHEIDUNGEN.md`](docs/ENTSCHEIDUNGEN.md) | fertig, bestätigt |
| 2 – Design | Design-System, Kartenstil, Klick-Prototyp aller 23 Screens, [`docs/DESIGN.md`](docs/DESIGN.md) | fertig, bestätigt |
| 3 – Fundament | Spiel-Server, Rechte mit Tests, Anmeldung aller Rollen (ursprünglich Firebase, seit 9b Cloudflare) | fertig |
| 4 – Spiel-Kern | Start (gewählt/ausgelost), Meldungen mit Standort-Fallback, Übergabe/Strafübergabe/Rückgängig, Wartezeiten im Umkreis, Verkleinerung, Pause, Zufallsende/Notstopp, Auswertung + Archiv, Neue Runde – alles am Server | fertig |
| 5 – Team & Mister X | Onboarding mit Standort-Freigabe, Warteraum mit Checks, Karte mit Spur und Countdown, Wartezeit, Übergabe-Szenen, Durchsagen, Verkleinerung, Spielfeld-Warnung, Chat, Regeln, Auswertung; eigener Standort wird adaptiv gesendet | fertig |
| 6 – Schiri & Spielleitung | Schiri: Karte aller Teams, nächste Jäger, Übergabe nach Nähe mit Wartezeit-Vorschau, Rückgängig, „Ich begleite Mister X“. Spielleitung: Live-Übersicht mit Warnungen, Start (wählen/auslosen), Pause, Notstopp, Regeln live, Verkleinerung, Sofort-Meldung, Durchsage, Teams & Zugänge, Postfach, Protokoll | fertig |
| 7 – Spielfeld & Spiele | Zonen-Editor (Punkte ziehen/einfügen/löschen, Sperrbereiche mit Name, Farbe, Reihenfolge, Toleranz, Vorschau, Prüfung, GeoJSON-Import/-Export, Linz-Vorlage), Speichern mit Prüfung am Server; Organisator: Spiele öffnen ohne Passwort, archivieren, reaktivieren, löschen | fertig |
| 8 – Benachrichtigungen | Push bei allen Spielereignissen, Push-Arten pro Gerät, Web-App-Manifest (iPhone: Home-Bildschirm), Ton/Vibration in der App | fertig |
| 9 – Android-App | Capacitor-App mit Standort im Hintergrund (Vordergrund-Dienst, natives HTTP), Benachrichtigungen, Akku-Optimierung, eigenen Icons; signierte APK per GitHub Action ([`docs/ANDROID-APK.md`](docs/ANDROID-APK.md)) | fertig |
| 9b – Umzug auf Cloudflare | Worker + ein Spielraum (Durable Object) pro Spiel + D1, Live-Verbindung nach Rolle gefiltert, Alarme statt Takt, eigene Anmeldung (Organisator-Passwort mit Setup-Geheimnis), Web Push mit VAPID, Android mit lokalen Benachrichtigungen; Firebase entfernt. [`docs/BETRIEB.md`](docs/BETRIEB.md), [`docs/API.md`](docs/API.md), [`docs/CLOUDFLARE-LIMITS.md`](docs/CLOUDFLARE-LIMITS.md) | fertig |
| 10–13 | Großbild, Archiv & Replay, Tracker, Härtung, Abnahme | in Arbeit |

## Ordner

| Ordner | Inhalt |
|---|---|
| `shared/` | Spiel-Logik (Geometrie, Spielfeld Linz, Regeln), Schnittstellen-Vertrag, Client-Bibliothek – mit Tests |
| `app/` | Die App (Svelte + TypeScript). `src/ui/` = Komponenten, `src/screens/` = Screens, `src/pages/` = Seiten mit Daten, `src/map/` = Karte, `src/texte.ts` = alle Texte, `android/` = Android-Projekt (Capacitor) |
| `server/` | Spiel-Server auf Cloudflare: Worker (`index.ts`), Spielraum je Spiel (`room.ts`, Regeln in `ablauf.ts` und `actions/`), Organisator-Zugang (`zentrale.ts`), Web Push, Konfiguration `wrangler.jsonc` |
| `tests/` | Server-, Rechte- (inkl. Angriffe), Ruhezustand- und Ende-zu-Ende-Tests mit simulierten Handys, Screenshot-Skript |
| `docs/` | Konzept, Entscheidungen, API, Betrieb, Limits, Design, Screenshots |
| `legacy/` | alter Prototyp (nur Referenz) |

## Klick-Prototyp ansehen

Voraussetzung: [Node.js 22](https://nodejs.org) installiert, Repository heruntergeladen. Befehle in der
Eingabeaufforderung (Windows) oder im Terminal im Repository-Ordner ausführen.

**Am eigenen PC:**

```sh
npm ci
npm run dev
```

Dann im Browser `http://localhost:5173/#/prototyp` öffnen. Mit dem Handy im selben WLAN geht die Adresse, die
`npm run dev` unter „Network“ anzeigt.

**Online zum Weitergeben:** nach dem Veröffentlichen (unten) unter `https://mister-x.mr-x-ooe.workers.dev/#/prototyp`
bzw. in der Vorschau-Umgebung ([`docs/BETRIEB.md`](docs/BETRIEB.md), Schritt 11).

Im Prototyp öffnet der lila Griff am linken Bildschirmrand ein Menü mit allen Zuständen eines Screens
(z. B. „Durchsage“, „Offline“) und der Darstellung (Hell, Dunkel, Sonne).
Die Komponenten-Bibliothek liegt unter `#/komponenten`.

## Veröffentlichen

Klick-für-Klick für Windows: [`docs/BETRIEB.md`](docs/BETRIEB.md) – kostenloses Cloudflare-Konto ohne Zahlungsart,
`npx wrangler login`, `npm run deploy`, `npm run schluessel`, Organisator-Passwort festlegen. Die laufende alte App
(`https://mr-x-ooe.web.app`) bleibt davon unberührt.

## Lokal ausprobieren (ohne Cloudflare-Konto)

Zwei Fenster:

```sh
npm run dev:server   # Fenster 1: Spiel-Server in der lokalen Cloudflare-Laufzeit (http://localhost:8787)
npm run dev          # Fenster 2: App mit automatischem Neuladen (leitet /api und /ws an Fenster 1 weiter)
```

Dann `http://localhost:5173/#/verwaltung` → „Erstes Mal hier?“ → Setup-Geheimnis **`lokal`** und ein Passwort →
Spiel anlegen → „Öffnen“ → „Teams & Zugänge“ → „Zugänge“: Team-Passwort und Schiri-Code festlegen → Teams über
`#/s/<spiel-code>` beitreten lassen (z. B. in weiteren Browser-Fenstern im privaten Modus) → „Steuerung“: Mister X
wählen oder auslosen und starten. Daten bleiben in `.wrangler/` (löschen = alles weg).

## Entwickeln

```sh
npm run lint     # ESLint + Prettier
npm run check    # TypeScript (strict) + Svelte
npm test         # Unit-Tests (Vitest)
npm run test:server # Server-, Rechte- und Ende-zu-Ende-Tests in der lokalen Cloudflare-Laufzeit
npm run build    # App bauen
```

Screenshots aller Screens (dunkel/hell/Sonne) neu erzeugen: `npm run build`, dann in `app/`
`npx vite preview --port 4173` starten und im Hauptordner `npm run screenshots` ausführen.
GitHub Actions führt bei jedem Push Lint, Typecheck, alle Tests (auch gegen den lokalen Cloudflare-Server) und den
Build aus.
