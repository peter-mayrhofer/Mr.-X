# Firebase einrichten (für den Organisator)

Diese Schritte macht der Organisator einmal in der Firebase- bzw. Google-Cloud-Konsole, angemeldet als
`mr.x.rf.ooe@gmail.com`. Programmierkenntnisse sind nicht nötig. Die laufende alte App wird dabei **nicht** verändert:
Der Neubau bekommt eine eigene Datenbank und eine eigene Website im selben Projekt (siehe `ENTSCHEIDUNGEN.md`, E-21).

Kosten: bei normaler Nutzung ≈ 0 € pro Monat (Rechnung in `KONZEPT.md`, Abschnitt 8).

---

## 1. Blaze-Tarif aktivieren

Cloud Functions (der Spiel-Server) gibt es nur im Blaze-Tarif („nutzungsabhängig bezahlen“). Die Gratis-Kontingente
bleiben gleich – bezahlt wird nur, was darüber hinausgeht.

1. <https://console.firebase.google.com> öffnen → Projekt **mr-x-ooe** wählen.
2. Links unten auf **„Spark“** bzw. **Upgrade** klicken → **Blaze** wählen.
3. Ein Rechnungskonto anlegen oder auswählen (Kreditkarte nötig) → bestätigen.

## 2. Budget-Alarm einrichten (wichtig)

1. <https://console.cloud.google.com/billing> öffnen → das Rechnungskonto aus Schritt 1 wählen.
2. Links **„Budgets und Benachrichtigungen“** → **„Budget erstellen“**.
3. Name: `Mister X`, Projekte: **mr-x-ooe**, weiter.
4. Betrag: **5 €** (fester Betrag), weiter.
5. Schwellenwerte: **50 %, 90 %, 100 %** (tatsächliche Kosten), E-Mail an Abrechnungsadministratoren anhaken → **Fertig**.

> Ein Budget-Alarm **warnt nur per E-Mail**, er stoppt nichts. Kommt je eine Warnung, bitte melden.

## 3. Eigene Datenbank für den Neubau anlegen

1. Firebase-Konsole → **Build → Realtime Database**.
2. Oben rechts im Menü **⋮ → „Datenbank hinzufügen“**.
3. Name: **`mr-x-ooe-neu`** · Standort: **Belgien (europe-west1)** · **„Im gesperrten Modus starten“** → Fertig.
   (Die richtigen Zugriffsregeln kommen beim Veröffentlichen mit.)

Ist der Name schon vergeben, bitte Bescheid geben – dann passe ich ihn im Code an.

## 4. Eigene Website für den Neubau anlegen

1. Firebase-Konsole → **Build → Hosting**.
2. Ganz unten **„Weitere Website hinzufügen“** → Website-ID **`mr-x-ooe-neu`** → Fertig.
   Die neue App läuft dann unter `https://mr-x-ooe-neu.web.app`; die alte bleibt unter `https://mr-x-ooe.web.app`.

## 5. Anmeldemethoden

1. Firebase-Konsole → **Build → Authentication → Sign-in method**.
2. **Anonym**: ist schon aktiv (für Teams, Schiris, Spielleitung) – so lassen.
3. **Google** → aktivieren → Support-E-Mail `mr.x.rf.ooe@gmail.com` → Speichern. (Nur für den Organisator-Zugang.)
4. Reiter **Settings → Autorisierte Domains** → **Domain hinzufügen**: `mr-x-ooe-neu.web.app`.
   Für eine Vorschau-Adresse (z. B. `mr-x-ooe-neu--prototyp-abc123.web.app`) diese ebenfalls hinzufügen, wenn dort der
   Google-Login gebraucht wird.

## 6. Wer ist Organisator (Super-Admin)?

In der Datei `functions/.env` steht:

```
SUPER_ADMINS=mr.x.rf.ooe@gmail.com
```

Weitere Google-Konten mit Komma anhängen. Nur diese Konten sehen nach dem Google-Login die Seite „Spiele verwalten“.

## 7. Veröffentlichen

Voraussetzung: [Node.js 22](https://nodejs.org). In der Eingabeaufforderung (Windows) im Repository-Ordner:

```sh
npm ci
npm run build
npx firebase-tools login
npx firebase-tools deploy
```

`deploy` veröffentlicht genau drei Dinge – alle nur für den Neubau: die Zugriffsregeln der Datenbank `mr-x-ooe-neu`,
den Spiel-Server (Cloud Functions in `europe-west1`) und die Website `mr-x-ooe-neu`.

Beim **ersten** Veröffentlichen fragt das Programm:
- ob es nötige Google-Cloud-Dienste einschalten darf → **Ja**;
- ob alte Container-Images automatisch gelöscht werden sollen → **Ja, nach 1 Tag** (spart Speicherkosten).

Danach:
1. `https://mr-x-ooe-neu.web.app/#/verwaltung` öffnen → „Mit Google anmelden“ → Spiel anlegen
   (Spiel-Code z. B. `linz-2027`, Vorlage „Linz Innenstadt“, Admin-Passwort).
2. Mit dem Admin-Passwort unter „Spielleitung“ anmelden → Team-Passwort und Schiri-Code festlegen → QR-Code drucken.

## 8. Online-Vorschau des Klick-Prototyps (optional)

```sh
npm ci
npm run build
npx firebase-tools hosting:channel:deploy prototyp --expires 30d
```

Zeigt eine Adresse wie `https://mr-x-ooe-neu--prototyp-xxxx.web.app` – dort `#/prototyp` anhängen. Ändert keine
veröffentlichte Version.
