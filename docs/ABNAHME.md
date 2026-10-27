# Abnahmebericht: Neubau Mister X – Rote Falken

**Stand: 27.10.2026**, Branch `claude/elegant-volta-i3dbpr`, Pull Request
[peter-mayrhofer/Mr.-X#1](https://github.com/peter-mayrhofer/Mr.-X/pull/1).
Grundlage: [`PROMPT-NEUBAU.md`](../PROMPT-NEUBAU.md) (Meilensteine 1–13, Definition of Done) und
[`NACHRICHT-AN-FRONTEND.md`](../NACHRICHT-AN-FRONTEND.md) (Umzug auf Cloudflare, Meilenstein 9b).

Kurz: **Alle Meilensteine sind gebaut, getestet und dokumentiert.** Offen ist, was sich nur mit echten Handys und dem
echten Cloudflare-Konto nachweisen lässt – dafür gibt es den [Feldtest](FELDTEST.md) – sowie zwei Angaben des Vereins
(Abschnitt 4).

## 1. Was fertig ist

| Bereich | Inhalt |
|---|---|
| **Spiel-Server** | Cloudflare Worker + ein Spielraum (Durable Object) pro Spiel + D1-Datenbank, Gratis-Tarif ohne Zahlungsart. Alle Regeln laufen am Server: Start (gewählt/ausgelost), Meldeplan, Übergabe/Strafübergabe/Rückgängig, Wartezeiten im Umkreis, Verkleinerung, Pause, Zufallsende/Notstopp, Auswertung, Archiv, Neue Runde, Löschfristen – per Alarm, auch wenn kein Handy online ist |
| **Live-Verbindung** | WebSocket mit Snapshot + Änderungen, **nach Rolle gefiltert** (Teams sehen keine fremden Standorte), automatischer Wiederaufbau, Server-Zeit, doppelte Anfragen werden erkannt |
| **Teams & Mister X** | Beitritt per QR + Passwort, Ersatzgerät, Onboarding (Standort, Benachrichtigungen, Akku), Warteraum mit Checks, Karte mit Spur und Countdown, Wartezeit-Overlay, Übergabe-Szenen, Durchsagen, Verkleinerung, Spielfeld-Warnung, Chat, Regeln, Auswertung |
| **Schiri** | Karte aller Teams, Übergabe nach Nähe mit Vorschau der Wartezeit, Rückgängig, „Ich begleite Mister X“ (Standort-Ersatz) |
| **Spielleitung** | Live-Übersicht mit Warnungen, Steuerung (Start, Pause, Notstopp, Regeln live, Verkleinern, Sofort-Meldung, Durchsage), Teams & Zugänge (Passwörter, QR-Flyer, Großbild-Link, Tracker, Neue Runde), Spielfeld-Editor (GeoJSON, Linz-Vorlage), Protokoll, Postfach |
| **Organisator** | Verwaltung mit Passwort (Setup-Geheimnis), Spiele anlegen/öffnen/archivieren/löschen |
| **Großbild, Zuschauer, Archiv** | Beamer-Ansicht, Zuschauer-Ansicht ohne Jäger-Standorte, Auswertung mit Feier, Archiv mit Wiederholung (Zeitschieberegler), Sichern als Datei, Drucken |
| **Benachrichtigungen** | Web Push (VAPID, verschlüsselt) für Browser und iPhone-Web-App; Android-App zeigt lokale Benachrichtigungen; Ton/Vibration in der App; Arten pro Gerät wählbar |
| **Android-App** | Capacitor-App mit Standort im Hintergrund (Vordergrund-Dienst, natives HTTP alle 30 s), Benachrichtigungen, Akku-Hinweis; APK-Build per GitHub Action; Download-Knopf auf der Startseite |
| **Tracker** | `/tracker` im OsmAnd-/Traccar-Format, Zuordnung Fahne/Team, Vorrang vor Handys |
| **Design** | eigenes Design-System „Fahndung in Rot-Weiß“, hell/dunkel/Sonnen-Modus, alle 23 Screens für Handy und Laptop ([Screenshots](screens/)) |
| **Doku** | [Handbuch Spielleitung](ADMIN-HANDBUCH.md), [Team-Anleitung](TEAM-ANLEITUNG.md) + [Flyer](flyer-beispiel.pdf), [Betrieb (Windows)](BETRIEB.md), [Android-APK](ANDROID-APK.md), [Limits & Kosten](CLOUDFLARE-LIMITS.md), [Konzept](KONZEPT.md), [API](API.md), [Entscheidungen](ENTSCHEIDUNGEN.md) (E-01 bis E-45), [Feldtest](FELDTEST.md), [Spieltag-Checkliste](SPIELTAG-CHECKLISTE.md) |

## 2. Wie getestet wurde

Alle Tests laufen bei **jedem Push automatisch in GitHub Actions** (Lint, Typecheck, Unit, Server, Ende-zu-Ende,
Build) – der letzte Lauf war grün. Lokal zuletzt: **84 Unit-Tests** und **192 Server-/Ende-zu-Ende-Tests** grün.

| Testart | Was genau | Dateien |
|---|---|---|
| Unit | Spiel-Logik: Meldeplan, Geometrie/Zonen mit Toleranz, Wartezeit-Umkreis, Auswertung, Teams, Push-Empfänger, Wiederholung; Web-Push-Verschlüsselung gegen den Testvektor aus RFC 8291 | `shared/test/`, `server/test/` |
| Server | gegen die **lokale Cloudflare-Laufzeit** (dieselbe wie im Betrieb): Anmeldung, Spielablauf mit echten Alarmen, Push, Verwaltung, Tracker, Ruhezustand (Hibernation, Neustart, Löschfristen) | `tests/zugang`, `spiel`, `push`, `verwaltung`, `tracker`, `ruhezustand` |
| Rechte & Angriffe | jede Rolle gegen jede Aktion und Sicht, gefälschte Tokens, Passwort-Raten, fremde Standorte, Zuschauer ohne Archiv | `tests/rechte` |
| Ende-zu-Ende | simulierte Handys (Playwright, Fake-GPS, Zeitraffer) über die echte App: Anmeldung aller Rollen, Team-Handys, Schiri & Spielleitung, Verwaltung, Großbild & Archiv, Tracker und ein **ganzes Spiel** von Beitritt bis Neue Runde | `tests/e2e-*` |
| Last | 49 Geräte (30 Teams), Zeitraffer: 1 Standort = 1 Nachricht, Verzögerung Median 0,4 s / 95 % < 1,1 s, hochgerechnet ≈ 4 % der Gratis-Limits für 4 h | `tests/last` |
| Barrierefreiheit | axe-core: alle Screens in allen Varianten in dunkel/hell/Sonne, WCAG 2.1 AA + Empfehlungen | `tests/barrierefreiheit` |
| Visuell | Screenshots aller Screens in drei Darstellungen, Handy und Laptop | `docs/screens/` |
| Performance | Lighthouse mobil (gedrosseltes Mobilfunknetz): Startseite **94–96 / 100 / 100** (Performance / Barrierefreiheit / Best Practices), Beitritt 95 / 100 / 96*, Hilfe 95 / 100 / 100; erste Anzeige ≈ 2,1–2,3 s | – |

\* Abzug nur, weil beim Messen ohne Spiel-Server eine Anfrage fehlschlägt.

## 3. Definition of Done

| Anforderung (PROMPT-NEUBAU §13) | Stand |
|---|---|
| Komplettes Spiel mit Web (iPhone/Android-Browser) **und** Android-APK gemischt | Web: ✔ automatisch getestet (ganzes Spiel). APK: gebaut in CI, dieselbe App; **Nachweis am echten Handy im Feldtest** (P2, P9–P15) |
| Meldungen, Spielende, Wartezeiten zuverlässig am Server, auch ohne Admin-Gerät | ✔ Server-Alarme, getestet (u. a. Ruhezustand, Neustart, Spielleitung offline) |
| Android sendet den Standort auch bei gesperrtem Bildschirm | gebaut (Vordergrund-Dienst + natives HTTP); **Nachweis im Feldtest-Protokoll** (P10) |
| Push kommt auf Android-App und installierter PWA an | gebaut und am Server getestet (Verschlüsselung nach RFC, Empfänger, kein Doppel); **Zustellung auf echten Geräten im Feldtest** (P11, P12) |
| Rollenrechte automatisch getestet, niemand Unbefugter sieht Live-Positionen | ✔ `tests/rechte` + Lasttest prüft es unter Last |
| Alle Screens im abgestimmten Design (hell/dunkel/Sonne), Handy **und** Laptop | ✔ Screenshots, Barrierefreiheits-Test |
| CI grün (Lint, Typecheck, Unit, Server, E2E), APK automatisch gebaut | ✔ (Server-Tests statt Firebase-Rules, siehe E-36) |
| Doku vollständig, Organisator kann ohne Programmierkenntnisse deployen, vorbereiten, durchführen | ✔ BETRIEB, ADMIN-HANDBUCH, TEAM-ANLEITUNG, Flyer, Checkliste |
| Laufende Kosten ≈ 0 € | ✔ Cloudflare-Gratis-Tarif **ohne Zahlungsart** – eine Abrechnung ist gar nicht möglich, daher braucht es keinen Budget-Alarm; ein Spiel braucht ≈ 4 % (schlimmster Fall ≈ 20 %) der Tageslimits ([Rechnung und Messung](CLOUDFLARE-LIMITS.md)) |

## 4. Bekannte Grenzen und offene Punkte (ehrlich)

**Braucht echte Geräte (Feldtest):**

1. **Die Android-App wurde noch nicht auf einem echten Handy getestet** – in der Entwicklungsumgebung gibt es kein
   Android-Gerät. Gebaut wird sie bei jedem Push; der Feldtest prüft Installation, Standort mit gesperrtem Bildschirm
   und Benachrichtigungen. Manche Hersteller (Samsung, Xiaomi, Huawei) brauchen zusätzliche Akku-Einstellungen.
2. **Push-Zustellung** an echte Push-Dienste (Google, Apple, Mozilla) ist nur im Feldtest prüfbar; die Verschlüsselung
   ist gegen den offiziellen Testvektor geprüft.
3. **iPhone:** Benachrichtigungen nur als Web-App vom Home-Bildschirm (ab iOS 16.4); Standort nur bei offener App und
   eingeschaltetem Bildschirm (Grenze von iOS für Web-Apps – die App hält den Bildschirm wach).
4. **Karte flüssig auf älteren Android-Handys (≥ 50 fps):** nur am echten Gerät messbar (Feldtest P23). Lighthouse kann
   Kartenseiten hier nicht sinnvoll messen (keine Grafikkarte in der Testumgebung).

**Braucht das echte Cloudflare-Konto:**

5. **Veröffentlicht ist noch nichts** – das macht der Organisator mit [`BETRIEB.md`](BETRIEB.md) (ca. 30 Minuten).
   Der Lasttest lief in der lokalen Cloudflare-Laufzeit; die echten Zahlen zeigt danach das Dashboard.
6. **CPU-Limit:** Die Cloudflare-Doku nennt für den Gratis-Tarif 10 ms (Workers) bzw. 30 s (Durable Objects). Die
   Passwort-Prüfung (≈ 12 ms) läuft deshalb im Spielraum; falls nötig, lässt sich die Rundenzahl halbieren
   ([`CLOUDFLARE-LIMITS.md`](CLOUDFLARE-LIMITS.md) Abschnitt 2).
7. **Datenstandort:** Spielräume entstehen nahe dem ersten Zugriff (also in Europa); eine EU-Pflicht („Jurisdiction“)
   ist nicht eingeschaltet, weil sie sich lokal nicht testen lässt.
8. **Signierte APK:** entsteht bei einem Versions-Tag (`v…`) oder per Knopf in GitHub, sobald die Signier-Secrets
   hinterlegt sind ([`ANDROID-APK.md`](ANDROID-APK.md) Abschnitt 2); bei normalen Pushes entsteht eine Test-APK.

**Braucht Angaben des Vereins:**

9. **F1 – Logos als Vektorgrafik:** verwendet werden die freigestellten PNG-Dateien aus `assets/logos/`; mit SVG/PDF
   werden sie auf Großbild und Flyer schärfer.
10. **F12 – Datenschutz:** Der Hinweis in der App nennt die Roten Falken / Kinderfreunde OÖ und die Projekt-Adresse
    `mr.x.rf.ooe@gmail.com`. Bitte den genauen Namen und die Anschrift des Verantwortlichen nennen und den Text von der
    zuständigen Stelle im Verein prüfen lassen (Text: `app/src/texte.ts`, Abschnitt `datenschutz`).

**Bewusst so gelöst:**

11. Die alte App (`https://mr-x-ooe.web.app`) und ihr Code (`legacy/`) sind unverändert; umgeschaltet wird nach der
    Abnahme.
12. Einen Play-Store-Eintrag gibt es nicht (Verteilung als APK, E-38); eine iOS-App ist nicht Teil des Projekts.

## 5. Nächste Schritte

1. Server einrichten und veröffentlichen ([`BETRIEB.md`](BETRIEB.md)), zuerst in der Vorschau-Umgebung.
2. Signier-Schlüssel erzeugen und in GitHub hinterlegen, signierte APK bauen, auf den Server legen
   ([`ANDROID-APK.md`](ANDROID-APK.md), [`BETRIEB.md`](BETRIEB.md) Schritt 9).
3. **Feldtest** mit 3–5 Handys in der Innenstadt ([`FELDTEST.md`](FELDTEST.md)), Protokoll zurückschicken.
4. Offene Angaben F1 (Logos) und F12 (Datenschutz) nachreichen.
5. Erstes echtes Spiel mit der [Spieltag-Checkliste](SPIELTAG-CHECKLISTE.md); danach die Haupt-Adresse umstellen.
