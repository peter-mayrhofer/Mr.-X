// Prüfpunkte aus dem ersten Prototyp (zones.test.mjs, im Git-Verlauf) + Toleranz, Abstand, Validierung.
import { describe, expect, it } from "vitest";
import {
  LINZ_INNENSTADT as F,
  allowedArea,
  bearingDeg,
  areaM2,
  cutInField,
  distanceM,
  distanceToBoundaryM,
  inField,
  lockedCutAt,
  selfIntersection,
  zoneStatus,
} from "../src/index.ts";

const ALL = ["norden", "osten", "mitte-ost", "westen"];
const p = (lat: number, lng: number) => ({ lat, lng });

describe("Spielfeld Linz (Prüfpunkte aus dem Prototyp)", () => {
  it.each([
    ["Taubenmarkt im Spielfeld", p(48.3036, 14.2878), ALL, true],
    ["Hauptplatz gesperrt bei Nord", p(48.3058, 14.2864), ["norden"], false],
    ["Hauptplatz ok ohne Sperre", p(48.3058, 14.2864), [], true],
    ["Stadtpark gesperrt bei Ost", p(48.305, 14.297), ["osten"], false],
    ["Hessenplatz gesperrt bei Mitte-Ost", p(48.2995, 14.2955), ["mitte-ost"], false],
    ["Hessenplatz ok bei nur Ost", p(48.2995, 14.2955), ["osten"], true],
    ["Baumbachstraße gesperrt bei West", p(48.3005, 14.284), ["westen"], false],
    ["auf der Humboldtstraße noch drinnen", p(48.2985, 14.29495), ["mitte-ost"], true],
    ["Böhmerwaldstraße (Dreieck beim Bahnhof) drinnen", p(48.2925, 14.2905), ALL, true],
    ["Urfahr draußen", p(48.312, 14.285), [], false],
    ["Hauptbahnhof draußen", p(48.2905, 14.2915), [], false],
  ] as const)("%s", (_, pt, locked, exp) => {
    expect(inField(pt, F, [...locked])).toBe(exp);
  });
});

describe("Toleranz (Regel 9)", () => {
  // Punkt auf der Grenzlinie (Ecke Kapuzinerstraße) und 15 m / 30 m nach außen verschoben
  const edge = p(48.30551, 14.27962);
  const west = (m: number) => p(edge.lat, edge.lng - m / (111320 * Math.cos((edge.lat * Math.PI) / 180)));
  it("15 m außerhalb zählt noch", () => expect(inField(west(15), F)).toBe(true));
  it("30 m außerhalb nicht mehr", () => expect(inField(west(30), F)).toBe(false));
  it("Toleranz 0 → nur Polygon", () => expect(inField(west(15), { ...F, toleranceM: 0 })).toBe(false));
});

describe("Abstände und Warnstufen", () => {
  it("Haversine Hauptplatz → Taubenmarkt ≈ 260 m", () => {
    expect(distanceM(p(48.3058, 14.2864), p(48.3036, 14.2878))).toBeGreaterThan(240);
    expect(distanceM(p(48.3058, 14.2864), p(48.3036, 14.2878))).toBeLessThan(290);
  });
  it("Taubenmarkt: weit weg von der Grenze ohne Sperre", () => {
    expect(distanceToBoundaryM(p(48.3036, 14.2878), F)).toBeGreaterThan(100);
    expect(zoneStatus(p(48.3036, 14.2878), F, [])).toBe("drinnen");
  });
  it("knapp innerhalb der Grenze → gelb", () => {
    expect(zoneStatus(p(48.3054, 14.2802), F, [])).toBe("grenze");
  });
  it("draußen → rot", () => expect(zoneStatus(p(48.312, 14.285), F, [])).toBe("draussen"));
});

describe("Flächen und Validierung", () => {
  it("Spielfeld ≈ 2 km² und jeder Sperrbereich schneidet es", () => {
    const all = areaM2(allowedArea(F, []));
    expect(all).toBeGreaterThan(1.5e6);
    expect(all).toBeLessThan(3e6);
    for (const id of ALL) expect(areaM2(cutInField(F, id))).toBeGreaterThan(50_000);
  });
  it("Sperren verkleinert die erlaubte Fläche", () => {
    expect(areaM2(allowedArea(F, ["norden"]))).toBeLessThan(areaM2(allowedArea(F, [])));
  });
  it("Linz-Polygone schneiden sich nicht selbst", () => {
    expect(selfIntersection(F.base)).toBeNull();
    for (const id of ALL) expect(selfIntersection(F.cuts[id]!.poly)).toBeNull();
  });
  it("Achter-Polygon wird erkannt", () => {
    expect(
      selfIntersection([
        [0, 0],
        [1, 1],
        [1, 0],
        [0, 1],
      ]),
    ).not.toBeNull();
  });
});

describe("Kompass: Richtung und Sperrgebiet", () => {
  const hp = { lat: 48.3059, lng: 14.2862 }; // Hauptplatz
  it("Richtung in Grad: Norden 0, Osten 90, Süden 180, Westen 270", () => {
    expect(bearingDeg(hp, { lat: hp.lat + 0.01, lng: hp.lng })).toBeCloseTo(0, 0);
    expect(bearingDeg(hp, { lat: hp.lat, lng: hp.lng + 0.01 })).toBeCloseTo(90, 0);
    expect(bearingDeg(hp, { lat: hp.lat - 0.01, lng: hp.lng })).toBeCloseTo(180, 0);
    expect(bearingDeg(hp, { lat: hp.lat, lng: hp.lng - 0.01 })).toBeCloseTo(270, 0);
  });
  it("gesperrter Bereich am Punkt", () => {
    const north = { lat: 48.31, lng: 14.285 }; // nördlich der Promenade, im Bereich „Norden“
    expect(lockedCutAt(north, F, ["norden"])).toBe("norden");
    expect(lockedCutAt(north, F, [])).toBeNull();
    expect(lockedCutAt(hp, F, ["osten"])).toBeNull();
  });
});
