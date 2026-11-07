# Schnittstelle App ↔ Spiel-Server

Der Vertrag steht als TypeScript-Typen in [`shared/src/api.ts`](../shared/src/api.ts) (Befehle) und
[`shared/src/protocol.ts`](../shared/src/protocol.ts) (Live-Verbindung). Diese Seite beschreibt ihn mit Beispielen.
Die kleine Client-Bibliothek [`shared/src/client.ts`](../shared/src/client.ts) (`import { Live } from "@mrx/shared/client"`)
erledigt Verbinden, Wiederverbinden, Snapshot + Änderungen und das Senden von Standorten – App und Tests nutzen sie.

Alles läuft unter **einer Adresse** (z. B. `https://mister-x.mr-x-ooe.workers.dev`):

| Pfad | Art | Zweck |
|---|---|---|
| `/` und alles andere | Dateien | die App (Static Assets) |
| `POST /api` | JSON | Befehle: Beitritt, Spielsteuerung, Chat, Verwaltung … |
| `GET /ws` | WebSocket | Live-Verbindung eines Geräts zu seinem Spiel |
| `POST /api/pos` | JSON | Standort der Android-App im Hintergrund (natives HTTP) |
| `GET`/`POST /tracker` | OsmAnd/Traccar | Standorte von GPS-Trackern und „Traccar Client“ (Abschnitt 5a) |
| `GET /health` | JSON | Status: `{"ok":true,"protocol":1}` |

Die Android-App (Adresse `https://localhost`) darf `/api` über CORS aufrufen; alle anderen fremden Seiten nicht.

---

## 1. Anmeldung und Sitzungen

- **Gerät in einem Spiel:** Der Befehl `join` liefert ein **Sitzungs-Token** (`token`) und die Gerätekennung (`uid`).
  Das Gerät schickt es bei jedem Befehl als `Authorization: Bearer <token>` und beim Verbinden als Unterprotokoll.
  Ein Token gilt 7 Tage, aber nur, solange das Gerät Mitglied des Spiels ist: **Entfernen, „Neue Runde“, Abmelden oder
  ein neues Admin-Passwort** machen es sofort wertlos (der Spielraum kennt die `uid` dann nicht mehr).
- **Organisator (Super-Admin):** einmal `superSetup` mit dem **Setup-Geheimnis** (Wrangler-Secret, siehe
  [`BETRIEB.md`](BETRIEB.md)) und einem Passwort, danach `superLogin` mit dem Passwort. Das Token trägt die
  Passwort-Version – ein neues Passwort macht alle alten Organisator-Sitzungen ungültig.
- Tokens sind mit `TOKEN_SECRET` (HMAC-SHA-256) unterschrieben, Passwörter/Codes nur als **PBKDF2-Hash** gespeichert
  (100 000 Runden, Salz, Vergleich in konstanter Zeit).

## 2. Befehle: `POST /api`

```http
POST /api
Content-Type: application/json
Authorization: Bearer eyJnIjoibGlueiIsInUiOiJ…

{ "action": "handover", "gameId": "linz-2027", "to": "Xk2…", "type": "fang", "expectedMrx": "Ab9…", "requestId": "a1b2c3d4e5f6", "rid": "k3j4h5" }
```

Antwort bei Erfolg (HTTP 200): `{ "ok": true, "result": { "handoverId": "a1b2c3d4e5f6", "locked": ["Ab9…"] } }`
Antwort bei Ablehnung: `{ "ok": false, "reason": "conflict", "message": "Mister X hat sich inzwischen geändert" }`

**Wiederholen ist sicher:** Jede Anfrage darf eine Kennung `rid` tragen (die App erzeugt sie). Kommt dieselbe Anfrage nach
einem Netzabbruch nochmal, antwortet der Spielraum mit dem gespeicherten Ergebnis, statt sie nochmal auszuführen.
Übergaben sind zusätzlich über `requestId` und `expectedMrx` abgesichert.

### 2.1 Ablehnungsgründe

| `reason` | HTTP | Bedeutung (Text in der App: `T.apiFehler`) |
|---|---|---|
| `invalid` | 400 | Eingabe ungültig – `message` sagt, was genau |
| `unauthenticated` | 401 | ohne Anmeldung |
| `session` | 401 | Sitzung abgelaufen/widerrufen → neu anmelden |
| `wrongSecret` | 403 | Passwort/Code falsch |
| `forbidden` | 403 | Rolle darf das nicht |
| `notFound` | 404 | Spiel (oder Archiv-Eintrag) gibt es nicht |
| `noTeamPassword`, `noSpectators`, `wrongPhase`, `conflict`, `exists`, `archived`, `tooLate` | 409 | geht gerade nicht (siehe Typen) |
| `tooMany` | 429 | Rate-Limit: 20 falsche Beitritte je IP und Spiel in 10 Min; Organisator 5 in 10 Min; Chat 1 Nachricht / 2 s |

### 2.2 Alle Befehle

| Befehl | wer | Felder | Ergebnis |
|---|---|---|---|
| `superSetup` | jeder mit Setup-Geheimnis | `setupSecret`, `password` (≥ 10) | `{ token }` |
| `superLogin` | Organisator | `password` | `{ token }` |
| `listGames` | Organisator | – | `{ games: [{ id, name, createdAt, archived, phase, teams }] }` |
| `createGame` | Organisator | `gameId`, `name`, `template` (`linz`/`leer`), `adminPassword` | `{ gameId }` |
| `archiveGame` / `deleteGame` | Organisator | `gameId`, `archived` | `{}` |
| `gameInfo` | jeder | `gameId` | `{ name, phase, createdAt, spectators, archived? }` |
| `join` | jeder | `gameId`, `role`, `name`, `secret?`, `secondDevice?` | `{ status: "joined", role, teamId?, token, uid }` oder `{ status: "teamExists", teamName }` |
| `leave` | Mitglied | `gameId` | `{}` |
| `setSecret` | Spielleitung | `kind` (`teamPw`/`schiriCode`/`adminPw`), `value` (`null` = löschen) | `{}` |
| `screenLink` | Spielleitung | – | `{ key }` (Großbild-Link `#/g/{spiel}?k={key}`) |
| `startGame` | Spielleitung | `mrx` (Team-Id oder `"random"`) | `{ mrx }` |
| `pause`, `resume`, `stopGame` | Spielleitung | – | `{}` |
| `setConfig` | Spielleitung | `config` (Teil von `Config`; `rulesText` ≤ 2000 Zeichen, leer = entfernen) | `{}` |
| `setCut` | Spielleitung | `cutId`, `locked` | `{}` |
| `setLock` | Spielleitung | `teamId`, `min` (0 = aufheben) | `{}` |
| `instantReport` | Spielleitung | – | `{ reportId }` |
| `announce` | Spielleitung | `text` | `{}` |
| `revealEnd` | Spielleitung | – | `{ endAt }` (wird protokolliert) |
| `handover` | Schiri, Spielleitung | `to`, `type` (`fang`/`strafe`), `expectedMrx`, `requestId` | `{ handoverId, locked }` |
| `undo` | Schiri, Spielleitung | `handoverId` | `{}` |
| `follow` | Schiri | `on` | `{}` |
| `resetRound`, `removeMember`, `removeTeam`, `renameTeam` | Spielleitung | `uid` / `teamId` / `name` | `{}` |
| `setField` | Spielleitung | `field` (Spielfeld + Sperrbereiche) | `{}` |
| `chat` | Team, Schiri, Spielleitung | `text`, `dm?` (Team-Id = Direktkanal) | `{ id }` |
| `deleteChat` | Spielleitung | `id`, `dm?` | `{}` |
| `pushSubscribe` | Mitglied | `sub` (Web-Push-Abo; `null` = keins; weglassen = behalten), `prefs` | `{}` |
| `addDevice` | Spielleitung | `name` | `{ device, key }` – Geräte-Kennung für den Tracker: `{spiel-code}.{key}` |
| `setDevice` | Spielleitung | `device`, `assign` (`"fahne"`, Team-Id oder `null`) | `{}` |
| `removeDevice` / `deviceKey` | Spielleitung | `device` | `{}` / `{ key }` |
| `archiveList` | Team, Schiri, Spielleitung, Großbild | – | `{ runs: [{ run, name, startedAt, endedAt, winner (Teamname), teams, durationMs, handovers }] }` |
| `archiveGet` | Team, Schiri, Spielleitung, Großbild | `run` | `{ archive }` (`ArchiveData`: Auswertung, Teams, Übergaben, Meldungen, Verkleinerungen, Pausen, Spielfeld, Chat – keine Standorte) |

Der Organisator darf jeden Befehl der Spielleitung auch ohne Beitritt ausführen und tritt jedem Spiel ohne Admin-Passwort
als Spielleitung bei.

## 3. Live-Verbindung: `GET /ws`

```js
const ws = new WebSocket("wss://mister-x.mr-x-ooe.workers.dev/ws?v=1", ["mrx", token]);
```

Das Token steht im Unterprotokoll (nicht in der Adresse → nicht in Logs). `v` ist die Protokollversion (`PROTOCOL_VERSION`).

### 3.1 Server → Gerät

Jede Nachricht trägt eine **fortlaufende Nummer** `seq` (pro Verbindung, ab 1) und die **Server-Zeit** `now`
(Countdowns rechnen mit Server-Zeit, nie mit der Handy-Uhr).

**Snapshot** beim Verbinden (und nach `resync`) – die ganze Sicht, **nach Rolle gefiltert**:

```json
{ "t": "snap", "seq": 1, "now": 1793122722514, "v": 1, "vapid": "BMQZNyxv8II2…",
  "view": {
    "info": { "name": "Mister X Linz", "phase": "laeuft", "createdAt": 1793100000000, "spectators": true },
    "config": { "intervalMin": 10, "headStartMin": 10, "waitMin": 5, "radiusM": 200, "undoMin": 2, "endMinH": 3, "endMaxH": 4, "spectators": true },
    "field": { "name": "Linz Innenstadt", "toleranceM": 20, "base": [[14.27, 48.30], "…"], "cuts": { "norden": { "…": "…" } } },
    "state": { "phase": "laeuft", "mrx": "Ab9…", "nextReportAt": 1793123300000, "rev": 7 },
    "teams": { "Ab9…": { "name": "Urfahr", "short": "UR", "color": "#7c5cff" } },
    "reports": {}, "handovers": {}, "locks": {}, "pauses": {}, "cutLog": {}, "stats": {},
    "chat": { "0mvqyhdgo000fbv": { "uid": "system", "name": "System", "text": "Spiel gestartet! …", "t": 1793121900648, "kind": "sys" } },
    "dm": { "Ab9…": {} },
    "me": { "role": "team", "name": "Urfahr", "teamId": "Ab9…", "joinedAt": 1793120000000, "uid": "RhHH…", "push": { "on": true, "prefs": {} } }
  } }
```

**Änderungen** – Liste von `[Teil, Kennung, Wert]`: `Wert = null` löscht, `Kennung = null` ersetzt den ganzen Teil;
im Direktkanal ist die Kennung `"teamId/nachrichtId"`. `applyPatch()` in `shared/src/protocol.ts` wendet sie an.

```json
{ "t": "patch", "seq": 2, "now": 1793122723000, "p": [
  ["reports", "0mvqyhdh2000a1x", { "teamId": "Ab9…", "lat": 48.3059, "lng": 14.2862, "t": 1793122723000, "posAt": 1793122710000, "src": "handy", "kind": "auto" }],
  ["chat", "0mvqyhdh2001q7c", { "uid": "system", "name": "System", "text": "Mister X wurde gemeldet …", "t": 1793122723000, "kind": "sys", "reportId": "0mvqyhdh2000a1x" }],
  ["state", null, { "phase": "laeuft", "mrx": "Ab9…", "lastReportAt": 1793122723000, "nextReportAt": 1793123323000, "rev": 8 }]
] }
```

**Benachrichtigung** für dieses Gerät (dieselbe wie der Web-Push; die Android-App zeigt sie im Hintergrund lokal an):

```json
{ "t": "note", "seq": 3, "now": 1793122723000, "n": { "id": "0mvqyhdh2002k9d", "kind": "meldung", "title": "Mister X gemeldet", "body": "Mister X wurde gemeldet …", "t": 1793122723000 } }
```

**Abschied** vor dem Schließen – das Gerät verbindet sich dann **nicht** neu, sondern erklärt es:

```json
{ "t": "bye", "reason": "removed" }
```

`removed` = entfernt/neue Runde/Spiel gelöscht (Schließ-Code 4001), `session` = Token ungültig (4002),
`version` = App veraltet, bitte neu laden (4003).

### 3.2 Gerät → Server

| Nachricht | Bedeutung |
|---|---|
| `{"t":"pos","p":{"lat":48.3059,"lng":14.2862,"acc":8,"t":1793122720000,"heading":90,"battery":76}}` | eigener Standort (`t` = Messzeit in Server-Zeit). Team → Standort des eigenen Teams, Schiri/Spielleitung → eigener Schiri-Punkt. Höchstens 1 pro Sekunde, Messzeit max. 15 Min alt und nicht in der Zukunft, sonst verworfen. |
| `{"t":"vis","on":false}` | App sichtbar/unsichtbar → unsichtbare Geräte bekommen zusätzlich Web-Push |
| `{"t":"resync"}` | Lücke bemerkt → neuer Snapshot |
| `ping` (Text) | Herzschlag alle 25 s; Antwort `pong` kommt direkt von Cloudflare (weckt den Spielraum nicht) |

### 3.3 Wer sieht was (Abschnitt 6 des ursprünglichen Auftrags, `docs/archiv/PROMPT-NEUBAU.md`)

| Teil | Team | Schiri | Spielleitung | Großbild | Zuschauer |
|---|---|---|---|---|---|
| `info`, `config`, `field`, `state`, `teams`, `reports`, `handovers`, `locks`, `pauses`, `cutLog`, `stats` | ✔ | ✔ | ✔ | ✔ | ✔ |
| `chat` | ✔ | ✔ | ✔ | ✔ | ✖ |
| `dm` (Direktkanäle) | nur eigener | ✖ | alle | ✖ | ✖ |
| `positions`, `staff`, `devices` (Live-Standorte, Tracker) | **✖** | ✔ | ✔ | ✔ | **✖** |
| `members`, `audit` | ✖ | ✖ | ✔ | ✖ | ✖ |
| Passwort-Hashes, geheimes Spielende, Streckenpunkte, Push-Abos anderer | ✖ | ✖ | ✖ | ✖ | ✖ |

Jede Änderung wird **pro Verbindung** gefiltert, bevor sie rausgeht – Teams bekommen fremde Positionen nicht einmal
„versteckt“ im Datenverkehr. Die Tests in [`tests/rechte.test.ts`](../tests/rechte.test.ts) lesen dafür den rohen
Datenverkehr mit.

## 4. Android im Hintergrund: `POST /api/pos`

```http
POST /api/pos
Authorization: Bearer <token>
Content-Type: application/json

{ "p": { "lat": 48.3059, "lng": 14.2862, "acc": 12, "t": 1793122720000 }, "since": 1793122600000 }
```

Antwort: `{ "ok": true, "result": { "notes": [ { "id": "…", "kind": "wartezeit", "title": "Bitte stehen bleiben", "body": "…", "t": 1793122700000 } ] } }`
– alle Benachrichtigungen für dieses Gerät seit `since`, die es vielleicht verpasst hat (die App zeigt jede nur einmal).
Gesendet wird im Hintergrund höchstens alle 30 s ([`CLOUDFLARE-LIMITS.md`](CLOUDFLARE-LIMITS.md)).

## 5a. Tracker: `/tracker`

Kompatibel mit dem **OsmAnd-Protokoll**, wie es die kostenlose App **„Traccar Client“** und viele GPS-Tracker sprechen.
Im Gerät werden eingetragen: **Server-Adresse** `https://mister-x.mr-x-ooe.workers.dev/tracker` und **Geräte-Kennung**
`{spiel-code}.{schlüssel}` (zeigt die App unter Teams & Zugänge → Tracker → Einrichtung).

```http
POST /tracker?id=linz-2027.k3J9xQ2mZp1aB7cD&lat=48.3059&lon=14.2862&timestamp=1793122720&accuracy=6&batt=77&bearing=90
```

Ebenso als Formular-Daten oder als JSON des neuen Traccar Client:

```json
{ "device_id": "linz-2027.k3J9xQ2mZp1aB7cD",
  "location": { "timestamp": "2026-10-27T17:22:00Z", "coords": { "latitude": 48.3059, "longitude": 14.2862, "accuracy": 8, "heading": 90 }, "battery": { "level": 0.42 } } }
```

Antwort `200 OK` (angenommen), `403` (unbekanntes Gerät), `400` (unvollständig). Zeit in Sekunden, Millisekunden oder
ISO; fehlt die Genauigkeit, wird `hdop × 5` bzw. 25 m angenommen. Höchstens ein Punkt alle 5 s pro Gerät; nach dem
Spielende wird nichts mehr gespeichert, bei Spielende werden alle Tracker-Standorte gelöscht.

**Zuordnung:** `fahne` = Tracker steckt in der Fahne → **erste Standortquelle** für Mister-X-Meldungen und Übergabeort
(Reihenfolge: Tracker der Fahne > Mister-X-Gerät > Schiri, der der Fahne folgt > letzter bekannter). Team-Id = der
Tracker **ist** der Standort dieses Teams und hat Vorrang vor dem Handy, solange er frisch sendet (≤ 2 Min).

## 5. Push

- **Browser und installierte Web-App:** Web Push mit VAPID-Schlüssel (`VAPID_PUBLIC` kommt im Snapshot als `vapid`).
  Die App abonniert über den Service Worker und schickt das Abo mit `pushSubscribe`. Inhalt (verschlüsselt nach
  RFC 8291): `{"title":"…","body":"…","kind":"meldung","tag":"meldung","link":"/#/spiel"}`. Abgelaufene Abos (404/410)
  löscht der Server selbst.
- **iPhone:** Web Push nur für eine zum **Home-Bildschirm hinzugefügte** Web-App, ab **iOS 16.4**.
- **Android-App:** kein Web Push und kein Firebase – Benachrichtigungen kommen über die Verbindung (`note`) bzw. mit
  `/api/pos` und werden lokal angezeigt.
- **Keine doppelten Benachrichtigungen:** Geräte mit sichtbarer App (`vis`) bekommen keinen Web-Push; die App meldet sich
  dann selbst mit Ton/Vibration.

Arten (`PushKind`): `meldung`, `uebergabe`, `wartezeit`, `durchsage`, `spielfeld`, `nachricht`, `spiel` – abschaltbar
pro Gerät (`prefs`). Wer was bekommt, steht in `pushTargets()` (`shared/src/push.ts`, mit Unit-Tests).

## 6. Versionen

`PROTOCOL_VERSION` (derzeit **1**) steigt nur bei inkompatiblen Änderungen. Alte Apps bekommen beim Verbinden
`{"t":"bye","reason":"version"}` und zeigen „Bitte neu laden“. Neue, optionale Felder erhöhen die Version nicht.
