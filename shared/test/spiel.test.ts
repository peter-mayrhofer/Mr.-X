import { describe, expect, it } from "vitest";
import { activeMs, bestPosition, randomEnd, results, stepCheck, teamsToLock, type Handover, type Position } from "../src/index.ts";

const MIN = 60_000;
const now = 1_800_000_000_000;
// Hauptplatz Linz; 0,001° Breite ≈ 111 m
const at = (dLat: number, ago = 0, extra: Partial<Position> = {}): Position => ({
  lat: 48.3059 + dLat,
  lng: 14.2862,
  acc: 10,
  t: now - ago,
  ...extra,
});

describe("Standortquelle für Meldungen (Abschnitt 4.3)", () => {
  it("Tracker vor Handy vor Schiri", () => {
    expect(bestPosition({ tracker: at(0), team: at(0.001), schiri: at(0.002) }, now)?.src).toBe("tracker");
    expect(bestPosition({ team: at(0.001), schiri: at(0.002) }, now)?.src).toBe("handy");
    expect(bestPosition({ schiri: at(0.002) }, now)?.src).toBe("schiri");
  });
  it("alter Handy-Standort → frischer Schiri-Standort gewinnt", () =>
    expect(bestPosition({ team: at(0, 3 * MIN), schiri: at(0.002, 30_000) }, now)?.src).toBe("schiri"));
  it("GPS-Sprung zählt nicht als frisch", () =>
    expect(bestPosition({ team: at(0, 0, { suspect: true }), schiri: at(0.002) }, now)?.src).toBe("schiri"));
  it("nichts frisch → neuester bekannter als „letzter“", () => {
    const r = bestPosition({ team: at(0, 5 * MIN), schiri: at(0.002, 4 * MIN) }, now);
    expect(r?.src).toBe("letzter");
    expect(r?.pos.t).toBe(now - 4 * MIN);
  });
  it("gar kein Standort → null", () => expect(bestPosition({}, now)).toBeNull());
});

describe("Wartezeit im Umkreis (Regel 4)", () => {
  const base = { at: at(0), from: "alt", to: "neu", radiusM: 200, now };
  it("altes Team + Teams im Umkreis, neuer Mister X nie", () => {
    const positions = { neu: at(0), nah: at(0.001), fern: at(0.003), alt: at(0.01) };
    expect(teamsToLock({ ...base, positions }).sort()).toEqual(["alt", "nah"]);
  });
  it("veraltete oder unplausible Standorte zählen nicht", () => {
    const positions = { alt1: at(0.0005, 3 * MIN), sprung: at(0.0005, 0, { suspect: true }) };
    expect(teamsToLock({ ...base, positions })).toEqual(["alt"]);
  });
  it("ohne Übergabeort nur das alte Team", () => expect(teamsToLock({ ...base, at: null, positions: { nah: at(0) } })).toEqual(["alt"]));
});

describe("Pausen", () => {
  it("Dauer ohne Pausen", () => expect(activeMs(0, 60 * MIN, [{ from: 10 * MIN, to: 20 * MIN }])).toBe(50 * MIN));
  it("laufende Pause zählt bis jetzt", () => expect(activeMs(0, 60 * MIN, [{ from: 50 * MIN }], 55 * MIN)).toBe(55 * MIN));
  it("Pause außerhalb zählt nicht", () => expect(activeMs(30 * MIN, 60 * MIN, [{ from: 0, to: 20 * MIN }])).toBe(30 * MIN));
});

describe("Zufallsende (Regel 12) mit Untergrenze", () => {
  it("nie vor `notBefore`", () => {
    expect(randomEnd(0, 3, 4, 0, 210 * MIN)).toBe(210 * MIN);
    expect(randomEnd(0, 3, 4, 0.5, 210 * MIN)).toBe(225 * MIN);
  });
});

describe("Auswertung (Abschnitt 7.10)", () => {
  const h = (to: string, atMin: number, type: Handover["type"] = "fang", extra: Partial<Handover> = {}): Handover => ({
    to,
    at: atMin * MIN,
    type,
    byName: "Anna",
    ...extra,
  });
  const r = results({
    handovers: [h("A", 0, "start"), h("B", 30), h("C", 40, "fang", { undoneAt: 41 * MIN }), h("A", 90), h("B", 150, "strafe")],
    startedAt: 0,
    endedAt: 180 * MIN,
    pauses: [{ from: 100 * MIN, to: 110 * MIN }],
    distM: { A: 5000, B: 7000, C: 100 },
  });
  it("Sieger ist der letzte Mister X", () => expect(r.winner).toBe("B"));
  it("rückgängig gemachte Übergaben zählen nicht", () => expect(r.handovers).toBe(3));
  it("Zeit als Mister X ohne Pausen", () => {
    expect(r.mrxMs).toEqual({ A: 30 * MIN + 50 * MIN, B: 60 * MIN + 30 * MIN });
    expect(r.durationMs).toBe(170 * MIN);
  });
  it("Bestwerte", () => {
    expect(r.longest).toEqual({ teamId: "B", ms: 90 * MIN });
    expect(r.most?.count).toBe(2);
    expect(r.farthest).toEqual({ teamId: "B", m: 7000 });
    expect(r.totalDistM).toBe(12_100);
  });
  it("Zeitstrahl in Reihenfolge", () => expect(r.timeline.map(([t]) => t)).toEqual(["A", "B", "A", "B"]));
  it("leeres Spiel", () => expect(results({ handovers: [], startedAt: 0, endedAt: 1, pauses: [], distM: {} }).winner).toBeNull());
  it("Futter-Profi: meiste Besuche, bei Gleichstand längere Zeit; ohne Besuch kein Preis", () => {
    const base = { handovers: [], startedAt: 0, endedAt: 1, pauses: [], distM: {} };
    const food = { A: { visits: 2, ms: 25 * MIN }, B: { visits: 2, ms: 31 * MIN }, C: { visits: 1, ms: 60 * MIN } };
    expect(results({ ...base, food }).food).toEqual({ teamId: "B", visits: 2, ms: 31 * MIN });
    expect(results({ ...base, food: { A: { visits: 0, ms: 0 } } }).food).toBeNull();
    expect(results(base).food).toBeNull();
  });
});

describe("GPS-Plausibilität (onPosition)", () => {
  it("ungenau → ignorieren", () => expect(stepCheck(at(0, 10_000), at(0.001, 0, { acc: 80 })).kind).toBe("ignore"));
  it("erster Punkt → Startpunkt", () => expect(stepCheck(null, at(0)).kind).toBe("reset"));
  it("111 m in 1 s → Sprung", () => expect(stepCheck(at(0, 1000), at(0.001)).kind).toBe("jump"));
  it("5 m → Rauschen", () => expect(stepCheck(at(0, 10_000), at(0.000045)).kind).toBe("noise"));
  it("111 m in 60 s → Bewegung mit Distanz", () => {
    const s = stepCheck(at(0, 60_000), at(0.001));
    expect(s.kind).toBe("move");
    expect(s.distM).toBeCloseTo(111.2, 0);
  });
  it("lange Lücke → neu ansetzen", () => expect(stepCheck(at(0, 5 * MIN), at(0.001)).kind).toBe("reset"));
});
