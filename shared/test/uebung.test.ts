// Übungsspiel (E-78): Computer-Teams laufen sinnvoll und bleiben im Spielfeld.
import { describe, expect, it } from "vitest";
import {
  botSchritt,
  distanceM,
  feldMitte,
  inField,
  kachel,
  kachelPunkt,
  LINZ_INNENSTADT,
  netzSchritt,
  netzWeg,
  SICHT_M,
  strassenNetz,
  werFaengt,
  zoneStatus,
  type NetzBot,
  type Point,
} from "../src/index.ts";

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
  it("bleibt diesseits der Grenzlinie: 500 Schritte mit Zufall, auch Mister X auf der Flucht zum Rand", () => {
    let s = 7;
    const zufall = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const streng = { ...field, toleranceM: 0 }; // nicht einmal in den Toleranz-Streifen jenseits der Linie
    for (const mrx of [false, true]) {
      let p = mitte;
      let richtung = 0;
      // Mister X: ein Jäger steht fest in der Mitte – früher lief er dann am Rand raus, rein, raus …
      const jaeger = mrx ? [mitte] : [];
      for (let i = 0; i < 500; i++) {
        ({ p, richtung } = botSchritt({ ...lage(p), richtung, zufall, mrx, jaeger }));
        expect(zoneStatus(p, streng, [], 0)).not.toBe("draussen");
      }
    }
  });
});

// Straßennetz (E-82): ein Raster aus Straßen um die Mitte, das über das Spielfeld hinausreicht
const D_LAT = 0.001;
const D_LNG = 0.0015;
const R = 6;
const rasterPunkt = (i: number, j: number): Point => ({ lat: mitte.lat + i * D_LAT, lng: mitte.lng + j * D_LNG });
const linien: Point[][] = [];
for (let i = -R; i <= R; i++) {
  linien.push(Array.from({ length: 2 * R + 1 }, (_, j) => rasterPunkt(i, j - R))); // Ost–West
  linien.push(Array.from({ length: 2 * R + 1 }, (_, j) => rasterPunkt(j - R, i))); // Nord–Süd
}
// ein Stück Weg ohne Verbindung zum Rest
linien.push([rasterPunkt(0.5, 0.5), rasterPunkt(0.5, 0.6)]);
const netz = strassenNetz(linien, field);
const aufStrasse = (p: Point) =>
  [D_LAT, D_LNG].some((d, k) => {
    const x = ((k ? p.lng - mitte.lng : p.lat - mitte.lat) / d) % 1;
    return Math.min(Math.abs(x), 1 - Math.abs(x)) < 1e-6;
  });

describe("Computer-Teams auf Straßen", () => {
  it("Kachel-Rechnung: Punkt → Kachel → Punkt bleibt in der Kachel", () => {
    const k = kachel(mitte, 14);
    const ecke = kachelPunkt(k.x, k.y, 14, 0, 0, 4096);
    const gegen = kachelPunkt(k.x, k.y, 14, 4096, 4096, 4096);
    expect(mitte.lng).toBeGreaterThanOrEqual(ecke.lng);
    expect(mitte.lng).toBeLessThan(gegen.lng);
    expect(mitte.lat).toBeLessThanOrEqual(ecke.lat);
    expect(mitte.lat).toBeGreaterThan(gegen.lat);
  });

  it("Netz: nur im Spielfeld, Kreuzungen verbunden, Einzelstücke weg", () => {
    expect(netz.pts.length).toBeGreaterThan(50);
    expect(netz.pts.length).toBeLessThan((2 * R + 1) ** 2);
    expect(netz.pts.every((p) => inField(p, field))).toBe(true);
    expect(Math.max(...netz.nb.map((n) => n.length))).toBe(4);
    expect(netz.pts.some((p) => p.lat === rasterPunkt(0.5, 0.5).lat)).toBe(false);
  });

  it("Weg führt an gesperrten Knoten vorbei", () => {
    const i = (p: Point) => netz.pts.findIndex((q) => q.lat === p.lat && q.lng === p.lng);
    const [a, mid, b] = [i(rasterPunkt(0, -2)), i(rasterPunkt(0, 0)), i(rasterPunkt(0, 2))];
    expect(netzWeg(netz, a, b, new Set())).toContain(mid);
    const um = netzWeg(netz, a, b, new Set([mid]));
    expect(um.length).toBeGreaterThan(5);
    expect(um).not.toContain(mid);
  });

  it("geht nur auf Straßen, bleibt im Spielfeld und kommt voran (kein Hin und Her)", () => {
    let s = 11;
    const zufall = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const ziel = rasterPunkt(3, 2);
    let b: NetzBot = { p: rasterPunkt(-2, -1), richtung: 0, weg: [], zweck: "", alter: 0 };
    const gesperrt = new Set<number>();
    for (let k = 0; k < 300; k++) {
      // die Meldung ändert sich oft – neu planen darf nie zurückführen
      const meldung = k < 40 ? { lat: ziel.lat + (k % 2) * 1e-5, lng: ziel.lng } : ziel;
      const vorher = distanceM(b.p, ziel);
      b = netzSchritt({ ...b, ...lage(b.p), richtung: b.richtung, ziel: meldung, zufall, netz, gesperrt });
      expect(aufStrasse(b.p)).toBe(true);
      expect(inField(b.p, field)).toBe(true);
      if (k < 25) expect(distanceM(b.p, ziel)).toBeLessThan(vorher); // auf dem Weg dorthin immer näher
    }
    // danach sucht es in der Nähe der Meldung
    expect(distanceM(b.p, ziel)).toBeLessThan(500);
  });

  it("Mister X flieht über Straßen vom nahen Jäger weg", () => {
    const jaeger = [rasterPunkt(0, 0)];
    let s = 5;
    const zufall = () => (s = (s * 16807) % 2147483647) / 2147483647;
    let b: NetzBot = { p: rasterPunkt(1, 0), richtung: 0, weg: [], zweck: "", alter: 0 };
    for (let k = 0; k < 20; k++)
      b = netzSchritt({ ...b, ...lage(b.p), richtung: b.richtung, mrx: true, jaeger, zufall, netz, gesperrt: new Set() });
    expect(b.zweck).toBe("flucht");
    expect(distanceM(b.p, jaeger[0]!)).toBeGreaterThan(250);
    expect(aufStrasse(b.p)).toBe(true);
  });
});

describe("Computer-Teams fangen Mister X (E-83)", () => {
  let s = 17;
  const zufall = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const gesperrt = new Set<number>();
  const jaeger = (p: Point, extra = {}): NetzBot & ReturnType<typeof lage> => ({
    ...lage(p),
    weg: [],
    zweck: "",
    alter: 0,
    zufall,
    ...extra,
  });

  it("wer am nächsten ist und nah genug, fängt", () => {
    const mrx = rasterPunkt(0, 0);
    const nah = { lat: mrx.lat + 0.0001, lng: mrx.lng }; // 11 m
    const naeher = { lat: mrx.lat + 0.00005, lng: mrx.lng }; // 6 m
    expect(werFaengt(mrx, { a: nah, b: naeher, c: rasterPunkt(1, 1) }, 20)).toBe("b");
    expect(werFaengt(mrx, { c: rasterPunkt(1, 1) }, 20)).toBeNull();
    expect(werFaengt(null, { a: nah }, 20)).toBeNull();
  });

  it("Jäger mit Sicht auf Mister X rennt hin und holt ihn ein", () => {
    let b: NetzBot = jaeger(rasterPunkt(0, -1)); // gut 110 m westlich
    let mrx = rasterPunkt(0, 0);
    const start = distanceM(b.p, mrx);
    expect(start).toBeLessThan(SICHT_M);
    b = netzSchritt({ ...jaeger(b.p), ...b, mrxJetzt: mrx, jetzt: 0, netz, gesperrt });
    expect(distanceM(b.p, mrx)).toBeLessThan(start - 15); // rennt: mehr als ein normaler Schritt
    expect(b.gesehen).toMatchObject(mrx);
    // Mister X geht weiter nach Osten, normal schnell – der Jäger holt auf
    for (let k = 1; k < 30 && distanceM(b.p, mrx) > 20; k++) {
      mrx = { lat: mrx.lat, lng: mrx.lng + 15 / 74_000 };
      b = netzSchritt({ ...jaeger(b.p), ...b, mrxJetzt: mrx, jetzt: k * 5000, netz, gesperrt });
    }
    expect(distanceM(b.p, mrx)).toBeLessThanOrEqual(20);
  });

  it("ohne Sicht: Jäger geht zur Meldung und sucht dann immer weiter weg (nicht stehen bleiben)", () => {
    const meldung = { ...rasterPunkt(1, 1), t: 0 };
    let b: NetzBot = jaeger(rasterPunkt(-1, -1));
    const weit: number[] = [];
    let steht = 0;
    for (let k = 0; k < 400; k++) {
      const vorher = b.p;
      b = netzSchritt({ ...jaeger(b.p), ...b, ziel: meldung, mrxJetzt: rasterPunkt(-5, -5), jetzt: k * 5000, netz, gesperrt });
      if (distanceM(vorher, b.p) < 1) steht++;
      weit.push(distanceM(b.p, meldung));
    }
    expect(steht).toBeLessThan(5);
    // anfangs nah an der Meldung, später weiter weg (der Suchkreis wächst mit der Zeit)
    const schnitt = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    expect(schnitt(weit.slice(25, 45))).toBeLessThan(250);
    expect(schnitt(weit.slice(300))).toBeGreaterThan(1.5 * schnitt(weit.slice(25, 45)));
  });

  it("verlorene Sicht: erst zur letzten Sichtung, nicht zur älteren Meldung", () => {
    const meldung = { ...rasterPunkt(-3, -3), t: 0 };
    const gesehenBei = rasterPunkt(0, 1);
    let b: NetzBot = jaeger(rasterPunkt(0, 0));
    b = netzSchritt({ ...jaeger(b.p), ...b, ziel: meldung, mrxJetzt: gesehenBei, jetzt: 10_000, netz, gesperrt });
    for (let k = 0; k < 5; k++)
      b = netzSchritt({ ...jaeger(b.p), ...b, ziel: meldung, mrxJetzt: rasterPunkt(5, 5), jetzt: 20_000 + k * 5000, netz, gesperrt });
    expect(distanceM(b.p, gesehenBei)).toBeLessThan(distanceM(b.p, meldung));
    expect(b.zweck).toContain(gesehenBei.lat.toFixed(5));
  });

  it("fast alles gesperrt: kein Absturz, Mister X geht trotzdem weiter", () => {
    const alles = new Set(netz.pts.map((_, i) => i));
    const b = netzSchritt({ ...jaeger(rasterPunkt(0, 0)), mrx: true, jaeger: [rasterPunkt(0, 1)], netz, gesperrt: alles });
    expect(distanceM(b.p, rasterPunkt(0, 0))).toBeGreaterThan(10);
  });

  it("neuer Mister X (eben noch Jäger) läuft sofort davon", () => {
    const b = netzSchritt({ ...jaeger(rasterPunkt(0, 0)), zweck: "jagd:x", mrx: true, jaeger: [], netz, gesperrt });
    expect(b.zweck).toBe("flucht");
  });
});
