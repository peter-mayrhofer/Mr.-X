// Eigener Standort (Abschnitt 9.1): GPS beobachten und adaptiv senden – alle 10 s bei mehr als 15 m Bewegung,
// sonst spätestens alle 30 s (damit der Standort für Meldungen und Umkreis „frisch“ bleibt, FRESH_MS = 2 Min).
// Ungenaue Punkte werden mit ihrer Genauigkeit gesendet; der Server zählt sie nicht zur Strecke.
import { ref, set } from "firebase/database";
import { distanceM, type Position } from "@mrx/shared";
import { db } from "./firebase.ts";
import { clock } from "./clock.svelte.ts";

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
    // Messzeit in Server-Zeit; nie in der Zukunft (Rules erlauben max. 1 Min)
    t: Math.min(Math.round(p.timestamp + clock.offset), Date.now() + clock.offset),
    ...(c.heading !== null && Number.isFinite(c.heading) ? { heading: Math.round(c.heading) % 360 } : {}),
  };
}
function onErr(e: GeolocationPositionError) {
  gps.error = e.code === e.PERMISSION_DENIED ? "denied" : "unavailable";
}

/** GPS starten (fragt beim ersten Mal nach der Erlaubnis). Mehrfach aufrufen ist harmlos. */
export function startGps() {
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
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  clearInterval(keep);
  watchId = null;
}

/** Sende-Entscheidung (rein, getestet über den Ende-zu-Ende-Test) */
export function shouldSend(last: Position | null, next: Position): boolean {
  if (!last) return true;
  const dt = next.t - last.t;
  return dt >= KEEP_MS || (dt >= MOVE_MS && distanceM(last, next) >= MOVE_M);
}

/** Standort an `path` senden, solange die Komponente lebt. `path()` = null → nichts senden. `extra`: z. B. Schiri-Name */
export function sendPosition(path: () => string | null, uid: () => string | undefined, extra: () => Record<string, string> = () => ({})) {
  let last: Position | null = null;
  $effect(() => {
    const p = gps.pos;
    const target = path();
    if (!p || !target || !shouldSend(last, p)) return;
    last = p;
    void set(ref(db, target), {
      ...p,
      uid: uid(),
      ...extra(),
      ...(gps.battery !== undefined ? { battery: gps.battery } : {}),
    }).catch(() => (last = null)); // offline: beim nächsten Punkt nochmal
  });
}

/** Bildschirm wach halten (Einstellung „Bildschirm anlassen“); fällt still weg, wo der Browser es nicht kann */
export function keepAwake(on: () => boolean) {
  $effect(() => {
    if (!on() || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const get = () => {
      if (document.visibilityState === "visible")
        void navigator.wakeLock
          .request("screen")
          .then((l) => (lock = l))
          .catch(() => {});
    };
    get();
    document.addEventListener("visibilitychange", get);
    return () => {
      document.removeEventListener("visibilitychange", get);
      void lock?.release();
    };
  });
}
