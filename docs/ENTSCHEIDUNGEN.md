# Entscheidungen

Jede Entscheidung mit Begründung und verworfenen Alternativen. Neue Einträge unten anhängen, alte nicht löschen –
wird eine Entscheidung geändert, bekommt sie einen neuen Eintrag mit Verweis.

---

### E-01 Realtime Database statt Firestore
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
**Entscheidung:** Alle spielentscheidenden Aktionen laufen über **eine** aufrufbare Function `api` (Feld `action`),
dazu `tick` (Scheduler, jede Minute), `onPosition` (Datenbank-Trigger), `tracker` (HTTP), `cleanup` (täglich).
Region `europe-west1` (wie die Datenbank), Node 22.
**Warum:** Jede 2nd-gen-Function ist ein eigener Dienst mit eigenem Kaltstart. Eine gemeinsame `api` bleibt während
des Spiels „warm“, egal welche Aktion kommt (Übergabe, Chat-Löschung, Regeländerung …). Die Aktionen sind trotzdem
sauber getrennte Module mit eigener Prüfung.
**Grenze:** Erster Aufruf nach längerer Pause hat 2–4 s Kaltstart. Mindest-Instanzen (`minInstances: 1`) würden das
beheben, kosten aber ≈ 5–10 €/Monat → nicht verwendet; der `tick` hält die Region während des Spiels ohnehin aktiv.

### E-04 Zeitgesteuerte Ereignisse: Minuten-Takt + „Warten bis zur Sekunde“
**Entscheidung:** Cloud Scheduler ruft `tick` jede Minute auf. `tick` sucht alle Ereignisse, die in den nächsten 60 s
fällig sind (Meldung, Spielende, Ablauf von Wartezeiten), wartet bis zum exakten Zeitpunkt und führt sie als Transaktion aus.
**Warum:** Sekundengenau, funktioniert ohne jedes Handy, kein zusätzliches Produkt. Doppelte Ausführung durch
überlappende Läufe ist durch Transaktionen mit erwartetem Zustand ausgeschlossen (idempotent).
**Verworfen:** Cloud Tasks pro Ereignis (präzise, aber IAM-Einrichtung für Laien fehleranfällig, Umplanen bei
Intervalländerung/Übergabe aufwendig); Spiel-Logik auf Handys (Kernproblem des Prototyps).
**Grenze:** Ein Lauf kostet bis zu 60 s Instanzzeit – bei vielen gleichzeitigen Spielen später auf Cloud Tasks umstellen.

### E-05 Login: anonym + serverseitig geprüftes Passwort; Super-Admin per Google + Custom Claim
**Entscheidung:** Teams, Schiris, Spiel-Admins melden sich mit einem **anonymen** Firebase-Konto an und treten einem
Spiel über `api: join` mit Passwort/Code bei. Der Server speichert die Rolle in `games/{g}/members/{uid}`
(nur vom Server schreibbar). Der Super-Admin meldet sich mit **Google** an; eine Function prüft die E-Mail gegen die
Freigabeliste (Deploy-Parameter `SUPER_ADMINS`) und setzt den Custom Claim `superAdmin`.
**Warum:** Keine E-Mail-Adressen von Jugendlichen nötig (Datenschutz), Rollen sind **pro Spiel** (ein Gerät kann in
einem Spiel Schiri und im nächsten Team sein) – das passt in die Datenbank besser als in Custom Claims, die nur langsam
aktualisiert werden (Token-Erneuerung). Google-Login für den Organisator ist bequem und sicher (bestätigte E-Mail).
**Verworfen:** E-Mail/Passwort-Konten pro Admin (Verwaltungsaufwand), Admin-Konto „wer zuerst kommt“ (Prototyp – unsicher).

### E-06 Passwörter gehasht (scrypt) in `/secrets`, niemand liest sie
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
**Entscheidung:** Alle Daten eines Spiels liegen unter `games/{g}` (+ `secrets/{g}`); Spiel-Code ist ein lesbarer
Kurzname (`linz-2027`), der auch im QR-Link steckt und notfalls eingetippt werden kann.
**Warum:** Mehrere Spiele/Orte ohne Vermischung, einfache Löschung, einfache Rules.

### E-11 Push über FCM mit Token-Liste statt Topics
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
**Warum:** Einheitlicher Strich, große Auswahl (Fahne, Radar, Funk …), freie Lizenz (ISC). Eigene Icons (Falke, Fahne mit
Rote-Falken-Form) werden im gleichen Strichstil ergänzt.

### E-15 Monorepo mit npm-Workspaces, `shared/` ohne Abhängigkeiten
**Entscheidung:** `shared/` (reine Logik + Typen), `app/`, `functions/`. Die Functions werden mit esbuild zu einer Datei
gebündelt (so funktioniert `firebase deploy` mit Code aus `shared/` ohne Tricks).
**Warum:** Eine Wahrheit für Spielregeln: Countdown in der App und Meldung am Server rechnen mit derselben Funktion.

### E-16 Tests: Vitest, Rules-Unit-Testing, Playwright; CI auf GitHub Actions
**Entscheidung:** Vitest (Logik, Functions mit Emulator), `@firebase/rules-unit-testing` (Rechte inkl. Angriffsversuche),
Playwright (E2E mit simulierten Handys, Fake-GPS, Zeitraffer über verkürzte Intervalle wie im Prototyp), Lasttest als
Node-Skript gegen den Emulator. GitHub Actions: Lint, Typecheck, Tests bei jedem Push; APK-Build; Preview-Deploy.

### E-17 APK-Verteilung über Firebase Hosting
**Entscheidung:** Die signierte APK wird von GitHub Actions gebaut und beim Deploy unter `https://mr-x-ooe.web.app/app.apk`
abgelegt (+ QR-Code im Admin und auf dem Flyer).
**Warum:** Das Repository ist privat – Downloads aus GitHub-Releases bräuchten ein GitHub-Konto.

### E-18 Prototyp im echten Stack
**Entscheidung:** Der Klick-Prototyp (Meilenstein 2) wird gleich mit Svelte + den echten Komponenten gebaut und läuft mit
Testdaten unter `/#/prototyp`. Die Komponenten-Bibliothek ist unter `/#/komponenten` dokumentiert (statt Storybook).
**Warum:** Kein Wegwerf-Prototyp; was abgenommen wird, ist exakt das, was später läuft. Storybook wäre eine zusätzliche
schwere Abhängigkeit für eine Handvoll Komponenten.

### E-19 Alter Prototyp nach `legacy/`
**Entscheidung:** Auf dem Neubau-Branch liegen die alten Dateien unter `legacy/` (nur Referenz). Die Live-Version
`https://mr-x-ooe.web.app` wird weiter vom bisherigen Branch deployt, bis der Neubau abgenommen ist.

### E-20 Antworten des Organisators (27.10.2026)
**Entscheidung:** Konzept und Design bestätigt. Übernommen: Pause-Funktion (F2), Aufbewahrung Archiv 1 Jahr / Chat 30 Tage /
Live-Standorte sofort löschen (F3), Zuschauer-Modus nur mit Meldungen (F6), Start-Mister-X auslosbar (F8),
Sofort-Meldung bei Übergabe (F10), Ersatzgerät pro Team (F14); die übrigen Fragen mit dem jeweiligen Vorschlag.
**Offen:** Vektor-Logos (F1) und Datenschutz-Kontakt (F12) – werden spätestens für Meilenstein 12 gebraucht.

### E-21 Eigene Datenbank-Instanz und Hosting-Site für den Neubau
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
**Entscheidung:** Alle automatisierten Tests laufen gegen die Firebase-Emulatoren mit der Projekt-ID `demo-mrx`.
**Warum:** `demo-`-Projekte haben garantiert keinen Zugriff auf echte Firebase-Dienste – ein Test kann nie versehentlich
Produktionsdaten verändern, und CI braucht keine Zugangsdaten.

### E-23 Anstoßen durch die Handys (`poke`) zusätzlich zum Minuten-Takt
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
