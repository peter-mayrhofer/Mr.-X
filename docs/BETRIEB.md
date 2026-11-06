# Betrieb: Server einrichten und veröffentlichen (für den Organisator)

Diese Anleitung ist für Menschen **ohne Programmierkenntnisse** und für **Windows** geschrieben. Du brauchst etwa
30 Minuten, einen Computer mit Internet und Zugang zum Postfach `mr.x.rf.ooe@gmail.com`.

**Was am Ende läuft:** Die App und der Spiel-Server laufen bei **Cloudflare im kostenlosen Tarif**, unter einer Adresse
wie `https://mister-x.mr-x-ooe.workers.dev`. **Kosten: 0 €.** Es wird **keine Kreditkarte und keine Bankverbindung**
hinterlegt. Ohne Zahlungsart kann Cloudflare nichts abrechnen – wird ein Gratis-Limit überschritten, funktionieren
Anfragen bis Mitternacht (UTC) nicht mehr, kosten aber nichts. Ein Spiel mit 30 Teams braucht höchstens etwa ein Fünftel
der Tageslimits ([`CLOUDFLARE-LIMITS.md`](CLOUDFLARE-LIMITS.md)).

Die **alte Version** (`https://mr-x-ooe.web.app`, Firebase) bleibt davon unberührt online, bis du umschaltest.

> Die Bezeichnungen im Cloudflare-Dashboard ändern sich gelegentlich ein wenig. Wenn ein Knopf etwas anders heißt,
> such nach dem ähnlichsten Begriff – die Reihenfolge der Schritte bleibt gleich.

---

## 1. Programme installieren (einmalig)

1. **Node.js** (LTS-Version, mindestens 22) von <https://nodejs.org> herunterladen → Installer starten → immer „Next“,
   am Ende „Finish“. Häkchen „Automatically install the necessary tools“ ist **nicht** nötig.
2. **Git** von <https://git-scm.com/download/win> → Installer mit den vorgeschlagenen Einstellungen durchklicken.
3. **Eingabeaufforderung öffnen:** Windows-Taste drücken, `cmd` tippen, Enter. In diesem schwarzen Fenster tippst du
   alle Befehle unten ein (jeweils mit Enter bestätigen). Prüfen: `node --version` zeigt `v22…` oder höher.

## 2. Kostenloses Cloudflare-Konto anlegen (einmalig)

1. <https://dash.cloudflare.com/sign-up> öffnen.
2. E-Mail **`mr.x.rf.ooe@gmail.com`** und ein neues, sicheres Passwort eingeben → **Sign up**.
3. Im Postfach die Bestätigungs-Mail von Cloudflare öffnen und auf den Link klicken.
4. Falls Cloudflare fragt, was du vorhast: „Workers“/„Build an application“ wählen oder überspringen.
   **Nirgends eine Zahlungsart hinterlegen** und **keinen** Bezahl-Tarif (Paid/Pro) auswählen.
5. Links im Menü **Workers & Pages** (bzw. **Compute → Workers**) öffnen. Beim ersten Mal fragt Cloudflare nach einer
   **Subdomain** für `workers.dev` → **`mr-x-ooe`** eintragen → bestätigen.
   Die App ist dann später unter `https://mister-x.mr-x-ooe.workers.dev` erreichbar.
   (Andere Subdomain gewählt? Dann überall in dieser Anleitung `mr-x-ooe` durch deine ersetzen und für die Android-App
   Schritt 9 beachten.)
6. Empfohlen: **Zwei-Faktor-Anmeldung** einschalten (rechts oben Profil → **My Profile → Authentication**).

## 3. Projekt herunterladen (einmalig)

In der Eingabeaufforderung:

```bat
cd %USERPROFILE%\Documents
git clone https://github.com/peter-mayrhofer/Mr.-X.git
cd Mr.-X
git checkout claude/elegant-volta-i3dbpr
npm ci
```

(Das Repository ist privat: Git fragt beim ersten Mal nach der GitHub-Anmeldung – im Browser bestätigen.)
`npm ci` lädt alle benötigten Bausteine (ein paar Minuten). Nach dem Zusammenführen in den Hauptzweig entfällt die Zeile
`git checkout …`.

## 4. Cloudflare mit dem Computer verbinden (einmalig)

```bat
npx wrangler login
```

Ein Browserfenster öffnet sich → mit dem Cloudflare-Konto anmelden → **Allow** klicken. Im schwarzen Fenster steht dann
„Successfully logged in“.

## 5. Erstes Veröffentlichen

```bat
npm run deploy
```

Das baut die App und lädt App + Server zu Cloudflare. Beim ersten Mal legt Cloudflare dabei automatisch die Datenbank
**`mister-x`** (D1) an. Fragt das Programm etwas (z. B. ob es die Datenbank anlegen soll), mit **Enter** bzw. `y`
bestätigen. Am Ende steht eine Zeile wie:

```
https://mister-x.mr-x-ooe.workers.dev
```

> Falls stattdessen ein Fehler zur Datenbank kommt („database_id“): einmal `npx wrangler d1 create mister-x` ausführen,
> die angezeigte `database_id` in `server/wrangler.jsonc` bei `"database_name": "mister-x"` als
> `"database_id": "…"` ergänzen und `npm run deploy` wiederholen.

## 6. Geheimnisse erzeugen und hochladen (einmalig)

Der Server braucht drei geheime Schlüssel: einen zum Unterschreiben der Anmeldungen, das **Setup-Geheimnis** für dich
als Organisator und ein Schlüsselpaar für Push-Benachrichtigungen. Alles wird mit einem Befehl erzeugt:

```bat
npm run schluessel
```

Dann hochladen (Befehl wird auch angezeigt):

```bat
npx wrangler secret bulk server/geheimnisse.json -c server/wrangler.jsonc
```

1. Das angezeigte **Setup-Geheimnis** (z. B. `pJg20-f16ey-dYIkk-Gx0sH`) **aufschreiben** und sicher aufbewahren
   (Passwort-Manager oder Zettel im Vereins-Tresor). Damit legst du dein Organisator-Passwort fest – und kannst es
   neu setzen, falls du es vergisst.
2. Die Datei löschen: `del server\geheimnisse.json`

Neue Schlüssel sind nur nötig, wenn einer verraten wurde. Achtung: ein neuer Push-Schlüssel bedeutet, dass alle Geräte
Benachrichtigungen einmal neu erlauben müssen; ein neuer Anmelde-Schlüssel meldet alle Geräte ab.

## 7. Prüfen

Im Browser öffnen:

- `https://mister-x.mr-x-ooe.workers.dev/health` → zeigt `{"ok":true,"protocol":1}`
- `https://mister-x.mr-x-ooe.workers.dev` → die Startseite der App

## 8. Organisator-Zugang einrichten und erstes Spiel anlegen

1. `https://mister-x.mr-x-ooe.workers.dev/#/verwaltung` öffnen.
2. **„Erstes Mal hier oder Passwort vergessen?“** antippen.
3. **Setup-Geheimnis** aus Schritt 6 und ein **neues Organisator-Passwort** (mindestens 10 Zeichen) eingeben →
   **Passwort festlegen**. Du bist jetzt angemeldet (das Gerät merkt sich das 7 Tage).
4. **Neues Spiel** → Name (z. B. „Mister X Linz 2027“), Spiel-Code wird vorgeschlagen, Vorlage **Linz Innenstadt**,
   **Admin-Passwort** für die Spielleitung → anlegen.
5. **Öffnen** → du bist Spielleitung dieses Spiels → unter **Teams & Zugänge** Team-Passwort und Schiri-Code festlegen,
   QR-Code drucken.

Danach meldest du dich auf anderen Geräten mit dem **Organisator-Passwort** an. Passwort vergessen → Schritt 2–3 mit dem
Setup-Geheimnis wiederholen (alle alten Organisator-Anmeldungen werden dabei ungültig).

## 9. Android-App mit dem Server verbinden

Die Android-App enthält die Adresse des Servers fest. Standard ist `https://mister-x.mr-x-ooe.workers.dev`.
Nur wenn du in Schritt 2 eine **andere Subdomain** gewählt hast: GitHub → Repository → **Settings → Secrets and
variables → Actions → Variables → New repository variable**: Name `MRX_API_URL`, Wert z. B.
`https://mister-x.meine-subdomain.workers.dev` – danach eine neue APK bauen ([`ANDROID-APK.md`](ANDROID-APK.md)).

**APK über die eigene Adresse verteilen (ohne GitHub-Konto für die Teams):** die fertige `mister-x.apk` (aus dem
GitHub-Release) nach `app\public\mister-x.apk` kopieren und `npm run deploy` ausführen. Dann ist sie unter
`https://mister-x.mr-x-ooe.workers.dev/mister-x.apk` zum Herunterladen da (die Datei kommt nie ins Repository), und
die Startseite zeigt am Android-Handy den Knopf **„Android-App installieren“** – die Teams kommen also einfach über
den QR-Code vom Flyer zur App.

## 10. Neue Version veröffentlichen

### Automatisch (empfohlen)

Ist das einmal eingerichtet, veröffentlicht GitHub jede Änderung auf `main` selbst (Workflow „Deploy“): Android-App
bauen, als `mister-x.apk` in die Web-App legen, alles auf Cloudflare hochladen. Web-App und APK sind dann immer vom
selben Stand – und die Android-App zeigt den Teams **„Neue Version der App – Jetzt installieren“**, sobald es eine
neuere gibt. Auf deinem Computer brauchst du dafür nichts mehr.

**Einmalig einrichten:**

1. **Cloudflare-Schlüssel erstellen:** im Cloudflare-Dashboard rechts oben auf das Profil → **Profil** → **API-Token**
   → **Token erstellen** → bei „Cloudflare Workers bearbeiten“ auf **Vorlage verwenden**. Unter *Berechtigungen* mit
   **+ Mehr hinzufügen** ergänzen: *Konto* → *D1* → *Bearbeiten*. Bei *Kontoressourcen* dein Konto wählen, bei
   *Zonenressourcen* „Alle Zonen“ lassen → **Weiter zur Zusammenfassung** → **Token erstellen**. Den Token **sofort
   kopieren** (er wird nur einmal angezeigt) – nie in einen Chat oder eine Datei im Projekt schreiben.
2. **Konto-ID:** im Dashboard unter **Workers & Pages** → rechts „Konto-ID“ (steht auch in der Adresse nach
   `dash.cloudflare.com/`).
3. **In GitHub hinterlegen:** Repository → **Settings → Secrets and variables → Actions → New repository secret**:
   `CLOUDFLARE_API_TOKEN` = der Token aus 1, `CLOUDFLARE_ACCOUNT_ID` = die Konto-ID aus 2.
4. **Signier-Schlüssel für die Android-App** hinterlegen ([`ANDROID-APK.md`](ANDROID-APK.md), 2.1 und 2.2). Ohne ihn
   baut GitHub nur eine Test-APK mit wechselndem Schlüssel – ein Update geht dann nur nach dem Deinstallieren der alten
   App.

Danach: GitHub → **Actions → Deploy → Run workflow** startet eine Veröffentlichung auch von Hand. Ohne die beiden
Secrets veröffentlicht der Workflow nichts und meldet nur einen Hinweis.

### Von Hand

```bat
cd %USERPROFILE%\Documents\Mr.-X
git pull
npm ci
npm run deploy
```

Laufende Spiele überstehen das: Geräte verbinden sich nach wenigen Sekunden von selbst neu, der Spielstand bleibt.
Trotzdem am besten **nicht während eines Spiels** veröffentlichen.

## 11. Vorschau zum Ausprobieren (getrennt von echten Spielen)

Eine zweite, völlig getrennte Umgebung (eigene Datenbank, eigene Spiele):

```bat
npm run deploy:vorschau
npm run schluessel
npx wrangler secret bulk server/geheimnisse.json -c server/wrangler.jsonc --env vorschau
del server\geheimnisse.json
```

Adresse: `https://mister-x-vorschau.mr-x-ooe.workers.dev` – dort mit dem neuen Setup-Geheimnis einrichten wie in Schritt 8.

## 12. Laufenden Betrieb beobachten

- **Verbrauch:** Cloudflare-Dashboard → **Workers & Pages → mister-x → Metrics** (Anfragen, Fehler). Für die Datenbank:
  **Storage & Databases → D1 → mister-x**. Die Tageslimits stehen in [`CLOUDFLARE-LIMITS.md`](CLOUDFLARE-LIMITS.md).
- **Fehler live ansehen:** `npx wrangler tail -c server/wrangler.jsonc` (Strg+C beendet). Die Logs enthalten Fehler mit
  Spiel-Code, aber **nie Standorte oder Passwörter**.
- **Statusseite:** `https://mister-x.mr-x-ooe.workers.dev/health`

## 13. Datensicherung

- **Spieleliste und Archive** (D1) als Datei sichern:
  ```bat
  npx wrangler d1 export mister-x --remote --output sicherung.sql -c server/wrangler.jsonc
  ```
- Das Archiv eines Spiels (Auswertung, Meldungen, Übergaben, Chat) ist außerdem in der App unter **Archiv** abrufbar
  und lässt sich dort als Datei sichern.
- **Löschfristen** laufen automatisch: Live-Standorte sofort bei Spielende, Chat und Protokoll nach 30 Tagen, Archiv
  nach einem Jahr (Übersicht: [`KONZEPT.md`](KONZEPT.md), Löschfristen).

## 14. Eigene Domain (optional)

Wenn der Verein eine eigene Domain hat (z. B. `mrx.rotefalken-ooe.at`): Domain zu Cloudflare hinzufügen
(**Websites → Add a domain**, kostenloser Tarif), dann **Workers & Pages → mister-x → Settings → Domains & Routes →
Add → Custom domain**. Die Android-App braucht danach eine neue APK mit `MRX_API_URL` (Schritt 9).

## 15. Hilfe bei Problemen

| Problem | Lösung |
|---|---|
| `npx` oder `npm` „nicht gefunden“ | Node.js installieren (Schritt 1), Eingabeaufforderung schließen und neu öffnen |
| `wrangler login` öffnet keinen Browser | den angezeigten Link kopieren und im Browser öffnen |
| Verwaltung: „Setup-Geheimnis ist am Server nicht eingerichtet“ | Schritt 6 ausführen |
| Verwaltung: „Zu viele Versuche“ | 10 Minuten warten (Schutz gegen Passwort-Raten) |
| App zeigt „Neue Version – bitte neu laden“ | einmal neu laden; passiert nach einem Update |
| Benachrichtigungen kommen nicht (iPhone) | nur als Web-App vom Home-Bildschirm, ab iOS 16.4; in der App unter **Mehr → Einstellungen** erlauben |
| Fehler 1027 oder „limit exceeded“ | Tageslimit erreicht – ab 01:00/02:00 Uhr geht es wieder; bitte melden, das sollte bei normalem Spiel nie passieren |
