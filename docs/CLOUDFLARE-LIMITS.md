# Cloudflare: Gratis-Limits und Verbrauch eines Spiels

**Stand: 27.10.2026.** Werte aus der Cloudflare-Dokumentation, gelesen am 27.10.2026:
[Workers – Limits](https://developers.cloudflare.com/workers/platform/limits/),
[Workers – Pricing](https://developers.cloudflare.com/workers/platform/pricing/),
[Durable Objects – Limits](https://developers.cloudflare.com/durable-objects/platform/limits/),
[Durable Objects – Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/),
[D1 – Limits](https://developers.cloudflare.com/d1/platform/limits/),
[Static Assets – Billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/),
[Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/).
Cloudflare ändert Limits gelegentlich – vor der Saison kurz gegenprüfen (Links oben).

## 1. Was passiert, wenn ein Limit erreicht ist?

Das Konto läuft im **Gratis-Tarif (Workers Free) ohne Zahlungsart**. Wird ein Tageslimit überschritten, **schlagen
weitere Anfragen fehl** (Fehlermeldung statt Antwort) – es entstehen **keine Kosten**, eine Abrechnung ist ohne Zahlungsart
und ohne Bezahl-Tarif gar nicht möglich. Die Tageslimits beginnen jeden Tag um **00:00 UTC** neu (= 01:00 Uhr Winterzeit,
02:00 Uhr Sommerzeit in Österreich). Ein Spiel am Nachmittag liegt immer innerhalb eines Tages.

Deshalb ist das Ziel nicht „billig“, sondern **„weit unter jedem Limit“** – damit am Spieltag nichts ausfällt.

## 2. Die Limits, auf die sich der Server verlässt

| Produkt | Limit (Gratis) | wofür im Spiel |
|---|---|---|
| Workers – Anfragen | **100 000 / Tag** | jeder Aufruf von `/api`, `/api/pos`, `/ws` (Verbindungsaufbau), `/health` |
| Workers – CPU-Zeit | **10 ms pro Anfrage** | Worker prüft nur Tokens (HMAC, < 1 ms) und leitet weiter |
| Workers – Unteranfragen | **50 pro Aufruf** | Web-Push-Versand: höchstens 40 pro Aufruf, der Rest im nächsten Alarm |
| Workers – Arbeitsspeicher | 128 MB | Spielraum hält ein Spiel im Speicher (< 2 MB) |
| Cron Triggers | 5 pro Konto | 1 (tägliche Löschfristen) |
| Static Assets (App-Dateien) | **unbegrenzt und kostenlos**, Datei bis 25 MiB | die ganze App (≈ 1,5 MB), optional die APK (≈ 8 MB) |
| Durable Objects – Art | **nur mit SQLite-Speicher** im Gratis-Tarif | `GameRoom` und `Zentrale` sind so angelegt (`new_sqlite_classes`) |
| Durable Objects – Anfragen | **100 000 / Tag** | jeder Aufruf aus dem Worker, jeder Alarm; **eingehende WebSocket-Nachrichten zählen 20:1** (20 Nachrichten = 1 Anfrage); ausgehende Nachrichten sind kostenlos |
| Durable Objects – Laufzeit | **13 000 GB-s / Tag** | wach = 128 MB × Sekunden; schlafende Verbindungen (Hibernation) zählen nicht |
| Durable Objects – CPU-Zeit | 30 s pro Anfrage (Standard) | Passwort-Prüfung (PBKDF2, ≈ 12 ms) läuft deshalb im Spielraum, nicht im Worker |
| Durable Objects – SQLite | 5 Mio. Zeilen gelesen, **100 000 Zeilen geschrieben / Tag**, 5 GB Speicher | jeder geänderte Teil des Spiels = 1 Zeile; Alarm stellen = 1 Zeile |
| WebSocket | Nachricht bis 32 MiB, Anhang pro Verbindung bis 16 KiB | Snapshot ≈ 50–300 KB; Anhang = Gerät, Nummer, sichtbar |
| D1 | 5 Mio. Zeilen gelesen, 100 000 geschrieben / Tag, 500 MB pro Datenbank, 50 Abfragen pro Aufruf | Spieleliste und Archiv |

**Unklarheit, offen dokumentiert:** Die Workers-Seite nennt 10 ms CPU für Gratis-Anfragen, die Durable-Objects-Seite
30 s pro Anfrage. Der Server ist so gebaut, dass beides passt: im Worker passiert nichts Rechenintensives; das Einzige,
was > 10 ms braucht (PBKDF2 beim Beitritt), läuft im Spielraum. Sollte Cloudflare auch dort 10 ms durchsetzen, lässt
sich die Zahl der PBKDF2-Runden in `server/src/auth.ts` (`ITER`) halbieren – bestehende Hashes bleiben gültig, weil
die Rundenzahl im Hash steht.

## 3. Rechnung: ein Spiel mit 30 Teams, 4 Stunden

Annahmen (bewusst großzügig): 30 Teams mit zusammen **36 Handys**, **10 Schiris**, 1 Spielleitung, 2 Großbild = 49 Geräte;
**4 Stunden**; Standort alle **10–15 s** (wir rechnen mit 12 s); 24 automatische Meldungen, 15 Übergaben,
10 Durchsagen, 4 Verkleinerungen, 400 Chat-Nachrichten.

### 3.1 Fall A – alle Handys mit offener App (Browser oder Android im Vordergrund)

| Posten | Rechnung | Ergebnis |
|---|---|---|
| Standorte über WebSocket | 46 Geräte × 4 h × 3600 s / 12 s = 55 200 Nachrichten → ÷ 20 | **2 760** DO-Anfragen |
| Herzschlag („ping“ alle 25 s) | beantwortet die Laufzeit selbst (`setWebSocketAutoResponse`), ohne den Spielraum aufzuwecken; selbst wenn er zählte: 49 × 576 ÷ 20 | 0 (höchstens ≈ 1 400) |
| Befehle (`/api`) | Beitritte 60, Chat 400, Übergaben/Rückgängig 20, Steuerung ≈ 100, Push-Einstellungen ≈ 50 | ≈ **630** Worker- + 630 DO-Anfragen |
| Verbindungsaufbau `/ws` | 49 Geräte × ≈ 10 (Funklöcher, Neuladen) | ≈ **490** Worker- + 490 DO-Anfragen |
| Alarme | Meldungen 24 + Wartezeiten ≈ 60 + Push-Versand ≈ 60 + Spielende 1 | ≈ **150** DO-Anfragen |
| **Summe** | | **≈ 1 100 Worker-Anfragen (1 %)**, **≈ 4 000 DO-Anfragen (4 %)** |

### 3.2 Fall B – alle Team-Handys mit der Android-App in der Hosentasche (schlimmster Fall)

Im Hintergrund sendet die Android-App per HTTP (`/api/pos`) und **nur alle 30 s** (`app/src/lib/gps.svelte.ts`):

| Posten | Rechnung | Ergebnis |
|---|---|---|
| Standorte Teams per HTTP | 36 Handys × 4 h × 3600 s / 30 s | **17 280** Worker- + 17 280 DO-Anfragen |
| Standorte Schiris über WebSocket | 10 × 1200 = 12 000 Nachrichten ÷ 20 | 600 DO-Anfragen |
| Befehle, Verbindungen, Alarme | wie Fall A | ≈ 1 100 Worker- + ≈ 1 300 DO-Anfragen |
| **Summe** | | **≈ 18 400 Worker-Anfragen (18 %)**, **≈ 19 200 DO-Anfragen (19 %)** |

Zum Vergleich: Würde die Android-App im Hintergrund alle 10 s per HTTP senden, wären es ≈ 52 000 + 52 000 Anfragen –
noch unter dem Limit, aber ohne Reserve. Deshalb die 30 s (Meldungen brauchen einen Standort, der höchstens 2 Min alt ist).

### 3.3 Laufzeit, Speicher, Datenbank

| Posten | Rechnung | Ergebnis |
|---|---|---|
| Laufzeit Spielraum | während des Spiels wach (Standorte kommen laufend): 4 h × 3600 s × 0,125 GB | **1 800 GB-s (14 %)** |
| Laufzeit vor/nach dem Spiel | Verbindungen schlafen (Hibernation) | ≈ 0 |
| Zeilen geschrieben | Befehle ≈ 630 × ≈ 4 Teile + Standorte gespeichert alle 30 s: 480 × 4 + Alarme stellen ≈ 600 | **≈ 5 000 (5 %)** |
| Zeilen gelesen | Aufwachen (23 Teile) + Alarm-Abfragen | **< 10 000 (0,2 %)** |
| Speicher Spielraum | Zustand + Chat + Protokoll; **keine Bewegungsprofile** (nur letzter Punkt je Team) | **< 2 MB** |
| D1 | Spiel anlegen 1, Spieleliste aktualisieren ≈ 40, Archiv 1 Zeile, Verwaltung ≈ 50 Lesevorgänge | **< 0,1 %** |
| Unteranfragen (Web Push) | 55 Ereignisse für alle × ≤ 49 Geräte, je höchstens 40 pro Aufruf | passt (in mehreren Alarmen) |

### 3.4 Ergebnis

**Ein Spiel mit 30 Teams über 4 Stunden braucht höchstens etwa ein Fünftel der Tageslimits** (schlimmster Fall:
alle Android-Handys im Hintergrund), meist unter 5 %. Zwei Spiele am selben Tag sind ebenfalls kein Problem.
**Kosten: 0 €**, keine Zahlungsart nötig.

## 4. Sparmaßnahmen im Code (damit das so bleibt)

- **WebSocket statt Abfragen:** Geräte fragen nie nach, der Server schickt nur Änderungen (`server/src/room.ts`).
- **Hibernation:** schlafende Verbindungen kosten keine Laufzeit; Herzschlag ohne Aufwecken (Auto-Antwort).
- **Standorte gesammelt:** an Spielleitung/Schiri/Großbild höchstens alle 2 s verteilt, gespeichert höchstens alle 30 s
  (ein Neustart verliert höchstens 30 s alte Standorte – die nächsten kommen ohnehin in Sekunden).
- **Nie Positionen in die Datenbank (D1)**: nur der Spielraum hält den letzten Punkt je Team; ins Archiv kommen nur
  Meldungen, Übergaben, Strecke.
- **Ein Alarm pro Spielraum** für alles Zeitgesteuerte; gestellt wird er nur, wenn sich der Termin ändert.
- **Android im Hintergrund nur alle 30 s**, im Vordergrund über die ohnehin offene Verbindung.
- **Push nur an Geräte, deren App nicht sichtbar ist** – sichtbare Apps zeigen es selbst an.

## 5. Nachgemessen (Lasttest, Meilenstein 12)

`tests/last.test.ts` lässt in der lokalen Cloudflare-Laufzeit (workerd, dieselbe wie im Betrieb) ein Spiel mit
**30 Teams (36 Handys), 10 Schiris, 1 Spielleitung und 2 Großbildern = 49 Geräten** laufen. Im **Zeitraffer** sendet
jedes Handy und jeder Schiri etwa **jede Sekunde** einen Standort (≈ 11× öfter als im Spiel); in derselben Minute
passieren außerdem 2 Meldungen, 1 Übergabe, 10 Chat-Nachrichten, 1 Durchsage und 1 Verkleinerung. Der Spielraum zählt
mit, was Cloudflare abrechnet. Ergebnis vom 27.10.2026 (Dauer 1 Minute):

| Messwert | gemessen | Bedeutung |
|---|---|---|
| Standorte gesendet / eingehende Nachrichten | 2 508 / **2 508** | jeder Standort ist genau eine Nachricht – keine versteckten Zusatznachrichten |
| Befehle (`/api`) / Alarme | 13 / 2 | entspricht den ausgelösten Ereignissen |
| geschriebene Zeilen | 47 (≈ 45 pro Minute) | Standorte: 5 Zeilen alle 30 s; jeder Befehl ≈ 3 Zeilen |
| Verzögerung, bis ein Standort bei der Spielleitung ist | **Median 0,4 s, 95 % unter 1,1 s** | gesammelt alle 2 s, also nie älter als ≈ 2,5 s |
| Snapshot beim Verbinden (Spielleitung, 30 Teams) | **36 KB** | auch mit schwachem Netz in Sekunden geladen |
| Daten an die Spielleitung | 28 KB pro Minute im Zeitraffer | im echten Spiel ≈ 2,6 KB/min ≈ **0,6 MB in 4 Stunden** |
| Daten an ein Team-Handy | 10 KB pro Minute (nur Ereignisse) | Teams bekommen keine fremden Standorte – im Spiel deutlich weniger |

**Hochrechnung auf 4 Stunden Spiel** (Standort alle 12 s):

| Posten | Rechnung | Ergebnis |
|---|---|---|
| DO-Anfragen durch Standorte | 46 Geräte × 1 200 Standorte = 55 200 Nachrichten ÷ 20 (gemessen: 1 Standort = 1 Nachricht) | 2 760 |
| DO-Anfragen sonst | Befehle ≈ 630, Verbindungsaufbau ≈ 490, Alarme ≈ 150 (Abschnitt 3.1) | ≈ 1 270 |
| **DO-Anfragen gesamt** | | **≈ 4 000 (4 %)** |
| Zeilen durch Standorte | 10 pro Minute × 240 Minuten (zeitabhängig, gemessen) | 2 400 |
| Zeilen durch Befehle und Alarme | 630 × ≈ 3 + 150 | ≈ 2 000 |
| **Zeilen geschrieben gesamt** | | **≈ 4 400 (4,4 %)** |

Selbst wenn man die zusammengedrängte Testminute stur mit 240 multipliziert (also 13 Befehle und 2 Alarme *jede*
Minute, viel mehr als im Spiel), bleibt es bei ≈ 6 200 DO-Anfragen und ≈ 10 800 Zeilen – **beides unter 11 %**. Der
Test prüft genau diese Obergrenze (< 20 %) bei jedem Lauf in der CI.

Nicht lokal messbar sind die **Laufzeit (GB-s)** und die **CPU-Zeit**; dafür gilt die Rechnung in Abschnitt 3.3
(Spielraum während des Spiels durchgehend wach: 1 800 GB-s = 14 %).

Längerer Lauf zum Nachmessen (z. B. 10 Minuten):

```bat
set MRX_LAST_S=600
npx vitest run --project server tests/last.test.ts --silent=false
```

Im Betrieb zeigt das Cloudflare-Dashboard unter **Workers & Pages → mister-x → Metrics** den tatsächlichen Verbrauch
(siehe [`BETRIEB.md`](BETRIEB.md)) – nach dem ersten Feldtest dort nachsehen und hier eintragen.
