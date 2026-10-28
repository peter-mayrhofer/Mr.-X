// Eigener Standort (Abschnitt 9.1): GPS beobachten und adaptiv senden – alle 10 s bei mehr als 15 m Bewegung,
// sonst spätestens alle 30 s, damit der Standort für Meldungen und Umkreis „frisch“ bleibt (FRESH_MS = 2 Min).
// Android-App im Hintergrund: alle 30 s.
// Ungenaue Punkte werden mit ihrer Genauigkeit gesendet; der Server zählt sie nicht zur Strecke.
import { distanceM, type Position } from "@mrx/shared";
import { clock } from "./clock.svelte.ts";
import { sendPos } from "./session.svelte.ts";
import { NATIVE, nativePos, stopNative, watchNative } from "./native.ts";
import { appVisible, onAppVisibility } from "./sichtbar.ts";

const MOVE_MS = 10_000;
const KEEP_MS = 30_000;
const MOVE_M = 15;

class Gps {
  pos = $state<Position | null>(null);
  error = $state<"denied" | "unavailable" | null>(null);
  battery = $state<number | undefined>(undefined);
}
export const gps = new Gps();

let watchId: number | null = null;
let keep: ReturnType<typeof setInterval> | undefined;

function onPos(p: GeolocationPosition) {
  gps.error = null;
  const c = p.coords;
  gps.pos = {
    lat: c.latitude,
    lng: c.longitude,
    acc: Math.round(c.accuracy),
    // Messzeit in Server-Zeit; nie in der Zukunft (der Server nimmt höchstens 1 Min an)
    t: Math.min(Math.round(p.timestamp + clock.offset), Date.now() + clock.offset),
    ...(c.heading !== null && Number.isFinite(c.heading) ? { heading: Math.round(c.heading) % 360 } : {}),
  };
}
function onErr(e: GeolocationPositionError) {
  gps.error = e.code === e.PERMISSION_DENIED ? "denied" : "unavailable";
}

let nativeMode: boolean | null = null;

/**
 * GPS starten (fragt beim ersten Mal nach der Erlaubnis). Mehrfach aufrufen ist harmlos.
 * Android-App: `background` = auch bei ausgeschaltetem Bildschirm (Dauer-Benachrichtigung).
 */
export function startGps(background = true) {
  if (NATIVE) {
    if (nativeMode === background) return;
    nativeMode = background;
    void watchNative(
      background,
      (l) => {
        gps.error = null;
        gps.pos = {
          lat: l.latitude,
          lng: l.longitude,
          acc: Math.round(l.accuracy),
          t: Math.min(Math.round((l.time ?? Date.now()) + clock.offset), Date.now() + clock.offset),
          ...(l.bearing !== null && Number.isFinite(l.bearing) ? { heading: Math.round(l.bearing) % 360 } : {}),
        };
      },
      () => (gps.error = "denied"),
    ).catch(() => (gps.error = "unavailable"));
    return;
  }
  if (!("geolocation" in navigator)) {
    gps.error = "unavailable";
    return;
  }
  if (watchId !== null) return;
  const opts: PositionOptions = { enableHighAccuracy: true, maximumAge: 5000, timeout: 30_000 };
  watchId = navigator.geolocation.watchPosition(onPos, onErr, opts);
  // manche Handys melden im Stillstand nichts mehr → regelmäßig nachfragen
  keep = setInterval(() => navigator.geolocation.getCurrentPosition(onPos, onErr, { ...opts, maximumAge: 10_000 }), KEEP_MS);
  void (navigator as Navigator & { getBattery?: () => Promise<{ level: number; addEventListener: (e: string, f: () => void) => void }> })
    .getBattery?.()
    .then((b) => {
      const upd = () => (gps.battery = Math.round(b.level * 100));
      upd();
      b.addEventListener("levelchange", upd);
    })
    .catch(() => {});
}

export function stopGps() {
  if (NATIVE) {
    nativeMode = null;
    void stopNative();
  }
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  clearInterval(keep);
  watchId = null;
}

/** Sende-Entscheidung (rein, getestet über den Ende-zu-Ende-Test) */
export function shouldSend(last: Position | null, next: Position, moveMs = MOVE_MS): boolean {
  if (!last) return true;
  const dt = next.t - last.t;
  return dt >= KEEP_MS || (dt >= moveMs && distanceM(last, next) >= MOVE_M);
}

/** Standort senden, solange die Komponente lebt und `active()` gilt. Der Server ordnet ihn dem eigenen Team bzw. Schiri zu. */
export function sendPosition(active: () => boolean) {
  let last: Position | null = null;
  $effect(() => {
    const p = gps.pos;
    // Android-App im Hintergrund: natives HTTP (Android drosselt das Netzwerk der WebView), dafür nur alle 30 s –
    // jede Anfrage zählt im Gratis-Tarif (docs/CLOUDFLARE-LIMITS.md)
    const background = NATIVE && !appVisible();
    if (!p || !active() || !shouldSend(last, p, background ? KEEP_MS : MOVE_MS)) return;
    last = p;
    const value = { ...p, ...(gps.battery !== undefined ? { battery: gps.battery } : {}) };
    if (background) void nativePos(value).catch(() => (last = null));
    else sendPos(value); // offline wartet der neueste Punkt und geht beim Wiederverbinden raus
  });
}

/** Bildschirm wach halten (Einstellung „Bildschirm anlassen“); fällt still weg, wo der Browser es nicht kann */
export function keepAwake(on: () => boolean) {
  $effect(() => {
    if (!on() || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const get = () => {
      if (appVisible())
        void navigator.wakeLock
          .request("screen")
          .then((l) => (lock = l))
          .catch(() => {});
    };
    get();
    const off = onAppVisibility(get);
    return () => {
      off();
      void lock?.release();
    };
  });
}
