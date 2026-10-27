# Zusatzauftrag: Umzug des Backends von Firebase auf Cloudflare (in die laufende Sitzung kopieren)

Wichtige Änderung zu `PROMPT-NEUBAU.md`: **Wir nehmen nicht den Firebase-Blaze-Tarif.** Der Verein will keine Kreditkarte/
kein Bankkonto hinterlegen. Das Backend soll stattdessen **komplett auf Cloudflare im Gratis-Tarif (ohne Zahlungsart)** laufen –
**ein einziger Anbieter** für Hosting, Spiel-Server, Echtzeit, Datenbank, Zeitsteuerung und Push. Kosten: 0 €.

## Ablauf
1. **Bring Meilenstein 9 (Android-App) sauber zu einem lauffähigen Zwischenstand**, aber baue dort **nichts Neues mehr auf Firebase**
   (kein FCM in der Android-App, keine neuen Firebase-Abhängigkeiten). Hintergrund-GPS, Foreground-Service, Berechtigungen und
   APK-Build kannst du fertigstellen – die Positionen gehen dann über die neue Verbindung (Schritt 2).
2. **Neuer Meilenstein „9b: Umzug auf Cloudflare“** – **vor** Meilenstein 10. Details und Anforderungen an das Backend stehen in
   **`PROMPT-BACKEND.md`** (Abschnitte 2, 4, 5, 6, 7, 8, 9, 10, 12 – die Abschnitte über einen zweiten Agenten/Branch-Aufteilung
   gelten für dich nicht, **du machst das selbst** in deiner bestehenden Struktur).
3. Danach weiter mit Meilenstein 10 ff. wie geplant.

## Was beim Umzug konkret passiert (Vorschlag – du kennst den Code am besten, begründe Abweichungen in `docs/ENTSCHEIDUNGEN.md`)
- **`functions/` → `server/`**: Cloudflare Worker (liefert auch die gebaute App als Static Assets aus, gleiche Domain) +
  **ein Durable Object pro Spiel** („Spielraum“, SQLite-Speicher, WebSocket-Hibernation, **Alarms** für Meldeplan, Zufallsende,
  Wartezeiten, Löschfristen) + **D1** für spielübergreifende Daten (Spiele, Super-Admin, Archiv, Vorlagen).
- **`shared/src/api.ts` bleibt der Vertrag**: Die Aktionen (`join`, `startGame`, `handover`, `undo`, `setConfig`, …) bleiben gleich,
  laufen aber über `POST /api` bzw. als Befehl über die WebSocket-Verbindung statt über `httpsCallable`.
- **Live-Daten:** Statt Firebase-Listenern (`live.svelte.ts`, `game.svelte.ts`) eine WebSocket-Verbindung pro Gerät:
  **rollengefilterter Snapshot** beim Verbinden + Ereignisse mit Sequenznummer + Server-Zeit; automatisches Wiederverbinden.
  Live-Positionen gehen **nur** an Admin/Schiri – im Spielraum pro Rolle filtern (ersetzt die Security Rules).
- **Anmeldung:** statt Firebase Auth eigene Sitzungs-Tokens (signiert, widerrufbar); Passwörter/Codes mit PBKDF2 gehasht;
  Super-Admin-Einrichtung über ein Setup-Geheimnis (Wrangler-Secret). Abläufe für Team/Schiri/Admin bleiben aus Nutzersicht gleich.
- **Push:** FCM → **Web Push (VAPID)** aus dem Worker; Android-App zeigt während des Spiels **lokale Benachrichtigungen** aus der
  bestehenden Verbindung (läuft als Foreground-Service). Doppel-Benachrichtigungen vermeiden.
- **Tests:** Rules-/Functions-Tests gegen den Firebase-Emulator werden zu Tests gegen die lokale Cloudflare-Laufzeit
  (z. B. Vitest-Workers-Pool/Miniflare) – inkl. Rechte-Angriffstests, Alarme mit Zeitsteuerung, Idempotenz, Reconnect.
  E2E-Tests (Playwright) gegen `wrangler dev`. Alle bestehenden Testfälle müssen sinngemäß weiter grün sein.
- **Limits:** aktuelle Cloudflare-Gratis-Limits recherchieren und für 30 Teams × 4 h vorrechnen (`docs/CLOUDFLARE-LIMITS.md`),
  sparsam bauen (Hibernation, Positionen nicht einzeln in D1, gebündelte Broadcasts).
- **Doku:** `docs/FIREBASE-EINRICHTUNG.md` ersetzen durch `docs/BETRIEB.md` (Klick-für-Klick für Windows: kostenloses Cloudflare-Konto
  mit `mr.x.rf.ooe@gmail.com` **ohne Zahlungsart**, `npx wrangler login`, D1 anlegen, Secrets setzen, `npx wrangler deploy`,
  Super-Admin einrichten). Firebase-Reste (`firebase.json`, `functions/`, Firebase-SDK) aus dem Neubau entfernen –
  **die alte Version unter `legacy/` und die laufende Seite `mr-x-ooe.web.app` bleiben unangetastet.**

Bitte bestätige kurz, wie du vorgehen willst, bevor du mit 9b anfängst (Aufwand, Reihenfolge, offene Fragen).
