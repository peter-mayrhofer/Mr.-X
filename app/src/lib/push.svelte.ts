// Push-Benachrichtigungen auf diesem Gerät (Abschnitt 7.6): Erlaubnis, Service Worker, FCM-Token unter
// games/{g}/push/{uid} und die Push-Arten, die das Gerät haben will. Der Server liest beides beim Senden.
import { onValue, ref, serverTimestamp, set, update } from "firebase/database";
import { PUSH_KINDS, type PushKind, type PushReg } from "@mrx/shared";
import { app, db, EMU, VAPID_KEY } from "./firebase.ts";
import { NATIVE, nativePushToken } from "./native.ts";

export type PushStatus = "an" | "aus" | "verweigert" | "nichtMoeglich";

/** Web-Push gibt es nur mit Service Worker + PushManager (iPhone: nur als Web-App am Home-Bildschirm) */
export const pushPossible = () => "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;

async function token(): Promise<string> {
  const reg = await navigator.serviceWorker.register("/sw.js");
  const { getMessaging, getToken } = await import("firebase/messaging");
  return getToken(getMessaging(app), { serviceWorkerRegistration: reg, ...(VAPID_KEY ? { vapidKey: VAPID_KEY } : {}) });
}

export class PushState {
  status = $state<PushStatus>("aus");
  prefs = $state<Record<PushKind, boolean>>(Object.fromEntries(PUSH_KINDS.map((k) => [k, true])) as Record<PushKind, boolean>);
  #path = "";

  /** Eigene Anmeldung live lesen und – wenn schon erlaubt – den Token still erneuern (Tokens wechseln gelegentlich) */
  watch(g: string, uid: string): () => void {
    this.#path = `games/${g}/push/${uid}`;
    if (NATIVE) {
      // Android-App: Erlaubnis und Token kommen nativ; bei jedem Start still erneuern
      const off = onValue(ref(db, this.#path), (s) => this.#read(s.val() as PushReg | null));
      void this.enable(true);
      return off;
    }
    if (!pushPossible() && !EMU) this.status = "nichtMoeglich";
    else if ("Notification" in window && Notification.permission === "denied") this.status = "verweigert";
    const off = onValue(ref(db, this.#path), (s) => this.#read(s.val() as PushReg | null));
    if ("Notification" in window && Notification.permission === "granted") void this.enable(true);
    return off;
  }

  #read(v: PushReg | null) {
    if (v) {
      this.status = "an";
      for (const k of PUSH_KINDS) this.prefs[k] = v.prefs?.[k] !== false;
    } else if (this.status === "an") this.status = "aus";
  }

  /** Erlaubnis anfragen und registrieren. `silent`: nur erneuern, nicht fragen. */
  async enable(silent = false): Promise<PushStatus> {
    if (NATIVE) {
      // Android fragt nur beim ersten Mal; danach liefert requestPermissions sofort das Ergebnis
      const t = await nativePushToken().catch(() => null);
      if (!t) return (this.status = silent ? this.status : "verweigert");
      await set(ref(db, this.#path), { token: t, platform: "android", prefs: $state.snapshot(this.prefs), t: serverTimestamp() });
      return (this.status = "an");
    }
    try {
      if (!("Notification" in window)) return (this.status = "nichtMoeglich");
      const perm = silent ? Notification.permission : await Notification.requestPermission();
      if (perm !== "granted") return (this.status = perm === "denied" ? "verweigert" : "aus");
      // Emulator (Tests, lokales Ausprobieren): kein FCM erreichbar → Platzhalter-Token, Server legt Pushes in pushOutbox ab
      const t = EMU ? `emulator-${this.#path.split("/").pop()}` : await token();
      await set(ref(db, this.#path), { token: t, platform: "web", prefs: $state.snapshot(this.prefs), t: serverTimestamp() });
      return (this.status = "an");
    } catch {
      return (this.status = pushPossible() ? "aus" : "nichtMoeglich");
    }
  }

  async setPref(k: PushKind, on: boolean) {
    this.prefs[k] = on;
    if (this.status === "an" && this.#path) await update(ref(db, `${this.#path}/prefs`), { [k]: on });
  }
}
