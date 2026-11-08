// Prüfung eines Spielfelds (Abschnitt 7.8) – gleich im Zonen-Editor und am Server.
import { areaM2, cutInField, selfIntersection } from "./geo.ts";
import type { Field, Polygon } from "./types.ts";

export interface FieldProblem {
  /** "base" = Spielfeld, sonst Id des Sperrbereichs */
  id: string;
  kind: "leer" | "kreuz" | "aussen";
}

/** mindestens drei verschiedene Punkte (Ring ist geschlossen: letzter = erster) */
const enough = (p: Polygon | undefined) => !!p && p.length >= 4;

export function fieldProblems(f: Field): FieldProblem[] {
  const out: FieldProblem[] = [];
  const baseOk = enough(f.base) && !selfIntersection(f.base);
  if (!enough(f.base)) out.push({ id: "base", kind: "leer" });
  else if (!baseOk) out.push({ id: "base", kind: "kreuz" });
  for (const [id, c] of Object.entries(f.cuts ?? {})) {
    if (!enough(c.poly)) out.push({ id, kind: "leer" });
    else if (selfIntersection(c.poly)) out.push({ id, kind: "kreuz" });
    // Sperrbereich muss das Spielfeld schneiden (mind. 1000 m², sonst ist er wirkungslos)
    else if (baseOk && areaM2(cutInField(f, id)) < 1000) out.push({ id, kind: "aussen" });
  }
  return out;
}

type GeoFeat = { properties?: Record<string, unknown>; geometry?: { type: string; coordinates: Polygon[] } };

/** Export des Zonen-Editors (GeoJSON) → Spielfeld; wirft, wenn kein Polygon drin ist. Gleich im Editor-Import und bei den Vorlagen. */
export function fieldFromGeoJson(fc: { features?: GeoFeat[] }): Field {
  const polys = (fc.features ?? []).filter((x) => x.geometry?.type === "Polygon");
  const base = polys.find((x) => x.properties?.rolle === "spielfeld") ?? polys[0];
  if (!base?.geometry) throw new Error("kein Polygon");
  return {
    name: String(base.properties?.name ?? "Neues Spielfeld"),
    toleranceM: Number(base.properties?.toleranzM ?? 20),
    base: base.geometry.coordinates[0]!,
    cuts: Object.fromEntries(
      polys
        .filter((x) => x !== base)
        .map((x, i) => {
          const p = x.properties ?? {};
          const name = String(p.name ?? `Bereich ${i + 1}`);
          return [
            String(p.id ?? `bereich-${i + 1}`),
            {
              name,
              short: String(p.kurz ?? name),
              color: String(p.farbe ?? "#e84393"),
              order: Number(p.reihenfolge ?? i + 1),
              poly: x.geometry!.coordinates[0]!,
            },
          ];
        }),
    ),
  };
}
