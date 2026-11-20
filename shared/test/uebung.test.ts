// Übungsspiel (E-78): Computer-Teams laufen sinnvoll und bleiben im Spielfeld.
import { describe, expect, it } from "vitest";
import { botSchritt, distanceM, feldMitte, LINZ_INNENSTADT, zoneStatus, type Point } from "../src/index.ts";

const field = LINZ_INNENSTADT;
const mitte = feldMitte(field);
const fest = () => 0.5; // kein Zufall
const lage = (p: Point, extra = {}) => ({ p, richtung: 90, mrx: false, field, locked: [], schritt: 15, zufall: fest, ...extra });

describe("Computer-Teams", () => {
  it("Mitte liegt im Spielfeld", () => expect(zoneStatus(mitte, field, [], 0)).not.toBe("draussen"));
  it("Schritt ist so lang wie verlangt", () => expect(distanceM(mitte, botSchritt(lage(mitte)).p)).toBeCloseTo(15, 0));
  it("Jäger laufen zur letzten Meldung", () => {
    const ziel = { lat: mitte.lat + 0.003, lng: mitte.lng };
    const r = botSchritt(lage(mitte, { ziel }));
    expect(distanceM(r.p, ziel)).toBeLessThan(distanceM(mitte, ziel) - 14);
  });
  it("Mister X läuft vom nahen Jäger weg", () => {
    const jaeger = [{ lat: mitte.lat - 0.001, lng: mitte.lng }];
    const r = botSchritt(lage(mitte, { mrx: true, jaeger }));
    expect(distanceM(r.p, jaeger[0]!)).toBeGreaterThan(distanceM(mitte, jaeger[0]!) + 14);
  });
  it("bleibt im Spielfeld: 500 Schritte mit Zufall", () => {
    let s = 7;
    const zufall = () => (s = (s * 16807) % 2147483647) / 2147483647;
    let p = mitte;
    let richtung = 0;
    for (let i = 0; i < 500; i++) {
      ({ p, richtung } = botSchritt({ ...lage(p), richtung, zufall }));
      expect(zoneStatus(p, field, [], 0)).not.toBe("draussen");
    }
  });
});
