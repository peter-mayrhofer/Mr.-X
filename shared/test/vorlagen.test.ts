import { describe, expect, it } from "vitest";
import { fieldProblems, isVorlage, LINZ_INNENSTADT, VORLAGEN, VORLAGEN_IDS } from "../src/index.ts";

describe("Spielfeld-Vorlagen", () => {
  it("Kennungen: linz bleibt, steyr und wels dazu, „leer“ ist keine Vorlage", () => {
    expect(VORLAGEN_IDS).toEqual(["linz", "steyr", "wels"]);
    expect(isVorlage("linz") && isVorlage("steyr") && isVorlage("wels")).toBe(true);
    expect(isVorlage("leer") || isVorlage("toString") || isVorlage(undefined)).toBe(false);
  });
  it("Anzeigenamen sind eindeutig", () => {
    const labels = Object.values(VORLAGEN).map((v) => v.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
  for (const [id, v] of Object.entries(VORLAGEN)) {
    it(`${id}: gültiges Spielfeld mit Sperrbereichen`, () => {
      expect(fieldProblems(v.field)).toEqual([]);
      expect(Object.keys(v.field.cuts).length).toBeGreaterThan(0);
    });
  }
  it("Linz unverändert", () => {
    expect(VORLAGEN.linz.field).toBe(LINZ_INNENSTADT);
    expect(LINZ_INNENSTADT.name).toBe("Linz Innenstadt");
    expect(LINZ_INNENSTADT.base).toHaveLength(235);
    expect(Object.keys(LINZ_INNENSTADT.cuts)).toEqual(["norden", "osten", "mitte-ost", "westen"]);
    expect(LINZ_INNENSTADT.base[0]).toEqual([14.28515, 48.29336]);
  });
});
