// Empfang von Tracker-Positionen (Meilenstein 11): OsmAnd-Protokoll, wie es „Traccar Client“ (Android/iOS) und viele
// GPS-Tracker sprechen – Parameter in der Adresse oder als Formular (`id`, `lat`, `lon`, `timestamp`, `accuracy`, `batt`,
// `bearing`) bzw. JSON des neuen Traccar Client (`device_id`, `location.coords`, `location.battery`).
// Die Geräte-Kennung ist „{spiel-code}.{schlüssel}“ – so findet der Worker den Spielraum, ohne etwas nachzuschlagen.
import type { PositionIn } from "@mrx/shared";

export interface TrackerFix {
  gameId: string;
  key: string;
  p: PositionIn;
}

const num = (v: unknown): number | undefined => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : undefined;
};
/** Sekunden, Millisekunden oder ISO-Datum → Millisekunden; fehlt sie, gilt „jetzt“ */
function time(v: unknown, now: number): number {
  const n = num(v);
  if (n !== undefined) return n < 1e12 ? n * 1000 : n;
  const d = typeof v === "string" ? Date.parse(v) : NaN;
  return Number.isFinite(d) ? d : now;
}

export async function parseTracker(req: Request, now = Date.now()): Promise<TrackerFix | null> {
  const q = new URL(req.url).searchParams;
  const f: Record<string, unknown> = Object.fromEntries(q);
  let json = null as { device_id?: unknown; location?: Record<string, unknown> } | null;
  if (req.method === "POST") {
    const type = req.headers.get("content-type") ?? "";
    const body = await req.text();
    if (body.length > 10_000) return null;
    if (type.includes("json") || body.trimStart().startsWith("{")) {
      try {
        json = JSON.parse(body) as typeof json;
      } catch {
        return null;
      }
    } else for (const [k, v] of new URLSearchParams(body)) f[k] = v;
  }
  const loc = json?.location ?? {};
  const c = (loc.coords ?? {}) as Record<string, unknown>;
  const bat = (loc.battery ?? {}) as Record<string, unknown>;
  const id = String(json?.device_id ?? f.id ?? f.deviceid ?? "");
  const dot = id.indexOf(".");
  if (dot < 1) return null;
  const lat = num(c.latitude ?? f.lat);
  const lng = num(c.longitude ?? f.lon ?? f.lng);
  if (lat === undefined || lng === undefined) return null;
  const acc = num(c.accuracy ?? f.accuracy) ?? (num(f.hdop) !== undefined ? num(f.hdop)! * 5 : 25);
  const level = num(bat.level);
  const battery = level !== undefined ? (level <= 1 ? level * 100 : level) : num(f.batt ?? f.battery);
  const heading = num(c.heading ?? f.bearing ?? f.heading);
  return {
    gameId: id.slice(0, dot).toLowerCase(),
    key: id.slice(dot + 1),
    p: {
      lat,
      lng,
      acc,
      t: time(loc.timestamp ?? f.timestamp, now),
      ...(heading !== undefined && heading >= 0 ? { heading } : {}),
      ...(battery !== undefined ? { battery } : {}),
    },
  };
}
