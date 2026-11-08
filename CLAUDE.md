# Mister X – Hinweise für Claude

Live-Geländespiel der Roten Falken / Kinderfreunde OÖ in der Linzer Innenstadt: Teams jagen Mister X, Spielleitung
und Schiris steuern, das Großbild zeigt die Jagd. Live: https://mister-x.mr-x-ooe.workers.dev. Überblick: `README.md`.

## Mit dem Organisator

- Immer **auf Deutsch** antworten, einfach und ohne Fachjargon. Er ist kein Programmierer und arbeitet unter Windows
  (`C:\Projekte\Mr.-X`). Befehle für ihn als `cmd`-Zeilen angeben.
- **Nie** nach Zugangsdaten fragen oder sie anfassen: Setup-Geheimnis, Organisator-Passwort, Cloudflare-Token,
  Signier-Schlüssel, Team-Passwörter. Er trägt sie selbst ein (GitHub-Secrets, `npm run schluessel`). Passwörter nie
  in Code, Links, QR-Codes oder Browser-Speicher; ein QR-Code gibt nie Zugang ohne Passwort.
- **Design nicht ungefragt ändern.** Ein Design-Feinschliff wurde auf seinen Wunsch komplett zurückgenommen
  (PR #3): Großbuchstaben, Ausrufezeichen, animierter Hintergrund und Siegerehrung bleiben, wie sie sind.

## Aufbau

- `app/` Svelte 5 + TypeScript (Vite). Alle Texte in `app/src/texte.ts` (Deutsch); Übersetzungen der
  Team-Bildschirme in `app/src/texte/{en,tr,bks}.ts`, typgeprüft gegen `texte.ts` – neue Team-Texte in allen vier
  Sprachen anlegen. Spielleitung, Schiri und Großbild sind nur deutsch. Android-App: `app/android/` (Capacitor).
- `server/` Cloudflare Worker, ein Spielraum (Durable Object) pro Spiel, D1, Web Push. Regeln in `server/src/ablauf.ts`
  und `server/src/actions/`. Chat-/Server-Meldungen in `shared/src/meldungen.ts`, Push-Titel in `shared/src/push.ts`.
- `shared/` Spiel-Logik, Geometrie, Schnittstellen-Vertrag – mit Unit-Tests.
- `tests/` Server-, Rechte-, Last- und Ende-zu-Ende-Tests (lokale Cloudflare-Laufzeit + Playwright).
- `docs/` Handbücher und Technik. Jede Entscheidung mit Begründung als neuer Eintrag in `docs/ENTSCHEIDUNGEN.md`
  (fortlaufend E-xx); Anleitungen für Spielleitung/Teams mitpflegen, wenn sich Bedienung ändert.
- `claude-mods/` Claude-Code-Mods (z. B. Co-Agenten-Panel), nicht Teil der App.

## Prüfen vor jedem Push

```sh
npm run lint        # ESLint + Prettier
npm run check       # TypeScript + Svelte
npm test            # Unit-Tests
npm run test:server # Server- und Ende-zu-Ende-Tests (~10 min)
```

Lokal ausprobieren: `npm run dev:server` und `npm run dev`, dann `http://localhost:5173/#/verwaltung`,
Setup-Geheimnis `lokal`.

## Arbeitsweise und Veröffentlichen

- Standard-Branch ist `claude/vibrant-darwin-2gk2cj`. **Jeder Merge dorthin geht automatisch live** (Workflow
  „Deploy“: Web-App und Android-APK aus demselben Stand). Deshalb Änderungen auf einem eigenen Branch, Pull Request,
  CI abwarten (CI, Android-APK mit Emulator-Test), erst auf ausdrücklichen Wunsch des Organisators zusammenführen.
- `server/wrangler.jsonc` enthält keine Datenbank-ID; der Organisator hat seine lokal eingetragen, CI sucht sie über
  den Namen. Nie eine ID committen.
- Nicht ins Repository: Musikdateien (Mixkit-Lizenz), Hilfsskripte für Videoaufnahmen, APKs, `server/geheimnisse*.json`.
- Promo-Videos liegen in `promo/` (Quellen und Ton-Protokolle in `promo/quellen/`).
- Alte Planung und der ursprüngliche Auftrag: `docs/archiv/` (nur Nachverfolgung).
