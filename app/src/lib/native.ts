// Android-App (Meilenstein 9 + 9b): was nur in der Capacitor-App anders läuft als im Browser.
// - Standort über einen Vordergrund-Dienst (Dauer-Benachrichtigung) → läuft auch bei ausgeschaltetem Bildschirm
// - im Hintergrund Standort per nativem HTTP (Android bremst das Netzwerk der WebView) – die Antwort bringt verpasste
//   Benachrichtigungen mit
// - Benachrichtigungen lokal anzeigen (kein Firebase): Ereignisse kommen über die Live-Verbindung oder POST /api/pos
// - Akku-Optimierung abschalten (eigenes kleines Plugin „Akku“)
import { Capacitor, CapacitorHttp, registerPlugin } from "@capacitor/core";
import type { BackgroundGeolocationPlugin, Location } from "@capacitor-community/background-geolocation";
import type { ApiReply, Note, PositionIn } from "@mrx/shared";
import { API_URL } from "./server.ts";
import { tokens } from "./tokens.ts";
import { pushTitel } from "./sprache.ts";

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

// ---------- Benachrichtigungen (lokal) ----------

const shown = new Set<string>();
let lastNoteAt = Date.now();
let channel: Promise<void> | null = null;

/** Erlaubnis für Benachrichtigungen (Android 13+ fragt) und Kanal „Spiel“ anlegen */
export async function enableLocal(ask: boolean): Promise<boolean> {
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  const perm = ask ? await LocalNotifications.requestPermissions() : await LocalNotifications.checkPermissions();
  if (perm.display !== "granted") return false;
  channel ??= LocalNotifications.createChannel({
    id: "spiel",
    name: "Spiel",
    description: "Meldungen, Übergaben, Wartezeiten, Durchsagen",
    importance: 5,
    vibration: true,
    visibility: 1,
  });
  await channel;
  return true;
}

/** App war sichtbar und hat es selbst angezeigt → später nicht nochmal als Benachrichtigung */
export function seenNote(n: Note) {
  lastNoteAt = Math.max(lastNoteAt, n.t);
  shown.add(n.id);
}

/** Benachrichtigung anzeigen – jede nur einmal, egal ob sie über die Verbindung oder per HTTP kam */
export async function showLocal(n: Note) {
  if (shown.has(n.id)) return;
  seenNote(n);
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  await LocalNotifications.schedule({
    notifications: [
      {
        id: (Date.now() % 2_000_000_000) + shown.size,
        title: pushTitel[n.title] ?? n.title,
        body: n.body,
        channelId: "spiel",
        smallIcon: "ic_stat_flag",
        // sofort anzeigen, kein Wecker: sonst verlangt das Plugin ab Android 12 erst die Erlaubnis für exakte Alarme
        // und öffnet dafür die Einstellungen – aus dem Hintergrund blockiert Android das, die Benachrichtigung fehlt
        isExactNotification: false,
      },
    ],
  });
}

/** Standort im Hintergrund per nativem HTTP; verpasste Benachrichtigungen kommen in der Antwort mit */
export async function nativePos(p: PositionIn): Promise<void> {
  if (!tokens.game) return;
  const r = await CapacitorHttp.post({
    url: `${API_URL}/api/pos`,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokens.game}` },
    data: { p, since: lastNoteAt },
  });
  const j = r.data as ApiReply<{ notes: Note[] }>;
  if (r.status >= 300 || !j.ok) throw new Error(`HTTP ${r.status}`);
  for (const n of j.result.notes) await showLocal(n);
}

/** Build-Kennung der Web-App auf dem Server (version.json); null, wenn nicht erreichbar */
export async function serverBuild(): Promise<string | null> {
  try {
    const r = await CapacitorHttp.get({ url: `${API_URL}/version.json?t=${Date.now()}`, headers: { "Cache-Control": "no-cache" } });
    const j = (typeof r.data === "string" ? JSON.parse(r.data) : r.data) as { build?: unknown };
    return r.status < 300 && typeof j.build === "string" ? j.build : null;
  } catch {
    return null;
  }
}

export const battery = {
  async optimized(): Promise<boolean> {
    return NATIVE ? !(await Akku.status()).ignoring : false;
  },
  request: () => Akku.request(),
};
