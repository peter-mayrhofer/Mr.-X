# Mister X – App-Spezifikation

Live-Version von „Scotland Yard“ in der Linzer Innenstadt.
Ziel: eine Handy-Web-App, die zuverlässiger ist als nur die WhatsApp-Gruppe.

## Das Spiel (Ist-Stand)

- Ca. 160 Teilnehmer in Teams (Ortsgruppen) zu je ca. 7 Personen → **ca. 20–25 Teams** (variiert jährlich).
- Ein Team ist **Mister X**, trägt die **Fahne** sichtbar und startet zuerst.
- Nach **10 Min** sendet Mister X seinen Standort, dann starten die anderen Teams.
- **Fangen:** einer Person des Mister-X-Teams ein „Tapperl“ geben.
- **Übergabe:** Das fangende Team wird neuer Mister X (bekommt Fahne), meldet Status + Standort.
  Ehemaliger Mister X + alle Teams in der Nähe warten **5 Min** (Vorsprung).
- **Meldepflicht:** nur Mister X, alle **10 Min** (später per Regeländerung alle **5 Min**).
- **Ende:** zufällig nach ca. 3–4 h. Wer dann Mister X ist, gewinnt.
- **Regeln:** Team bleibt zusammen (Sichtkontakt ~20 m), Mister X nicht in Gebäuden, Öffis max. 3 Stationen
  (Einstieg zählt nicht), Grenzstraßen gehören zum Spielfeld, keine Privatgespräche im Gruppenchat.
- **Schiri** begleitet Mister X (zu Fuß / E-Roller). Bei Uneinigkeit entscheiden Schiri / Spielleitung.
- **Spielfeld:** Innenstadt Linz (schwarze Linie auf der Karte), wird in **mehreren Stufen verkleinert**
  (Zickzack-Bereiche fallen nacheinander weg).
- **Regelbruch / Spielfeld verlassen:** situationsabhängig. Meist nur Warnung, ggf. Fahne an ein verfolgendes Team.

## Rollen

| Rolle | Wer | Darf |
|---|---|---|
| Team | 1 Handy pro Ortsgruppe | eigenen Standort senden, Mister-X-Meldungen sehen, Chat |
| Schiri | begleitet Mister X | alles was Team sieht + Live-Standorte aller, **Übergabe-Knopf** |
| Spielleitung | Zentrale | alles + Einstellungen, Zonen-Stufe, Spielende, Korrekturen |

## Funktionen

1. **Live-Standortverfolgung** aller Teams (GPS im Browser).
   - Live sehen: **nur Spielleitung + Schiri** (Mister X *und* Jäger).
   - Jäger-Teams sehen nur die Mister-X-Meldungen.
2. **Automatische Mister-X-Meldung** alle 10 / 5 Min (Intervall von Spielleitung umschaltbar).
   Bricht die Verbindung ab, wird der **letzte bekannte Standort** angezeigt (mit Uhrzeit).
3. **Übergabe-Knopf** (nur Schiri, Spielleitung): fangendes Team auswählen →
   neuer Mister X, sofortige Standortmeldung, **5 Min Sperre** für altes Team + alle Teams im **Umkreis**
   (Radius von Spielleitung einstellbar).
4. **Fehlübergabe:**
   - Übergabe **rückgängig** machen (falsches Team gewählt).
   - **Strafübergabe** ohne Fangen (Regelbruch), Zielteam wählt Schiri / Spielleitung.
5. **Spielfeld-Warnung:** Mister X außerhalb der aktuellen Zone → Warnung an Mister X + Spielleitung/Schiri.
   Konsequenz entscheidet der Mensch.
6. **Zonen:** Start + Verkleinerungsstufen fest eingebaut (nach der Papierkarte),
   Spielleitung schaltet die Stufe weiter.
7. **Chat:** ein Gruppenchat für alle + privater Kanal je Team ↔ Spielleitung.
   Automatische Meldungen (Standort, Übergabe, Zonenwechsel) erscheinen im Gruppenchat.
8. **Zufallsende:** Spielleitung gibt Zeitfenster ein (z. B. 3–4 h), App wählt geheim den Zeitpunkt.
   Zusätzlich **Notstopp** von Hand.
9. **Auswertung am Ende:**
   - Letzter Mister X (Hauptsieger)
   - Längste Zeit als Mister X
   - Am öftesten Mister X
   - Meiste Distanz (GPS)
10. **Anmeldung:** Teams registrieren sich selbst mit Teamname + Passwort.
    Schiri/Spielleitung-Rechte vergibt die Spielleitung.

## Technik (Vorschlag)

- **Frontend:** einfache Web-App (HTML/JS), Karte mit **Leaflet + OpenStreetMap**, läuft im Handy-Browser,
  als PWA zum Homescreen hinzufügbar.
- **Backend:** **Firebase** – Authentication (Login), Realtime Database (Live-Standorte, Chat), Hosting.
  Gratis-Kontingent reicht für ~25 Teams + Leitung (max. 100 gleichzeitige Verbindungen).
- **Sicherheit:** Wer welchen Standort lesen darf, wird in den **Firebase Security Rules** erzwungen,
  nicht nur in der Oberfläche versteckt (sonst könnte ein Team Mister X mitlesen).

## Bekannte Risiken

- **GPS im Hintergrund:** Browser senden keinen Standort, wenn der Bildschirm aus ist oder die App im
  Hintergrund läuft (v. a. iPhone). Für den Prototyp: Bildschirm bleibt an (Wake Lock), Powerbank mitnehmen.
  Falls das nicht reicht: später als echte App verpacken (z. B. Capacitor).
- **Akku:** ständiges GPS + Bildschirm an → Powerbank pro Team-Handy einplanen.
- **Funklöcher:** letzter bekannter Standort + Uhrzeit wird angezeigt.

## Noch offen

- Genaue Regel, wann Strafübergabe vs. nur Warnung (bleibt Schiri-Entscheidung).
- Genauer Verlauf der Verkleinerungsstufen (Reihenfolge der Zickzack-Bereiche).
