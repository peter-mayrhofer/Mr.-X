# Design: „Fahndung in Rot-Weiß“

Meilenstein 2. Konzept-Grundlage: [`KONZEPT.md`](KONZEPT.md) Abschnitt 10, Entscheidungen E-12 bis E-14, E-18.
Den klickbaren Prototyp startet man wie im [README](../README.md) beschrieben (`#/prototyp`), die Komponenten-Bibliothek
mit allen Zuständen liegt unter `#/komponenten`.

## Leitidee

Ein Handy-Spiel mit Agenten-Gefühl in Rot-Weiß: dunkles Nacht-Blau als Spielfläche, kräftiges Rot
für alles, was mit Mister X und Aktionen zu tun hat, Weiß für Lesbarkeit. Agenten-Elemente sparsam: schmale, fette
Großbuchstaben wie Akten-Etiketten, Fadenkreuz-Ecken am Countdown, Radar-Ping bei neuen Meldungen, Stempel „Gefangen!“.
Die Wärme kommt über runde Formen, Fahne und Falke und die freundliche Sprache („Tapperl“).

## Design-Tokens (`app/src/ui/tokens.css`)

| Token | Wert | Herkunft / Verwendung |
|---|---|---|
| `--mrx-rot` | `#C51A1A` | Mister-X-Rot – Mister X, Hauptaktionen |
| `--mrx-blau` | `#214C6B` | Basis des Nacht-Blaus |
| Signalfarben | Gelb `#FFC531`, Grün `#2FBF71`, Blau `#3B9CFF` | Warnung/Wartezeit, ok/frei, Info/eigenes Team |
| Schrift | Barlow Condensed (Überschriften, Countdown) + Inter (Text) | lokal eingebunden, tabellarische Ziffern, **Mindestgröße 16 px** |
| Touch-Ziele | 48 / 56 / 72 px | wichtige Aktionen unten in der Daumenzone |
| Bewegung | 150 / 250 / 400 ms | „Bewegung reduzieren“ schaltet Animationen ab |

Drei Darstellungen über `data-theme`: **Dunkel** (Standard im Spiel), **Hell**, **Sonne** (Hochkontrast: weißer Grund,
schwarze Schrift, 2–3 px Ränder, keine Schatten/Transparenz). Umschalten: Einstellungen oder Sonnen-Knopf auf der Karte.
Mister-X-Modus: rote Statusleiste + roter Rahmen um den ganzen Bildschirm.

Die Logos liegen freigestellt unter `app/public/logos/` (Hintergrund entfernt, der weiße Falke im Kreis bleibt weiß);
für dunkle Flächen gibt es eine Negativ-Version mit weißem Schriftzug. Für Splash und Großbild sind Vektor-Logos
nötig (Frage F1).

## Karte

Eigener MapLibre-Stil auf OpenFreeMap-Kacheln (`app/src/map/style.ts`): gedämpfte Basiskarte, Fußgängerzonen
(Landstraße) hervorgehoben, Straßennamen fett mit Halo, **Haltestellen** ab Zoom 15 (Öffi-Regel), außerhalb des
Spielfelds stark abgedunkelt, leuchtend rote Grenzlinie, gesperrte Bereiche rot schraffiert mit Namen („WESTEN
GESPERRT“), Mister-X-Spur gestrichelt mit verblassenden Punkten und Uhrzeiten, letzte Meldung als pulsierender
Fahnen-Marker. Teamnamen erscheinen erst ab Zoom 15,5 (sonst überlappen 30 Teams; die Kürzel bleiben).
Fällt OpenFreeMap aus, schaltet die Karte automatisch auf OSM-Rasterkacheln um.

## Screens

Alle Bilder: Handy 390 × 844 bzw. Laptop 1440 × 900, Testdaten aus einem laufenden Spiel.
Jeder Screen liegt in drei Darstellungen vor: [`screens/dunkel/`](screens/dunkel/), [`screens/hell/`](screens/hell/),
[`screens/sonne/`](screens/sonne/). Weitere Zustände (in Klammern) sind im Prototyp über das Menü erreichbar.

### Einstieg

| # | Screen | Dunkel | Hell | Sonne |
|---|---|---|---|---|
| 1 | **Startseite**<br>Alle<br>Logo, App-Name, „Team beitreten“, dezent Schiri und Spielleitung (Ohne Spiel, Aus QR-Link) | <img src="screens/dunkel/01-handy.jpg" width="150"> | <img src="screens/hell/01-handy.jpg" width="150"> | <img src="screens/sonne/01-handy.jpg" width="150"> |
| 2 | **Team beitreten**<br>Team<br>Spiel-Code/QR, Teamname, Team-Passwort (Normal, Passwort falsch, Ersatzgerät) | <img src="screens/dunkel/02-handy.jpg" width="150"> | <img src="screens/hell/02-handy.jpg" width="150"> | <img src="screens/sonne/02-handy.jpg" width="150"> |
| 3 | **Schiri- & Admin-Login**<br>Schiri, Spielleitung<br>Spiel-Code, Name, Schiri-Code bzw. Admin-Passwort (Schiri, Spielleitung) | <img src="screens/dunkel/03-handy.jpg" width="150"> | <img src="screens/hell/03-handy.jpg" width="150"> | <img src="screens/sonne/03-handy.jpg" width="150"> |
| 4 | **Onboarding**<br>Team<br>So läuft's, Standort, Benachrichtigungen, Akku (1, 2, 3, 4) | <img src="screens/dunkel/04-handy.jpg" width="150"> | <img src="screens/hell/04-handy.jpg" width="150"> | <img src="screens/sonne/04-handy.jpg" width="150"> |
| 5 | **Warteraum**<br>Team<br>Vor dem Start: Teamliste, Checks, wichtigste Regeln | <img src="screens/dunkel/05-handy.jpg" width="150"> | <img src="screens/hell/05-handy.jpg" width="150"> | <img src="screens/sonne/05-handy.jpg" width="150"> |

### Im Spiel – Teams

| # | Screen | Dunkel | Hell | Sonne |
|---|---|---|---|---|
| 6 | **Jäger-Karte**<br>Team<br>Hauptscreen: Mister-X-Spur, Countdown, Status (Normal, Durchsage, Verkleinerung, Offline) | <img src="screens/dunkel/06-handy.jpg" width="150"> | <img src="screens/hell/06-handy.jpg" width="150"> | <img src="screens/sonne/06-handy.jpg" width="150"> |
| 7 | **Mister-X-Karte**<br>Mister X<br>Roter Modus, eigener Countdown, Spielfeld-Warnung (Normal, Nahe Grenze, Draußen) | <img src="screens/dunkel/07-handy.jpg" width="150"> | <img src="screens/hell/07-handy.jpg" width="150"> | <img src="screens/sonne/07-handy.jpg" width="150"> |
| 8 | **Wartezeit**<br>Team<br>Bildschirmfüllend: Bitte stehen bleiben | <img src="screens/dunkel/08-handy.jpg" width="150"> | <img src="screens/hell/08-handy.jpg" width="150"> | <img src="screens/sonne/08-handy.jpg" width="150"> |
| 9 | **Übergabe**<br>Alle<br>Gefangen! / Ihr seid jetzt Mister X! / Erwischt! (Alle, Neuer Mister X, Alter Mister X) | <img src="screens/dunkel/09-handy.jpg" width="150"> | <img src="screens/hell/09-handy.jpg" width="150"> | <img src="screens/sonne/09-handy.jpg" width="150"> |
| 10 | **Chat**<br>Team<br>Gruppenchat, Direktkanal, System-Meldungen, Durchsagen (Alle, Spielleitung) | <img src="screens/dunkel/10-handy.jpg" width="150"> | <img src="screens/hell/10-handy.jpg" width="150"> | <img src="screens/sonne/10-handy.jpg" width="150"> |
| 11 | **Regeln & Hilfe**<br>Alle<br>Regeln mit Icons und aktuellen Werten, durchsuchbar, FAQ | <img src="screens/dunkel/11-handy.jpg" width="150"> | <img src="screens/hell/11-handy.jpg" width="150"> | <img src="screens/sonne/11-handy.jpg" width="150"> |

### Schiri

| # | Screen | Dunkel | Hell | Sonne |
|---|---|---|---|---|
| 12 | **Schiri-Ansicht**<br>Schiri<br>Alle Teams live, Übergabe-Ablauf, Rückgängig (Karte, Übergabe, Nach Übergabe) | <img src="screens/dunkel/12-handy.jpg" width="150"> | <img src="screens/hell/12-handy.jpg" width="150"> | <img src="screens/sonne/12-handy.jpg" width="150"> |

### Spielleitung

| # | Screen | Dunkel | Hell | Sonne |
|---|---|---|---|---|
| 13 | **Admin: Live-Übersicht**<br>Spielleitung<br>Karte mit allen Teams, Warnungen, Schnellaktionen | <img src="screens/dunkel/13-laptop.jpg" width="360"> | <img src="screens/hell/13-laptop.jpg" width="360"> | <img src="screens/sonne/13-laptop.jpg" width="360"> |
| 14 | **Admin: Steuerung & Regeln**<br>Spielleitung<br>Start/Auslosen, Zufallsende, Pause, Notstopp, Regeln live (Im Spiel, Vor dem Start) | <img src="screens/dunkel/14-laptop.jpg" width="360"> | <img src="screens/hell/14-laptop.jpg" width="360"> | <img src="screens/sonne/14-laptop.jpg" width="360"> |
| 15 | **Admin: Teams & Zugänge**<br>Spielleitung<br>Teams, Schiris, Passwörter, QR-Codes, Neue Runde (Teams, Schiris, Zugänge) | <img src="screens/dunkel/15-laptop.jpg" width="360"> | <img src="screens/hell/15-laptop.jpg" width="360"> | <img src="screens/sonne/15-laptop.jpg" width="360"> |
| 16 | **Admin: Spielfeld-Editor**<br>Spielleitung<br>Spielfeld und Sperrbereiche bearbeiten, GeoJSON (Normal, Fehler) | <img src="screens/dunkel/16-laptop.jpg" width="360"> | <img src="screens/hell/16-laptop.jpg" width="360"> | <img src="screens/sonne/16-laptop.jpg" width="360"> |
| 17 | **Admin: Protokoll**<br>Spielleitung<br>Wer hat wann was ausgelöst | <img src="screens/dunkel/17-laptop.jpg" width="360"> | <img src="screens/hell/17-laptop.jpg" width="360"> | <img src="screens/sonne/17-laptop.jpg" width="360"> |

### Großbild, Ende & Archiv

| # | Screen | Dunkel | Hell | Sonne |
|---|---|---|---|---|
| 18 | **Großbild**<br>Zentrale, Beamer<br>Für 3–5 m lesbar: Karte, Countdown, Rangliste, Ticker (Normal, Durchsage, Zuschauer) | <img src="screens/dunkel/18-laptop.jpg" width="360"> | <img src="screens/hell/18-laptop.jpg" width="360"> | <img src="screens/sonne/18-laptop.jpg" width="360"> |
| 19 | **Spielende & Auswertung**<br>Alle<br>Feier, Sieger, Statistiken, Zeitstrahl | <img src="screens/dunkel/19-handy.jpg" width="150"> | <img src="screens/hell/19-handy.jpg" width="150"> | <img src="screens/sonne/19-handy.jpg" width="150"> |
| 20 | **Archiv & Replay**<br>Spielleitung, Teams<br>Vergangene Spiele, Wiederholung auf der Karte (Liste, Replay) | <img src="screens/dunkel/20-handy.jpg" width="150"> | <img src="screens/hell/20-handy.jpg" width="150"> | <img src="screens/sonne/20-handy.jpg" width="150"> |

### Verwaltung & Sonstiges

| # | Screen | Dunkel | Hell | Sonne |
|---|---|---|---|---|
| 21 | **Super-Admin: Spiele**<br>Organisator<br>Spiele anlegen, Admins vergeben, archivieren | <img src="screens/dunkel/21-laptop.jpg" width="360"> | <img src="screens/hell/21-laptop.jpg" width="360"> | <img src="screens/sonne/21-laptop.jpg" width="360"> |
| 22 | **Einstellungen**<br>Alle<br>Darstellung, Ton, Push, Standort, Abmelden | <img src="screens/dunkel/22-handy.jpg" width="150"> | <img src="screens/hell/22-handy.jpg" width="150"> | <img src="screens/sonne/22-handy.jpg" width="150"> |
| 23 | **Fehler & Offline**<br>Alle<br>Kein Netz, kein GPS, Standort verweigert, Spiel nicht gefunden, abgemeldet (Kein Netz, Kein GPS, Verweigert, Nicht gefunden, Abgemeldet) | <img src="screens/dunkel/23-handy.jpg" width="150"> | <img src="screens/hell/23-handy.jpg" width="150"> | <img src="screens/sonne/23-handy.jpg" width="150"> |

## Barrierefreiheit

- Kontraste nach WCAG AA, Sonnen-Modus AAA (Rot `#B30000` auf Weiß 7,2 : 1) – **automatisch geprüft** für jeden Screen
  in jeder Variante und Darstellung (`tests/barrierefreiheit.test.ts`, axe-core). Team-Abzeichen dunkeln die Teamfarbe
  leicht ab, damit das weiße Kürzel auf jeder Farbe ≥ 4,5 : 1 hat.
- „Bewegung reduzieren“: keine Übergänge, Animationen nur einen Augenblick lang.
- Nie Information nur über Farbe: Wartezeit = Sanduhr, offline = gestrichelt + Symbol, Mister X = Fahne.
- Alle Knöpfe mit Beschriftung oder `aria-label`, Dialoge über `<dialog>` (Fokus bleibt drin, Escape schließt),
  Countdown mit `role="timer"`, Durchsagen und Warnungen als `role="alert"`.
