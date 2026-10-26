# Auftrag: Kompletter Neubau der App „Mister X – Rote Falken“

> Dieser Prompt richtet sich an eine KI (Coding-Agent), die selbstständig über mehrere Tage arbeiten darf.
> Lies ihn vollständig, bevor du anfängst. Er beschreibt das Spiel, den Ist-Stand, alle Anforderungen,
> das gewünschte Design, die Qualitätsansprüche und den Arbeitsablauf.
> Antworte, schreibe und gestalte die App **auf Deutsch** (österreichisches Deutsch, „Tapperl“ etc. ist gewollt).

---

## 0. Deine Rolle und Arbeitsweise

Du bist ein **Senior-Fullstack-Entwickler und Produktdesigner** mit Erfahrung in Echtzeit-Apps, Karten/GPS,
Mobile (Capacitor/Android), Firebase und Spiele-UX. Du baust die App **komplett neu** – nicht als Flickwerk
auf der alten Version, sondern sauber von Grund auf, mit dem bestehenden Code nur als **Referenz** für Regeln,
Abläufe und Daten (v. a. die Spielfeld-Koordinaten).

**Arbeitsregeln:**
1. **Du darfst Tage arbeiten.** Qualität geht vor Geschwindigkeit. Arbeite in Meilensteinen (siehe Abschnitt 12),
   jeder Meilenstein endet lauffähig, getestet, committet und gepusht.
2. **Frag nach, wenn etwas wirklich unklar ist** und du es nicht sinnvoll selbst entscheiden kannst
   (z. B. Spielregel-Details, Kosten, rechtliche Fragen). Sammle Fragen, statt für jede Kleinigkeit zu stoppen.
   Alles, was eine vernünftige Standardlösung hat, entscheidest du selbst und dokumentierst es in `docs/ENTSCHEIDUNGEN.md`.
3. **Vor dem Programmieren:** Lies den bestehenden Code (`app.js`, `index.html`, `zones.js`, `database.rules.json`,
   `test/`, `SPEC.md`, `IDEEN.md`, `README.md`), schreibe dann ein kurzes **Architektur- und Designkonzept**
   (`docs/KONZEPT.md`) und ein **Klick-Prototyp/Screen-Übersicht** (statische Screens oder Storybook) und
   **lass dir das Konzept bestätigen**, bevor du die große Umsetzung startest.
4. **Repository:** `peter-mayrhofer/Mr.-X`. Arbeite auf einem **neuen Branch** (z. B. `neubau`).
   Die alte Version bleibt bis zur Fertigstellung unverändert online (`https://mr-x-ooe.web.app`).
   Die neue Version läuft während der Entwicklung auf einem **eigenen Firebase-Hosting-Kanal** (Preview Channel)
   bzw. einer eigenen Hosting-Site, damit nichts kaputtgeht.
5. **Kein Halbfertiges:** Keine TODO-Platzhalter in fertigen Meilensteinen, keine toten Buttons,
   keine erfundenen Features, die nicht funktionieren.
6. **Ehrlich berichten:** Wenn etwas nicht geht (z. B. technische Grenzen bei iPhone im Hintergrund), sag es klar.

---

## 1. Das Spiel (reale Welt) – unbedingt verstehen

„Mister X“ ist ein **Live-Geländespiel** der **Roten Falken / Kinderfreunde Oberösterreich** in der
**Linzer Innenstadt**, angelehnt an das Brettspiel „Scotland Yard“. Es wird **real mit echten Menschen**
auf der Straße gespielt, nicht am Bildschirm. Die App ist das **Werkzeug**, das die bisherige WhatsApp-Gruppe
zuverlässiger macht (Fotos und Smalltalk laufen weiter über WhatsApp – **keine Foto-Funktion bauen**).

**Eckdaten:**
- Ca. **160 Teilnehmer**, Gruppen (Ortsgruppen) zu ca. **7 Personen** → ca. **20–30 Teams** (jedes Jahr anders).
- Dauer **ca. 3–4 Stunden**, Ende zu einem **zufälligen Zeitpunkt**.
- Pro Team bedient **ein Handy** die App – das hat ein **Betreuer (Erwachsener)** oder ein **Jugendlicher (12–18)**.
- Dazu: **Admin** (Spielleitung in der Zentrale, oft am Laptop), **Schiris** (begleiten Mister X zu Fuß oder mit E-Roller).

**Regeln (Original-Regelblatt, sinngemäß):**
1. Ein Team ist **Mister X**, trägt eine **Fahne** sichtbar als Erkennungszeichen und startet zuerst.
2. Nach **10 Minuten** wird der Standort von Mister X gemeldet – dann dürfen alle anderen Teams loslaufen.
3. **Fangen:** Es genügt, **einer Person** der Mister-X-Gruppe ein **„Tapperl“** (Berührung) zu geben.
4. **Übergabe:** Das fangende Team wird der **neue Mister X** und bekommt die Fahne. Die ehemalige Mister-X-Gruppe
   **und alle Gruppen in unmittelbarer Nähe des Fangortes** müssen **5 Minuten warten**, damit der neue Mister X Vorsprung hat.
5. Mister X meldet seinen Standort **alle 10 Minuten** (bei späterer Regeländerung **alle 5 Minuten**).
6. Die Gruppe muss **zusammenbleiben** (Sichtkontakt ca. 20 m).
7. Mister X darf sich **nicht in Gebäuden** aufhalten.
8. **Öffis:** pro Fahrt höchstens **drei Stationen** (Einstiegshaltestelle zählt nicht). Halstuch = Fahrschein, gut sichtbar tragen.
   Rücksicht auf andere Fahrgäste.
9. Die **Straßen, die das Spielfeld begrenzen, gehören noch zum Spielfeld**.
10. Das Spielfeld wird **während des Spiels verkleinert** (mehrere Bereiche, Reihenfolge entscheidet der Admin).
11. Bei Uneinigkeit entscheidet **Schiri bzw. Spielleitung/Admin**.
12. Wer **beim Spielende Mister X ist, gewinnt**.
13. Regelbruch von Mister X (z. B. Spielfeld verlassen): situationsabhängig – meist nur Warnung,
    bei Bedarf **Strafübergabe** der Fahne an ein verfolgendes Team (Entscheidung Schiri/Admin).

**Spielfeld:** Innenstadt Linz. Die exakten, straßengenauen Polygone (Spielfeld + 4 sperrbare Bereiche
Norden / Osten / Mitte-Ost / Westen) liegen in `zones.js` und **müssen übernommen werden** (sie wurden mühsam mit
dem Organisator abgestimmt). Grenzstraßen: Kapuzinerstraße – Römerbergtunnel – Obere/Untere Donaulände –
Gruberstraße – Khevenhüllerstraße – Blumauerstraße – Bahnhofstraße – Kärntnerstraße – Waldeggstraße –
Kellergasse – Sandgasse – Hopfengasse. Toleranz: bis 20 m jenseits der Straßenmitte zählt noch als „drinnen“.

---

## 2. Ist-Stand (Prototyp) – was es schon gibt und was wir gelernt haben

Der Prototyp (Vanilla-JS, Leaflet, Firebase Realtime Database, Firebase Hosting, Projekt-ID **`mr-x-ooe`**,
Konto `mr.x.rf.ooe@gmail.com`) funktioniert und wurde mit einem Playwright-E2E-Test gegen den Firebase-Emulator geprüft.
Lies `SPEC.md`, `IDEEN.md`, `README.md` und den Code. Übernimm **die Abläufe**, nicht die Code-Struktur.

**Vorhandene Funktionen (alle müssen in der neuen Version mindestens gleichwertig, aber besser umgesetzt sein):**
- Team-Login: Teamname + gemeinsames **Team-Passwort** (vom Admin festgelegt); Knopf **„Ich bin Admin“** mit eigenem Admin-Passwort.
- Admin-Dashboard: Team-Passwort festlegen/ändern/löschen, Admin-Passwort ändern, Teams entfernen, Schiris ernennen.
- Live-Standort aller Teams (nur für Admin + Schiri sichtbar), automatische **Mister-X-Meldungen** im Intervall,
  letzter bekannter Standort bei Verbindungsverlust.
- **Übergabe** durch Schiri/Admin (Fang oder Strafübergabe), **Rückgängig**, Wartezeit für Teams im einstellbaren Umkreis.
- Spielfeld mit 4 einzeln sperrbaren Bereichen, Warnung „außerhalb“.
- Chat: Gruppenchat + Direktkanal Team ↔ Admin; automatische System-Meldungen; **Durchsagen** (nur Admin).
- „Mister X sofort melden“ (Strafe), Warnung bei Teams ohne Standort > 3 Min.
- **Zufallsende** in einem Zeitfenster + **Notstopp**; **Auswertung** (letzter Mister X, längste Zeit als Mister X,
  am öftesten Mister X, meiste Distanz); **Archiv** vergangener Spiele inkl. Route von Mister X und Chat.
- „**Neue Runde vorbereiten**“: alle Teams/Schiris abmelden, Team-Passwort löschen, Spieldaten leeren, Archiv bleibt.
- **Großbild** für Laptop/Beamer, **Spielregeln** in der App, **Ton + Vibration**, Bildschirm-wach-halten.

**Schwächen des Prototyps, die der Neubau lösen muss:**
1. **Spiel-Logik läuft auf den Geräten** (Meldungen, Zufallsende, Wartezeiten). Wenn Admin- und Mister-X-Handy offline sind,
   passiert nichts. → Im Neubau ist der **Server die Autorität** (Cloud Functions).
2. **Standort nur bei offenem Bildschirm** (Browser-Grenze). → **Android-App mit Hintergrund-GPS**; iPhone bleibt Web (ehrlich kommunizieren).
3. **Design** ist zweckmäßig, aber nicht schön, nicht „spielig“, nicht für Sonne/Draußen optimiert.
4. Keine Push-Benachrichtigungen (App muss offen sein).
5. Nur ein Spiel/Ort möglich; Spielfeld fest im Code.
6. Schiris müssen sich als „Team“ anmelden und dann befördert werden – umständlich.
7. Code ist eine große Datei ohne Typen/Struktur.

---

## 3. Zielgruppen und Nutzungssituation

| Rolle | Wer | Gerät | Situation |
|---|---|---|---|
| **Super-Admin** | Organisator (Roten Falken OÖ) | Laptop/Handy | Legt Spiele/Orte an, vergibt Spiel-Admins |
| **Spiel-Admin** | Spielleitung in der Zentrale | Laptop + Beamer, Handy | Steuert das ganze Spiel, sieht alles |
| **Schiri** | Erwachsene Begleiter von Mister X | Handy, unterwegs, E-Roller | Bestätigt Fänge, löst Übergaben aus |
| **Team** | Betreuer oder Jugendliche (12–18) | 1 Handy pro Team, draußen | Jagt Mister X oder ist Mister X |
| **Großbild/Zuschauer** | Zentrale, Eltern-Treffpunkt | Laptop/TV | Nur ansehen |

**Bedingungen draußen (Design muss das berücksichtigen):**
- **Sonnenlicht**, Regen, Handschuhe, eine Hand frei, Gehen/Laufen, Stress und Aufregung.
- Kurze Blicke aufs Handy: Das Wichtigste (Wo war Mister X? Wann kommt die nächste Meldung? Müssen wir warten?)
  muss in **unter 2 Sekunden** erfassbar sein.
- **Akku** soll 4 Stunden halten (mit Powerbank). Kein unnötiges GPS-Dauerfeuer, kein unnötiges Neurendern.
- **Schlechtes Netz** (Häuserschluchten, Öffis, Unterführungen) → robuste Offline-/Reconnect-Logik.
- Jugendliche und Erwachsene ohne Technik-Erfahrung → **selbsterklärend**, keine Fachbegriffe.

---

## 4. Technik-Vorgaben

### 4.1 Plattformen
- **Eine Codebasis** für:
  - **Web-App (PWA)** – für iPhone und alle, die nichts installieren wollen; installierbar („Zum Home-Bildschirm“),
    Vollbild, App-Icon, Splash.
  - **Android-App** über **Capacitor** – mit **Hintergrund-Standort** (Foreground-Service mit Dauer-Benachrichtigung
    „Mister X läuft – Standort wird geteilt“), funktioniert bei gesperrtem Bildschirm und in anderen Apps.
    Verteilung als **signierte APK-Datei** (Download-Link + QR-Code), **kein Play Store**.
  - **Kein iOS-App-Build** (kein Apple-Account). Für iPhones: PWA mit klaren Hinweisen (Bildschirm anlassen,
    App zum Home-Bildschirm hinzufügen für Push).
- Prüfe für Android ein geeignetes Plugin (z. B. `@capacitor-community/background-geolocation`), achte auf
  Android-Berechtigungen (ACCESS_BACKGROUND_LOCATION, Foreground-Service-Typ „location“, Benachrichtigungs-Berechtigung,
  Akku-Optimierung-Ausnahme mit Erklärung) und dokumentiere die Einrichtung Schritt für Schritt.

### 4.2 Stack (Empfehlung – du darfst begründet abweichen)
- **TypeScript (strict)**, **Vite**, ein modernes, schlankes UI-Framework (z. B. Svelte/SvelteKit-SPA, Vue oder React –
  wähle und begründe in `docs/ENTSCHEIDUNGEN.md`).
- **Karten:** MapLibre GL (Vektorkarten, flüssig, eigener Kartenstil passend zum Design) mit einem **kostenlosen**
  Kachel-Anbieter ohne Pflicht-Kreditkarte (z. B. OpenFreeMap – prüfe Nutzungsbedingungen) oder Leaflet + OSM-Raster als Fallback.
  Eigener, kontrastreicher Kartenstil (Straßennamen gut lesbar, Spielfeld klar hervorgehoben, außerhalb abgedunkelt).
- **Firebase (Blaze-Tarif ist erlaubt – Organisator stellt um):**
  - **Authentication** (anonym für Teams/Schiris, E-Mail/Passwort bzw. Custom Claims für Admins),
  - **Realtime Database** oder **Firestore** (begründe die Wahl; Echtzeit-Standorte + Chat + Spielzustand),
  - **Cloud Functions (2nd gen)** als **Spiel-Server**: alle spielentscheidenden Aktionen laufen serverseitig,
  - **Cloud Scheduler / geplante Functions** für Meldungen, Zufallsende, Ablauf von Wartezeiten,
  - **Firebase Cloud Messaging (FCM)** für **Push-Benachrichtigungen** (Android-App + Web-Push; iPhone nur als installierte PWA ab iOS 16.4),
  - **Hosting** (mit sinnvollen Cache-Headern – nach jedem Deploy muss sofort die neue Version laufen; Service-Worker-Update-Strategie!).
- **Laufende Kosten müssen praktisch 0 € bleiben** (innerhalb der kostenlosen Kontingente bei ~30 Teams, 4 h, ein paar Spiele pro Jahr).
  Rechne das grob vor und setze ein **Budget-Limit/Alarm** in der Doku.
- **Keine Geheimnisse im Client.** Passwörter gehashed/serverseitig geprüft, Admin-Rechte über Custom Claims, Security Rules streng.

### 4.3 Server-Autorität (wichtig)
Folgende Dinge entscheidet **der Server**, nicht ein Handy:
- Spielstart, Spielende (Zufallszeitpunkt geheim nur am Server!), Notstopp.
- Automatische Mister-X-Meldungen zum richtigen Zeitpunkt (auch wenn kein Admin-Gerät online ist).
- Übergabe (inkl. Prüfung: nur Schiri/Admin), Strafübergabe, Rückgängig, Berechnung der Wartezeit-Teams im Umkreis.
- Ablauf von Wartezeiten, Spielfeldverkleinerung, Intervalländerung.
- Auswertung und Archivierung.
- Plausibilitätsprüfungen (z. B. unrealistische GPS-Sprünge markieren, nicht blind übernehmen).

**Standort-Fallback für Mister X** (siehe `IDEEN.md`): Liefert das Mister-X-Gerät keinen frischen Standort,
nimmt der Server automatisch den Standort des **begleitenden Schiris** (Schiri ist einem Mister-X-Team zugeordnet
bzw. folgt der Fahne). In der Meldung transparent anzeigen („Standort vom Schiri“ / „letzter bekannter Standort von 14:32“).

**Vorbereitung Tracker (nur Datenmodell + Schnittstelle, kein Hardware-Kauf):** Positionen können optional von
externen Geräten kommen (GPS-Tracker/Traccar Client, siehe `IDEEN.md`) – baue eine HTTP-Funktion mit Geräte-Token,
die Positionen einem Team bzw. „der Fahne“ zuordnet. Admin kann im Dashboard „Gerät → Team/Fahne“ zuordnen.
Priorität der Standortquellen: Tracker der Fahne > Mister-X-Gerät > Schiri-Gerät > letzter bekannter.

---

## 5. Mandanten: mehrere Spiele / Orte

- **Super-Admin** (Organisator) legt **Spiele** an (z. B. „Mister X Linz 2027“, später andere Städte/Ortsgruppen),
  vergibt pro Spiel einen **Spiel-Admin** (Zugang mit eigenem Passwort oder Einladungslink) und kann Spiele archivieren/löschen.
- Jedes Spiel hat eigenes: Spielfeld + Sperrbereiche, Einstellungen, Team-Passwort, Teams, Schiris, Chat, Archiv.
- Teams treten einem Spiel über **Spiel-Link/QR-Code** + Teamname + Team-Passwort bei (kein Spielauswahl-Chaos).
- Die Linz-Zonen aus `zones.js` werden als **Vorlage „Linz Innenstadt“** mitgeliefert.

---

## 6. Rollen & Rechte (muss in Security Rules + Functions durchgesetzt werden)

| Aktion | Team | Mister-X-Team | Schiri | Spiel-Admin | Super-Admin |
|---|---|---|---|---|---|
| Eigenen Standort senden | ✔ | ✔ | ✔ | (optional) | – |
| Live-Standorte anderer sehen | ✖ | ✖ | ✔ | ✔ | ✔ |
| Mister-X-Meldungen sehen | ✔ | ✔ | ✔ | ✔ | ✔ |
| Übergabe / Strafübergabe / Rückgängig | ✖ | ✖ | ✔ | ✔ | ✔ |
| Durchsage | ✖ | ✖ | ✖ | ✔ | ✔ |
| Einstellungen, Zonen, Start/Ende | ✖ | ✖ | ✖ | ✔ | ✔ |
| Team-Passwort, Teams/Schiris verwalten | ✖ | ✖ | ✖ | ✔ | ✔ |
| Spiele anlegen, Spiel-Admins vergeben | ✖ | ✖ | ✖ | ✖ | ✔ |

- Schiris treten mit einem eigenen **Schiri-Code** (vom Admin) bei – nicht erst als Team.
- Niemand außer Admin/Schiri darf **jemals** Live-Positionen lesen können (auch nicht per Datenbank-Trick) – **teste das**.
- Teams dürfen keine System-Meldungen/Durchsagen fälschen, keine fremden Teams ändern.

---

## 7. Funktionsumfang (vollständig)

### 7.1 Einstieg & Konten
- **Startseite** mit großem Logo, App-Name „Mister X – Rote Falken“, zwei klaren Wegen: **„Team beitreten“** (Spiel-Code/QR scannen,
  Teamname, Team-Passwort) und **„Schiri“** / **„Admin“** (dezenter).
- QR-Code-Beitritt: Admin zeigt/druckt pro Spiel einen QR-Code (Link mit Spiel-ID); Team-Passwort bleibt Pflicht.
- Bleibt angemeldet (Gerät merkt sich das Team); „Abmelden“ mit Bestätigung.
- Wird ein Team vom Admin entfernt / neue Runde → Gerät landet freundlich erklärt wieder auf der Startseite.
- **Onboarding** beim ersten Beitritt (3–4 kurze, schöne Screens): Wie läuft das Spiel, Standort erlauben,
  Benachrichtigungen erlauben, Bildschirm/Akku-Hinweise (Android: Akku-Optimierung ausschalten – mit Schritt-für-Schritt-Hilfe).

### 7.2 Team-Hauptansicht (Jäger)
- **Vollbild-Karte** als Hauptelement, eigene Position, Spielfeld (gesperrte Bereiche abgedunkelt/schraffiert).
- **Mister-X-Spur:** letzte Meldung groß und deutlich (pulsierender Marker mit Uhrzeit „vor 4 Min“),
  ältere Meldungen seit der letzten Übergabe als verblassende Spur mit Uhrzeiten.
- **Status-Leiste oben** (immer sichtbar, riesig lesbar): „Mister X: <Team>“ + **Countdown bis zur nächsten Meldung**
  (Ring/Balken-Animation), Spielzeit, Verbindungsstatus (online/offline/GPS-Qualität).
- **Wartezeit-Overlay** (wenn gesperrt): bildschirmfüllend, großer Countdown, „Bitte stehen bleiben“, nicht übersehbar.
- **Durchsagen** als auffälliges Banner + Ton/Vibration; **Spielfeld-Verkleinerung** als animierter Hinweis
  („Der Norden wird gesperrt!“) mit Karten-Highlight.
- Untere Navigation (Tabs, groß, Daumen-erreichbar): **Karte · Chat · Regeln · Mehr**.

### 7.3 Mister-X-Ansicht
- Eigener, sofort erkennbarer Modus (andere Farbwelt/Rahmen, Fahnen-Symbol): „**Ihr seid Mister X!**“
- Countdown bis zur **nächsten automatischen Meldung** (sie sehen, wann ihr Standort verraten wird).
- **Spielfeld-Warnung**, wenn sie sich der Grenze nähern (z. B. < 50 m: gelb) bzw. draußen sind (rot, Vibration).
- Hinweis-Karte mit den Mister-X-Regeln (nicht in Gebäude, Fahne sichtbar, zusammenbleiben).
- Übergabe-Moment: große Animation („Gefangen! Die Fahne geht an …“) bzw. „Ihr seid jetzt Mister X! 5 Min Vorsprung“.

### 7.4 Schiri-Ansicht
- Karte mit **allen Teams live** (Mister X hervorgehoben), Distanz der nächsten Jäger zu Mister X.
- **Übergabe-Knopf** groß: Team auswählen (sortiert nach Nähe zum Fangort!), Typ „Gefangen“/„Strafübergabe“, Bestätigung,
  **Rückgängig** (zeitlich begrenzt, z. B. 2 Min, mit Bestätigung).
- Liste der Teams, die gerade Wartezeit haben.
- Schiri kann einem Mister-X-Team „folgen“ (für den Standort-Fallback).

### 7.5 Chat
- **Gruppenchat** (alle) + **Direktkanal Team ↔ Admin**; Admin hat Postfach mit Ungelesen-Zählern pro Team.
- System-Meldungen (Standort gemeldet, Übergabe, Regeländerung, Verkleinerung, Start/Ende) optisch klar unterscheidbar,
  Standort-Meldungen antippbar → springt auf der Karte hin.
- Durchsagen (nur Admin) besonders hervorgehoben.
- Nur Text + Emojis (Fotos laufen über WhatsApp). Länge begrenzen, einfache Moderation (Admin kann Nachrichten löschen).
- Ungelesen-Badges, Auto-Scroll, „neue Nachrichten“-Hinweis.

### 7.6 Benachrichtigungen
- **Push (FCM)** bei: Mister-X-Meldung, Übergabe, „Ihr seid Mister X“, Wartezeit beginnt/endet, Durchsage,
  Spielfeld-Verkleinerung, Intervalländerung, Direktnachricht vom Admin, Spielstart/-ende.
- In der App zusätzlich **Ton + Vibration** (unterschiedliche Muster je nach Wichtigkeit), stummschaltbar.
- Einstellungen pro Gerät (welche Push-Arten).

### 7.7 Admin-Dashboard (Laptop **und** Handy gut bedienbar)
- **Übersicht/Live:** Karte mit allen Teams, Mister X, Spur, Wartezeiten, Offline-Warnungen (Team seit X Min ohne Standort,
  Mister X ohne Standort → rote Warnung), Spielfeld-Warnungen.
- **Spielsteuerung:** Spiel starten (Start-Mister-X wählen oder **zufällig losen** mit Animation), Zufallsende-Fenster
  (z. B. 3–4 h, Zeitpunkt geheim am Server; Admin kann ihn bei Bedarf aufdecken), Notstopp, Pause (optional, begründen).
- **Regeln live ändern:** Meldeintervall (10 → 5 Min), Wartezeit, Umkreis, Bereiche sperren/freigeben – jede Änderung mit
  Vorschau und automatischer Meldung an alle.
- **Sofort-Meldung** von Mister X (Strafe), **Durchsage**.
- **Teams & Schiris:** Liste mit Status (online, Akku falls verfügbar, letzte Position, Rolle), entfernen, umbenennen,
  Schiri-Code anzeigen/ändern, Team-Passwort festlegen/ändern/löschen, Admin-Passwort ändern.
- **Geräte/Tracker** zuordnen (siehe 4.3).
- **Neue Runde vorbereiten** (mit klarer Warnung, was gelöscht wird).
- **Protokoll** (Audit-Log): wer hat wann was ausgelöst (Übergaben, Regeländerungen, Rückgängig) – wichtig bei Streit.

### 7.8 Zonen-Editor
- Admin zeichnet/bearbeitet **Spielfeld** und **Sperrbereiche** direkt auf der Karte (Punkte ziehen, hinzufügen, löschen).
- **„An Straße ausrichten“**-Hilfe ist nice-to-have (z. B. Snapping an OSM-Straßenlinien); mindestens: Import/Export als GeoJSON.
- Sperrbereiche benennen, Farbe, Reihenfolge-Vorschlag; Vorschau „so sieht das Spielfeld aus, wenn X gesperrt ist“.
- Validierung (keine sich selbst schneidenden Polygone, Sperrbereich muss das Spielfeld schneiden).
- Vorlage „Linz Innenstadt“ aus `zones.js` vorinstalliert.
- Toleranz (Standard 20 m) einstellbar.

### 7.9 Großbild (Zentrale/Beamer)
- Eigene Ansicht (Link/QR für Laptop), Vollbild, **für 3–5 m Entfernung lesbar**:
  große Karte mit allen Teams (Namen), Mister X + Spur, Countdown, Spielzeit, letzte Ereignisse als Ticker,
  Live-Rangliste (Zeit als Mister X, Anzahl Fänge), Durchsagen groß eingeblendet. Keine Bedienelemente nötig.
- Optional ein „Zuschauer-Modus“ (z. B. für Eltern), der **keine Live-Positionen**, nur Mister-X-Meldungen zeigt.

### 7.10 Spielende, Auswertung, Archiv
- Spielende mit **Feier-Animation** für den Gewinner (Konfetti in Rot/Weiß, Fahne).
- Auswertung: Sieger (letzter Mister X), längste Zeit als Mister X, am öftesten Mister X, meiste Distanz,
  dazu schöne Statistiken (Anzahl Übergaben, zurückgelegte Gesamtstrecke, Zeitstrahl der Übergaben).
- **Archiv** aller Spiele mit **Replay**: Zeitschieberegler, der das Spiel auf der Karte abspielt (Mister-X-Meldungen,
  Übergaben, Verkleinerungen), Chat-Verlauf, Auswertung. Export als PDF/Bild für die Vereinszeitung ist nice-to-have.

### 7.11 Spielregeln & Hilfe
- Schön gestaltete Regel-Seite (Icons/Illustrationen pro Regel), durchsuchbar, vom Admin pro Spiel anpassbar
  (Text mit einfacher Formatierung). Aktuelle Werte (Intervall, Wartezeit) werden automatisch eingesetzt.
- Kurze FAQ / Hilfe („Mein Standort wird nicht gesendet“, „Ich bekomme keine Benachrichtigungen“).

### 7.12 Bewusst NICHT bauen
- Keine Fotos/Medien im Chat (läuft über WhatsApp).
- Keine Mehrsprachigkeit (nur Deutsch), aber Texte zentral halten (keine Strings verstreut).
- Keine iOS-App.

---

## 8. Design – „Mix aus Agenten-Spiel und Rote Falken“

### 8.1 Leitidee
Ein **hochwertiges Handy-Spiel mit Detektiv-/Agenten-Feeling** („Scotland Yard“, Fahndung, geheime Meldungen),
aber **in den Farben und mit der Wärme der Roten Falken / Kinderfreunde**: kräftiges **Rot**, **Weiß**, dazu dunkle
Flächen für den Spiel-Look. Es soll sich anfühlen wie ein **echtes, cooles Spiel**, das Jugendliche gern benutzen,
und trotzdem für Betreuer sofort verständlich und seriös wirken.

### 8.2 Markenelemente
- App-Name: **„Mister X – Rote Falken“**.
- **Logos** der Roten Falken und Kinderfreunde liegen im Repo unter **`assets/logos/`** (der Organisator legt sie dort ab –
  falls sie fehlen, frag nach; bis dahin neutraler Platzhalter). Logos auf Startseite, Splash, Großbild, Auswertung.
- Farben grob (verfeinern, als Design-Tokens): Rote-Falken-Rot (ca. `#C8102E`, aus Logo exakt übernehmen), Weiß,
  tiefes Nacht-Blau/Anthrazit als Spiel-Hintergrund, Signalfarben: Gelb (Warnung), Grün (ok/frei), Blau (Info, eigenes Team).
- Fahne als zentrales Symbol (Mister X = Fahne).

### 8.3 Design-System (verpflichtend)
- **Design-Tokens** (Farben, Abstände, Radien, Schatten, Typografie, Animationsdauern) zentral definiert.
- **Hell- und Dunkel-Modus**; zusätzlich **„Sonnen-Modus“/Hochkontrast** für draußen (automatisch hell + extra Kontrast, manuell umschaltbar).
- Typografie: gut lesbare, moderne Schrift (lokal eingebunden, kein Tracking), **Mindestgröße 16 px**, Countdown-Ziffern sehr groß, tabellarische Ziffern.
- **Touch-Ziele mindestens 48 × 48 px**, wichtige Aktionen unten (Daumenzone), gefährliche Aktionen mit Bestätigung und
  farblich getrennt.
- Konsistente **Icons** (ein Icon-Set, z. B. Lucide/Phosphor), keine Emoji-Ersatz-Icons in der finalen UI
  (Emojis im Chat sind ok).
- **Komponenten-Bibliothek** (Buttons, Karten, Banner, Countdown-Ring, Team-Badge, Marker, Bottom-Sheet, Modal, Toast,
  Liste, Tabs, Eingabefelder) mit Zuständen (normal, gedrückt, deaktiviert, Laden, Fehler) – dokumentiert (z. B. Storybook oder eine interne Komponenten-Seite).

### 8.4 Karte
- Eigener Kartenstil: gedämpfte Basiskarte, **Spielfeld klar abgegrenzt** (leuchtende rote Grenzlinie),
  außerhalb dunkel abgedeckt, gesperrte Bereiche mit Schraffur + Name, Straßennamen gut lesbar.
- Marker: eigenes Team (blau, mit Richtungspfeil wenn verfügbar), andere Teams (nur Admin/Schiri; mit Kürzel/Farbe),
  **Mister X** (rot, Fahne, pulsierend), Mister-X-Spur (verblassend), Fangorte (kleines Symbol im Replay).
- Kartensteuerung: „Auf mich zentrieren“, „Mister X zeigen“, „Ganzes Spielfeld“ – große Buttons.
- Flüssig auf älteren Android-Handys (≥ 2019).

### 8.5 Animation & Feedback
- Sinnvolle, kurze Animationen (150–400 ms), nie blockierend; respektiere „Bewegung reduzieren“.
- Besondere Momente inszenieren: Spielstart (Countdown 3-2-1), neue Mister-X-Meldung (Radar-/Ping-Effekt auf der Karte),
  Übergabe (Fahnen-Animation), Verkleinerung (Bereich „fällt weg“), Spielende (Konfetti).
- Haptik: unterschiedliche Vibrationsmuster je Ereignis.
- Ladezustände mit Skeletons, nie leere weiße Seiten; Fehlermeldungen freundlich und mit Lösungsvorschlag.

### 8.6 Barrierefreiheit
- Kontraste nach WCAG AA (draußen eher AAA bei Statusanzeigen), Screenreader-Labels, Fokus-Reihenfolge,
  keine Information nur über Farbe (zusätzlich Icons/Text).

### 8.7 Screens (liefere für jeden Screen ein Design, bevor du ihn baust)
1. Splash / Startseite
2. Team beitreten (Code/QR, Teamname, Passwort)
3. Schiri-/Admin-Login
4. Onboarding (Standort, Benachrichtigungen, Akku, Regeln kurz)
5. Warteraum vor Spielstart (Teamliste, Countdown, Regeln)
6. Jäger-Karte (Hauptscreen)
7. Mister-X-Karte (Hauptscreen im Mister-X-Modus)
8. Wartezeit-Overlay
9. Übergabe-Animation / Ergebnis
10. Chat (Gruppe, Direkt)
11. Regeln & Hilfe
12. Schiri-Ansicht inkl. Übergabe-Flow
13. Admin: Live-Übersicht
14. Admin: Spielsteuerung & Regeln
15. Admin: Teams & Schiris & Passwörter
16. Admin: Zonen-Editor
17. Admin: Protokoll
18. Großbild
19. Spielende & Auswertung
20. Archiv & Replay
21. Super-Admin: Spiele verwalten
22. Einstellungen (Ton, Push, Darstellung, Abmelden)
23. Fehler-/Offline-Zustände (kein Netz, kein GPS, Standort verweigert, Spiel nicht gefunden)

---

## 9. Qualität & Robustheit

### 9.1 Echtzeit & Netz
- Reconnect automatisch, Status sichtbar („Offline – letzte Daten von 14:32“), ausstehende Aktionen sauber behandeln
  (Übergabe nie doppelt; serverseitig idempotent).
- Server-Zeit verwenden (keine Handy-Uhr-Fehler bei Countdowns).
- Standort senden: adaptiv (z. B. alle 10–15 s oder bei > 15 m Bewegung, schlechte Genauigkeit verwerfen/kennzeichnen),
  Akku schonen, Distanz-Statistik nur aus plausiblen Punkten.

### 9.2 Sicherheit & Datenschutz (Minderjährige!)
- Security Rules/Functions so, dass **keine** unberechtigten Lese-/Schreibzugriffe möglich sind; **automatisierte Rule-Tests**.
- **Standortdaten** werden nach Spielende nur in reduzierter Form archiviert (Mister-X-Meldungen, keine lückenlosen Bewegungsprofile der Jäger)
  und **Live-Positionen werden nach Spielende gelöscht**; Löschfristen dokumentieren.
- **Datenschutzhinweis** in der App (kurz, verständlich, DSGVO), Hinweis vor Standort-Freigabe, kein Tracking/Analytics von Drittanbietern.
- Rate-Limits gegen Spam (Chat, Beitrittsversuche mit falschem Passwort).

### 9.3 Tests (Pflicht, in CI)
- **Unit-Tests** für Spiel-Logik (Meldeplan, Umkreis-Wartezeit, Zonen inkl. Toleranz, Auswertung, Zufallsende).
- **Rule-/Function-Tests** gegen den Firebase-Emulator (wer darf was – inkl. Angriffsversuche).
- **E2E-Tests** (Playwright) mit **simulierten Handys** (Admin, Schiri, 3+ Teams, Fake-GPS, Zeitraffer):
  kompletter Spielablauf Start → Meldungen → Übergabe → Rückgängig → Verkleinerung → Ende → Archiv → Neue Runde.
  Übernimm/erweitere die Szenarien aus `test/e2e.js`.
- **Lasttest:** 30 Teams senden 4 h Positionen (simuliert, Zeitraffer) – Kosten/Kontingente prüfen.
- **Visuelle Kontrolle:** Screenshots aller Screens in hell/dunkel/Sonnen-Modus, Handy- und Laptop-Größe.
- **GitHub Actions:** Lint, Typecheck, Tests bei jedem Push; **APK-Build** (signiert, Secrets in GitHub) als Release-Artefakt;
  Deploy auf Firebase Preview-Channel für Pull Requests.

### 9.4 Code-Qualität
- TypeScript strict, ESLint + Prettier, klare Ordnerstruktur (Spiel-Logik als reine, getestete Module, getrennt von UI und Firebase).
- Gemeinsame Typen für Client und Functions.
- Keine riesigen Dateien; sprechende Namen; Kommentare dort, wo Spielregeln umgesetzt werden (mit Verweis auf die Regel).

### 9.5 Performance-Ziele
- Erster Aufruf über Mobilfunk < 3 s bis zur benutzbaren Ansicht; Lighthouse PWA/Performance/Accessibility ≥ 90.
- Karte flüssig (≥ 50 fps beim Verschieben auf Mittelklasse-Android).

---

## 10. Dokumentation (für Menschen ohne Programmierkenntnisse)

- `README.md`: Was ist das, wie starte ich es lokal, wie deploye ich (Schritt für Schritt, Windows-Befehle!).
- `docs/ADMIN-HANDBUCH.md`: Spiel vorbereiten (Spiel anlegen, Zonen, Passwörter, QR-Codes drucken), während des Spiels, nach dem Spiel.
  Mit Screenshots.
- `docs/TEAM-ANLEITUNG.md` + **druckbares A4-PDF/Flyer** mit QR-Code und den wichtigsten Schritten für Teams
  (Android-APK installieren bzw. iPhone-Web-App zum Home-Bildschirm).
- `docs/ANDROID-APK.md`: APK bauen, signieren, verteilen, Installation aus unbekannten Quellen erklären, Akku-Optimierung.
- `docs/FIREBASE-EINRICHTUNG.md`: Blaze-Tarif, Budget-Alarm, Auth-Anbieter, FCM, Functions, Hosting – was der Organisator
  in der Konsole klicken muss (der Organisator macht diese Schritte selbst, du gibst exakte Anleitungen).
- `docs/ENTSCHEIDUNGEN.md`: alle Architektur-/Design-Entscheidungen mit Begründung.
- `docs/KONZEPT.md`: Architektur, Datenmodell, Abläufe (Sequenzdiagramme für Übergabe, Meldung, Spielende).

---

## 11. Rahmenbedingungen & Zugänge

- Firebase-Projekt **`mr-x-ooe`** existiert (Hosting, Realtime Database in europe-west1, Auth). Der Organisator stellt auf **Blaze** um
  und richtet einen Budget-Alarm ein – gib ihm dafür die genaue Anleitung, sobald du es brauchst.
- Du hast **keinen** Zugriff auf die Firebase-Konsole und keine Service-Account-Schlüssel – Deploys macht der Organisator
  mit `npx firebase-tools deploy` (bzw. später per GitHub Action mit von ihm hinterlegten Secrets). Bereite alles so vor,
  dass er nur wenige, genau beschriebene Befehle ausführen muss.
- Die Daten der alten Version müssen **nicht migriert** werden (außer den Zonen aus `zones.js`).
- Die alte Version bleibt online, bis die neue abgenommen ist; dann Umschalten der Haupt-URL.
- Logos: `assets/logos/` (siehe 8.2).

---

## 12. Meilensteine (jeweils: lauffähig, getestet, committet, gepusht, kurzer Bericht)

1. **Analyse & Konzept:** Bestehenden Code lesen, `docs/KONZEPT.md`, `docs/ENTSCHEIDUNGEN.md`, Datenmodell, Rollen/Rechte,
   Kostenabschätzung, offene Fragen sammeln. **→ Bestätigung durch Organisator abwarten.**
2. **Design:** Design-System (Tokens, Komponenten), Kartenstil, Screens 1–23 als klickbarer Prototyp mit Testdaten.
   **→ Bestätigung abwarten.**
3. **Fundament:** Projekt-Setup (Vite/TS/Framework, Lint, Tests, CI), Firebase-Emulator-Setup, Datenmodell, Security Rules + Rule-Tests,
   Auth-Flows (Super-Admin, Spiel-Admin, Schiri, Team-Beitritt per QR + Passwort).
4. **Spiel-Kern serverseitig:** Functions für Start, Meldeplan, Übergabe/Strafübergabe/Rückgängig, Wartezeiten, Zonen-Sperren,
   Zufallsende/Notstopp, Auswertung/Archiv, Neue Runde, Audit-Log; Standort-Fallback Schiri; Unit- + Emulator-Tests.
5. **Team- & Mister-X-Oberfläche:** Karte, Spur, Countdown, Wartezeit-Overlay, Spielfeld-Warnungen, Chat, Regeln, Onboarding.
6. **Schiri- & Admin-Oberfläche:** Live-Übersicht, Spielsteuerung, Teams/Schiris/Passwörter, Protokoll, Durchsage, Sofort-Meldung.
7. **Zonen-Editor & Mehrere Spiele:** Editor mit GeoJSON-Import/Export, Linz-Vorlage, Super-Admin-Verwaltung.
8. **Benachrichtigungen:** FCM-Push (Android + Web), In-App-Ton/Vibration, Einstellungen.
9. **Android-App:** Capacitor, Hintergrund-GPS mit Foreground-Service, Berechtigungs-Flow, signierte APK per GitHub Action, Doku.
10. **Großbild, Auswertung, Archiv & Replay.**
11. **Tracker-Schnittstelle (Vorbereitung):** HTTP-Endpoint mit Geräte-Token, Zuordnung im Admin, Priorität der Quellen.
12. **Härtung:** E2E-Gesamtspiel, Lasttest, Datenschutz-Löschfristen, Barrierefreiheit, Performance, Sonnen-Modus,
    Fehlerzustände, Screenshots aller Screens, komplette Doku inkl. Flyer.
13. **Abnahme-Paket:** Kurzer Bericht (was fertig ist, wie getestet, bekannte Grenzen), Anleitung für den Feldtest mit
    3–5 Handys in der Linzer Innenstadt, Checkliste für den Spieltag.

---

## 13. Definition of Done (für das Gesamtprojekt)

- Ein komplettes Spiel kann mit **Web (iPhone/Android-Browser)** und **Android-APK** gemischt gespielt werden.
- Mister-X-Meldungen, Spielende und Wartezeiten passieren **zuverlässig serverseitig**, auch wenn das Admin-Gerät offline ist.
- Auf Android wird der Standort **auch bei gesperrtem Bildschirm** gesendet (nachgewiesen im Test/Feldtest-Protokoll).
- Push-Benachrichtigungen kommen auf Android-App und installierter PWA an.
- Alle Rollenrechte sind durch automatisierte Tests abgesichert; niemand Unbefugter sieht Live-Positionen.
- Alle Screens entsprechen dem abgestimmten Design (hell/dunkel/Sonnen-Modus), sind auf Handy **und** Laptop gut nutzbar.
- CI ist grün (Lint, Typecheck, Unit, Rules, E2E), APK wird automatisch gebaut.
- Doku vollständig, Organisator kann ohne Programmierkenntnisse deployen, Spiel vorbereiten und durchführen.
- Laufende Kosten bei normaler Nutzung ≈ 0 € (Rechnung dokumentiert, Budget-Alarm beschrieben).

---

## 14. Fragen, die du zu Beginn klären solltest (falls nicht schon beantwortet)

- Exakter Farbcode und Logo-Dateien (liegen sie in `assets/logos/`? Nutzungsrechte bestätigt?).
- Soll es eine „Pause“-Funktion geben (z. B. Regenunterbrechung)?
- Wie lange dürfen Spiel-Archive (Mister-X-Meldungen, Chat) aufbewahrt werden? (Vorschlag: 1 Jahr, Chat 30 Tage.)
- Sollen Jäger-Teams sich gegenseitig auf der Karte sehen? (Bisher: nein, nur Admin/Schiri.)
- Soll Mister X die Jäger sehen? (Bisher: nein.)
- Gibt es einen Zuschauer-/Eltern-Modus, und was darf der zeigen?
- Wer ist Super-Admin (E-Mail), wie viele Spiel-Admins pro Spiel?
- Soll der Start-Mister-X ausgelost werden können?

**Los geht's mit Meilenstein 1. Viel Erfolg – mach daraus die beste Mister-X-App, die es gibt!**
