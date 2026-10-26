# Mister X – Rote Falken OÖ

Handy-Web-App für das Live-Spiel „Mister X“ in der Linzer Innenstadt. Spezifikation: [SPEC.md](SPEC.md).

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Oberfläche |
| `app.js` | Logik (Login, GPS, Meldungen, Übergabe, Chat, Auswertung) |
| `zones.js` | Spielfeld und 4 sperrbare Bereiche (Koordinaten entlang der Straßen aus OpenStreetMap) |
| `database.rules.json` | Zugriffsrechte (wer darf was sehen/schreiben) |
| `test/e2e.js` | Automatischer Test mit simulierten Handys |
| `test/zones.test.mjs` | Prüft die Spielfeld-Zonen (`node test/zones.test.mjs`) |

## Veröffentlichen (einmalig am PC)

Voraussetzung: [Node.js](https://nodejs.org) installiert, Repo heruntergeladen.

```sh
npx firebase-tools login                       # mit mr.x.rf.ooe@gmail.com anmelden
npx firebase-tools deploy --project mr-x-ooe   # lädt App + Zugriffsregeln hoch
```

Danach läuft die App unter **https://mr-x-ooe.web.app**.

## Erster Start

1. Spielleitung registriert sich als Team (z. B. „Spielleitung“) und drückt **„Ich bin die Spielleitung“**.
   Das geht nur einmal – danach vergibt die Spielleitung alle weiteren Rollen.
2. Schiris registrieren sich, die Spielleitung macht sie unter „Schiris“ zum Schiri.
3. Jede Ortsgruppe registriert sich mit Teamname + Passwort auf **einem** Handy.
4. Spielleitung wählt den Start-Mister-X und drückt **„Spiel starten“**.

## Testen

```sh
npx firebase-tools emulators:start --only auth,database --project mr-x-ooe   # Terminal 1
python3 -m http.server 8080                                                 # Terminal 2
node test/e2e.js                                                            # Terminal 3 (braucht playwright)
```

Im Browser: `http://localhost:8080/?emu` verwendet den Emulator statt der echten Datenbank.
