# Android-App (APK)

Die Android-App ist dieselbe App wie im Browser, eingepackt mit [Capacitor](https://capacitorjs.com). Sie kann zusätzlich:

- **Standort auch bei ausgeschaltetem Bildschirm senden** (Dauer-Benachrichtigung „Mister X läuft“),
- **Benachrichtigungen** auch dann zeigen, wenn die App geschlossen ist,
- direkt zu **„Akku-Optimierung ausschalten“** führen.

iPhones nutzen die Web-App (Safari → Teilen → „Zum Home-Bildschirm“) – eine iOS-App ist nicht Teil dieses Projekts.

---

## 1. APK herunterladen (für Teams)

1. Am Handy die Seite **Releases** des Repositorys öffnen (oder den Link/QR-Code der Spielleitung) und `mister-x.apk`
   herunterladen.
2. Antippen → Android fragt: **„Installation aus unbekannten Quellen zulassen?“** → für den Browser bzw. „Dateien“
   **erlauben** → zurück → **Installieren**.
   (Der Hinweis kommt, weil die App nicht aus dem Play Store kommt. Sie ist mit dem Schlüssel der Roten Falken signiert.)
3. App öffnen, Spiel-Code scannen bzw. eingeben, Team-Passwort.
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
| `GOOGLE_SERVICES_JSON` | siehe 2.3 (für Benachrichtigungen) |

### 2.3 Benachrichtigungen für Android (google-services.json)

1. Firebase-Konsole → Projekt **mr-x-ooe** → Zahnrad → **Projekteinstellungen** → unten **„App hinzufügen“** → Android.
2. Paketname: **`at.rotefalken.misterx`**, App-Name „Mister X“ → **App registrieren**.
3. **`google-services.json` herunterladen** (die weiteren Schritte im Assistenten überspringen).
4. In Text umwandeln wie in 2.1 (`certutil -encode google-services.json gs.b64`, erste/letzte Zeile löschen) und als
   Secret `GOOGLE_SERVICES_JSON` speichern.

Ohne dieses Secret funktioniert die App trotzdem – nur Benachrichtigungen bei geschlossener App fehlen dann.

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
- Gesendet wird über **natives HTTP** direkt an die Datenbank (mit Anmeldung, dieselben Zugriffsregeln wie im Browser),
  weil Android das Netzwerk der App-Oberfläche im Hintergrund nach einigen Minuten drosselt.
- Nach dem Spielende sendet die App keinen Standort mehr; die Dauer-Benachrichtigung verschwindet, wenn die App
  geschlossen bzw. das Team abgemeldet wird.
