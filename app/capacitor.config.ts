// Android-App (Meilenstein 9): dieselbe Web-App, eingepackt mit Capacitor. Siehe docs/ANDROID-APK.md.
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "at.rotefalken.misterx",
  appName: "Mister X",
  webDir: "dist",
  android: {
    // Karte und Firebase laufen über https – keine unverschlüsselten Verbindungen erlauben
    allowMixedContent: false,
    // sonst hören Standort-Updates nach 5 Min im Hintergrund auf (Hinweis des Standort-Plugins)
    useLegacyBridge: true,
  },
  plugins: {
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};

export default config;
