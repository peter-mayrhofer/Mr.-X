// Benachrichtigungen auf diesem Gerät (Abschnitt 7.6). Browser/iPhone-Web-App: Web Push mit dem VAPID-Schlüssel des
// Servers (kein Google-Konto) – das Abo und die gewünschten Arten gehen per pushSubscribe an den Server. Android-App:
// lokale Benachrichtigungen aus der Live-Verbindung (kein Firebase); der Server kennt nur die gewünschten Arten.
import { untrack } from "svelte";
import { PUSH_KINDS, type PushKind, type PushSub } from "@mrx/shared";
import { call } from "./api.ts";
import { onNote, onView, session } from "./session.svelte.ts";
import { E2E } from "./server.ts";
import { enableLocal, NATIVE, seenNote, showLocal } from "./native.ts";

export type PushStatus = "an" | "aus" | "verweigert" | "nichtMoeglich";

/** Web-Push gibt es nur mit Service Worker + PushManager (iPhone: nur als Web-App am Home-Bildschirm, iOS ≥ 16.4) */
export const pushPossible = () => "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;

const key = (b64: string) => Uint8Array.from(atob(b64.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function subscribe(vapid: string, uid: string): Promise<PushSub> {
  // Tests im Browser ohne Push-Dienst: Platzhalter-Abo – der Server sammelt Pushes dort ohnehin nur im Postausgang
  if (E2E) return { endpoint: `https://push.example.net/e2e-${uid}`, keys: { p256dh: "e2e", auth: "e2e" } };
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const opts = { userVisibleOnly: true, applicationServerKey: key(vapid) };
  let sub: PushSubscription;
  try {
    sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe(opts));
  } catch {
    // altes Abo mit anderem Schlüssel → neu abonnieren
    await (await reg.pushManager.getSubscription())?.unsubscribe();
    sub = await reg.pushManager.subscribe(opts);
  }
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  return { endpoint: j.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth } };
}

export class PushState {
  status = $state<PushStatus>("aus");
  prefs = $state<Record<PushKind, boolean>>(Object.fromEntries(PUSH_KINDS.map((k) => [k, true])) as Record<PushKind, boolean>);
  #g = "";
  #uid = "";

  /** eigene Einstellung live lesen und – wenn schon erlaubt – das Abo still erneuern (Abos wechseln gelegentlich) */
  watch(g: string, uid: string): () => void {
    return untrack(() => this.#watch(g, uid));
  }

  #watch(g: string, uid: string): () => void {
    this.#g = g;
    this.#uid = uid;
    const offs = [
      onView((v) => {
        const p = v.me.push;
        if (!p) return;
        for (const k of PUSH_KINDS) this.prefs[k] = p.prefs?.[k] !== false;
        if (!NATIVE) {
          if (p.on) this.status = "an";
          else if (this.status === "an") this.status = "aus";
        }
      }),
      // Android: Benachrichtigungen kommen über die Verbindung – im Hintergrund lokal anzeigen
      onNote((n) => {
        if (NATIVE && document.visibilityState === "hidden" && this.status === "an") void showLocal(n);
        else seenNote(n);
      }),
    ];
    if (NATIVE) void this.enable(true);
    else if (!pushPossible() && !E2E) this.status = "nichtMoeglich";
    else if ("Notification" in window && Notification.permission === "denied") this.status = "verweigert";
    else if ("Notification" in window && Notification.permission === "granted") void this.enable(true);
    return () => offs.forEach((off) => off());
  }

  /** Erlaubnis anfragen und beim Server anmelden. `silent`: nur erneuern, nicht fragen. */
  async enable(silent = false): Promise<PushStatus> {
    const prefs = $state.snapshot(this.prefs);
    try {
      if (NATIVE) {
        if (!(await enableLocal(!silent))) return (this.status = silent ? this.status : "verweigert");
        await call({ action: "pushSubscribe", gameId: this.#g, sub: null, prefs });
        return (this.status = "an");
      }
      if (!("Notification" in window)) return (this.status = "nichtMoeglich");
      const perm = silent ? Notification.permission : await Notification.requestPermission();
      if (perm !== "granted") return (this.status = perm === "denied" ? "verweigert" : "aus");
      // Schlüssel kommt mit dem ersten Snapshot – kurz warten, falls die Verbindung gerade erst aufgeht
      for (let i = 0; i < 20 && !session.vapid && !E2E; i++) await new Promise((r) => setTimeout(r, 250));
      if (!session.vapid && !E2E) return (this.status = "nichtMoeglich");
      const sub = await subscribe(session.vapid ?? "", this.#uid);
      await call({ action: "pushSubscribe", gameId: this.#g, sub, prefs });
      return (this.status = "an");
    } catch {
      return (this.status = NATIVE || pushPossible() ? "aus" : "nichtMoeglich");
    }
  }

  async setPref(k: PushKind, on: boolean) {
    this.prefs[k] = on;
    if (this.status === "an" && this.#g) await call({ action: "pushSubscribe", gameId: this.#g, prefs: $state.snapshot(this.prefs) });
  }
}
