import { describe, expect, it } from "vitest";
import { replayAt, replayMarks, replayTeams, type ReplayInput } from "../src/index.ts";

const MIN = 60_000;
const r = (teamId: string, t: number, extra = {}) => ({
  teamId,
  t,
  posAt: t,
  lat: 48.3,
  lng: 14.28,
  src: "handy" as const,
  kind: "auto" as const,
  ...extra,
});
const game: ReplayInput = {
  startedAt: 0,
  endedAt: 60 * MIN,
  reports: {
    a: r("A", 10 * MIN),
    b: r("A", 20 * MIN),
    c: r("B", 25 * MIN, { kind: "uebergabe" }),
    d: r("B", 35 * MIN),
    v: r("C", 40 * MIN, { void: true }),
  },
  handovers: {
    s: { to: "A", at: 0, type: "start", byName: "P" },
    h1: { from: "A", to: "B", at: 25 * MIN, type: "fang", byName: "S", lat: 48.31, lng: 14.29 },
    h2: { from: "B", to: "C", at: 40 * MIN, type: "fang", byName: "S", lat: 48.32, lng: 14.3, undoneAt: 41 * MIN },
  },
  cutLog: {
    k0: { cut: "westen", locked: true, t: -5 * MIN },
    k1: { cut: "norden", locked: true, t: 30 * MIN },
    k2: { cut: "westen", locked: false, t: 45 * MIN },
  },
};

describe("Wiederholung", () => {
  it("vor der ersten Übergabe: Start-Mister-X mit seinen Meldungen, vorab gesperrter Bereich", () => {
    const f = replayAt(game, 15 * MIN);
    expect(f.mrx).toBe("A");
    expect(f.trail.map((x) => x.t)).toEqual([10 * MIN]);
    expect(f.catches).toEqual([]);
    expect(f.locked).toEqual(["westen"]);
  });
  it("nach der Übergabe: neue Spur, Fangort, Verkleinerung", () => {
    const f = replayAt(game, 36 * MIN);
    expect(f.mrx).toBe("B");
    expect(f.since).toBe(25 * MIN);
    expect(f.trail.map((x) => x.t)).toEqual([25 * MIN, 35 * MIN]);
    expect(f.catches.map((c) => c.to)).toEqual(["B"]);
    expect(f.locked.sort()).toEqual(["norden", "westen"]);
  });
  it("rückgängig gemachte Übergaben und ungültige Meldungen zählen nicht; Freigabe wirkt", () => {
    const f = replayAt(game, 50 * MIN);
    expect(f.mrx).toBe("B");
    expect(f.trail.every((x) => x.teamId === "B")).toBe(true);
    expect(f.locked).toEqual(["norden"]);
  });
  it("Markierungen für den Regler", () =>
    expect(replayMarks(game)).toEqual([
      { t: 25 * MIN, kind: "uebergabe", teamId: "B" },
      { t: 30 * MIN, kind: "sperre", cut: "norden" },
    ]));
});

describe("replayTeams (E-72)", () => {
  const tracks = {
    A: [
      [0, 4830000, 1428000],
      [20, 4830100, 1428200],
      [400, 4830500, 1428500], // nach 6 Min Pause: kein Gleiten, Team steht
    ] as [number, number, number][],
    B: [[100, 4831000, 1429000]] as [number, number, number][],
  };
  const at = (sek: number) => Object.fromEntries(replayTeams({ startedAt: 1000, tracks }, 1000 + sek * 1000).map((x) => [x.teamId, x]));
  it("zwischen nahen Punkten geradlinig", () => expect(at(10).A).toEqual({ teamId: "A", lat: 48.3005, lng: 14.281 }));
  it("vor dem ersten Punkt nicht zu sehen", () => expect(at(50).B).toBeUndefined());
  it("große Lücke: steht am letzten Punkt, nach 10 Min weg", () => {
    expect(at(200).A).toMatchObject({ lat: 48.301, lng: 14.282 });
    expect(at(100 + 601).B).toBeUndefined();
    expect(at(100 + 599).B).toMatchObject({ lat: 48.31, lng: 14.29 });
  });
  it("ohne Spuren (älter als 30 Tage) leer", () => expect(replayTeams({ startedAt: 0 }, 5000)).toEqual([]));
});
