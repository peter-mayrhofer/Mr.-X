# Auftrag: Backend für „Mister X“ auf Cloudflare

> **Hinweis (aktueller Stand):** Der Frontend-Agent hat die Meilensteine 1–8 bereits mit Firebase gebaut
> (Branch `claude/elegant-volta-i3dbpr`: `app/`, `functions/`, `shared/`, `tests/`). Der Umzug auf Cloudflare wird deshalb
> **vom selben Agenten** als Meilenstein „9b“ erledigt (siehe `NACHRICHT-AN-FRONTEND.md`). Dieses Dokument dient ihm als
> **Anforderungs-Referenz für das Backend**; die Abschnitte über einen zweiten Agenten, eigenen Branch und Ordner-Aufteilung
> (0, 1.1–1.3, 3, 11) gelten dann nicht. Der bestehende Vertrag `shared/src/api.ts` wird weiterverwendet.

> Dieser Prompt richtet sich an eine KI (Coding-Agent), die selbstständig über mehrere Tage arbeiten darf.
> Lies ihn vollständig, bevor du anfängst. Antworte und dokumentiere **auf Deutsch**.

---

## 0. Ausgangslage und Arbeitsteilung

Die App „Mister X“ wird komplett neu gebaut. **Zwei KI-Agenten arbeiten parallel:**

| Agent | Zuständig für | Auftrag |
|---|---|---|
| **Frontend-Agent** (läuft bereits) | Spiel-Logik-Konzept, Design, gesamte Oberfläche (Web/PWA + Android-App mit Capacitor) | `PROMPT-NEUBAU.md` |
| **Du (Backend-Agent)** | Server, Echtzeit, Datenhaltung, Rechte, Zeitsteuerung, Push, Tracker-Schnittstelle, Deployment | dieser Prompt |

**Wichtige Änderung gegenüber `PROMPT-NEUBAU.md`:** Dort steht Firebase (Blaze). Das gilt **nicht mehr**.
Das Backend läuft **ausschließlich auf Cloudflare, im kostenlosen Tarif, ohne Kreditkarte**.
Firebase wird im Neubau **nicht** verwendet (die alte Version bleibt bis zur Umstellung auf Firebase online und wird nicht angefasst).

Lies trotzdem **`PROMPT-NEUBAU.md` vollständig** – dort stehen das Spiel, die Regeln, alle Funktionen, Rollen, Datenschutz-
und Qualitätsanforderungen. Alles dort, was Server-Aufgaben betrifft (Abschnitte 1, 4.3, 5, 6, 7, 9, 10, 12, 13), setzt **du** um –
nur eben auf Cloudflare statt Firebase. Lies außerdem den bestehenden Prototyp (`app.js`, `zones.js`, `database.rules.json`,
`test/e2e.js`, `SPEC.md`, `IDEEN.md`) als Referenz für Abläufe und Spielregeln.

**Ziel:** Ein **einziger Anbieter (Cloudflare)** für alles: Hosting der App, Spiel-Server, Echtzeit, Datenbank, Zeitsteuerung, Push.
**Laufende Kosten: 0 €.** Keine Kreditkarte, keine Bankdaten.

---

## 1. Deine Arbeitsweise

1. **Zuerst schauen, was der Frontend-Agent schon gemacht hat.** Prüfe die Branches im Repo `peter-mayrhofer/Mr.-X`
   (insbesondere `neubau` bzw. den Branch des Frontend-Agenten): Ordnerstruktur, gewähltes Framework, `docs/KONZEPT.md`,
   `docs/ENTSCHEIDUNGEN.md`, vorhandene Typen. **Passe dich an seine Struktur an**, statt eine konkurrierende aufzubauen.
2. **Vertrag zuerst:** Bevor du Server-Logik baust, schreibst du den **Schnittstellen-Vertrag** (`docs/API.md` + gemeinsame
   TypeScript-Typen, siehe Abschnitt 6) und pushst ihn, damit der Frontend-Agent sofort dagegen bauen kann.
   Lass dir den Vertrag vom Organisator bestätigen (er leitet ihn an den Frontend-Agenten weiter).
3. **Eigene Ordner, eigener Branch:** Arbeite in eigenen Ordnern (z. B. `server/` und `shared/`, siehe Abschnitt 3) auf dem Branch
   **`neubau-backend`**. Ändere **keine** Frontend-Dateien des anderen Agenten. Integration in den Haupt-Neubau-Branch über Pull Request.
4. **Fragen sammeln** statt bei jeder Kleinigkeit zu stoppen; triff Standardentscheidungen selbst und dokumentiere sie in
   `docs/ENTSCHEIDUNGEN-BACKEND.md`. Frag nach, wenn es um Spielregeln, Kosten, Datenschutz oder Zugänge geht.
5. **Ehrlich:** Wenn ein Cloudflare-Gratis-Limit zu knapp ist oder etwas technisch nicht geht, sag es klar und schlag Alternativen vor.
6. **Prüfe aktuelle Fakten selbst:** Cloudflare ändert Produkte und Gratis-Limits. Lies zu Beginn die aktuelle Dokumentation
   (Workers, Durable Objects, D1, Static Assets/Pages, Cron/Alarms, Limits & Pricing) und halte die Werte, auf die du dich
   verlässt, mit Datum in `docs/CLOUDFLARE-LIMITS.md` fest.

---

## 2. Architektur (Empfehlung – begründet abweichen ist erlaubt)

### 2.1 Bausteine (alles Cloudflare, Gratis-Tarif)
- **Workers (mit Static Assets)** – liefert die gebaute Web-App aus **und** stellt die API bereit, unter **einer Domain**
  (kein CORS-Chaos). Falls Cloudflare Pages die bessere Wahl ist, begründen.
- **Durable Objects (SQLite-Speicher)** – **ein Objekt pro laufendem Spiel** („Spielraum“):
  - hält den kompletten Spielzustand (Teams, Rollen, Positionen, Meldungen, Übergaben, Sperren, Chat),
  - verwaltet die **WebSocket-Verbindungen** aller Geräte des Spiels (**Hibernation-API** verwenden, damit es kostenlos bleibt),
  - ist die **einzige Autorität** für Spielregeln (alle Aktionen laufen durch das Objekt, serialisiert, keine Race-Conditions),
  - nutzt **Alarms** für alle zeitgesteuerten Ereignisse: nächste Mister-X-Meldung, geheimes Zufallsende, Ablauf von Wartezeiten,
    Löschfristen nach Spielende.
- **D1 (SQLite-Datenbank)** – spielübergreifende Daten: Liste der Spiele, Super-Admin, Spiel-Admins, Archiv-Index,
  Zonen-Vorlagen, Push-Abos (falls nicht im Spielraum), Audit-Log-Export.
- **Cron Triggers** (falls nötig) – Aufräumarbeiten (alte Daten löschen, verwaiste Spielräume).
- **Web Push (VAPID)** direkt aus dem Worker – **kein Firebase Cloud Messaging**.
- Optional **KV** nur wenn sinnvoll (z. B. Rate-Limit-Zähler); lieber im Durable Object lösen.

### 2.2 Warum diese Aufteilung
- Ein Spielraum = ein Durable Object → strikt geordnete Verarbeitung, Echtzeit-Broadcast, Timer genau dort, wo der Zustand liegt.
- Server-Autorität: Meldungen und Spielende passieren auch dann, wenn **kein** Admin-Gerät online ist.
- Wird das Gratis-Limit überschritten, fallen **keine Kosten** an (ohne hinterlegte Zahlungsart gibt es keine Abrechnung) –
  trotzdem so sparsam bauen, dass Limits nie erreicht werden. **Prüfe und dokumentiere dieses Verhalten.**

### 2.3 Sparsamkeit (Pflicht)
Rechne in `docs/CLOUDFLARE-LIMITS.md` vor: **30 Teams + 10 Schiris + Admin + 2 Großbild, 4 Stunden, Position alle 10–15 s**,
dazu Chat, Meldungen, Push. Ziel: deutlich unter allen Tageslimits (Requests, Durable-Object-Dauer, D1-Lese/Schreibzugriffe, Speicher).
Maßnahmen: WebSocket statt HTTP-Polling, Hibernation, Positionen nicht einzeln in D1 schreiben (im Spielraum halten, nur
reduziert archivieren), Broadcasts bündeln/drosseln (z. B. Positions-Updates an Staff max. 1×/2 s gesammelt).

---

## 3. Repository-Struktur (an den Frontend-Agenten anpassen!)

Vorschlag (Monorepo mit npm/pnpm-Workspaces – übernimm, was der Frontend-Agent bereits angelegt hat):
```
shared/      # gemeinsame TypeScript-Typen + reine Spiel-Logik (Zonen, Meldeplan, Umkreis, Auswertung) – von Client UND Server genutzt
server/      # Cloudflare Worker + Durable Objects + D1-Migrationen + wrangler-Konfiguration
web/ (o. ä.) # Frontend – gehört dem Frontend-Agenten, NICHT anfassen
docs/        # API.md, ENTSCHEIDUNGEN-BACKEND.md, CLOUDFLARE-LIMITS.md, BETRIEB.md
```
- **Reine Spiel-Logik** (Punkt-in-Zone mit 20-m-Toleranz, Meldezeitpunkte, Wartezeit-Umkreis, Auswertung, Zufallsende-Ziehung)
  gehört nach `shared/` als **getestete, seiteneffektfreie Funktionen** – der Server ist die Autorität, der Client darf sie für
  Vorschauen/Anzeigen nutzen. Stimme das mit dem Frontend-Agenten ab (er hat die Spiel-Logik konzipiert – übernimm seine Regeln).
- Die Zonen aus `zones.js` (Spielfeld Linz + 4 Sperrbereiche) werden als **Vorlage „Linz Innenstadt“** (GeoJSON) übernommen.

---

## 4. Konten, Login, Rechte (selbst gebaut, sicher)

Es gibt **keine E-Mail-Konten** und keinen externen Login-Anbieter. Baue eine schlanke, sichere Lösung:

| Rolle | Zugang |
|---|---|
| **Super-Admin** | Einmalige Einrichtung über ein Setup-Geheimnis (Wrangler-Secret) → setzt Super-Admin-Passwort. Danach Login mit Passwort. |
| **Spiel-Admin** | Vom Super-Admin pro Spiel angelegt (Name + Passwort oder Einladungslink mit Ablauf). |
| **Schiri** | Tritt dem Spiel mit **Spiel-Code + Schiri-Code** bei (Schiri-Code setzt der Spiel-Admin). |
| **Team** | Tritt mit **Spiel-Code (Link/QR) + Teamname + Team-Passwort** bei (Team-Passwort setzt der Spiel-Admin). |
| **Großbild/Zuschauer** | Eigener Anzeige-Link mit Token (nur lesen; Zuschauer ohne Live-Positionen). |

- Passwörter/Codes **nie im Klartext speichern**: PBKDF2 (WebCrypto) mit Salt; Vergleich in konstanter Zeit.
- Nach erfolgreichem Login/Beitritt: **signiertes Sitzungs-Token** (z. B. HMAC-signiert oder JWT mit Worker-Secret, Ablauf ca. 24 h,
  Spiel-ID + Rolle + Team-ID), das Gerät merkt es sich; WebSocket-Verbindung authentifiziert sich damit.
- **Sitzungen widerrufbar**: Team entfernen / „Neue Runde vorbereiten“ / Passwortwechsel des Admins → alle betroffenen Tokens ungültig
  (z. B. Token-Version pro Spiel/Team), Verbindungen werden mit verständlichem Grund geschlossen.
- **Rechte-Matrix** aus `PROMPT-NEUBAU.md` Abschnitt 6 **serverseitig** durchsetzen. Insbesondere:
  - **Live-Positionen** bekommen **nur Admin und Schiri** – Teams erhalten **nie** fremde Positionen, auch nicht im
    Datenverkehr (keine „versteckten“ Felder in Broadcasts!). Jeder Broadcast wird **pro Rolle gefiltert**.
  - Mister-X-Meldungen bekommen alle Spielteilnehmer (zum Meldezeitpunkt, nicht vorher).
  - Übergabe/Rückgängig/Strafübergabe: nur Schiri/Admin; Durchsage, Einstellungen, Zonen, Start/Ende: nur Admin.
  - Teams können keine System-Meldungen/Durchsagen fälschen.
- **Rate-Limits**: Beitrittsversuche mit falschem Passwort (z. B. 5/Min pro IP+Spiel), Chat (z. B. 1 Nachricht/2 s), Positionen.
- Eingaben streng validieren (Schema-Validierung, z. B. zod/valibot), Größenlimits, nur erwartete Felder.

---

## 5. Spiel-Server: Funktionen (Server ist die Autorität)

Setze **alle** serverseitigen Punkte aus `PROMPT-NEUBAU.md` um. Konkret:

**Spielverwaltung**
- Super-Admin: Spiele anlegen/archivieren/löschen, Spiel-Admins verwalten, Zonen-Vorlagen.
- Spiel-Admin: Team-Passwort festlegen/ändern/löschen, Schiri-Code, eigenes Passwort ändern, Teams umbenennen/entfernen,
  Schiri-Rollen, **„Neue Runde vorbereiten“** (alle Teams/Schiris abmelden, Team-Passwort löschen, Spieldaten leeren, Archiv bleibt).
- Zonen: Spielfeld + benannte Sperrbereiche als GeoJSON speichern, validieren (gültige Polygone), Toleranz (Standard 20 m).

**Spielablauf**
- Start (Start-Mister-X gewählt oder **serverseitig ausgelost**), Vorsprung, erste Meldung nach Intervall.
- **Automatische Mister-X-Meldungen** per Alarm im eingestellten Intervall (10 Min, änderbar auf 5 usw.); bei Intervalländerung
  Zeitplan sauber neu berechnen. Meldung nach einer Übergabe sofort.
- **Standortquelle für Mister X** (Priorität): Tracker der Fahne → Mister-X-Gerät → begleitender Schiri → letzter bekannter Standort.
  Die Meldung enthält Quelle und Alter („Standort vom Schiri“, „letzter bekannter von 14:32“).
- **Übergabe** (Fang / Strafübergabe) durch Schiri/Admin: neuer Mister X, Wartezeit für altes Team + alle Teams im Umkreis
  (einstellbar) um den Fangort, **idempotent** (doppelter Klick/Netzwiederholung erzeugt keine zweite Übergabe).
  **Rückgängig** zeitlich begrenzt (z. B. 2 Min) mit sauberem Zurücksetzen von Mister X, Zeitplan und Sperren.
- **Sofort-Meldung** (Strafe), **Durchsage**, **Bereiche sperren/freigeben**, Wartezeit/Umkreis ändern – jeweils mit System-Meldung.
- **Spielfeld-Prüfung**: Server erkennt Mister X außerhalb (mit Toleranz) und nahe der Grenze → Ereignis an Mister X + Staff.
- **Offline-Erkennung**: Team ohne Position > 3 Min → Ereignis an Staff; Mister X ohne frische Position → Warnung + Fallback.
- **Zufallsende**: Zeitfenster vom Admin, Zeitpunkt **geheim** im Spielraum (nie an Clients senden, außer Admin deckt ihn auf),
  Alarm beendet das Spiel. **Notstopp**. Optional **Pause** (falls der Frontend-Agent/Organisator sie will – nachfragen).
- **Plausibilität** der Positionen: unrealistische Sprünge/schlechte Genauigkeit markieren, Distanz-Statistik nur aus plausiblen Punkten.
- **Audit-Log** aller spielentscheidenden Aktionen (wer, wann, was, vorher/nachher).

**Chat**
- Gruppenchat + Direktkanal Team ↔ Admin, System-Meldungen, Durchsagen; Admin kann Nachrichten löschen; Ungelesen-Zähler unterstützen
  (z. B. Nachrichten-IDs/Zeitstempel, Client merkt sich den Lesestand). **Keine Fotos.**

**Spielende, Auswertung, Archiv**
- Auswertung serverseitig: letzter Mister X (Sieger), längste Zeit als Mister X, am öftesten Mister X, meiste Distanz,
  Anzahl Übergaben, Zeitstrahl.
- **Archiv** in D1: Auswertung, Mister-X-Meldungen, Übergaben, Verkleinerungen, Chat – **für Replay** geeignet aufbereitet.
- **Datenschutz/Löschfristen** (Minderjährige!): Live-Positionen aller Geräte **nach Spielende löschen**; keine Bewegungsprofile der
  Jäger archivieren (nur Gesamtdistanz). Chat-Aufbewahrung und Archiv-Dauer konfigurierbar (Vorschlag: Chat 30 Tage, Archiv 1 Jahr –
  Organisator bestätigen lassen). Automatisches Löschen per Alarm/Cron.

**Großbild/Zuschauer**
- Eigener Lese-Kanal: Großbild bekommt alles wie Admin (ohne Steuerung), Zuschauer nur öffentliche Infos.

---

## 6. Schnittstellen-Vertrag (zuerst liefern!)

Lege in `shared/` die **TypeScript-Typen** und in `docs/API.md` die **Beschreibung** fest:

- **HTTP (JSON)** für: Login/Beitritt, Token-Erneuerung, Super-Admin-/Spiel-Verwaltung, Zonen, Archiv/Replay abrufen,
  Push-Abo registrieren, Tracker-Positionen.
- **WebSocket** (eine Verbindung pro Gerät zum Spielraum) für alles Live:
  - Client → Server: `position`, `chat.send`, `handover`, `handover.undo`, `admin.*` (Einstellungen, Sperren, Durchsage, Sofort-Meldung,
    Start, Notstopp …), `ack`/`ping`.
  - Server → Client: `snapshot` (vollständiger, **rollengefilterter** Zustand beim Verbinden/Reconnect), danach **Ereignisse**
    (`report`, `handover`, `lock`, `zone`, `settings`, `chat`, `announcement`, `warning`, `game.start`, `game.end`, `positions` nur Staff …),
    jeweils mit **fortlaufender Sequenznummer**, damit der Client Lücken erkennt und bei Bedarf einen neuen Snapshot holt.
  - **Server-Zeit** in jeder Nachricht (Clients rechnen Countdowns mit Server-Zeit, nicht mit der Handy-Uhr).
  - Befehle tragen eine **Client-Request-ID** → Server antwortet mit Erfolg/Fehler (verständliche deutsche Fehlercodes/-texte),
    Wiederholungen sind idempotent.
- **Versionierung** des Protokolls (z. B. `protocolVersion`), Client wird bei Inkompatibilität freundlich zum Neuladen aufgefordert.
- Beispiele (JSON) für jede Nachricht in `docs/API.md`.
- Stelle eine **kleine Client-Bibliothek** in `shared/` (oder `client-sdk/`) bereit: verbinden, automatisch wiederverbinden mit Backoff,
  Snapshot + Ereignisse zu einem lokalen Zustand zusammenführen, Befehle mit Promise-Antwort, Offline-Warteschlange für Positionen.
  Das spart dem Frontend-Agenten viel Arbeit und verhindert Fehler – **stimme Form und Framework-Unabhängigkeit mit ihm ab**.

---

## 7. Push-Benachrichtigungen (ohne Google-Konto)

- **Web Push mit VAPID** (Schlüssel als Wrangler-Secret), Verschlüsselung der Payload nach Standard (RFC 8291/8188) mit WebCrypto im Worker.
  Prüfe, ob eine Bibliothek im Workers-Runtime funktioniert, sonst schlanke eigene Implementierung mit Tests.
- Abo-Verwaltung pro Gerät/Rolle/Spiel; abgelaufene Abos (HTTP 404/410) automatisch löschen.
- Ereignisse mit Push: Mister-X-Meldung, Übergabe, „Ihr seid Mister X“, Wartezeit beginnt/endet, Durchsage, Verkleinerung,
  Regeländerung, Direktnachricht vom Admin, Spielstart/-ende. Geräte mit offener WebSocket-Verbindung brauchen keinen Push
  (Doppel-Benachrichtigungen vermeiden – Absprache mit dem Frontend-Agenten).
- **Android-App:** Die Android-App läuft während des Spiels wegen Hintergrund-GPS als Foreground-Service und hält die WebSocket-Verbindung
  → sie kann **lokale Benachrichtigungen** selbst auslösen. Kläre mit dem Frontend-Agenten, ob zusätzlich Web-Push in der App-WebView
  nötig ist. **Kein Firebase Cloud Messaging.**
- **iPhone:** Web-Push nur für zum Home-Bildschirm hinzugefügte Web-App (iOS ≥ 16.4) – in `docs/API.md` vermerken.

---

## 8. Tracker-Schnittstelle (Vorbereitung, siehe `IDEEN.md`)

- HTTP-Endpunkt, kompatibel mit dem **OsmAnd-/Traccar-Client-Protokoll** (Parameter `id`, `lat`, `lon`, `timestamp`, `accuracy`, …),
  damit z. B. alte Android-Handys mit der kostenlosen App „Traccar Client“ direkt senden können.
- Geräte-Token pro Tracker (vom Admin erzeugt), Zuordnung **Gerät → Team** oder **Gerät → Fahne (= immer Mister X)**.
- Positionen fließen in dieselbe Logik wie Handy-Positionen (Priorität siehe Abschnitt 5). Rate-Limit pro Gerät.

---

## 9. Tests (Pflicht, in CI)

- **Unit-Tests** (`shared/`): Zonen inkl. Toleranz (übernimm/erweitere `test/zones.test.mjs`), Meldeplan inkl. Intervalländerung,
  Umkreis-Wartezeit, Rückgängig, Auswertung, Zufallsende-Ziehung, Plausibilitätsfilter.
- **Integrations-Tests** gegen die lokale Cloudflare-Laufzeit (z. B. Vitest mit dem Workers-Test-Pool / Miniflare):
  Durable-Object-Alarme (mit Zeitsteuerung), WebSocket-Protokoll, Rechte (**Angriffsversuche**: Team versucht Positionen zu lesen,
  Durchsage zu fälschen, Übergabe auszulösen, fremdes Team zu ändern, mit abgelaufenem/widerrufenem Token zu verbinden),
  Idempotenz, Reconnect mit Sequenzlücke, Neue Runde, Löschfristen.
- **Simuliertes Gesamtspiel** (Zeitraffer): Admin, 2 Schiris, 30 Teams mit Fake-GPS – Start → Meldungen → Übergaben → Rückgängig →
  Verkleinerung → Offline-Team → Zufallsende → Archiv → Neue Runde. Misst dabei Requests/Nachrichten/Speicher und vergleicht mit
  `docs/CLOUDFLARE-LIMITS.md`.
- **Vertragstests**: Nachrichten entsprechen den Typen/Schemas in `shared/`.
- **GitHub Actions**: Lint, Typecheck, alle Tests bei jedem Push; Deploy nur manuell/auf Freigabe (siehe Abschnitt 10).

---

## 10. Betrieb & Deployment (für Menschen ohne Programmierkenntnisse)

- Der Organisator legt ein **kostenloses Cloudflare-Konto** mit `mr.x.rf.ooe@gmail.com` an (**keine Zahlungsart hinterlegen**).
  Schreibe in `docs/BETRIEB.md` eine **Klick-für-Klick-Anleitung** (Windows): Konto anlegen, `npx wrangler login`,
  D1-Datenbank anlegen, Secrets setzen (Setup-Geheimnis, Token-Schlüssel, VAPID-Schlüssel – mit fertigem Befehl zum Erzeugen),
  `npx wrangler deploy`, Super-Admin einrichten, eigene Subdomain (`*.workers.dev`), optional eigene Domain.
- Optional: GitHub Action für Deploy mit Cloudflare-API-Token als Repository-Secret (Anleitung, welche minimalen Rechte der Token braucht).
- **Getrennte Umgebungen**: `dev`/Vorschau und `produktion` (eigene D1-Datenbanken, eigene Durable-Object-Namensräume), damit Tests
  nie echte Spiele stören.
- **Backup**: Export eines Spiel-Archivs als JSON (Admin-Funktion) + D1-Export-Anleitung.
- **Monitoring**: Worker-Logs (Fehler mit Spiel-ID/Request-ID, **ohne** Standortdaten/Passwörter), einfache Status-Route (`/health`).
- Die **alte Firebase-Version** bleibt unangetastet online, bis der Organisator umschaltet.

---

## 11. Meilensteine (jeweils lauffähig, getestet, committet, gepusht, kurzer Bericht)

1. **Bestandsaufnahme:** Branch/Struktur des Frontend-Agenten lesen, Cloudflare-Limits recherchieren (`docs/CLOUDFLARE-LIMITS.md` mit Rechnung),
   Architektur-Entscheidungen (`docs/ENTSCHEIDUNGEN-BACKEND.md`), offene Fragen sammeln.
2. **Schnittstellen-Vertrag:** `shared/`-Typen + Schemas, `docs/API.md` mit Beispielen, Client-SDK-Gerüst.
   **→ Bestätigung durch Organisator/Frontend-Agent abwarten.**
3. **Fundament:** Worker + Static Assets, D1-Schema + Migrationen, Durable-Object-Spielraum-Gerüst, Auth (Super-Admin-Setup, Spiel-Admin,
   Team-/Schiri-Beitritt, Tokens, Widerruf), Rate-Limits, CI.
4. **Spiel-Kern:** Start, Meldeplan per Alarm, Standortquellen-Priorität, Übergabe/Rückgängig/Strafübergabe, Wartezeiten, Zonen/Sperren,
   Spielfeld-/Offline-Warnungen, Sofort-Meldung, Durchsage, Zufallsende/Notstopp, Audit-Log – mit Tests.
5. **Chat** (Gruppe, Direkt, System, Moderation) + rollengefilterte Broadcasts + Reconnect/Sequenzen.
6. **Auswertung, Archiv & Replay-Daten, Löschfristen, Neue Runde.**
7. **Super-Admin & mehrere Spiele, Zonen-Vorlagen (Linz aus `zones.js`), Zonen-Validierung.**
8. **Web Push (VAPID)** + Abstimmung lokale Benachrichtigungen der Android-App.
9. **Tracker-Schnittstelle** (Traccar/OsmAnd-Protokoll, Geräte-Token, Zuordnung).
10. **Härtung:** simuliertes Gesamtspiel mit 30 Teams, Limit-Messung, Angriffs-Tests, Doku `docs/BETRIEB.md`, Übergabe an Frontend.
11. **Integration:** Zusammen mit dem Frontend-Branch lauffähig auf einer Cloudflare-Vorschau-Umgebung; Anleitung für den Feldtest.

---

## 12. Definition of Done (Backend)

- Ein komplettes Spiel läuft über das Cloudflare-Backend; Meldungen, Wartezeiten und Zufallsende passieren **auch ohne online Admin-Gerät**.
- Kein Gerät ohne Berechtigung erhält jemals Live-Positionen (durch Tests belegt).
- Simuliertes Spiel mit 30 Teams/4 h bleibt nachweislich deutlich unter den Gratis-Limits; **0 € Kosten, keine Zahlungsart nötig**.
- Web Push funktioniert (Android-Browser/Chrome, installierte PWA auf iPhone ≥ 16.4); Android-App bekommt Ereignisse über die Verbindung.
- Schnittstellen-Vertrag ist dokumentiert, typisiert und vom Frontend genutzt; CI grün.
- `docs/BETRIEB.md` ermöglicht dem Organisator ohne Programmierkenntnisse: Konto anlegen, deployen, Super-Admin einrichten, Spiel anlegen.
- Datenschutz-Löschfristen greifen automatisch.

---

## 13. Fragen, die du früh klären solltest

- Wie heißt der Branch/Ordner des Frontend-Agenten, und welches Framework/Build-Setup nutzt er?
- Pause-Funktion ja/nein? Zuschauer-/Eltern-Modus ja/nein und was darf er zeigen?
- Aufbewahrung: Chat (Vorschlag 30 Tage), Archiv (Vorschlag 1 Jahr) – passt das?
- Soll der Start-Mister-X ausgelost werden können?
- Rückgängig-Zeitfenster (Vorschlag 2 Min)?
- Wer ist Super-Admin, wie viele Spiel-Admins pro Spiel?

**Los geht's mit Meilenstein 1.**
