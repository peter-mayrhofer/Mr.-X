// Android-App (Meilenstein 9): dieselbe Web-App, eingepackt mit Capacitor. Siehe docs/ANDROID-APK.md.
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "at.rotefalken.misterx",
  appName: "Mister X",
  webDir: "dist",
  android: {
    // Karte und Spiel-Server laufen über https – keine unverschlüsselten Verbindungen erlauben
    allowMixedContent: false,
    // sonst hören Standort-Updates nach 5 Min im Hintergrund auf (Hinweis des Standort-Plugins)
    useLegacyBridge: true,
  },
  plugins: {
    // lokale Benachrichtigungen (kein Firebase): kleines Fahnen-Symbol, Farbe der Roten Falken
    LocalNotifications: { smallIcon: "ic_stat_flag", iconColor: "#C51A1A" },
  },
};

export default config;
