# Entscheidungen

Jede Entscheidung mit Begründung und verworfenen Alternativen. Neue Einträge unten anhängen, alte nicht löschen –
wird eine Entscheidung geändert, bekommt sie einen neuen Eintrag mit Verweis.

---

### E-01 Realtime Database statt Firestore
> **Abgelöst durch E-32** (Meilenstein 9b: Umzug auf Cloudflare, siehe `archiv/NACHRICHT-AN-FRONTEND.md`).
**Entscheidung:** Firebase Realtime Database (bestehende Instanz `europe-west1`).
**Warum:** Der Großteil des Verkehrs sind kleine, häufige Standort-Updates, die an wenige Empfänger (Admin, Schiris,
Großbild) verteilt werden. Die Realtime Database rechnet nach **Datenmenge** ab (10 GB Download gratis), Firestore nach
**Anzahl Lese-/Schreibvorgängen** (50 000 Lesungen / Tag gratis): 33 000 Standort-Updates × 7 Empfänger = 231 000
Lesungen pro Spiel → mit Firestore kostenpflichtig, mit RTDB ≈ 60 MB → gratis. Dazu: niedrigere Latenz, eingebaute
Anwesenheit (`onDisconnect`), Server-Zeitversatz, Offline-Puffer, Instanz existiert schon.
**Verworfen:** Firestore (Kosten pro Vorgang, für Chat/Archiv wäre es schöner abfragbar – bei unseren Mengen egal).

### E-02 Svelte 5 + Vite + TypeScript (strict), keine SvelteKit
**Entscheidung:** Svelte 5 (Runes) als UI-Framework, Vite als Build, eigener kleiner Hash-Router.
**Warum:** Kleinstes Laufzeit-Paket der großen Frameworks und feingranulare Reaktivität: Wenn sich ein Standort oder der
Countdown ändert, wird genau diese Stelle aktualisiert, nicht ein ganzer Komponentenbaum – wichtig für ältere
Android-Handys und Akku. SvelteKit bringt Server-Rendering und Routing-Konventionen, die eine reine App (Web + Capacitor,
statische Dateien) nicht braucht. Hash-Routen (`/#/s/linz-2027`) funktionieren in Firebase Hosting und in der Capacitor-Hülle
ohne Sonderkonfiguration.
**Verworfen:** React (größer, Neurendern muss manuell gezügelt werden), Vue (gleichwertig, aber größer), SvelteKit (unnötig).

### E-03 Server-Autorität mit Cloud Functions 2nd gen, ein Aktions-Endpunkt
> **Abgelöst durch E-32** (Meilenstein 9b: Umzug auf Cloudflare, siehe `archiv/NACHRICHT-AN-FRONTEND.md`).
**Entscheidung:** Alle spielentscheidenden Aktionen laufen über **eine** aufrufbare Function `api` (Feld `action`),
dazu `tick` (Scheduler, jede Minute), `onPosition` (Datenbank-Trigger), `tracker` (HTTP), `cleanup` (täglich).
Region `europe-west1` (wie die Datenbank), Node 22.
**Warum:** Jede 2nd-gen-Function ist ein eigener Dienst mit eigenem Kaltstart. Eine gemeinsame `api` bleibt während
des Spiels „warm“, egal welche Aktion kommt (Übergabe, Chat-Löschung, Regeländerung …). Die Aktionen sind trotzdem
sauber getrennte Module mit eigener Prüfung.
**Grenze:** Erster Aufruf nach längerer Pause hat 2–4 s Kaltstart. Mindest-Instanzen (`minInstances: 1`) würden das
beheben, kosten aber ≈ 5–10 €/Monat → nicht verwendet; der `tick` hält die Region während des Spiels ohnehin aktiv.

### E-04 Zeitgesteuerte Ereignisse: Minuten-Takt + „Warten bis zur Sekunde“
> **Abgelöst durch E-32** (Meilenstein 9b: Umzug auf Cloudflare, siehe `archiv/NACHRICHT-AN-FRONTEND.md`).
**Entscheidung:** Cloud Scheduler ruft `tick` jede Minute auf. `tick` sucht alle Ereignisse, die in den nächsten 60 s
fällig sind (Meldung, Spielende, Ablauf von Wartezeiten), wartet bis zum exakten Zeitpunkt und führt sie als Transaktion aus.
**Warum:** Sekundengenau, funktioniert ohne jedes Handy, kein zusätzliches Produkt. Doppelte Ausführung durch
überlappende Läufe ist durch Transaktionen mit erwartetem Zustand ausgeschlossen (idempotent).
**Verworfen:** Cloud Tasks pro Ereignis (präzise, aber IAM-Einrichtung für Laien fehleranfällig, Umplanen bei
Intervalländerung/Übergabe aufwendig); Spiel-Logik auf Handys (Kernproblem des Prototyps).
**Grenze:** Ein Lauf kostet bis zu 60 s Instanzzeit – bei vielen gleichzeitigen Spielen später auf Cloud Tasks umstellen.

### E-05 Login: anonym + serverseitig geprüftes Passwort; Super-Admin per Google + Custom Claim
> **Abgelöst durch E-33** (Meilenstein 9b: Umzug auf Cloudflare, siehe `archiv/NACHRICHT-AN-FRONTEND.md`).
**Entscheidung:** Teams, Schiris, Spiel-Admins melden sich mit einem **anonymen** Firebase-Konto an und treten einem
Spiel über `api: join` mit Passwort/Code bei. Der Server speichert die Rolle in `games/{g}/members/{uid}`
(nur vom Server schreibbar). Der Super-Admin meldet sich mit **Google** an; eine Function prüft die E-Mail gegen die
Freigabeliste (Deploy-Parameter `SUPER_ADMINS`) und setzt den Custom Claim `superAdmin`.
**Warum:** Keine E-Mail-Adressen von Jugendlichen nötig (Datenschutz), Rollen sind **pro Spiel** (ein Gerät kann in
einem Spiel Schiri und im nächsten Team sein) – das passt in die Datenbank besser als in Custom Claims, die nur langsam
aktualisiert werden (Token-Erneuerung). Google-Login für den Organisator ist bequem und sicher (bestätigte E-Mail).
**Verworfen:** E-Mail/Passwort-Konten pro Admin (Verwaltungsaufwand), Admin-Konto „wer zuerst kommt“ (Prototyp – unsicher).

### E-06 Passwörter gehasht (scrypt) in `/secrets`, niemand liest sie
> **Abgelöst durch E-33** (Meilenstein 9b: Umzug auf Cloudflare, siehe `archiv/NACHRICHT-AN-FRONTEND.md`).
**Entscheidung:** Team-Passwort, Schiri-Code, Admin-Passwort und Großbild-Schlüssel werden mit `scrypt` + Salt gehasht in
`secrets/{g}` gespeichert; Rules: `.read: false, .write: false`. Der Admin sieht das Team-Passwort nach dem Festlegen
**einmal** und kann jederzeit ein neues setzen (statt es später auszulesen).
**Warum:** Keine Geheimnisse im Client, auch nicht für Admins (Admin-Handy kann verloren gehen).
**Alternative für den Spieltag:** Das Team-Passwort steht ohnehin auf dem Ausdruck mit dem QR-Code.

### E-07 Kartenbibliothek MapLibre GL + OpenFreeMap, eigener Stil
**Entscheidung:** MapLibre GL JS mit Vektorkacheln von OpenFreeMap (`tiles.openfreemap.org`, OpenMapTiles-Schema) und
einem eigenen Stil (hell, dunkel, Sonne) im Code.
**Warum:** Kostenlos ohne Registrierung, Schlüssel, Cookies oder Limits; kommerzielle Nutzung erlaubt; Namensnennung
„OpenFreeMap © OpenMapTiles Data from OpenStreetMap“ wird von MapLibre automatisch angezeigt (Nutzungsbedingungen geprüft
am 26.10.2026). Offline-Vorladen ist bis 3 000 Kacheln erlaubt – unser Spielfeld braucht ≈ 30. Vektorkarten erlauben einen
eigenen kontrastreichen Stil, flüssiges Drehen/Zoomen und gestochen scharfe Straßennamen.
**Risiko:** OpenFreeMap ist ein Spenden-Projekt ohne Garantie → Fallback auf OSM-Rasterkacheln ist eingebaut (ein Schalter).
**Verworfen:** Leaflet + OSM-Raster (kein eigener Stil, unscharfe Schrift), Mapbox/MapTiler (Konto/Kreditkarte).

### E-08 Android: Capacitor 8 + `@capacitor-community/background-geolocation`
**Entscheidung:** Die Web-App wird mit Capacitor als Android-App verpackt. Hintergrund-Standort über das Community-Plugin
(Foreground-Service mit Dauer-Benachrichtigung, aktiv gepflegt, kostenlos).
**Warum:** Eine Codebasis; das Plugin liefert Standorte auch bei gesperrtem Bildschirm, solange die Dauer-Benachrichtigung
läuft. Die JavaScript-Seite schreibt sie wie im Web in die Datenbank.
**Verworfen:** Transistorsoft-Plugin (für Android-Release-Builds kostenpflichtige Lizenz), eigene native App (zweite Codebasis).
**Ehrlich:** Hersteller-Akku-Spar-Modi (Samsung, Xiaomi, Huawei) können auch Foreground-Services beenden – deshalb
Onboarding mit Akku-Optimierungs-Hilfe und Pflicht-Feldtest (Meilenstein 13).

### E-09 Positionen ohne Spur speichern, Distanz serverseitig
**Entscheidung:** `pos/{team}` enthält nur den letzten Punkt. `onPosition` bekommt alten + neuen Wert und addiert die
Distanz, wenn der Schritt plausibel ist (Genauigkeit ≤ 50 m, ≥ 10 m, ≤ 25 m/s).
**Warum:** Datenschutz für Minderjährige (keine Bewegungsprofile), manipulationssichere Statistik, keine zusätzlichen Lesezugriffe.

### E-10 Ein Spiel = Mandant unter `games/{spielcode}`
> **Abgelöst durch E-32** (Meilenstein 9b: Umzug auf Cloudflare, siehe `archiv/NACHRICHT-AN-FRONTEND.md`).
**Entscheidung:** Alle Daten eines Spiels liegen unter `games/{g}` (+ `secrets/{g}`); Spiel-Code ist ein lesbarer
Kurzname (`linz-2027`), der auch im QR-Link steckt und notfalls eingetippt werden kann.
**Warum:** Mehrere Spiele/Orte ohne Vermischung, einfache Löschung, einfache Rules.

### E-11 Push über FCM mit Token-Liste statt Topics
> **Abgelöst durch E-34** (Meilenstein 9b: Umzug auf Cloudflare, siehe `archiv/NACHRICHT-AN-FRONTEND.md`).
**Entscheidung:** Jedes Gerät speichert sein FCM-Token + gewählte Push-Arten unter `games/{g}/push/{uid}`; der Server
sendet gezielt (alle / ein Team / Staff) per `sendEachForMulticast`.
**Warum:** Topics können nicht nach Geräte-Einstellungen filtern. Bei < 100 Geräten pro Spiel ist die Token-Liste trivial.

### E-12 Design-Tokens als CSS-Variablen, drei Themes
**Entscheidung:** Alle Farben, Abstände, Radien, Schatten, Schriftgrößen und Animationsdauern als CSS-Custom-Properties
in `app/src/ui/tokens.css`; Themes `dunkel` (Standard im Spiel), `hell`, `sonne` (Hochkontrast) über `data-theme`.
Komponenten verwenden nur Tokens, nie feste Farbwerte.
**Warum:** Ein Ort für das ganze Design; Sonnen-Modus ist nur ein anderes Token-Set; auch die Kartenstile werden aus
denselben Werten erzeugt.

### E-13 Schriften Barlow Condensed + Inter, lokal
**Entscheidung:** `Barlow Condensed` (fett, schmal – Überschriften, Countdown, Zahlen) und `Inter` (Fließtext), beide
über `@fontsource` als Dateien im App-Paket. Ziffern mit `font-variant-numeric: tabular-nums`.
**Warum:** Agenten-/Akten-Anmutung durch schmale Großbuchstaben, sehr gute Lesbarkeit von Inter bei kleinen Größen und in
der Sonne, kein Google-Fonts-Abruf (kein Tracking, offline verfügbar).

### E-14 Icons: Lucide
**Entscheidung:** Ein Icon-Set: Lucide (`@lucide/svelte`), nur die verwendeten Icons landen im Paket.
**Warum:** Einheitlicher Strich, große Auswahl (Fahne, Radar, Funk …), freie Lizenz (ISC). Eigene Icons (Fahne) werden im gleichen Strichstil ergänzt.

### E-15 Monorepo mit npm-Workspaces, `shared/` ohne Abhängigkeiten
**Entscheidung:** `shared/` (reine Logik + Typen), `app/`, `functions/`. Die Functions werden mit esbuild zu einer Datei
gebündelt (so funktioniert `firebase deploy` mit Code aus `shared/` ohne Tricks).
**Warum:** Eine Wahrheit für Spielregeln: Countdown in der App und Meldung am Server rechnen mit derselben Funktion.

### E-16 Tests: Vitest, Rules-Unit-Testing, Playwright; CI auf GitHub Actions
> **Abgelöst durch E-36** (Meilenstein 9b: Umzug auf Cloudflare, siehe `archiv/NACHRICHT-AN-FRONTEND.md`).
**Entscheidung:** Vitest (Logik, Functions mit Emulator), `@firebase/rules-unit-testing` (Rechte inkl. Angriffsversuche),
Playwright (E2E mit simulierten Handys, Fake-GPS, Zeitraffer über verkürzte Intervalle wie im Prototyp), Lasttest als
Node-Skript gegen den Emulator. GitHub Actions: Lint, Typecheck, Tests bei jedem Push; APK-Build; Preview-Deploy.

### E-17 APK-Verteilung über Firebase Hosting
> **Abgelöst durch E-38** (Meilenstein 9b: Umzug auf Cloudflare, siehe `archiv/NACHRICHT-AN-FRONTEND.md`).
**Entscheidung:** Die signierte APK wird von GitHub Actions gebaut und beim Deploy unter `https://mr-x-ooe.web.app/app.apk`
abgelegt (+ QR-Code im Admin und auf dem Flyer).
**Warum:** Das Repository ist privat – Downloads aus GitHub-Releases bräuchten ein GitHub-Konto.

### E-18 Prototyp im echten Stack
**Entscheidung:** Der Klick-Prototyp (Meilenstein 2) wird gleich mit Svelte + den echten Komponenten gebaut und läuft mit
Testdaten unter `/#/prototyp`. Die Komponenten-Bibliothek ist unter `/#/komponenten` dokumentiert (statt Storybook).
**Warum:** Kein Wegwerf-Prototyp; was abgenommen wird, ist exakt das, was später läuft. Storybook wäre eine zusätzliche
schwere Abhängigkeit für eine Handvoll Komponenten.

### E-19 Alter Prototyp nach `legacy/`
> **Abgelöst durch E-57** (`legacy/` entfernt, alter Code nur noch im Git-Verlauf).

**Entscheidung:** Auf dem Neubau-Branch liegen die alten Dateien unter `legacy/` (nur Referenz). Die Live-Version
`https://mr-x-ooe.web.app` wird weiter vom bisherigen Branch deployt, bis der Neubau abgenommen ist.

### E-20 Antworten des Organisators (27.10.2026)
**Entscheidung:** Konzept und Design bestätigt. Übernommen: Pause-Funktion (F2), Aufbewahrung Archiv 1 Jahr / Chat 30 Tage /
Live-Standorte sofort löschen (F3), Zuschauer-Modus nur mit Meldungen (F6), Start-Mister-X auslosbar (F8),
Sofort-Meldung bei Übergabe (F10), Ersatzgerät pro Team (F14); die übrigen Fragen mit dem jeweiligen Vorschlag.
**Offen:** Vektor-Logos (F1) und Datenschutz-Kontakt (F12) – werden spätestens für Meilenstein 12 gebraucht.

### E-21 Eigene Datenbank-Instanz und Hosting-Site für den Neubau
> **Abgelöst durch E-32** (Meilenstein 9b: Umzug auf Cloudflare, siehe `archiv/NACHRICHT-AN-FRONTEND.md`).
**Entscheidung:** Der Neubau verwendet die Realtime-Database-Instanz `mr-x-ooe-neu` (europe-west1) und die Hosting-Site
`mr-x-ooe-neu` im selben Firebase-Projekt. Der Organisator legt beide einmal in der Konsole an (Blaze erlaubt mehrere
Instanzen kostenlos; Kosten zählen gemeinsam).
**Warum:** Die alte App liest und schreibt in der Standard-Instanz direkt unter `/teams`, `/game`, … und braucht ihre
eigenen Security Rules. Würden die neuen Rules in dieselbe Instanz deployt, wäre die alte App sofort kaputt. Getrennte
Instanz und Site bedeuten: Kein Befehl für den Neubau kann die laufende Version beschädigen. Umschalten nach der
Abnahme = neue App auf die Standard-Site deployen (Anleitung folgt in Meilenstein 13).
**Verworfen:** Gemeinsame Instanz mit kombinierten Rules (fehleranfällig), eigenes Firebase-Projekt (zweite Konfiguration,
zweiter Budget-Alarm, Logins doppelt).

### E-22 Emulator-Projekt `demo-mrx` für Tests
> **Abgelöst durch E-36** (Meilenstein 9b: Umzug auf Cloudflare, siehe `archiv/NACHRICHT-AN-FRONTEND.md`).
**Entscheidung:** Alle automatisierten Tests laufen gegen die Firebase-Emulatoren mit der Projekt-ID `demo-mrx`.
**Warum:** `demo-`-Projekte haben garantiert keinen Zugriff auf echte Firebase-Dienste – ein Test kann nie versehentlich
Produktionsdaten verändern, und CI braucht keine Zugangsdaten.

### E-23 Anstoßen durch die Handys (`poke`) zusätzlich zum Minuten-Takt
> **Abgelöst durch E-32** (Meilenstein 9b: Umzug auf Cloudflare, siehe `archiv/NACHRICHT-AN-FRONTEND.md`).
**Entscheidung:** Jedes Mitglied darf `api: poke` aufrufen – z. B. wenn sein Countdown abgelaufen ist. Der Server
erledigt dann nur, was wirklich fällig ist (Meldung, Spielende); alles läuft als Transaktion auf `state`, darum meldet
er auch bei 30 gleichzeitigen Aufrufen genau einmal. Der Takt (`tick`, jede Minute, wartet bis zur Sekunde) bleibt die
Sicherheit, wenn kein Handy online ist.
**Warum:** Meldungen kommen sekundengenau, auch wenn Cloud Scheduler einmal ein paar Sekunden zu spät startet. Für die
Tests („Zeitraffer“) werden Termine in der Datenbank vorverlegt und dann angestoßen – der Spiel-Server braucht dafür
keinen eigenen Test-Modus.

### E-24 Nur die Strecke wird gespeichert, alles andere wird aus den Übergaben berechnet
**Entscheidung:** `stats/{t}` enthält nur `distM`. Zeit als Mister X, Anzahl, Sieger und Zeitstrahl rechnet
`shared/results()` aus Übergaben und Pausen – am Server fürs Archiv, in der App für die Live-Rangliste.
**Warum:** Keine doppelte Buchführung: „Rückgängig“ und Pausen müssen so keine Zähler korrigieren.

### E-25 Übergabe-Kennung kommt vom Handy
**Entscheidung:** Das Handy erzeugt pro Übergabe eine zufällige `requestId`; sie ist zugleich der Schlüssel unter
`handovers/` und steht in `state.lastHandover`. Kommt dieselbe Anfrage nach einem Netzabbruch nochmal, antwortet der
Server mit dem schon gespeicherten Ergebnis.
**Warum:** Idempotenz ohne zusätzlichen Speicher (Abschnitt 9.1).

### E-26 Neue Runde nur vor dem Start oder nach dem Ende
**Entscheidung:** „Neue Runde vorbereiten“ geht nur, wenn kein Spiel läuft (sonst zuerst Notstopp). Teams und Schiris
werden abgemeldet (Hinweis auf ihrem Gerät), das Team-Passwort gelöscht; Spielleitung, Großbild, Zuschauer, Schiri-Code,
Einstellungen, Spielfeld, Protokoll und Archiv bleiben.
**Warum:** So kann ein laufendes Spiel nicht versehentlich gelöscht werden, und das Archiv entsteht immer vollständig.

### E-27 Standort adaptiv senden, Ereignisse nur ab dem Öffnen melden
**Entscheidung:** Das Handy sendet seinen Standort alle 10 s, wenn es sich mehr als 15 m bewegt hat, sonst spätestens
alle 30 s (fragt dafür im Stillstand aktiv nach). Ungenaue Punkte gehen mit ihrer Genauigkeit mit; der Server wertet.
Nach dem Spielende sendet die App nichts mehr. Ton, Vibration und Szenen gibt es nur für Ereignisse nach dem Öffnen der
App – wer neu lädt, bekommt keine alten Übergaben noch einmal vorgespielt. Der Ungelesen-Zähler zählt Nachrichten und
Durchsagen, keine System-Meldungen (die zeigt die Karte).
**Warum:** Akku schonen (Abschnitt 9.1), aber der Standort bleibt für Meldungen und Umkreis immer „frisch“ (2 Min).

### E-28 Spielfeld nur vor dem Start ändern, Prüfung an beiden Enden
**Entscheidung:** Der Zonen-Editor speichert über `api: setField`. Das geht nur vor dem Start oder nach dem Ende; im
laufenden Spiel ist der Editor schreibgeschützt (Bereiche sperren geht weiter unter „Steuerung“). Editor und Server
prüfen mit derselben Funktion (`shared/feld.ts`): mindestens 3 Punkte, keine Selbstüberschneidung, jeder Sperrbereich
schneidet das Spielfeld (≥ 1000 m²). Der Server prüft zusätzlich Form, Größe (≤ 2000 Punkte, ≤ 12 Bereiche) und Farben.
**Warum:** Ein Spielfeld, das sich mitten im Spiel verschiebt, würde Warnungen und Sperren für alle verändern.

### E-29 Archivieren und Löschen
**Entscheidung:** „Archivieren“ (nur Organisator, nicht im laufenden Spiel) lässt alle Daten lesbar, sperrt aber jeden
neuen Beitritt („Dieses Spiel ist archiviert“); es lässt sich reaktivieren. „Löschen“ entfernt das Spiel samt Archiv,
Passwörtern und Index endgültig; angemeldete Geräte bekommen den freundlichen Hinweis „entfernt“. Der Organisator kann
jedes Spiel ohne Admin-Passwort als Spielleitung öffnen.

### E-30 Push: eigener schlanker Service Worker, Versand nur am Server
> **Abgelöst durch E-34** (Meilenstein 9b: Umzug auf Cloudflare, siehe `archiv/NACHRICHT-AN-FRONTEND.md`).
**Entscheidung:** Benachrichtigungen verschickt ausschließlich der Spiel-Server (`functions/src/push.ts`) mit dem
Firebase Admin SDK; die Geräte legen nur ihren Token und die gewünschten Arten unter `games/{g}/push/{uid}` ab.
Im Web sind es reine Daten-Nachrichten, die ein eigener kleiner Service Worker (`app/public/sw.js`) anzeigt – nicht
doppelt, wenn die App gerade sichtbar ist. Android-Geräte (Meilenstein 9) bekommen zusätzlich eine
System-Benachrichtigung. Ungültige Tokens werden beim Senden gelöscht. Im Emulator gibt es kein FCM: dort landet jede
Benachrichtigung im Postausgang `pushOutbox/{g}`, so prüfen die Tests die Empfänger.
**Warum:** Kein Gerät kann anderen Pushes schicken (Fälschungssicherheit), ein Service Worker ohne Offline-Cache
verhindert veraltete App-Versionen, und die Empfängerauswahl ist als reine Funktion (`shared/push.ts`) getestet.

### E-31 Android-App mit Capacitor, Web-Inhalte in der APK
> **Abgelöst durch E-34** (Meilenstein 9b: Umzug auf Cloudflare, siehe `archiv/NACHRICHT-AN-FRONTEND.md`).
**Entscheidung:** Die Android-App packt die gebaute Web-App in die APK (keine Fernladung von der Website). Nativ
ergänzt werden nur: Standort über `@capacitor-community/background-geolocation` (Vordergrund-Dienst mit
Dauer-Benachrichtigung), Senden per nativem HTTP an die REST-Schnittstelle der Datenbank (gleiche Rules, ID-Token),
Push über `@capacitor/push-notifications` und ein eigenes 30-Zeilen-Plugin „Akku“ für den Dialog
„Akku-Optimierung ausschalten“. Signiert wird ausschließlich in GitHub Actions mit Secrets.
**Warum:** Kostenlos und ohne Play Store verteilbar; das Netzwerk der WebView wird von Android im Hintergrund nach
einigen Minuten gedrosselt, natives HTTP nicht. Kommerzielle Hintergrund-Standort-Plugins wären für Release-Builds
kostenpflichtig.
**Verworfen:** App lädt die Website (`server.url`) – von Capacitor nicht für den Produktivbetrieb vorgesehen.

---

## Meilenstein 9b: Umzug auf Cloudflare

### E-32 Cloudflare statt Firebase: ein Worker, ein Spielraum (Durable Object) pro Spiel, D1
**Entscheidung:** Auf Wunsch des Organisators (`archiv/NACHRICHT-AN-FRONTEND.md`) läuft der Neubau komplett bei Cloudflare im
**Gratis-Tarif ohne Zahlungsart**. Ein **Worker** liefert die App (Static Assets) und die API unter derselben Adresse aus
und leitet weiter. **Ein Durable Object pro Spiel** („Spielraum“, `server/src/room.ts`, SQLite-Speicher) hält den ganzen
Spielzustand im Speicher, ist die einzige Stelle, die ihn ändert, verteilt Änderungen über WebSockets (Hibernation) und
weckt sich per **Alarm** für Meldungen, Wartezeiten, Spielende und Löschfristen – auch ohne ein einziges Handy online.
**D1** hält nur spielübergreifende Daten: Spieleliste der Verwaltung und Archiv. Ein kleines zweites Durable Object
(`Zentrale`) verwaltet das Organisator-Passwort. Ein täglicher Cron löscht nach Frist (Chat im Archiv 30 Tage, Archiv 1 Jahr).
**Warum:** Ein Anbieter für alles, keine Kreditkarte; Durable Objects verarbeiten alles eines Spiels nacheinander – die
Transaktionen und der Minuten-Takt aus E-03/E-04/E-23 entfallen, Meldungen kommen sekundengenau per Alarm.
**Abweichungen von `archiv/PROMPT-BACKEND.md`, begründet:**
- **Befehle per HTTP (`POST /api`), Live-Daten per WebSocket.** Befehle brauchen eine Antwort und sichere Wiederholung
  (Kennung `rid`) – das ist mit HTTP einfacher und robuster als eigene Antwort-Zuordnung im WebSocket; Standorte gehen über
  die ohnehin offene Verbindung.
- **Spiel-Admins** bekommen weiterhin ein Admin-Passwort pro Spiel (wie bisher in der App), keine eigenen Konten.
- **Zonen-Vorlage „Linz Innenstadt“** bleibt im Code (`shared/vorlagen/linz.ts`), nicht in D1 – es gibt nur eine.
- **Tracker-Schnittstelle** folgt in Meilenstein 11.
**Verworfen:** Cloudflare Pages (Worker mit Static Assets ist der aktuelle Weg und hält App + API zusammen), KV für
Rate-Limits (im Spielraum gezählt, ohne extra Produkt), Tabellen-Migrationen per Befehl (der Server legt die zwei
D1-Tabellen beim ersten Zugriff selbst an – ein Schritt weniger für den Organisator).

### E-33 Anmeldung: Sitzungs-Tokens, PBKDF2, Organisator mit Setup-Geheimnis
**Entscheidung:** Kein externer Login-Anbieter. `join` prüft Passwort/Code im Spielraum und gibt ein **HMAC-signiertes
Token** zurück (Spiel + Gerätekennung, gültig 7 Tage). **Widerrufen** wird über die Mitgliedschaft: entfernt, neue
Runde, abgemeldet oder neues Admin-Passwort → die Gerätekennung ist im Spielraum unbekannt, jede Anfrage und jede
Verbindung bekommt „Sitzung abgelaufen“. Passwörter und Codes werden mit **PBKDF2-SHA-256, 100 000 Runden** und Salz
gehasht (das ist das Maximum der Cloudflare-Laufzeit; ≈ 12 ms, deshalb im Spielraum statt im Worker mit 10 ms
CPU-Grenze). Der **Organisator** legt sein Passwort einmalig mit dem **Setup-Geheimnis** (Wrangler-Secret) fest;
dasselbe Geheimnis setzt ein vergessenes Passwort zurück und macht dabei alle alten Organisator-Sitzungen ungültig
(Passwort-Version im Token). Rate-Limits: 20 falsche Beitritte je IP und Spiel in 10 Min (großzügig wegen Carrier-NAT),
5 falsche Organisator-Passwörter je IP in 10 Min.
**Warum:** Keine E-Mail-Konten für Kinder/Jugendliche, kein Google-Konto nötig, Sitzungen sofort widerrufbar.
**Verworfen:** JWT-Bibliothek (HMAC mit WebCrypto sind 20 Zeilen), kurze Token-Laufzeit mit Erneuerung (Widerruf läuft
ohnehin über die Mitgliedschaft; Spielleitungen richten Spiele oft Tage vorher ein).

### E-34 Push: Web Push mit eigenem VAPID-Schlüssel, Android lokal, keine Doppelungen
**Entscheidung:** **Web Push** (Browser, iPhone-Web-App ab iOS 16.4) verschlüsselt der Server selbst nach RFC 8291 und
unterschreibt nach RFC 8292 (VAPID) – gut 100 Zeilen WebCrypto in `server/src/webpush.ts`, geprüft mit dem Beispiel aus dem
Standard. Die **Android-App** nutzt kein Firebase mehr: Benachrichtigungen kommen über die Live-Verbindung (`note`) und
werden lokal angezeigt (`@capacitor/local-notifications`); verpasste kommen mit der Antwort auf den nächsten
Hintergrund-Standort (`/api/pos`). Geräte mit **sichtbarer App** bekommen keinen Web-Push (`vis`), weil sich die App
selbst mit Ton/Vibration meldet. Höchstens 40 Pushes pro Aufruf (Gratis-Grenze 50 Unteranfragen), der Rest im nächsten
Alarm. Abgelaufene Abos (404/410) werden gelöscht.
**Warum:** Kein Google-Konto, keine `google-services.json`, keine Kosten; vom Organisator so bestätigt (Android nur lokal).
**Verworfen:** Bibliothek `web-push` (braucht Node-Krypto, läuft nicht im Worker), Web Push zusätzlich in der Android-WebView
(doppelte Benachrichtigungen, kein Mehrwert, solange die App im Vordergrund-Dienst läuft).

### E-35 Live-Protokoll: Snapshot + Änderungen, nach Rolle gefiltert
**Entscheidung:** Beim Verbinden bekommt jedes Gerät einen **Snapshot** seiner Sicht, danach nur **Änderungen**
(`[Teil, Kennung, Wert]`), jede Nachricht mit fortlaufender Nummer und Server-Zeit; bei einer Lücke holt die App einen
neuen Snapshot. Gefiltert wird **jede** Änderung pro Verbindung nach der Rolle (`#filter` in `room.ts`) – Teams bekommen
fremde Positionen nie, auch nicht versteckt. Standorte werden gesammelt (höchstens alle 2 s verteilt, alle 30 s
gespeichert). Herzschlag `ping`/`pong` beantwortet die Laufzeit selbst, ohne den Spielraum aufzuwecken.
Protokollversion: alte Apps werden freundlich zum Neuladen aufgefordert.
**Warum:** Sparsam (siehe `CLOUDFLARE-LIMITS.md`), einfach im Client (`shared/client.ts`, rund 150 Zeilen, ohne Framework),
und die Rechte stehen an genau einer Stelle.

### E-36 Tests gegen die lokale Cloudflare-Laufzeit, ohne Workers-Test-Pool
**Entscheidung:** Server-, Rechte- und Ende-zu-Ende-Tests starten den echten Worker mit `createTestHarness` aus
`wrangler` (workerd, Spielräume, D1, Alarme, Cron) und sprechen ihn über HTTP/WebSocket an – wie die App. Nur mit der
Variable `TEST_HOOKS=1` (nie in `wrangler.jsonc`) gibt es `/__test/…` zum Lesen/Ändern des Spielraums („Zeitraffer“) und
einen Push-Postausgang statt Versand. Ein eigener Test legt den Spielraum gezielt schlafen (Hibernation) und prüft, dass
Spielstand, Verbindungen und Alarme das überstehen.
**Warum:** `@cloudflare/vitest-pool-workers` verlangt Vitest 4.1, das Projekt nutzt Vitest 5. Über HTTP/WebSocket zu
testen prüft außerdem genau das, was die App erlebt.

### E-37 Android im Hintergrund: Standort per HTTP alle 30 s
**Entscheidung:** Ist die Android-App im Hintergrund, sendet sie per nativem HTTP an `/api/pos` und nur alle 30 s
(sonst alle 10–30 s über die Verbindung). Die Adresse des Servers kommt beim Bauen der APK aus `VITE_API_URL`
(Repository-Variable `MRX_API_URL`, Standard `https://mister-x.mr-x-ooe.workers.dev`); der Server erlaubt dafür die
Herkunft `https://localhost` (CORS).
**Warum:** Android drosselt das Netzwerk der WebView im Hintergrund; 30 s halten den Standort frisch (Meldungen nehmen
Standorte bis 2 Min) und lassen bei 30 Teams genug Reserve im Tageslimit.

### E-38 APK-Verteilung
**Entscheidung:** Die signierte APK baut GitHub Actions (Release). Ohne GitHub-Konto für die Teams: die APK nach
`app/public/mister-x.apk` legen und veröffentlichen → `https://…workers.dev/mister-x.apk` (Static Assets, kostenlos,
nie im Repository; Anleitung `BETRIEB.md` Schritt 9).

---

## Meilenstein 10: Großbild, Zuschauer, Archiv

### E-39 Großbild und Zuschauer: eine Ansicht, Daten vom Server gefiltert
**Entscheidung:** Großbild und Zuschauer-Ansicht sind derselbe Screen (`BigScreen.svelte`); der Unterschied kommt allein
aus dem, was der Server der Rolle schickt: dem Zuschauer fehlen Live-Positionen und Chat (also auch Durchsagen). Der
Ereignis-Ticker wird deshalb aus Meldungen, Übergaben und Verkleinerungen gebaut, nicht aus dem Chat. Auf schmalen
Bildschirmen (Eltern am Handy) stapelt sich die Ansicht untereinander. Die Spielleitung kann das Großbild direkt auf
ihrem eigenen Gerät öffnen (`/#/grossbild`, z. B. Laptop am Beamer) und kommt mit einem Knopf zurück – ohne zweites
Gerät oder Großbild-Link. Nach dem Spielende rechnet die Ansicht die Auswertung mit derselben Funktion wie der Server
(`shared/results`), weil Zuschauer das Archiv nicht lesen dürfen (es enthält den Chat). Eine Durchsage steht 60 s groß
da und lässt sich antippen und ausblenden.
**Warum:** Ein Screen, eine Rechte-Stelle (Server), keine „versteckten“ Daten im Zuschauer-Gerät.

### E-40 Wiederholung im Gerät, Export als Datei und Druck
**Entscheidung:** Die Wiederholung lädt einen Archiv-Lauf einmal (`archiveGet`) und rechnet jede Reglerstellung im
Gerät aus (`shared/replay.ts`, mit Unit-Tests): Spur des damaligen Mister X seit der letzten Übergabe, Fangorte,
gesperrte Bereiche. „Als Datei sichern“ lädt den Lauf als JSON herunter (Sicherung, Weitergabe), „Drucken“ druckt
Auswertung und Chat ohne Karte (der Browser kann daraus ein PDF machen).
**Verworfen:** Bild/PDF der Karte erzeugen (die WebGL-Karte müsste dafür dauerhaft langsamer zeichnen; nice-to-have
laut Auftrag) – ein Bildschirmfoto der Wiederholung erfüllt denselben Zweck.

---

## Meilenstein 11: Tracker

### E-41 Tracker über das OsmAnd-Protokoll, Kennung = Spiel-Code + Schlüssel
**Entscheidung:** Externe Geräte senden an `/tracker` im **OsmAnd-Protokoll** (Parameter oder Formular; zusätzlich das
JSON des neuen Traccar Client) – das sprechen die kostenlose App „Traccar Client“ und viele 4G-Tracker, ohne eigenen
Traccar-Server. Die **Geräte-Kennung** ist `{spiel-code}.{schlüssel}`: der Worker findet daran den Spielraum ohne
Datenbank-Abfrage, der Spielraum prüft den Schlüssel in konstanter Zeit. Zuordnung durch die Spielleitung: **Fahne**
(erste Quelle für Meldungen und Übergabeort, archiv/IDEEN.md) oder **Team** (ersetzt das Handy, solange der Tracker frisch
sendet) oder frei (nur zum Testen sichtbar). Höchstens ein Punkt alle 5 s pro Gerät, höchstens 20 Geräte pro Spiel.
Datenschutz wie bei Handys: Tracker-Standorte sehen nur Spielleitung, Schiri und Großbild; bei Spielende gelöscht;
„Neue Runde“ hebt Team-Zuordnungen auf (die Teams gibt es nicht mehr), die Fahne bleibt.
**Warum:** Kein Hardware-Kauf nötig, um es auszuprobieren (altes Handy + Traccar Client), keine zusätzlichen Kosten,
dieselbe Plausibilitätsprüfung und Strecke wie für Handys.
**Verworfen:** eigener Traccar-Server (≈ 5 €/Monat, archiv/IDEEN.md), Tracker-Token als eigene Sitzung (ein Geräteschlüssel
in der Kennung ist alles, was Traccar Client übertragen kann).

---

## Meilenstein 12: Härtung

### E-42 Nachladen statt einer großen Datei, gemeinsame Teile gebündelt
**Entscheidung:** Spielleitung (inkl. Spielfeld-Editor), Großbild, Archiv, Verwaltung und der Klick-Prototyp werden
erst geladen, wenn sie gebraucht werden (`{#await import(…)}`); Team-Handys laden nur Start, Beitritt und ihre
Spielansicht. Gemeinsam genutzte Module fasst eine Bündel-Regel (`app/vite.config.ts`) in **eine** Datei zusammen.
Ergebnis: Startseite ≈ 102 statt 132 KB JavaScript (gzip); Lighthouse mobil 96/100/100, erste Anzeige ≈ 2,2 s.
**Warum:** Kinder-Handys mit schwachem Mobilfunk. Ohne die Bündel-Regel entstanden ≈ 20 Mini-Dateien, die über
langsame Verbindungen sogar langsamer waren als vorher (gemessen).
**Verworfen:** die Kartenbibliothek nicht nachladen (sie war schon vorher eigene Datei und kommt erst mit der Karte).

### E-43 Datensparsamkeit nachgeschärft
**Entscheidung:** Das Protokoll der Spielleitung (enthält Namen) wird wie der Chat 30 Tage nach Spielende und bei
„Neue Runde“ gelöscht; Prüfsummen von IP-Adressen (Schutz gegen Passwort-Raten) nur so lange wie die Sperre (10 Min).
Vollständiger Datenschutzhinweis (Art. 13 DSGVO, kindgerecht formuliert) in der App unter Regeln → Datenschutz.
**F12:** Verantwortlicher ist seit E-64 der Organisator selbst.

### E-44 Android-App von der Startseite
> **Erweitert durch E-58** (Download-Knopf für alle Systeme, `downloads.json` statt HEAD-Anfrage).
**Entscheidung:** Liegt `mister-x.apk` am Server (BETRIEB.md Schritt 9), zeigt die Startseite im Android-Browser
„Android-App installieren“. Ob die Datei da ist, prüft die Seite mit einer HEAD-Anfrage (fehlt sie, liefert der Server
die App-Seite als HTML – dann kein Knopf). Der Flyer erklärt beide Wege.
**Warum:** Teams scannen ohnehin den QR-Code – so kommen sie ohne GitHub-Konto und ohne extra Link zur App, die den
Standort auch bei gesperrtem Bildschirm sendet.

### E-45 Barrierefreiheit automatisch geprüft
**Entscheidung:** `tests/barrierefreiheit.test.ts` prüft mit axe-core jeden Screen in jeder Variante in dunkel, hell
und Sonne (WCAG 2.1 A/AA plus axe-Empfehlungen). Gefundene Mängel wurden behoben (Kontraste der Team-Abzeichen,
gedämpfte Schrift, Seitenbereiche, Überschriften). Im Modus „Bewegung reduzieren“ gibt es keine Übergänge mehr.
**Warum:** Kontraste draußen in der Sonne sind Spielqualität, nicht Kür – und ein Test verhindert Rückschritte.

### E-46 Eigene Regeln der Spielleitung als einfacher Text
**Entscheidung:** Unter Steuerung → „Regeln für die Teams“ schreibt die Spielleitung bis zu 2000 Zeichen eigene
Regeln und Hinweise (Abschnitt 7.11). Formatierung ohne HTML: Leerzeile = neuer Absatz, Zeile mit „- “ = Aufzählung,
`**fett**`. Alle sehen den Text ganz oben im Tab „Regeln“; ändert die Spielleitung ihn während des Spiels, bekommen alle
eine Meldung. Der Text wird nie als HTML eingesetzt (`shared/src/regeltext.ts` zerlegt ihn nur in Textstücke).
**Warum:** Treffpunkt, Verbote, Notfallnummer ändern sich von Spiel zu Spiel – das soll ohne Programmierer gehen.
Eingaben als HTML wären ein Einfallstor für Schadcode auf allen Kinder-Handys.
**Verworfen:** Markdown-Bibliothek oder Text-Editor mit Knöpfen (zusätzlicher Code für drei Formatierungen).

### E-47 Android-App automatisch im Emulator geprüft
**Entscheidung:** Ein CI-Job (`.github/workflows/android.yml`, Job „emulator“) installiert die Test-APK in einem
Android-14-Emulator und spielt gegen den lokalen Spiel-Server: App offen → Hintergrund → Spielstart → Bildschirm aus →
Durchsage ([`tests/android-geraet.mjs`](../tests/android-geraet.mjs), Ablauf in [`ANDROID-APK.md`](ANDROID-APK.md)
Abschnitt 5). Der Test fand vier Fehler, die im Browser nicht auftreten – alle behoben:
1. Jeder Phasenwechsel (Warteraum → Spiel) startete das GPS neu. Liegt das Handy dann schon gesperrt in der Tasche,
   darf Android den Vordergrund-Dienst nicht wieder starten – es kämen keine Standorte mehr. Jetzt läuft GPS vom
   Beitritt bis zum Spielende durch (Browser-Test zählt die GPS-Starts).
2. In der Capacitor-WebView bleibt `document.visibilityState` auch im Hintergrund „visible“. Die App zeigte
   Benachrichtigungen deshalb nur in der App und nutzte den robusten Hintergrund-Weg (natives HTTP) nie. Jetzt erkennt
   sie den Hintergrund an den Capacitor-Ereignissen `pause`/`resume` (`app/src/lib/sichtbar.ts`).
3. Die App hing über EmojiCompat am Schriften-Dienst von Google Play und wurde mitbeendet, wenn Google Play abstürzte.
   Die Emoji-Initialisierung ist abgeschaltet (die App zeigt alles in der WebView an).
4. Das Benachrichtigungs-Plugin plant jede Benachrichtigung standardmäßig als „exakten Alarm“ und öffnet ab
   Android 12 dafür erst die Einstellungen „Alarme & Erinnerungen“ – aus dem Hintergrund blockiert Android das, die
   Benachrichtigung erschien nie. Benachrichtigungen werden jetzt sofort angezeigt (`isExactNotification: false`).

**Warum:** Die Definition of Done verlangt den Nachweis „im Test oder Feldtest-Protokoll“; ein echtes Handy gibt es in
der Entwicklungsumgebung nicht. Der Feldtest bleibt für Hersteller-Eigenheiten (Akkusparen bei Samsung, Xiaomi, Huawei).
**Kosten:** ≈ 20 Min GitHub-Rechenzeit pro Lauf, nur bei Änderungen an App, Server oder `shared/`. Das Repository ist
privat: die Minuten kommen aus den 2000 Gratis-Minuten im Monat; ohne hinterlegte Zahlungsart entstehen keine Kosten,
sind sie aufgebraucht, laufen die Jobs erst im nächsten Monat wieder.

### E-48 Web Push über echte Push-Dienste geprüft
**Entscheidung:** `tests/push-dienst.mjs` (CI-Job „push-dienst“) startet den Spiel-Server wie im Betrieb (ohne
Testmodus, eigener VAPID-Schlüssel; er liefert auch die gebaute App aus) und lässt die Spielleitung Durchsagen schicken.
Der Spielraum verschlüsselt sie per Alarm und schickt sie
- an **Mozillas** Push-Dienst: das Skript meldet sich wie Firefox per WebSocket an und entschlüsselt die Nachricht,
- an **Googles** Push-Dienst: echtes Google Chrome installiert die echte App (DevTools-Protokoll `PWA.install`, wie
  „App installieren“) und öffnet sie; sie legt ihr Abo selbst an, und bei geschlossener App zeigt ihr Service Worker die
  Durchsage als Benachrichtigung. Ohne Bildschirm öffnet Chrome installierte Apps ohnehin als Tab statt im eigenen
  Fenster, der Test öffnet sie darum gleich im Tab – Abo, Service Worker und Push sind dieselben.

Gefunden dabei: Google antwortet auf ein Abo, das erst Sekunden alt ist, gelegentlich mit 410 („Abo ungültig“), obwohl
Chrome es weiter hat. Der Server vergaß solche Abos sofort – das Team hätte bis zum nächsten App-Start keine
Benachrichtigung mehr bekommen. Jetzt behält er Abos, die jünger als 5 Minuten sind; der Test schickt dann wie im Spiel
eine weitere Durchsage (höchstens drei). Jeder Push steht mit der Antwort des Dienstes im Protokoll („Push 201 …“).

Damit ist auch der Versandweg im Server geprüft, der im Testmodus der übrigen Tests nur protokolliert wird.
**Warum:** Die Definition of Done verlangt, dass Push auf der installierten Web-App ankommt. Chromium ohne
Google-Schlüssel (der Testbrowser) kann kein Push-Abo anlegen, Google Chrome schon; die Erlaubnis für Benachrichtigungen
steht dafür im Chrome-Profil (Chromes Push prüft die Profil-Einstellung, nicht die Test-Vorgabe). Apples Dienst
(iPhone) braucht ein echtes Gerät und bleibt dem Feldtest – alle drei arbeiten nach denselben Standards
(RFC 8030, 8291, 8292).

### E-49 Auszeichnung „Futter-Profi“ (Essens-Orte)
**Entscheidung:** Das Spielfeld kann Essens-Orte haben (Name, Punkt, Umkreis 15–100 m, Standard 40 m; im
Spielfeld-Editor unter „Essens-Orte“). Bleibt ein Team mindestens 10 Minuten am selben Ort (Standort genauer als 40 m,
keine Lücke über 3 Minuten), zählt ein Besuch. Bei der Siegerehrung gewinnt, wer die meisten Besuche hat; bei
Gleichstand die längere Zeit dort. Die Vorlage „Linz Innenstadt“ bringt sechs Orte mit (McDonald's Bahnhofplatz,
Landstraße, Taubenmarkt; Dunkin' Stelzhamerstraße; KFC Annagasse; Subway Landstraße – Koordinaten aus
OpenStreetMap, abgerufen am 2.11.2026).
**Warum so:** Gespeichert werden nur Zählerstände (Besuche, Minuten) im Geheimbereich des Spielraums, nie ein
Standort; wer gerade wo ist, steht nur im Arbeitsspeicher. Nach der Auswertung werden die Zählerstände gelöscht.
Die Datenschutzhinweise nennen das.

### E-50 Spielleitung blendet die Jäger für Schiris aus
**Entscheidung:** Schalter in der Steuerung („Schiris sehen die Jäger live“, Standard an; Einstellung
`refereeHunters`). Aus: Schiris bekommen nur noch den Standort von Mister X (dazu andere Schiris und sich selbst);
Tracker von Jäger-Teams ohne Standort. Der Server filtert das – im Snapshot und in jeder Änderung –, beim Umschalten
und bei jedem neuen Mister X bekommen die Schiris die Liste komplett neu. Beim Schiri steht dann „Jäger ausgeblendet
(Spielleitung)“ statt der nächsten Jäger. Die Wartezeit nach einem Fang rechnet weiter der Server mit allen Standorten.

### E-51 Ergänzungen nach dem ersten echten Spiel (WhatsApp-Chat ausgewertet)
**Entscheidung:** Zehn Funktionen, die direkt aus den Problemen im WhatsApp-Chat kommen:
- **Sperrgebiet-Warnung für alle Teams:** Jäger bekommen „Ihr steht im Sperrgebiet (Norden)! Bitte sofort raus.“
  bzw. „außerhalb des Spielfelds“ mit Ton/Vibration; Mister X ebenso (bisher nur „außerhalb“). Die Spielleitung sieht
  es in den Warnungen.
- **Kompass** (eigener Reiter): Pfeil zur letzten Meldung bzw. beim Sammelruf zum Treffpunkt, dreht sich mit dem
  Handy (`deviceorientationabsolute`, iPhone `webkitCompassHeading` nach Erlaubnis per Tipp); ohne Kompass
  Laufrichtung aus dem GPS bzw. Norden oben. Entfernung, Himmelsrichtung, „In Google Maps öffnen“.
- **Teamgröße** beim Beitritt (1–99, freiwillig), änderbar durch das Team und die Spielleitung; Summe in „Teams“.
- **Team aufteilen** (Spielleitung): neues Team mit gewählten Handys; Wartezeit und Personen werden mitgenommen,
  die Handys bekommen sofort einen frischen Stand.
- **Endphase:** zu Beginn des Spielende-Fensters automatisch Durchsage + Push „spätestens um …“ (einmal).
- **Notfall-Knopf** (SOS auf der Karte und unter „Mehr“): Spielleitung und Schiris bekommen eine nicht abschaltbare
  Meldung mit Standort (Google-Maps-Link), „Erledigt“; das Team kann einen Fehlalarm zurücknehmen. Andere Teams sehen
  nichts. Gelöscht mit dem Chat (Löschfrist).
- **Sammelruf:** Spielleitung ruft alle zum Treffpunkt (Spielfeld-Editor, sonst Spielfeldmitte) – auch nach dem Ende.
  Ankunft automatisch im Umkreis von 60 m (solange Standorte gesendet werden), per „Wir sind da“ oder durch die
  Spielleitung; Kopfzählung nach Teams und Personen.
- **Warnungen** für die Spielleitung zusätzlich bei Akku unter 15 %; neue Warnungen kommen als Hinweis mit Ton.
- **Vorlagen:** Regeln, Regeltext, Durchsage-Vorlagen und Spielfeld (mit Essens-Orten und Treffpunkt) als Vorlage
  speichern (D1-Tabelle `templates`, wird automatisch angelegt) und vor dem Start laden.
- **Durchsage-Vorlagen:** feste Vorschläge aus dem echten Spiel + eigene (höchstens 20) – antippen füllt den Text.
- **Probelauf:** vor dem Start einschaltbar; das Spiel läuft normal, die Auswertung gibt es, im Archiv erscheint es
  nicht (Kennung `probe-…`), mit der neuen Runde wird es gelöscht.

### E-52 QR-Codes scannen in der App und drei Druckblätter
**Entscheidung:** Startseite, „Team beitreten“ und die Schiri-/Spielleitungs-Anmeldung haben einen Knopf
„QR-Code scannen“: Kamera direkt in der App (Web und Android-App, ohne Kamera-App), erkannt mit dem eingebauten
BarcodeDetector bzw. jsQR (iPhone, Laptop). Mister-X-Links von jeder Adresse und reine Spiel-Codes führen auf die
passende Seite (`routeFromQr`), fremde Codes werden abgelehnt. Die QR-Codes enthalten **nur den Weg zur Anmeldung mit
dem Spiel-Code** – Name, Personenzahl und Passwort tippt man selbst (Wunsch der Spielleitung, aus Sicherheit).
Unter „Zugänge“ gibt es drei A4-Druckblätter (Teams, Schiris, Spielleitung) mit QR-Code, Spiel-Code, Passwort bzw.
Code, Notfall-Telefon und Anleitung. Das Passwort kommt aufs Blatt, wenn es gerade festgelegt wurde (nur im
Arbeitsspeicher des Fensters), sonst wird es beim Drucken eingetippt und vom Server geprüft (`checkSecret`: nur
Spielleitung, nur „stimmt/stimmt nicht“, höchstens 10 Versuche pro Minute).
**Warum so:** Passwörter liegen nur als Prüfsumme am Server und in keinem QR-Code, Link, Browser-Speicher oder
Quelltext. Ein zwischenzeitlich gebauter Zugang per Schlüssel im QR-Code (ohne Passwort) wurde wieder entfernt: Ein
Foto des Spielleitungs-Codes hätte zum Steuern des Spiels gereicht. Die QR-Links nennen immer die öffentliche Adresse
(in der Android-App `VITE_API_URL`, nicht „localhost“). Die Android-App braucht die Kamera-Berechtigung (fragt beim
ersten Scannen).

### E-53 Übergabe durch Teams (pro Team freigegeben)
**Entscheidung:** In der Steuerung gibt die Spielleitung einzelne Teams frei (Schalter pro Team, dazu „Alle
freigeben/sperren“). Ein freigegebenes Team bestätigt, **wenn es Mister X ist**, seinen eigenen Fang: „Wir wurden
gefangen“ → fangendes Team wählen → bestätigen. Der Server lässt das nur für das aktuelle Mister-X-Team zu (Prüfung
`expectedMrx`), nur als Fang (keine Strafübergabe) und nicht für Rückgängig; im Protokoll steht „<Team> (Mister X)“.
**Warum so:** Nicht überall ist ein Schiri dabei. Dass das gefangene Team bestätigt, ist fair: Niemand kann sich die
Fahne selbst holen.

### E-54 Prüfung selbst gemeldeter Übergaben
**Entscheidung:** Meldet Mister X den eigenen Fang (E-53), vergleicht der Server die letzten Standorte von Mister X und
Fänger. Sind sie über 150 m (plus GPS-Genauigkeit beider, je höchstens 100 m) auseinander oder fehlt ein aktueller
Standort, gilt die Übergabe trotzdem, wird aber mit `pruefen` markiert: Spielleitung und Schiris bekommen „Übergabe
prüfen“ (Push), die Spielleitung eine Warnung; das Protokoll nennt den Abstand.
**Warum so:** GPS in Häuserschluchten ist ungenau – ein hartes Ablehnen würde echte Fänge verhindern. Missbrauch soll
auffallen, entscheiden und rückgängig machen kann die Spielleitung.

### E-55 Update-Hinweis und automatisches Deploy
**Entscheidung:** Web-App und APK tragen die Build-Kennung (Commit) und legen `version.json` ab. Die Android-App fragt
beim Start (natives HTTP) nach dem Stand am Server und zeigt bei einem anderen Stand „Neue Version – Jetzt
installieren“ (Link auf `/mister-x.apk`). Der Workflow „Deploy“ baut bei jedem Push auf den Standard-Branch APK und Web-App aus
demselben Stand und veröffentlicht mit wrangler; Zugang über die Secrets `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`,
die D1-ID wird über den Namen nachgeschlagen (steht nicht im Repository). APK-Versionsnummer = Minuten seit 1970.
**Warum so:** Bisher musste jede Änderung von Hand gebaut, kopiert und veröffentlicht werden, und Teams spielten mit
alten APKs. Ohne Secrets veröffentlicht der Workflow nichts (nur Hinweis).

### E-56 Sprachen der Team-Oberfläche
**Entscheidung:** Deutsch bleibt die Grundlage (`texte.ts`). Englisch, Türkisch und Bosnisch/Kroatisch/Serbisch
(Latein, ijekavisch) überschreiben die Texte, die Teams sehen (`texte/*.ts`, typgeprüft gegen `texte.ts`), geladen
vor allen Seiten (`lib/sprache.ts`, nur die gewählte Sprache wird nachgeladen). Wahl auf der Startseite und in den
Einstellungen, gespeichert im Gerät. Spielleitung, Schiris, Großbild und der Datenschutz-Hinweis bleiben deutsch;
Meldungen vom Server (Chat, Text der Benachrichtigungen) ebenso – nur die Benachrichtigungs-Titel der Android-App sind
übersetzt.
**Warum so:** Kinder und Eltern, die besser in einer anderen Sprache lesen, verstehen Beitritt, Regeln und Bedienung.
Die Übersetzungen sollte vor dem ersten Einsatz jemand mit der jeweiligen Muttersprache durchsehen.

### E-57 Aufräumen: kein „Neubau“ mehr
**Entscheidung:** Die App ist nicht mehr der Neubau neben einer alten Version, sondern Mister X selbst. Der alte
Firebase-Prototyp (`legacy/`, `.firebaserc`) ist entfernt und nur noch im Git-Verlauf. Auftrag und Planung von damals
(`PROMPT-NEUBAU.md`, `PROMPT-BACKEND.md`, `NACHRICHT-AN-FRONTEND.md`, `SPEC.md`, `IDEEN.md`) liegen in `docs/archiv/`.
Promo-Material ist in `videos/`, `bilder/` und `quellen/` sortiert; die README beschreibt die App statt des Umbaus.
Sicherung des Stands davor: Branch `sicherung-vor-aufraeumen`.
**Warum so:** Im Hauptordner lag Planungsmaterial zwischen dem Code, und die README erklärte einen Umbau, der fertig ist.

### E-58 Desktop-App mit Tauri, Download-Knopf passend zum Gerät
**Entscheidung:** Für Organisator, Spielleitung und Großbild am Laptop gibt es eine Desktop-App mit **Tauri 2**
(zuerst Windows als NSIS-Setup `.exe`, danach macOS `.dmg` und Linux `.deb`). Die App ist eine schlanke Hülle, die
die **Live-Web-App vom Server lädt** – anders als die APK (E-31). Die Startseite und die Logins am Laptop zeigen einen
Download-Knopf für das erkannte System (`shared/src/geraet.ts`); welche Dateien am Server liegen, steht in
`/downloads.json`, die beim Bauen aus `app/public` entsteht. Das ersetzt die HEAD-Prüfung aus E-44. Details und
Phasen: `docs/DESKTOP-APP.md`.
**Warum so:** Tauri-Installer sind wenige MB groß und passen unter die 25-MiB-Grenze für Dateien am Worker – so kommt
die App wie die APK ohne GitHub-Konto von der eigenen Adresse (Electron: 80–150 MB). Live laden heißt: gleiche
Adresse wie die Website (keine CORS-Erweiterung, Einladungslinks stimmen) und kein Versionsversatz, obwohl die
Desktop-Builds wegen der teuren macOS-Minuten nur bei Versions-Tags laufen. E-31 verwarf das Fernladen nur für
Capacitor und die Hintergrund-Drosselung von Android; ein Live-Spiel braucht ohnehin Netz.
**Verworfen:** Electron (zu groß für den Worker), nur PWA-Installation (keine `.exe`, kaum Zugriff auf Monitore und
Benachrichtigungen), MSI (lehnt die Version `2.0.0-beta.1` ab), AppImage (≈ 80 MB).

### E-59 Desktop-App: Großbild auf dem Beamer, Benachrichtigungen, Versionshinweis
**Entscheidung:** Nur in der Desktop-App (E-58) gibt es drei Zusatzfunktionen. Die Webseite ruft sie über zwei eigene
Befehle der Hülle auf, freigegeben nur für die eigene Server-Adresse (`app/src-tauri/capabilities/server.json`).
- **Großbild auf Beamer öffnen** (Zugänge → „Großbild-Link“): `grossbild_oeffnen` öffnet `#/grossbild` in einem eigenen
  Fenster im Vollbild auf dem größten Bildschirm, auf dem das Hauptfenster nicht liegt; das Fenster übernimmt die
  Sitzung über `localStorage`. Nur Adressen des eigenen Servers sind erlaubt.
- **Benachrichtigungen für die Spielleitung** (bisher ohne Push, E-34): `melden` zeigt eine Windows-/macOS-Meldung und
  lässt die Taskleiste blinken – bei neuer Team-Nachricht, neuen Warnungen (inkl. gemeldeter Übergaben, E-54) und
  Notfällen, nur wenn die App nicht im Vordergrund ist. Ausgelöst von denselben Zählern wie die Töne, daher keine
  Doppelungen nach dem Neuverbinden.
- **Hinweis „Neue Version der Mister-X-App“:** Der Deploy schreibt den Release-Tag als `desktopVersion` in
  `downloads.json`; weicht er von der Version der Hülle ab, bietet die App den Installer an (öffnet im Browser).
**Warum so:** Am Laptop läuft die App oft neben anderen Fenstern – Meldungen und das Blinken holen die Spielleitung
zurück; das Großbild landet ohne Ziehen und F11 auf dem Beamer. Eigene, eng begrenzte Befehle statt allgemeiner
Fenster- oder Dateirechte für die Webseite.
**Verworfen:** eigener „Speichern unter“-Dialog für Exporte (WebView2 speichert Downloads selbst; ein Dialog bräuchte
Dateisystem-Rechte für die Webseite), automatisches Selbst-Update (signierter Updater – erst, wenn das Drüber-
Installieren lästig wird).

### E-60 Spielfeld-Vorlagen Linz, Steyr und Wels
**Entscheidung:** Beim Anlegen eines Spiels und im Zonen-Editor sind „Linz Innenstadt“ (`linz`), „Steyr“ (`steyr`)
und „Wels“ (`wels`) wählbar, dazu „leer“. Steyr und Wels sind Exporte des Zonen-Editors, fest im Code
(`shared/src/vorlagen/`, nicht von Hand bearbeiten). Eine Liste `VORLAGEN` (`shared/src/vorlagen/index.ts`) dient
Server, Verwaltung und Editor; die GeoJSON-Umwandlung (`fieldFromGeoJson`, `shared/src/feld.ts`) nutzen Editor-Import
und Vorlagen gemeinsam. Der Server lehnt unbekannte Vorlagen ab (bisher: still leeres Feld).
**Warum so:** Gespielt wird nicht nur in Linz; eine weitere Stadt braucht nur eine Datei und einen
Listeneintrag. Die Kennung `linz` bleibt, damit bestehende Spiele und Tests unverändert funktionieren.

### E-61 Spray-Logo auf der Startseite
**Entscheidung:** Der Titel „MISTER X“ der Startseite ist jetzt eine Animation nach der Vorlage des Organisators
(Claude Design): Mister X mit Fahne holt eine Spraydose, sprüht „MISTER“ in Weiß, wechselt zur roten Dose, sprüht das
X und bleibt in der Siegerpose stehen (15 s, spielt einmal). Rechnung in `app/src/lib/sprayLogo.ts`, Zeichnung in
`app/src/screens/parts/SprayLogo.svelte`, Schriftzug und Fahne als Bilder in `app/public/logos/`. Bei „weniger
Bewegung“ steht sofort das fertige Bild da. Im hellen Design sind Figur und Schrift nachtblau, das X bleibt rot.
**Warum so:** Wunsch des Organisators – das ganze Logo als Animation. Einmal statt Endlosschleife, damit die Knöpfe
darunter nicht ständig von Bewegung abgelenkt werden. Der Blitz beim Einschlag des alten X ist mit dem alten Titel
entfallen.

### E-62 Ohne Vereinslogos und Vereinsnamen, Veranstalter im Datenschutz offen
**Entscheidung:** Die Vereinslogos sind aus App, Großbild, Einstellungen und
Druckblättern entfernt, die Bilddateien gelöscht. Wo ein Logo Platz hatte, steht klein das Mister-X-Logo (Läufer mit
Fahne und Schriftzug, Endbild des Spray-Logos aus E-61; `app/public/logos/mister-x.png` und `-negativ.png` für dunklen
Grund). Auf der Startseite entfällt das kleine Logo oben, weil darunter das große Spray-Logo steht. Im
Datenschutzhinweis ist der Veranstalter offen: Veranstalter, Adresse und Kontakt „wird noch eingetragen“.
**Warum so:** Wunsch des Organisators – die App soll vorerst ohne Vereinslogos auskommen. Der Datenschutzhinweis
braucht vor dem ersten echten Spiel wieder einen Verantwortlichen (DSGVO Art. 13), siehe ABNAHME F12.
**Nachtrag:** Auch der Vereinsname als Text ist entfernt: Startseite (nur noch „Das Live-Geländespiel in der
Innenstadt“), Fenstertitel, App-Beschreibung, Einstellungen und Herausgeber im Desktop-Installer. Später auf Wunsch des
Organisators auch die interne App-Kennung: jetzt `at.misterx.app` (Android, Desktop). Folge: bisher installierte Apps
bekommen keine Updates mehr und müssen einmal deinstalliert und neu installiert werden. Das Repository nennt den Verein
nirgends mehr; die alten Promo-Videos sind ohne Vereinsnamen und -logos neu gerendert.
**Nachtrag Startseite:** Das Spray-Logo spielt ohne Kamerafahrt (neue Vorlage des Organisators, „followCam“ aus), damit
der Schriftzug während der Animation an derselben Stelle bleibt; die Zeichenfläche ist auf den genutzten Bereich
zugeschnitten. Der Satz unter dem Logo („Das Live-Geländespiel in der Innenstadt“) entfällt, auf der Startseite am Handy fehlt
der Installationshinweis unter dem App-Download (am PC und auf den Anmeldeseiten bleibt er), und niedrige Handys bekommen engere
Abstände – so passt die Startseite auf gängigen Handys ohne Scrollen (geprüft u. a. 393 × 727 mit Download-Karte).

### E-63 Weicheres Design und neue Startseite
**Entscheidung:** Auf Wunsch des Organisators („smoother“, vor allem die Startseite) ist das Design gleichmäßiger und
ruhiger geworden, ohne die Marke zu ändern (Großbuchstaben, Ausrufezeichen, animierter Hintergrund, Siegerehrung und
Farben bleiben).
- **Bausteine** (`app/src/ui/`): weichere Schatten (`--shadow-*`), leichter Verlauf auf dem roten Hauptknopf, federndes
  Loslassen (`--ease-spring`), Hover-Zustände am PC, weicher Fokusring an Eingabefeldern, gewählter Reiter unten mit
  runder Fläche, Sprachwahl in Neutral (Rot bleibt der Hauptaktion), Dialoge und Blätter blenden weicher ein.
- **Übergänge:** Seitenwechsel (`App.svelte`) und Reiter-/Bereichswechsel blenden den neuen Inhalt in 250 ms ein – nur
  Deckkraft, nichts verschiebt sich. Bei „weniger Bewegung“ entfällt das.
- **Startseite:** Logo oben groß, alle Wege auf einer ruhigen Fläche darunter. Rangfolge: „Team beitreten“ (rot), „QR-Code
  scannen“, App-Download; „Ich bin Schiri“ und „Spielleitung“ als leise Links unter einer Linie. Die Jagd-Route und die
  wandernden Punkte laufen nicht mehr hinter dem Text; ohne Animation (weniger Bewegung, langsames Gerät) verschwinden
  die Punkte statt in der Ecke zu kleben. Die liegengebliebene Spraydose blendet am Ende aus. Auf Handys bis 680 px
  Höhe entfällt die Hinweiszeile unter dem roten Knopf, damit nichts scrollt.
- **Fehler behoben:** Reiter-Leisten brechen nicht mehr um, sondern lassen sich seitlich wischen (Verlauf am Rand zeigt
  es an); „Wie viele seid ihr?“ nutzt die Breite (Hinweis darunter); Titel „Spiele verwalten“ bricht nicht mehr um;
  Download-Knopf zeigt die Größe in zweiter Zeile; Karten-Hinweis (i) liegt beim Schiri über der Übergabe-Leiste und
  im Spielfeld-Editor neben dem Hinweis; Abstand zwischen Sammelruf-Text und Knopf; Auswertung und Großbild ziehen
  schmale Handys (320 px) nicht mehr breit; Stepper, Einführungs-Striche passen sich an.
**Warum so:** Die Marke bleibt erkennbar (CLAUDE.md: Design nicht ungefragt ändern – hier ausdrücklich gewünscht); die
Änderungen sind „leise“: Tiefe, Bewegung und Abstände statt neuer Formen. Alles über Design-Tokens, damit „Sonne“
(Hochkontrast) flach bleibt.

### E-64 Organisator als Verantwortlicher im Datenschutzhinweis
**Entscheidung:** Verantwortlicher (DSGVO Art. 13) ist der Organisator persönlich: Peter Mayrhofer, Madersdorferstraße
10a, 4523 Neuzeug, petermayrhofer08@gmail.com, +43 660 8184922. Steht im Datenschutzhinweis der App
(`app/src/texte.ts`, Abschnitt `datenschutz`) und ersetzt die Platzhalter aus E-62.
**Warum so:** Die Vereine sind aus der App entfernt (E-62); der Datenschutzhinweis braucht trotzdem eine erreichbare
Person. Angaben vom Organisator am 13.11.2026.

### E-65 Urkunden für die Teams
**Entscheidung:** Die Spielleitung druckt mit einem Knopf ein A4-Blatt pro Team als Urkunde: Mister-X-Logo,
„Urkunde für das Team“, Teamname (ohne Team-Kreis, Wunsch des Organisators), Glückwunsch zur Teilnahme mit Spielname, Datum und eine Linie für
die Unterschrift. Aus der **Auswertung** gedruckt stehen auch der Stempel **Sieger** und die Zeit als Mister X drauf;
unter **Teams & Zugänge → Zugänge** geht es schon vor dem Spiel (ohne Ergebnis). Umsetzung:
`app/src/screens/parts/Urkunden.svelte` (nur beim Drucken eingehängt, direkt an `<body>`, damit der Rest der App keine
leeren Seiten erzeugt), `druckeUrkunden()` in `app/src/lib/druck.svelte.ts` (räumt nach „afterprint“ auf),
Test `tests/e2e-urkunden.test.ts`.
**Warum so:** Wunsch des Organisators. Druck über den Browser wie bei den Zugangs-Blättern (kein PDF-Paket nötig,
geht am Laptop der Spielleitung sofort). Nur Deutsch, wie alle Bildschirme der Spielleitung.
**Nachtrag (Gestaltung):** Die erste, schlichte Fassung (weiß, nur Ecken) war dem Organisator zu langweilig. Jetzt:
Kopf in Nachtblau wie die App (Raster, Radar-Kreise, weißes Spray-Logo in Druckauflösung
`app/public/logos/mister-x-urkunde.png`) mit Farbtropfen ins Blatt; darunter ein ausgedachter Stadtplan als Muster
(Fluss, Straßen, rotes Spielfeld mit Sperrzone, Jagd-Route am Rand; `app/src/lib/urkundeKarte.ts`). „URKUNDE“ in
Saira Stencil One mit rotem Pinselstrich, Teamname in Permanent Marker auf gelbem Textmarker, Text in Special Elite
(Schreibmaschine) – alle drei Schriften lokal über `@fontsource` (OFL/Apache), werden vor dem Druck geladen.
Runder Stempel „Mission erfüllt“ für alle, „Sieger“-Stempel für den Sieger. Papierton statt Reinweiß, damit es nach
Urkunde aussieht; der Kopf braucht Farbe, der Rest bleibt hell (wenig Tinte).

### E-66 Werkzeuge aktuell halten (GitHub-Bausteine, Sicherheitswarnungen)
**Entscheidung:** Die GitHub-Abläufe nutzen die Bausteine, die auf Node 24 laufen (`actions/checkout@v6`,
`setup-node@v6`, `setup-java@v5`, `upload-artifact@v6`, `download-artifact@v7`, `softprops/action-gh-release@v3`).
Capacitor auf 8.6.2 (bringt neuere Hilfspakete `xcode`, `rimraf`/`glob` mit), ESLint 10.14 und typescript-eslint 8.72.2.
ESLint hängt noch an `minimatch` 10 mit einer DoS-Warnung (GHSA-g3hv-75wg-m249); `overrides` in `package.json` zwingt
`minimatch` 11 – entfernen, sobald ESLint selbst `minimatch` 11 verlangt.
**Warum so:** GitHub schaltet Node 20 für Bausteine ab; die alten liefen nur noch mit Warnung. `npm audit` meldete
17 Warnungen, alle in Entwickler-Werkzeugen (die App selbst: 0). Übrig bleiben 2 niedrige in `deepmerge` (über
`@sveltejs/vite-plugin-svelte`, nur beim Bauen), für die es noch keine behobene Version gibt.

### E-67 Sprachen hinter dem Zahnrad, Spanisch und Italienisch, alles im Spiel übersetzt
**Entscheidung:** Die Sprachwahl liegt auf der Startseite nicht mehr offen, sondern hinter einem **Zahnrad** oben rechts
(Blatt „Einstellungen“ mit der Sprache); in der App weiter unter **Mehr → Einstellungen**. Sprachen: Deutsch, Englisch,
Spanisch, Italienisch, Türkisch – Bosnisch/Kroatisch/Serbisch fällt weg (Wunsch des Organisators; wer es gewählt hatte,
landet wieder bei Deutsch). Im Spiel ist jetzt alles übersetzt, was Teams sehen: auch die automatischen
**Chat-Meldungen** des Servers, Text und Titel der **Benachrichtigungen**, Uhrzeit-/Datumsformat, „vor 6 Min“,
Kartenbeschriftung, Vorlese-Texte, Archiv mit Wiederholung und der **Datenschutz-Hinweis** (ersetzt E-56 in diesem
Punkt). Umsetzung: Der Server schreibt weiter deutsch; `shared/src/sprachen.ts` erkennt jede deutsche Meldung über ihr
Muster aus `meldungen.ts` und setzt sie mit Teamnamen und Minuten in der Sprache neu zusammen – in der App beim
Anzeigen (Chat, Android-Benachrichtigung) und am Server für Web-Push (das Gerät meldet seine Sprache mit
`pushSubscribe`). Texte von Menschen (Durchsagen, Chat, Regel-Ergänzungen, Teamnamen) bleiben, wie sie geschrieben
wurden. Spielende ohne Sieger hat eine eigene Meldung statt „Niemand“. Nebenbei behoben: Im Warteraum fehlten in
anderen Sprachen die drei wichtigsten Regeln (Auswahl über das Symbol statt über den deutschen Titel).
**Warum so:** Wunsch des Organisators. Muster statt neuer Felder im Server: alte Chat-Verläufe werden mit übersetzt,
und es braucht keine Umstellung der gespeicherten Daten. Neue Meldung in `meldungen.ts` → in allen vier Sprachdateien
unter `shared/src/sprachen/` ergänzen (TypeScript meldet fehlende). Die Übersetzungen sollte vor dem Einsatz jemand mit
der jeweiligen Muttersprache durchsehen.

### E-68 Die ganze App in fünf Sprachen
**Entscheidung:** Nicht nur die Team-Bildschirme, sondern alles ist übersetzt: Anmeldung für Schiri und Spielleitung,
Schiri-Ansicht, Spielleitung (Live, Steuerung, Teams & Zugänge, Spielfeld-Editor, Protokoll, Tracker), Großbild,
Verwaltung des Organisators, Druckblätter und Urkunden (ersetzt E-56 und E-67 in diesem Punkt). Das **Protokoll**
schreibt der Server weiter deutsch, aber nur noch über die Vorlagen in `shared/src/protokoll.ts`; die App übersetzt
Aktion und Details beim Anzeigen über ihr Muster (`uebersetzeProtokoll`, eigene Muster neben denen der
Chat-Meldungen), auch feste Wörter in den Teilen („niemand“, „Schiri“, „Fahne“). Freier Text (Durchsagen, gelöschte
Nachrichten) bleibt. Erklärungen des Servers bei falschen Eingaben („invalid“) gibt es nur auf Deutsch – in anderen
Sprachen zeigt `fehlerText()` (`app/src/lib/api.ts`) den allgemeinen Hinweis „Bitte Eingaben prüfen“.
**Warum so:** Wunsch des Organisators („gefühlt alles ist noch deutsch“). Was Menschen eintippen (Teamnamen,
Bereichsnamen, Regel-Ergänzungen, Durchsagen) wird nicht übersetzt. Neue Texte immer in allen fünf Sprachen anlegen,
neue Protokoll-Einträge nur über `protokoll.ts` (TypeScript meldet fehlende Übersetzungen).
