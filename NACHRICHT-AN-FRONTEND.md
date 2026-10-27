# Nachricht an den Frontend-Agenten (in die laufende Sitzung kopieren)

Wichtige Änderung zum Auftrag in `PROMPT-NEUBAU.md`:

**Das Backend läuft nicht auf Firebase, sondern komplett auf Cloudflare (Gratis-Tarif, ohne Kreditkarte).**
Ein zweiter KI-Agent baut parallel das Backend nach `PROMPT-BACKEND.md` (bitte lesen, v. a. Abschnitte 0, 2, 3, 6 und 7).

Was das für dich bedeutet:

1. **Kein Firebase** im Neubau – kein Firebase-SDK, keine Security Rules, keine Cloud Functions, kein FCM.
   Die alte Version auf Firebase bleibt bis zur Umstellung unverändert online.
2. **Du bist für Spiel-Logik-Konzept, Design und die gesamte Oberfläche zuständig** (Web/PWA + Android-App mit Capacitor).
   Server, Echtzeit, Datenhaltung, Rechte, Zeitsteuerung, Push-Versand und Tracker-Schnittstelle macht der Backend-Agent.
3. **Verbindung zum Server:** eine WebSocket-Verbindung pro Gerät zum „Spielraum“ (Cloudflare Durable Object) plus einige HTTP-Aufrufe
   (Login/Beitritt, Verwaltung, Archiv). Der Backend-Agent liefert zuerst den **Schnittstellen-Vertrag** (`docs/API.md` + gemeinsame
   TypeScript-Typen in `shared/`) und eine kleine **Client-Bibliothek** (verbinden, wiederverbinden, Zustand, Befehle).
   Baue gegen diesen Vertrag; bis er da ist, arbeite mit Mock-Daten.
4. **Login** ohne E-Mail-Konten: Team = Spiel-Code (Link/QR) + Teamname + Team-Passwort; Schiri = Spiel-Code + Schiri-Code;
   Spiel-Admin und Super-Admin mit Passwort. Der Server gibt ein Sitzungs-Token zurück.
5. **Push:** Web Push (VAPID) für Browser/PWA; die Android-App zeigt während des Spiels **lokale Benachrichtigungen** aus der
   bestehenden Verbindung (läuft wegen Hintergrund-GPS ohnehin als Foreground-Service) – **kein FCM**.
6. **Gemeinsame Spiel-Logik** (Zonen mit 20-m-Toleranz, Meldeplan, Umkreis, Auswertung) liegt als reine, getestete Funktionen in `shared/`.
   Der Server ist die Autorität; der Client nutzt sie nur für Anzeige/Vorschau. Bitte gib dem Backend-Agenten deine Spiel-Logik-Regeln
   bzw. dein Konzept (`docs/KONZEPT.md`) weiter, damit beide dasselbe umsetzen.
7. **Hosting:** Die gebaute Web-App wird vom selben Cloudflare Worker ausgeliefert (gleiche Domain wie die API).
8. **Arbeitsteilung im Repo:** Du arbeitest in deinem Frontend-Ordner, der Backend-Agent in `server/` und `shared/` auf dem Branch
   `neubau-backend`. Bitte keine Dateien des anderen ändern; Abstimmung über `docs/API.md` und Pull Requests.
9. Bitte teile mir mit: **Branch-Name, Ordnerstruktur, Framework/Build-Setup** und ob du schon Typen/Datenmodelle angelegt hast –
   ich gebe das an den Backend-Agenten weiter.
