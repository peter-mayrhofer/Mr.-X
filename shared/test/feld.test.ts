import { describe, expect, it } from "vitest";
import { fieldProblems, LINZ_INNENSTADT, type Field, type Polygon } from "../src/index.ts";

const sq = (lng: number, lat: number, d: number): Polygon => [
  [lng - d, lat - d],
  [lng + d, lat - d],
  [lng + d, lat + d],
  [lng - d, lat + d],
  [lng - d, lat - d],
];
const cut = (poly: Polygon) => ({ name: "Test", short: "Test", color: "#ff0000", order: 1, poly });

describe("Spielfeld prüfen (Abschnitt 7.8)", () => {
  it("Linz-Vorlage ist in Ordnung", () => expect(fieldProblems(LINZ_INNENSTADT)).toEqual([]));
  it("leeres Spielfeld", () =>
    expect(fieldProblems({ name: "x", toleranceM: 20, base: [], cuts: {} })).toEqual([{ id: "base", kind: "leer" }]));
  it("Linie kreuzt sich", () => {
    const base = sq(14.29, 48.3, 0.01);
    [base[1], base[2]] = [base[2]!, base[1]!];
    expect(fieldProblems({ name: "x", toleranceM: 20, base, cuts: {} })).toEqual([{ id: "base", kind: "kreuz" }]);
  });
  it("Sperrbereich außerhalb des Spielfelds", () => {
    const f: Field = {
      name: "x",
      toleranceM: 20,
      base: sq(14.29, 48.3, 0.01),
      cuts: { weit: cut(sq(14.4, 48.3, 0.005)), drin: cut(sq(14.29, 48.3, 0.005)) },
    };
    expect(fieldProblems(f)).toEqual([{ id: "weit", kind: "aussen" }]);
  });
});
