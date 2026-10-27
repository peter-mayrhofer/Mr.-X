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
| 3 – Fundament | Firebase (eigene Datenbank + Website, E-21), Security Rules mit Tests, Spiel-Server, Anmeldung aller Rollen | fertig |
| 4 – Spiel-Kern | Start (gewählt/ausgelost), Meldungen mit Standort-Fallback, Übergabe/Strafübergabe/Rückgängig, Wartezeiten im Umkreis, Verkleinerung, Pause, Zufallsende/Notstopp, Auswertung + Archiv, Neue Runde – alles am Server | fertig |
| 5 – Team & Mister X | Onboarding mit Standort-Freigabe, Warteraum mit Checks, Karte mit Spur und Countdown, Wartezeit, Übergabe-Szenen, Durchsagen, Verkleinerung, Spielfeld-Warnung, Chat, Regeln, Auswertung; eigener Standort wird adaptiv gesendet | fertig |
| 6 – Schiri & Spielleitung | Schiri: Karte aller Teams, nächste Jäger, Übergabe nach Nähe mit Wartezeit-Vorschau, Rückgängig, „Ich begleite Mister X“. Spielleitung: Live-Übersicht mit Warnungen, Start (wählen/auslosen), Pause, Notstopp, Regeln live, Verkleinerung, Sofort-Meldung, Durchsage, Teams & Zugänge, Postfach, Protokoll | fertig |
| 7–13 | Zonen-Editor, Push, Android-App, Großbild, Archiv, Tracker … | in Arbeit |

## Ordner

| Ordner | Inhalt |
|---|---|
| `shared/` | Spiel-Logik ohne Firebase (Geometrie, Spielfeld Linz, Regeln) – mit Tests |
| `app/` | Die App (Svelte + TypeScript). `src/ui/` = Komponenten, `src/screens/` = Screens, `src/pages/` = Seiten mit Daten, `src/map/` = Karte, `src/texte.ts` = alle Texte |
| `functions/` | Spiel-Server (Cloud Functions): Beitritt, Passwörter, Spiele anlegen, der ganze Spielablauf (`ablauf.ts`, `actions/`), Takt, Strecken-Berechnung |
| `database.rules.json` | Zugriffsregeln der Datenbank (wer darf was lesen/schreiben) |
| `tests/` | Rechte-Tests, Server-Tests, Ende-zu-Ende-Tests mit simulierten Handys, Screenshot-Skript |
| `docs/` | Konzept, Entscheidungen, Design, Screenshots |
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

**Online zum Weitergeben:** siehe [`docs/FIREBASE-EINRICHTUNG.md`](docs/FIREBASE-EINRICHTUNG.md), Abschnitt 8.

Im Prototyp öffnet der lila Griff am linken Bildschirmrand ein Menü mit allen Zuständen eines Screens
(z. B. „Durchsage“, „Offline“) und der Darstellung (Hell, Dunkel, Sonne).
Die Komponenten-Bibliothek liegt unter `#/komponenten`.

## Veröffentlichen

Einmalige Einrichtung und Befehle: [`docs/FIREBASE-EINRICHTUNG.md`](docs/FIREBASE-EINRICHTUNG.md).
`npx firebase-tools deploy` betrifft nur die neue Datenbank `mr-x-ooe-neu`, den Spiel-Server und die neue Website
`mr-x-ooe-neu` – die laufende alte App bleibt unberührt.

## Lokal mit Emulatoren (ohne echte Firebase-Daten)

Braucht zusätzlich [Java 21](https://adoptium.net). Zwei Fenster:

```sh
npm run emu        # Fenster 1: Firebase-Emulatoren (Projekt demo-mrx)
npm run dev:emu    # Fenster 2: App gegen die Emulatoren
```

Dann `http://localhost:5173/#/verwaltung` → „Mit Google anmelden“ → im Emulator-Fenster `orga@test.at` eingeben →
Spiel anlegen → mit dem Admin-Passwort unter „Spielleitung“ anmelden → „Teams & Zugänge“ → „Zugänge“: Team-Passwort
und Schiri-Code festlegen → Teams über `#/s/<spiel-code>` beitreten lassen (z. B. in weiteren Browser-Fenstern im
privaten Modus) → „Steuerung“: Mister X wählen oder auslosen und starten.

## Entwickeln

```sh
npm run lint     # ESLint + Prettier
npm run check    # TypeScript (strict) + Svelte
npm test         # Unit-Tests (Vitest)
npm run test:emu # Rechte-, Server- und Ende-zu-Ende-Tests gegen die Emulatoren (Java 21 nötig)
npm run build    # App und Spiel-Server bauen
```

Screenshots aller Screens (dunkel/hell/Sonne) neu erzeugen: `npm run build`, dann in `app/`
`npx vite preview --port 4173` starten und im Hauptordner `npm run screenshots` ausführen.
GitHub Actions führt bei jedem Push Lint, Typecheck, alle Tests (auch gegen die Emulatoren) und den Build aus.
