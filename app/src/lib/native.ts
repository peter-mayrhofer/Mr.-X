// Android-App (Meilenstein 9): was nur in der Capacitor-App anders läuft als im Browser.
// - Standort über einen Vordergrund-Dienst (Dauer-Benachrichtigung) → läuft auch bei ausgeschaltetem Bildschirm
// - Standort senden über natives HTTP (REST der Datenbank) → Android bremst WebView-Netzwerk im Hintergrund
// - Push über Firebase Cloud Messaging nativ, Akku-Optimierung abschalten (eigenes kleines Plugin „Akku“)
import { Capacitor, CapacitorHttp, registerPlugin } from "@capacitor/core";
import type { BackgroundGeolocationPlugin, Location } from "@capacitor-community/background-geolocation";
import { auth, DATABASE_URL } from "./firebase.ts";

export const NATIVE = Capacitor.isNativePlatform();

const BG = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");
const Akku = registerPlugin<{ status(): Promise<{ ignoring: boolean }>; request(): Promise<void> }>("Akku");

let watcher: string | null = null;

/** Standort beobachten; `background` = mit Dauer-Benachrichtigung, damit Android die App nicht anhält */
export async function watchNative(background: boolean, onLoc: (l: Location) => void, onDenied: () => void) {
  await stopNative();
  watcher = await BG.addWatcher(
    {
      ...(background ? { backgroundTitle: "Mister X läuft", backgroundMessage: "Euer Standort wird an die Spielleitung gesendet." } : {}),
      requestPermissions: true,
      stale: false,
      distanceFilter: 5,
    },
    (loc, err) => {
      if (err?.code === "NOT_AUTHORIZED") onDenied();
      else if (loc) onLoc(loc);
    },
  );
}

export async function stopNative() {
  if (watcher) await BG.removeWatcher({ id: watcher });
  watcher = null;
}

export const openLocationSettings = () => BG.openSettings();

/** Datenbank-Schreibzugriff per REST mit nativem HTTP (Rules gelten genauso, Anmeldung über das ID-Token) */
export async function restSet(path: string, value: unknown) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("nicht angemeldet");
  const r = await CapacitorHttp.put({
    url: `${DATABASE_URL}/${path}.json?auth=${encodeURIComponent(token)}`,
    headers: { "Content-Type": "application/json" },
    data: value,
  });
  if (r.status >= 300) throw new Error(`HTTP ${r.status}`);
}

/** Push nativ registrieren; liefert den FCM-Token oder null (keine Erlaubnis / keine google-services.json) */
export async function nativePushToken(): Promise<string | null> {
  const { PushNotifications } = await import("@capacitor/push-notifications");
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") return null;
  await PushNotifications.createChannel({
    id: "spiel",
    name: "Spiel",
    description: "Meldungen, Übergaben, Wartezeiten, Durchsagen",
    importance: 5,
    vibration: true,
    visibility: 1,
  });
  return new Promise((resolve) => {
    void PushNotifications.addListener("registration", (t) => resolve(t.value));
    void PushNotifications.addListener("registrationError", () => resolve(null));
    void PushNotifications.register();
  });
}

export const battery = {
  async optimized(): Promise<boolean> {
    return NATIVE ? !(await Akku.status()).ignoring : false;
  },
  request: () => Akku.request(),
};
