# Android-App (APK)

Die Android-App ist dieselbe App wie im Browser, eingepackt mit [Capacitor](https://capacitorjs.com). Sie kann zusätzlich:

- **Standort auch bei ausgeschaltetem Bildschirm senden** (Dauer-Benachrichtigung „Mister X läuft“),
- **Benachrichtigungen** auch dann zeigen, wenn die App geschlossen ist,
- direkt zu **„Akku-Optimierung ausschalten“** führen.

iPhones nutzen die Web-App (Safari → Teilen → „Zum Home-Bildschirm“) – eine iOS-App ist nicht Teil dieses Projekts.

---

## 1. APK herunterladen (für Teams)

1. Am einfachsten: den QR-Code vom Flyer scannen – liegt die APK am Server ([`BETRIEB.md`](BETRIEB.md) Schritt 9),
   zeigt die Startseite im Android-Browser **„Android-App installieren“**. Sonst die Seite **Releases** des
   Repositorys öffnen und `mister-x.apk` herunterladen.
2. Antippen → Android fragt: **„Installation aus unbekannten Quellen zulassen?“** → für den Browser bzw. „Dateien“
   **erlauben** → zurück → **Installieren**.
   (Der Hinweis kommt, weil die App nicht aus dem Play Store kommt. Sie ist mit dem Schlüssel der Roten Falken signiert.)
3. App öffnen → **Team beitreten** → Spiel-Code eingeben (steht auf dem Flyer), Teamname, Team-Passwort.
4. Im Onboarding:
   - **Standort erlauben** → „Beim Verwenden der App“ wählen. Für das Senden im Hintergrund zeigt die App eine
     Dauer-Benachrichtigung – die bitte nicht wegwischen.
   - **Benachrichtigungen erlauben.**
   - **Akku-Einstellungen öffnen** → „Zulassen“ bzw. „Nicht optimieren“. Ohne diesen Schritt halten manche Handys
     (Samsung, Xiaomi, Huawei) die App nach einigen Minuten an.

Unter **Mehr → Einstellungen → Standort** lässt sich „Im Hintergrund senden“ ausschalten (dann nur, solange die App
offen ist).

**Updates:** einfach die neue `mister-x.apk` installieren – Anmeldung und Einstellungen bleiben erhalten.

---

## 2. Einmalig einrichten (Organisator)

### 2.1 Signier-Schlüssel erzeugen

Jede APK muss mit **demselben** Schlüssel signiert sein, sonst lässt sich ein Update nicht über die alte Version
installieren. Den Schlüssel einmal erzeugen und **gut aufheben** (z. B. im Passwort-Manager des Vereins).

Mit installiertem [Java 21](https://adoptium.net), in der Eingabeaufforderung (Windows):

```sh
keytool -genkeypair -v -keystore mister-x.jks -alias misterx -keyalg RSA -keysize 4096 -validity 10000
```

Das Programm fragt nach einem Passwort (zweimal) und nach Namen/Organisation (z. B. „Rote Falken OÖ“, „AT“).

Den Schlüssel für GitHub in Text umwandeln:

```sh
certutil -encode mister-x.jks mister-x.b64
```

(Auf Mac/Linux: `base64 -i mister-x.jks -o mister-x.b64`.) Bei Windows aus `mister-x.b64` die erste und letzte Zeile
(`-----BEGIN…`/`-----END…`) löschen.

### 2.2 Secrets in GitHub hinterlegen

GitHub → Repository → **Settings → Secrets and variables → Actions → New repository secret**:

| Name | Inhalt |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | gesamter Inhalt von `mister-x.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | Passwort aus 2.1 |
| `ANDROID_KEY_ALIAS` | `misterx` |
| `ANDROID_KEY_PASSWORD` | Passwort aus 2.1 (dasselbe, wenn keytool nicht extra gefragt hat) |

### 2.3 Adresse des Spiel-Servers

Die App enthält die Adresse des Servers fest (Standard `https://mister-x.mr-x-ooe.workers.dev`, siehe
[`BETRIEB.md`](BETRIEB.md)). Nur bei einer anderen Adresse: GitHub → **Settings → Secrets and variables → Actions →
Variables → New repository variable** `MRX_API_URL` = z. B. `https://mister-x.meine-subdomain.workers.dev`.

Benachrichtigungen brauchen **keine** weitere Einrichtung: Die App zeigt sie selbst an (lokale Benachrichtigungen),
es gibt kein Firebase und keine `google-services.json` mehr.

---

## 3. Neue Version bauen

**Automatisch:** Bei jedem Versions-Tag baut GitHub die signierte APK und veröffentlicht sie unter **Releases**:

1. GitHub → **Releases → Draft a new release** → „Choose a tag“: z. B. `v2.0.0` eingeben → **Create new tag**.
2. **Publish release.** Nach ca. 10 Minuten hängt `mister-x.apk` am Release.

Alternativ: GitHub → **Actions → Android-APK → Run workflow** (die APK liegt dann unter „Artifacts“ des Laufs).

Bei jeder Änderung an der App baut GitHub außerdem eine **unsignierte Test-APK** (`mister-x-test.apk` unter
„Artifacts“) – zum Ausprobieren, nicht zum Verteilen.

**Lokal (für Entwickler):** Android Studio bzw. Android-SDK + Java 21, dann

```sh
npm ci
npm -w app run build
cd app && npx cap sync android && cd android && gradlew assembleDebug
```

Die APK liegt unter `app/android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 4. Verhalten im Hintergrund

- Der Standort wird über einen **Vordergrund-Dienst** ermittelt (Android verlangt dafür die Dauer-Benachrichtigung).
- Ist die App sichtbar, geht der Standort über die Live-Verbindung. Im Hintergrund sendet sie über **natives HTTP**
  (`/api/pos`, mit dem Sitzungs-Token, alle 30 s), weil Android das Netzwerk der App-Oberfläche im Hintergrund nach
  einigen Minuten drosselt. Die Antwort bringt Benachrichtigungen mit, die die App vielleicht verpasst hat.
- **Benachrichtigungen** (Meldung, Übergabe, Wartezeit, Durchsage …) zeigt die App selbst an, sobald sie im Hintergrund
  ist – über die Verbindung sofort, sonst spätestens mit dem nächsten Standort (≤ 30 s). Ist die App ganz geschlossen
  (Dauer-Benachrichtigung weggewischt), kommen keine Benachrichtigungen – darum im Onboarding den Hinweis beachten.
- Nach dem Spielende sendet die App keinen Standort mehr; die Dauer-Benachrichtigung verschwindet, wenn die App
  geschlossen bzw. das Team abgemeldet wird.

## 5. Automatischer Gerätetest (Emulator)

Bei jeder Änderung an App oder Server startet GitHub zusätzlich einen **Android-Emulator** (Android 14), installiert die
Test-APK und spielt gegen einen Spiel-Server auf demselben Rechner ([`tests/android-geraet.mjs`](../tests/android-geraet.mjs)):

1. App offen im Warteraum → der Standort kommt am Server an,
2. App in den Hintergrund (Handy wandert in die Tasche), **dann** startet die Spielleitung das Spiel; 90 Sekunden
   „gehen“ → neue Standorte kommen weiter an, die Dauer-Benachrichtigung „Mister X läuft“ bleibt,
3. Bildschirm aus, 150 Sekunden weitergehen → neue Standorte kommen weiter an,
4. Durchsage der Spielleitung → erscheint als **Android-Benachrichtigung**, während der Bildschirm aus ist.

Ergebnis ansehen: GitHub → **Actions → Android-APK** → Lauf öffnen → **Summary** zeigt die Tabelle „Gerätetest
Android-App (Emulator)“ mit einem Verlauf alle 5 Sekunden; Geräteprotokolle liegen im Artefakt `android-geraetetest`. Ein Emulator ersetzt den
[Feldtest](FELDTEST.md) nicht ganz: Akku-Sparfunktionen mancher Hersteller (Samsung, Xiaomi, Huawei) gibt es nur auf
echten Handys.
