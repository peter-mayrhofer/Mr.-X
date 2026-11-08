# Mister X – Rote Falken

Das Live-Geländespiel der Roten Falken / Kinderfreunde Oberösterreich in der Linzer Innenstadt – als App.
Teams jagen Mister X durch die Stadt: Mister X meldet seinen Standort in festen Abständen, die Jäger sehen die
letzte Meldung auf der Karte, wer Mister X fängt, wird selbst Mister X. Spielleitung und Schiris steuern das Spiel,
das Großbild zeigt die Jagd am Beamer.

**Live:** https://mister-x.mr-x-ooe.workers.dev · **Android-App:** https://mister-x.mr-x-ooe.workers.dev/mister-x.apk

## Was die App kann

- **Teams und Mister X** (Handy, Web-App oder Android-App): Beitritt per QR-Code, Karte mit Spielfeld und Spur von
  Mister X, Countdown bis zur nächsten Meldung, Kompass, Übergabe, Wartezeiten, Durchsagen, Chat, Regeln, Notfall-Knopf.
  Oberfläche auf Deutsch, Englisch, Türkisch und Bosnisch/Kroatisch/Serbisch.
- **Schiris:** alle Teams live, Übergabe nach Nähe, Rückgängig.
- **Spielleitung:** Start (gewählt oder ausgelost), Pause, Notstopp, Verkleinerung des Spielfelds, Sofort-Meldung,
  Durchsagen mit Vorlagen, Sammelruf, Warnungen (Akku, Funkstille, Übergabe prüfen), Teams und Zugänge, Protokoll,
  Probelauf, Spiel-Vorlagen.
- **Großbild** für den Beamer, **Archiv** mit Wiederholung, **GPS-Tracker** (OsmAnd/Traccar) als Standortquelle.
- **Benachrichtigungen** über Web Push und die Android-App, auch bei ausgeschaltetem Bildschirm.

## Anleitungen

| Für wen | Dokument |
|---|---|
| Spielleitung: Spiel vorbereiten, durchführen, nachbereiten | [`docs/ADMIN-HANDBUCH.md`](docs/ADMIN-HANDBUCH.md), [`docs/SPIELTAG-CHECKLISTE.md`](docs/SPIELTAG-CHECKLISTE.md) |
| Teams: App holen, beitreten, spielen | [`docs/TEAM-ANLEITUNG.md`](docs/TEAM-ANLEITUNG.md), Flyer: [`docs/flyer-beispiel.pdf`](docs/flyer-beispiel.pdf) |
| Organisator: Server einrichten und veröffentlichen | [`docs/BETRIEB.md`](docs/BETRIEB.md) |
| Android-App bauen, signieren, verteilen | [`docs/ANDROID-APK.md`](docs/ANDROID-APK.md) |
| Feldtest mit echten Handys | [`docs/FELDTEST.md`](docs/FELDTEST.md) |
| Stand, Tests, bekannte Grenzen | [`docs/ABNAHME.md`](docs/ABNAHME.md) |
| Kosten und Gratis-Limits | [`docs/CLOUDFLARE-LIMITS.md`](docs/CLOUDFLARE-LIMITS.md) |
| Technik: Aufbau, Schnittstelle, Design, Entscheidungen | [`docs/KONZEPT.md`](docs/KONZEPT.md), [`docs/API.md`](docs/API.md), [`docs/DESIGN.md`](docs/DESIGN.md), [`docs/ENTSCHEIDUNGEN.md`](docs/ENTSCHEIDUNGEN.md) |
| Videos und Screenshots zum Teilen | [`promo/`](promo/README.md) |

## Veröffentlichen

**Automatisch:** Jede Änderung auf dem Standard-Branch des Repositorys wird von GitHub Actions gebaut (Web-App und
Android-App aus demselben Stand) und auf Cloudflare veröffentlicht – Workflow „Deploy“, eingerichtet über die Secrets
`CLOUDFLARE_API_TOKEN` und `CLOUDFLARE_ACCOUNT_ID` ([`docs/BETRIEB.md`](docs/BETRIEB.md), Abschnitt 10). Von Hand
starten: GitHub → Actions → Deploy → Run workflow.

**Von Hand** (Windows, im Repository-Ordner): `git pull`, `npm ci`, `npm run deploy`.

## Ordner

```
app/        Die App (Svelte 5 + TypeScript, Vite)
  src/ui/        Komponenten          src/screens/  Bildschirme      src/pages/  Seiten mit Daten
  src/map/       Karte                src/lib/      Sitzung, Live-Daten, Standort, Push, Sprache
  src/texte.ts   alle Texte (Deutsch) src/texte/    Übersetzungen    android/    Android-Projekt (Capacitor)
server/     Spiel-Server auf Cloudflare: Worker, Spielraum je Spiel (Durable Object), Organisator-Zugang, D1, Web Push
shared/     Spiel-Logik (Geometrie, Spielfeld Linz, Regeln), Schnittstellen-Vertrag, Client – mit Tests
tests/      Server-, Rechte-, Last- und Ende-zu-Ende-Tests (lokale Cloudflare-Laufzeit + Playwright),
            Android-Gerätetest, Push-Test, Screenshot- und Flyer-Skript
docs/       Handbücher, Betrieb, Konzept, Entscheidungen, API, Limits, Design, Screenshots
  archiv/        ursprünglicher Auftrag und Planung (Spezifikation, Prompts, Ideen) – nur zur Nachverfolgung
assets/     Logos der Roten Falken und der Kinderfreunde
promo/      Videos, Screenshots und ihre Quellen
claude-mods/ Erweiterungen für Claude Code, z. B. das Co-Agenten-Panel (installieren: siehe ihre README)
.github/    CI (Tests), Android-APK (Build + Emulator-Test), Deploy (Veröffentlichen)
```

## Lokal ausprobieren (ohne Cloudflare-Konto)

Voraussetzung: [Node.js 22](https://nodejs.org). Im Repository-Ordner einmal `npm ci`, dann zwei Fenster:

```sh
npm run dev:server   # Fenster 1: Spiel-Server in der lokalen Cloudflare-Laufzeit (http://localhost:8787)
npm run dev          # Fenster 2: App mit automatischem Neuladen (leitet /api und /ws an Fenster 1 weiter)
```

Dann `http://localhost:5173/#/verwaltung` → „Erstes Mal hier?“ → Setup-Geheimnis **`lokal`** und ein Passwort →
Spiel anlegen → „Öffnen“ → „Teams & Zugänge“: Team-Passwort und Schiri-Code festlegen → Teams über
`#/s/<spiel-code>` beitreten lassen (z. B. in weiteren Browser-Fenstern im privaten Modus) → „Steuerung“: Mister X
wählen oder auslosen und starten. Daten bleiben in `.wrangler/` (löschen = alles weg).

Klick-Prototyp aller Bildschirme: `#/prototyp`, Komponenten-Bibliothek: `#/komponenten`.

## Entwickeln

```sh
npm run lint        # ESLint + Prettier
npm run check       # TypeScript (strict) + Svelte
npm test            # Unit-Tests (Vitest)
npm run test:server # Server-, Rechte- und Ende-zu-Ende-Tests in der lokalen Cloudflare-Laufzeit
npm run build       # App bauen
```

Screenshots aller Bildschirme: `npm run build`, in `app/` `npx vite preview --port 4173` starten, dann im
Hauptordner `npm run screenshots`; `npm run flyer` erzeugt das Beispiel-PDF.
GitHub Actions prüft bei jedem Push Lint, Typen, alle Tests und den Build, testet Web Push über die echten Dienste
von Google und Mozilla und – bei Änderungen an App oder Server – die Android-App im Emulator.

## Geschichte

Die App ersetzt seit Herbst 2026 den ersten Prototyp (Firebase, `mr-x-ooe.web.app`). Der damalige Auftrag und die
Planung liegen in [`docs/archiv/`](docs/archiv/), der alte Code im Git-Verlauf.
