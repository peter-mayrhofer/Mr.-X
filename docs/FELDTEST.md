# Feldtest in der Linzer Innenstadt (3–5 Handys)

Ziel: alles, was sich im Labor nicht prüfen lässt, **einmal draußen mit echten Handys** nachweisen – vor allem, dass
**Android den Standort bei gesperrtem Bildschirm sendet** und **Benachrichtigungen ankommen**. Im Android-Emulator ist
beides schon automatisch geprüft, Web Push auch über die echten Push-Dienste von Google und Mozilla
([`ABNAHME.md`](ABNAHME.md) Abschnitt 2); draußen kommen echtes GPS, Mobilfunk, Apples Push-Dienst (iPhone) und die
Akku-Sparfunktionen der Hersteller dazu.
Dauer: ca. **2 Stunden** inklusive Vorbereitung. Ergebnisse ins Protokoll unten eintragen und an die Projektleitung
schicken.

## 1. Wer und was

| Rolle | Gerät | Wer |
|---|---|---|
| Spielleitung | Laptop (mit Handy-Hotspot) oder Handy | |
| Schiri | Handy (Android oder iPhone) | |
| Team A – „Android-App“ | **Android-Handy mit der APK** | |
| Team B – „iPhone“ | **iPhone mit der Web-App vom Home-Bildschirm** | |
| Team C – „Browser“ (optional) | Android-Handy im Browser (Chrome) | |
| Tracker (optional) | altes Android-Handy mit „Traccar Client“ | |

Mitnehmen: geladene Handys, je eine Powerbank, Notizzettel, Uhr. Treffpunkt z. B. Hauptplatz.

## 2. Vorbereitung (am Vortag, ca. 20 Minuten)

1. Server ist eingerichtet ([`BETRIEB.md`](BETRIEB.md)); am besten in der **Vorschau-Umgebung** testen
   (`npm run deploy:vorschau`, Adresse `https://mister-x-vorschau.mr-x-ooe.workers.dev`).
2. Neueste APK aus GitHub (Actions → „Android-APK“ → Artefakt bzw. Release) nach `app\public\mister-x.apk` kopieren und
   veröffentlichen – dann bietet die Startseite am Android-Handy „Android-App installieren“ an ([`ANDROID-APK.md`](ANDROID-APK.md)).
3. In der Verwaltung ein Spiel „Feldtest“ mit Vorlage **Linz Innenstadt** anlegen. Als Spielleitung öffnen:
   **Meldeintervall 2 Min**, **Vorsprung 2 Min**, **Wartezeit 2 Min**, **Zufallsende 1–1 h** (Steuerung → Regeln).
4. Team-Passwort und Schiri-Code festlegen, Flyer drucken (Teams & Zugänge → Zugänge → Drucken).
5. Alle Handys: Akkustand notieren (Protokoll, Zeile „Akku Start“).

## 3. Ablauf mit Prüfpunkten

Jeder Prüfpunkt hat eine Nummer (P1 …). Im Protokoll ✔, ✖ oder eine Bemerkung eintragen.

### Beitritt (Treffpunkt, 15 Min)

| Nr. | Was tun | Erwartet |
|---|---|---|
| P1 | Team A (Android): QR-Code scannen | Startseite zeigt **„Android-App installieren“** |
| P2 | Team A: App installieren (unbekannte Quellen erlauben), öffnen, Team beitreten mit Spiel-Code | Onboarding; Standort „Beim Verwenden der App“ und Benachrichtigungen erlaubt; Akku-Optimierung aus |
| P3 | Team B (iPhone): QR-Code scannen, Safari → Teilen → **Zum Home-Bildschirm**, von dort öffnen, beitreten | Onboarding; Benachrichtigungen erlauben (nur vom Home-Bildschirm möglich) |
| P4 | Team C (Browser): beitreten, Onboarding | Warteraum zeigt „Standort: gut“ |
| P5 | Zweites Handy für Team A mit gleichem Teamnamen | Frage „Team gibt es schon“ → **Als Ersatzgerät beitreten** klappt |
| P6 | Schiri meldet sich an, schaltet **Ich begleite Mister X** ein | Spielleitung sieht den Schiri auf der Karte |
| P7 | Spielleitung: Live-Übersicht | alle Teams mit Standort, keine Warnung „ohne Standort“ |
| P8 | Optional: Tracker anlegen, im Traccar Client Kennung + Server-Adresse eintragen, Zuordnung **Fahne** | Tracker zeigt „sendet“ |

### Spiel (60 Min)

| Nr. | Was tun | Erwartet |
|---|---|---|
| P9 | **Team A sperrt schon vorher den Bildschirm** und steckt das Handy ein (wie im echten Spiel). Spielleitung: Mister X = **Team A** wählen, **Spiel starten** | Countdown 3-2-1 auf den offenen Handys; B und C sehen die Wartezeit; bei Team A bleibt die Dauer-Benachrichtigung „Mister X läuft“ |
| P10 | **Team A geht mit gesperrtem Handy** 10 Minuten | Spielleitung sieht Team A **weiterlaufen** (Standort höchstens 30 s alt); Meldungen kommen mit aktuellem Standort |
| P11 | Team B und C: Handy gesperrt in der Tasche, wenn eine Meldung fällig ist | **Benachrichtigung** „Mister X gemeldet“ auf dem Sperrbildschirm (B: iPhone-Web-App, C: Browser) |
| P12 | Team A (App im Hintergrund) bei einer Durchsage der Spielleitung | Benachrichtigung der Android-App |
| P13 | Team B fängt Team A, der **Schiri** trägt die Übergabe ein | B wird rot („Ihr seid Mister X“), A sieht „Erwischt“ + Wartezeit, C „Gefangen!“ |
| P14 | Schiri: **Rückgängig** | alles wie vorher, alle sehen die Erklärung |
| P15 | Übergabe nochmal richtig eintragen | wie P13 |
| P16 | Team C geht in einen Hauseingang/Durchgang ohne Netz (oder Flugmodus 2 Min), dann wieder raus | Oben „Kein Netz“, danach verbindet sich die App von selbst; Standort kommt wieder an |
| P17 | Team B (Mister X) geht bewusst über die Spielfeldgrenze | Warnung „Spielfeldgrenze“ bzw. „außerhalb“ bei B; Warnung bei der Spielleitung |
| P18 | Spielleitung: einen Bereich **sperren** (Verkleinerung) | alle sehen „… wird gesperrt!“ und die Schraffur |
| P19 | Chat: Team C schreibt der Spielleitung direkt | Postfach zeigt die Nachricht mit Zähler; Antwort kommt nur bei C an |
| P20 | Spielleitung klappt den Laptop **15 Minuten zu** | Meldungen kommen trotzdem pünktlich (Server-Alarm) |
| P21 | Großbild (optional, Laptop): Großbild-Link öffnen | Karte, Countdown, Rangliste, Ereignisse laufen mit |
| P22 | In engen Gassen (z. B. Altstadt) auf die Genauigkeit achten | Notieren: wie oft „GPS schwach“, größte Abweichung in Metern |
| P23 | Karte am ältesten Android-Handy verschieben und zoomen | flüssig (keine Ruckler über 1 Sekunde) |

### Ende (10 Min)

| Nr. | Was tun | Erwartet |
|---|---|---|
| P24 | Spielleitung: **Notstopp** (oder Ende abwarten) | alle sehen die Auswertung mit Sieger |
| P25 | Team A: Handy weiter in der Tasche | die Dauer-Benachrichtigung verschwindet nach dem Schließen; **kein** Standort mehr bei der Spielleitung |
| P26 | Spielleitung: **Archiv** öffnen, Wiederholung abspielen | Meldungen und Übergaben stimmen mit dem Erlebten überein |
| P27 | Alle: Akkustand notieren | Verbrauch pro Stunde berechnen (Ziel: ≤ 20 %/h mit Bildschirm aus) |
| P28 | Spielleitung: **Neue Runde vorbereiten** | alle Team-Handys zeigen „Ihr wurdet abgemeldet“ |
| P29 | Cloudflare-Dashboard → Workers & Pages → mister-x → Metrics | Anfragen und Fehler notieren (erwartet: einige Tausend Anfragen, kaum Fehler) |

## 4. Protokoll (ausfüllen)

Datum: ______________  Wetter: ______________  Uhrzeit Start/Ende: ______________

| Gerät | Modell / System | App oder Browser | Akku Start | Akku Ende | Bemerkung |
|---|---|---|---|---|---|
| Team A | | Android-App | | | |
| Team B | | iPhone Web-App | | | |
| Team C | | Browser | | | |
| Schiri | | | | | |
| Spielleitung | | | | | |

| Prüfpunkt | ✔ / ✖ | Bemerkung |
|---|---|---|
| P1 | | |
| P2 | | |
| P3 | | |
| P4 | | |
| P5 | | |
| P6 | | |
| P7 | | |
| P8 | | |
| P9 | | |
| **P10 – Android mit gesperrtem Bildschirm** | | Standort-Alter laut Spielleitung: ___ s |
| **P11 – Benachrichtigung iPhone / Browser** | | |
| **P12 – Benachrichtigung Android-App** | | |
| P13 | | |
| P14 | | |
| P15 | | |
| P16 | | |
| P17 | | |
| P18 | | |
| P19 | | |
| P20 | | |
| P21 | | |
| P22 | | größte Abweichung: ___ m |
| P23 | | |
| P24 | | |
| P25 | | |
| P26 | | |
| P27 | | Verbrauch: ___ %/h |
| P28 | | |
| P29 | | Anfragen: ___ Fehler: ___ |

## 5. Wenn etwas nicht klappt

- **P10 scheitert** (Standort hört nach ein paar Minuten auf): Akku-Optimierung für „Mister X“ prüfen
  (Einstellungen → Apps → Mister X → Akku → „Nicht eingeschränkt“); bei Samsung zusätzlich „Apps im Standby“ /
  „Nie schlafende Apps“ – Modell notieren und melden.
- **P11 scheitert am iPhone:** wurde die App vom Home-Bildschirm geöffnet? iOS-Version notieren (ab 16.4 nötig).
- **Fehler im Cloudflare-Dashboard:** `npx wrangler tail -c server/wrangler.jsonc` während des Tests laufen lassen
  und die Ausgabe mitschicken ([`BETRIEB.md`](BETRIEB.md) Abschnitt 12).
