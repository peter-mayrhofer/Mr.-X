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
