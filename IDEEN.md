# Ideen für später: Standort im Hintergrund

Stand jetzt: Die Web-App sendet den Standort nur, solange sie offen ist und der Bildschirm an ist
(Browser frieren Webseiten im Hintergrund ein, das gilt für Android und noch strenger für iPhone).
Wir spielen vorerst so: Handys bleiben eingeschaltet, Powerbank pro Team.

## Was nicht geht
- **WhatsApp-Live-Standort**: Ende-zu-Ende-verschlüsselt, keine Schnittstelle.
- **Google-Maps-Standortfreigabe**: keine Schnittstelle für fremde Apps.
- **AirTag / SmartTag / Tile**: keine Schnittstelle, nicht live (nur wenn fremde Handys in der Nähe sind).

## Möglichkeiten

| Idee | Kosten | Aufwand | Mister X sicher | Jäger im Hintergrund |
|---|---|---|---|---|
| Schiri-Handy als Ersatz für Mister X | 0 € | gering | meistens | nein |
| GPS-Tracker in der Fahne (wandert mit Mister X) | ca. 100 € + SIM | mittel | ja | nein |
| Alte Android-Handys + „Traccar Client“ pro Team | ca. 10–15 €/Team (SIM) | mittel | ja | ja |
| Billige 4G-Tracker pro Team | ca. 35–55 €/Team | mittel–hoch | ja | ja |
| Eigene Android-App (Capacitor + Hintergrund-GPS) | 0 € | mittel | ja (Android) | ja (Android) |
| OwnTracks-App (Android + iPhone) | 0 € + Blaze-Tarif | mittel | ja | ja |
| Eigene iPhone-App | 99 $/Jahr + Mac | hoch | ja | ja |

### Schiri-Handy als Ersatz
Der Schiri läuft immer mit Mister X mit. Sendet das Mister-X-Handy nicht mehr, nimmt die App den Standort
des Schiris für die automatischen Meldungen.

### GPS-Tracker in der Fahne
Die Fahne wird bei jeder Übergabe weitergegeben → ein Tracker darin trackt immer Mister X.
1 Tracker + 1 Ersatz reichen. Admin ordnet „Tracker = Mister X“ zu, Fallback bleibt das Handy.

### Tracker / alte Handys pro Team
- 4G-Tracker (2G/3G werden in Österreich abgeschaltet!), Server per SMS einstellbar („GT06“, „Traccar-kompatibel“).
- SIM: IoT-SIM mit Einmalpreis (ca. 10–15 € für mehrere Jahre).
- Alternativ alte, gespendete Android-Handys mit der kostenlosen App „Traccar Client“ (sendet im Hintergrund).
- Vorher mit 2–3 Geräten in der Innenstadt testen.

### Empfangsstelle (für Tracker, Traccar Client, OwnTracks)
Geräte können nicht direkt in die Firebase-Datenbank schreiben. Entweder:
- **Firebase Blaze-Tarif + Cloud Function** (praktisch gratis, Kreditkarte nötig), oder
- **Traccar-Server** (Open Source, kleiner Mietserver ca. 5 €/Monat); die App holt die Positionen von dort.

In der App dann: Admin-Feld „Tracker zuordnen“ (Tracker → Team); Tracker-Standort hat Vorrang vor dem Handy.
