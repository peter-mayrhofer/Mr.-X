// Geometrie für Spielfeld, Sperrbereiche und Abstände. Rein, ohne Abhängigkeit zu Firebase oder Karte.
import polygonClipping, { type MultiPolygon as ClipMulti } from "polygon-clipping";
import type { Field, LngLat, Point, Polygon } from "./types.ts";

const R = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;

/** Abstand in Metern (Haversine) */
export function distanceM(a: Point, b: Point): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const toPoint = ([lng, lat]: LngLat): Point => ({ lat, lng });

/** Punkt in Polygon (Strahl-Verfahren). Punkte genau auf der Linie sind zufällig drinnen oder draußen – die Toleranz fängt das ab. */
export function inPolygon(p: Point, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > p.lat !== yj > p.lat && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Abstand Punkt → Strecke in Metern (lokal eben gerechnet, auf Stadtgröße auf Zentimeter genau) */
function distanceToSegmentM(p: Point, a: LngLat, b: LngLat): number {
  const kx = Math.cos(rad(p.lat)) * rad(1) * R;
  const ky = rad(1) * R;
  const ax = (a[0] - p.lng) * kx,
    ay = (a[1] - p.lat) * ky;
  const bx = (b[0] - p.lng) * kx,
    by = (b[1] - p.lat) * ky;
  const dx = bx - ax,
    dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/** Richtung von `a` nach `b` in Grad (0 = Norden, 90 = Osten), für den Kompass */
export function bearingDeg(a: Point, b: Point): number {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** In welchem gesperrten Bereich liegt der Punkt? (für die Warnung „Ihr steht im Sperrgebiet“) */
export function lockedCutAt(p: Point, field: Field, locked: string[]): string | null {
  return locked.find((id) => field.cuts[id] && inPolygon(p, field.cuts[id].poly)) ?? null;
}

/** kürzester Abstand zu einer Polygon-Linie in Metern */
export function distanceToEdgeM(p: Point, poly: Polygon): number {
  let min = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) min = Math.min(min, distanceToSegmentM(p, poly[j]!, poly[i]!));
  return min;
}

/** Ist der Punkt im erlaubten Spielfeld (Spielfeld ohne gesperrte Bereiche), ohne Toleranz? */
function inAllowed(p: Point, field: Field, locked: string[]): boolean {
  return inPolygon(p, field.base) && !locked.some((id) => field.cuts[id] && inPolygon(p, field.cuts[id].poly));
}

const RINGS = [1, 0.5];
const DIRS = 16;
/**
 * Regel 9: Grenzstraßen gehören zum Spielfeld → bis `toleranceM` jenseits der Straßenmitte zählt noch als drinnen.
 * ponytail: Toleranz über 32 Prüfpunkte im Kreis (16 Richtungen × 2 Ringe) statt Polygon-Puffer;
 * Fehler ≤ 2 % der Toleranz (0,4 m bei 20 m). Exakter Puffer erst, wenn das jemand messen kann.
 */
export function inField(p: Point, field: Field, locked: string[] = []): boolean {
  if (inAllowed(p, field, locked)) return true;
  const m = field.toleranceM / 111320;
  const cos = Math.cos(rad(p.lat));
  return RINGS.some((r) =>
    Array.from({ length: DIRS }, (_, i) => (i * 2 * Math.PI) / DIRS).some((a) =>
      inAllowed({ lat: p.lat + r * m * Math.cos(a), lng: p.lng + (r * m * Math.sin(a)) / cos }, field, locked),
    ),
  );
}

/**
 * Abstand eines Punkts im erlaubten Bereich zur nächsten Grenze (Spielfeldrand oder gesperrter Bereich).
 * Exakt: Jeder Weg zu einem Teil einer Sperr-Linie außerhalb des Felds kreuzt zuerst den Feldrand.
 */
export function distanceToBoundaryM(p: Point, field: Field, locked: string[] = []): number {
  return Math.min(
    distanceToEdgeM(p, field.base),
    ...locked.map((id) => (field.cuts[id] ? distanceToEdgeM(p, field.cuts[id].poly) : Infinity)),
  );
}

export type ZoneStatus = "drinnen" | "grenze" | "draussen";
/** Mister-X-Warnung (Abschnitt 7.3): gelb unter `warnM` zur Grenze, rot draußen */
export function zoneStatus(p: Point, field: Field, locked: string[], warnM = 50): ZoneStatus {
  if (!inField(p, field, locked)) return "draussen";
  if (!inAllowed(p, field, locked)) return "grenze";
  return distanceToBoundaryM(p, field, locked) < warnM ? "grenze" : "drinnen";
}

// ---------- Flächen (für Karte und Zonen-Editor) ----------

const ring = (poly: Polygon): LngLat[] => poly;
type Multi = LngLat[][][];

/** erlaubte Fläche = Spielfeld minus gesperrte Bereiche (für die Karte) */
export function allowedArea(field: Field, locked: string[]): Multi {
  const cuts = locked.flatMap((id) => (field.cuts[id] ? [[ring(field.cuts[id].poly)]] : []));
  return polygonClipping.difference([ring(field.base)], ...(cuts as unknown as ClipMulti[])) as Multi;
}

/** Teil eines Sperrbereichs, der im Spielfeld liegt (für Schraffur und Beschriftung) */
export function cutInField(field: Field, id: string): Multi {
  const cut = field.cuts[id];
  return cut ? (polygonClipping.intersection([ring(field.base)], [ring(cut.poly)]) as Multi) : [];
}

/** Fläche in m² (für Validierung „Sperrbereich muss das Spielfeld schneiden“) */
export function areaM2(multi: Multi): number {
  let sum = 0;
  for (const poly of multi)
    poly.forEach((r, i) => {
      const lat0 = r[0]?.[1] ?? 0;
      const kx = Math.cos(rad(lat0)) * rad(1) * R,
        ky = rad(1) * R;
      let a = 0;
      for (let k = 0, j = r.length - 1; k < r.length; j = k++) a += r[j]![0] * kx * (r[k]![1] * ky) - r[k]![0] * kx * (r[j]![1] * ky);
      sum += (i === 0 ? 1 : -1) * Math.abs(a / 2);
    });
  return sum;
}

const cross = (o: LngLat, a: LngLat, b: LngLat) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
function segmentsCross(a: LngLat, b: LngLat, c: LngLat, d: LngLat): boolean {
  const d1 = cross(c, d, a),
    d2 = cross(c, d, b),
    d3 = cross(a, b, c),
    d4 = cross(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/**
 * Index des ersten Kantenpaars, das sich schneidet (Zonen-Editor-Validierung), sonst null.
 * ponytail: O(n²) – bei ~250 Punkten 30 000 Vergleiche, unter 1 ms.
 */
export function selfIntersection(poly: Polygon): [number, number] | null {
  const n = poly.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // benachbart über den Schluss
      if (segmentsCross(poly[i]!, poly[(i + 1) % n]!, poly[j]!, poly[(j + 1) % n]!)) return [i, j];
    }
  return null;
}

export function bounds(poly: Polygon): [LngLat, LngLat] {
  const xs = poly.map((p) => p[0]),
    ys = poly.map((p) => p[1]);
  return [
    [Math.min(...xs), Math.min(...ys)],
    [Math.max(...xs), Math.max(...ys)],
  ];
}
