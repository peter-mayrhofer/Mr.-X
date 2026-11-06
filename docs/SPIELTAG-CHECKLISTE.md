# Checkliste für den Spieltag

Zum Ausdrucken und Abhaken. Details stehen im [Handbuch für die Spielleitung](ADMIN-HANDBUCH.md).

## Eine Woche vorher

- [ ] Feldtest mit 3–5 Handys gemacht ([`FELDTEST.md`](FELDTEST.md)), Probleme behoben
- [ ] Neueste Version veröffentlicht (`git pull`, `npm ci`, `npm run deploy` – [`BETRIEB.md`](BETRIEB.md) Schritt 10);
      **nicht am Spieltag selbst** veröffentlichen
- [ ] Android-App (`mister-x.apk`) liegt am Server: Startseite am Android-Handy zeigt „Android-App installieren“
- [ ] Spiel in der Verwaltung angelegt, Admin-Passwort an die Spielleitung übergeben
- [ ] Spielfeld geprüft und gespeichert (Spielfeld-Editor: „Keine Überschneidungen – alles in Ordnung“)
- [ ] Regeln eingestellt: Meldeintervall, Vorsprung, Wartezeit, Umkreis, Zufallsende
- [ ] Team-Passwort und Schiri-Code festgelegt und notiert
- [ ] Flyer gedruckt (Teams & Zugänge → Zugänge → Drucken), Team-Passwort und Notfall-Nummer eingetragen
- [ ] Schiris eingeteilt (mindestens einer begleitet Mister X), Schiri-Code und Kurzeinweisung verschickt
- [ ] Optional: Tracker in der Fahne eingerichtet und getestet (sendet?)
- [ ] Eltern informiert (Datenschutz-Kurztext aus der App, Zuschauer-Link `…/#/z/<spiel-code>`)

## Am Vortag

- [ ] Laptop der Spielleitung geladen, Ladegerät, Handy-Hotspot oder WLAN für die Zentrale geklärt
- [ ] Großbild: Laptop + Beamer + Kabel, Großbild-Link gespeichert (Teams & Zugänge → Großbild-Link)
- [ ] Ersatz-Powerbanks für Teams, ein Ersatz-Handy für Notfälle
- [ ] Wetter geprüft (Pause-Funktion bei Regen)
- [ ] Cloudflare-Dashboard erreichbar (Anmeldung funktioniert)

## Am Treffpunkt – vor dem Start

- [ ] Spielleitung angemeldet, **Live** zeigt den Warteraum
- [ ] Flyer ausgeteilt; jedes Team ist beigetreten (Live: Anzahl Teams stimmt)
- [ ] Jedes Team hat das Onboarding fertig: Warteraum zeigt **Standort: gut** und **Benachrichtigungen: gut**
- [ ] Android-Teams: Akku-Optimierung ausgeschaltet (Onboarding Schritt 4)
- [ ] iPhone-Teams: Web-App vom **Home-Bildschirm** geöffnet
- [ ] Keine Warnung „… hat noch keinen Standort geschickt“ in der Live-Übersicht
- [ ] Schiris angemeldet, Begleit-Schiri hat **Ich begleite Mister X** eingeschaltet
- [ ] Großbild läuft
- [ ] Regeln kurz erklärt (Tapperl, Zusammenbleiben, keine Gebäude, Öffis höchstens 3 Stationen, Halstuch)
- [ ] Notfall-Nummer der Spielleitung ist auf jedem Flyer
- [ ] Start-Mister-X gewählt oder ausgelost → **Spiel starten**

## Während des Spiels

- [ ] Live-Übersicht im Blick: Warnungen (Mister X ohne Standort, außerhalb des Spielfelds, Team ohne Standort)
- [ ] Übergaben tragen die Schiris ein; Fehler innerhalb von 2 Minuten **Rückgängig**
- [ ] Verkleinerungen zu den geplanten Zeiten (Steuerung → Spielfeld verkleinern)
- [ ] Postfach im Chat beantworten (Akku leer, verlaufen …)
- [ ] Bei Regen/Unterbrechung: **Pause**, danach **Fortsetzen**
- [ ] Notfall: **Notstopp** beendet sofort (aktueller Mister X gewinnt)

## Nach dem Spiel

- [ ] Auswertung auf dem Großbild gezeigt, Sieger geehrt
- [ ] Alle Teams zurück am Treffpunkt (Anzahl prüfen!)
- [ ] Archiv geprüft, bei Bedarf **Als Datei sichern**
- [ ] Für ein weiteres Spiel: **Neue Runde vorbereiten** und neues Team-Passwort festlegen
- [ ] Ende der Saison: Spiel in der Verwaltung archivieren oder löschen
- [ ] Verbrauch im Cloudflare-Dashboard kurz angesehen (Workers & Pages → mister-x → Metrics)
- [ ] Rückmeldungen der Teams gesammelt (was war unklar, was hat gefehlt?)

**Automatisch erledigt** (nichts zu tun): Live-Standorte sind bei Spielende gelöscht, Chat und Protokoll nach 30 Tagen,
Archiv nach einem Jahr.
