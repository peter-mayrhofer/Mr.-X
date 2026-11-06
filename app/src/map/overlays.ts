// Spiel-Ebenen der Karte als GeoJSON: Maske außerhalb, Grenze, gesperrte Bereiche, Mister-X-Spur, Genauigkeitskreis.
import { allowedArea, cutInField, type Field, type Point } from "@mrx/shared";
import { uhr } from "../lib/format.ts";
import { T } from "../texte.ts";
import type { Overlays } from "./style.ts";
import { EMPTY } from "./style.ts";

type FC = GeoJSON.FeatureCollection;
const fc = (features: GeoJSON.Feature[]): FC => ({ type: "FeatureCollection", features });
const WORLD: GeoJSON.Position[] = [
  [-180, -85],
  [180, -85],
  [180, 85],
  [-180, 85],
  [-180, -85],
];

export interface TrailReport extends Point {
  id: string;
  t: number;
}

/** Welt mit erlaubter Fläche als Loch → alles außerhalb (inkl. gesperrter Bereiche) wird abgedunkelt */
export function fieldOverlays(
  field: Field,
  locked: string[],
  preview: string[] = [],
): Pick<Overlays, "mask" | "boundary" | "cuts" | "preview"> {
  // noch kein Spielfeld gezeichnet (Zonen-Editor) → nichts abdunkeln
  if (field.base.length < 4) return { mask: EMPTY, boundary: EMPTY, cuts: EMPTY, preview: EMPTY };
  const allowed = allowedArea(field, locked);
  return {
    mask: fc([
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "MultiPolygon",
          // Außenringe der erlaubten Fläche als Löcher; Löcher in der erlaubten Fläche (Sperrbereich mitten im Feld) bleiben dunkel
          coordinates: [[WORLD, ...allowed.map((p) => p[0]!)], ...allowed.flatMap((p) => p.slice(1).map((h) => [h]))],
        },
      },
    ]),
    boundary: fc([{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [...field.base, field.base[0]!] } }]),
    cuts: fc(
      locked.flatMap((id) => {
        const cut = field.cuts[id];
        if (!cut) return [];
        return [
          {
            type: "Feature",
            properties: { id, short: cut.short, status: T.karte.gesperrt.toUpperCase() },
            geometry: { type: "MultiPolygon", coordinates: cutInField(field, id) },
          },
        ];
      }),
    ),
    preview: fc(
      preview.flatMap((id) => {
        const cut = field.cuts[id];
        return cut
          ? [{ type: "Feature", properties: { color: cut.color }, geometry: { type: "MultiPolygon", coordinates: cutInField(field, id) } }]
          : [];
      }),
    ),
  };
}

/** Spur seit der letzten Übergabe: ältere Meldungen verblassen, die neueste zeichnet GameMap als pulsierenden Marker */
export function trailOverlay(reports: TrailReport[]): FC {
  if (reports.length === 0) return EMPTY;
  const n = reports.length;
  const older = reports.slice(0, -1);
  return fc([
    { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: reports.map((r) => [r.lng, r.lat]) } },
    ...older.map((r, i): GeoJSON.Feature => ({
      type: "Feature",
      properties: { fade: 0.3 + (0.6 * (i + 1)) / n, label: uhr(r.t) },
      geometry: { type: "Point", coordinates: [r.lng, r.lat] },
    })),
  ]);
}

/** Genauigkeitskreis um den eigenen Standort (64-Eck) */
export function accuracyOverlay(p: (Point & { acc: number }) | undefined): FC {
  if (!p) return EMPTY;
  const k = 111320,
    cos = Math.cos((p.lat * Math.PI) / 180);
  const ring = Array.from({ length: 65 }, (_, i) => {
    const a = (i / 64) * 2 * Math.PI;
    return [p.lng + (p.acc * Math.sin(a)) / (k * cos), p.lat + (p.acc * Math.cos(a)) / k];
  });
  return fc([{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } }]);
}
