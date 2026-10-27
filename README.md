# Mister X – Rote Falken (Neubau)

Live-Geländespiel der Roten Falken / Kinderfreunde Oberösterreich in der Linzer Innenstadt.
Dieser Branch enthält den **Neubau** nach [`PROMPT-NEUBAU.md`](PROMPT-NEUBAU.md).

> **Die bisherige App bleibt unverändert online** (`https://mr-x-ooe.web.app`). Ihr Code liegt hier nur noch zur
> Referenz unter [`legacy/`](legacy/) und wird weiter vom Branch `claude/vibrant-darwin-2gk2cj` aus veröffentlicht.

## Stand

| Meilenstein | Inhalt | Status |
|---|---|---|
| 1 – Konzept | [`docs/KONZEPT.md`](docs/KONZEPT.md), [`docs/ENTSCHEIDUNGEN.md`](docs/ENTSCHEIDUNGEN.md) | fertig, **wartet auf Bestätigung** |
| 2 – Design | Design-System, Kartenstil, Klick-Prototyp aller 23 Screens, [`docs/DESIGN.md`](docs/DESIGN.md) | fertig, **wartet auf Bestätigung** |
| 3–13 | Server, Echtzeit, Android-App, Push … | nach Bestätigung |

## Ordner

| Ordner | Inhalt |
|---|---|
| `shared/` | Spiel-Logik ohne Firebase (Geometrie, Spielfeld Linz, Regeln) – mit Tests |
| `app/` | Die App (Svelte + TypeScript). `src/ui/` = Komponenten, `src/screens/` = Screens, `src/map/` = Karte, `src/texte.ts` = alle Texte |
| `tests/` | Screenshot-Skript (später: Rechte-, Function- und Gesamtspiel-Tests) |
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

**Online zum Weitergeben (Firebase-Vorschau, ändert die Live-Version nicht):**

```sh
npm ci
npm run build
npx firebase-tools login
npx firebase-tools hosting:channel:deploy prototyp --expires 30d
```

Der letzte Befehl zeigt eine Adresse wie `https://mr-x-ooe--prototyp-xxxx.web.app` – die ist 30 Tage gültig.
Am Ende `#/prototyp` anhängen.

> ⚠️ **Von diesem Branch nie `firebase deploy` ausführen** – das würde die laufende alte App ersetzen.
> Bis zur Abnahme nur `hosting:channel:deploy` verwenden.

Im Prototyp öffnet der lila Griff am linken Bildschirmrand ein Menü mit allen Zuständen eines Screens
(z. B. „Durchsage“, „Offline“) und der Darstellung (Hell, Dunkel, Sonne).
Die Komponenten-Bibliothek liegt unter `#/komponenten`.

## Entwickeln

```sh
npm run lint     # ESLint + Prettier
npm run check    # TypeScript (strict) + Svelte
npm test         # Unit-Tests (Vitest)
npm run build    # App bauen (app/dist)
```

Screenshots aller Screens (dunkel/hell/Sonne) neu erzeugen: `npm run build`, dann in `app/`
`npx vite preview --port 4173` starten und im Hauptordner `npm run screenshots` ausführen.
GitHub Actions führt Lint, Typecheck, Tests und Build bei jedem Push aus.
