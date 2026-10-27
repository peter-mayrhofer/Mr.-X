// Spiel-Logik als reine Funktionen (KONZEPT Abschnitt 5). Der Server rechnet damit, die App zeigt dieselben Werte.
import { distanceM } from "./geo.ts";
import type { Handover, Point, Position, ReportSource } from "./types.ts";

const MIN = 60_000;
/** Standort gilt als frisch, wenn jünger als 2 Min */
export const FRESH_MS = 2 * MIN;
/** Team gilt als offline, wenn länger als 3 Min kein Standort kam (Abschnitt 7.7) */
export const OFFLINE_MS = 3 * MIN;

export interface Sources {
  tracker?: Position | null | undefined;
  team?: Position | null | undefined;
  schiri?: Position | null | undefined;
}

/**
 * Standortquelle für Mister-X-Meldungen (Abschnitt 4.3): Tracker der Fahne > Mister-X-Gerät > Schiri, der der Fahne folgt,
 * jeweils nur frisch und nicht als GPS-Sprung markiert; sonst der neueste bekannte Standort („letzter“).
 */
export function bestPosition(s: Sources, now: number, freshMs = FRESH_MS): { pos: Position; src: ReportSource } | null {
  const list: [Position | null | undefined, ReportSource][] = [
    [s.tracker, "tracker"],
    [s.team, "handy"],
    [s.schiri, "schiri"],
  ];
  for (const [p, src] of list) if (p && !p.suspect && now - p.t <= freshMs) return { pos: p, src };
  const last = list.flatMap(([p]) => (p ? [p] : [])).sort((a, b) => b.t - a.t)[0];
  return last ? { pos: last, src: "letzter" } : null;
}

/**
 * Regel 4: Wer wartet nach einer Übergabe? Das alte Mister-X-Team und alle Teams mit frischem, plausiblem Standort
 * im Umkreis `radiusM` um den Übergabeort. Das neue Mister-X-Team nie.
 */
export function teamsToLock(o: {
  at: Point | null;
  from: string | undefined;
  to: string;
  positions: Record<string, Position | undefined>;
  radiusM: number;
  now: number;
}): string[] {
  const out = new Set<string>();
  if (o.from) out.add(o.from);
  if (o.at)
    for (const [id, p] of Object.entries(o.positions))
      if (p && !p.suspect && o.now - p.t <= FRESH_MS && distanceM(o.at, p) <= o.radiusM) out.add(id);
  out.delete(o.to);
  return [...out];
}

export interface Interval {
  from: number;
  to?: number | undefined;
}

/** Dauer von [a, b) ohne die Pausen */
export function activeMs(a: number, b: number, pauses: Interval[], now = b): number {
  let ms = Math.max(0, b - a);
  for (const p of pauses) {
    const pb = p.to ?? now;
    ms -= Math.max(0, Math.min(b, pb) - Math.max(a, p.from));
  }
  return Math.max(0, ms);
}

export interface Results {
  winner: string | null;
  durationMs: number;
  /** Zeit als Mister X pro Team (ohne Pausen) */
  mrxMs: Record<string, number>;
  /** wie oft Mister X (Start zählt mit) */
  mrxCount: Record<string, number>;
  longest: { teamId: string; ms: number } | null;
  most: { teamId: string; count: number } | null;
  farthest: { teamId: string; m: number } | null;
  handovers: number;
  totalDistM: number;
  /** Zeitstrahl: wer war wie lange Mister X, in Reihenfolge */
  timeline: [string, number][];
}

const top = <T extends number>(o: Record<string, T>): [string, T] | null => {
  const e = Object.entries(o).sort((a, b) => b[1] - a[1])[0];
  return e && e[1] > 0 ? e : null;
};

/** Auswertung (Abschnitt 7.10): Sieger = letzter Mister X, längste Zeit, am öftesten, meiste Strecke, Zeitstrahl */
export function results(o: {
  handovers: Handover[];
  startedAt: number;
  endedAt: number;
  pauses: Interval[];
  distM: Record<string, number>;
}): Results {
  const hs = o.handovers.filter((h) => !h.undoneAt).sort((a, b) => a.at - b.at);
  const mrxMs: Record<string, number> = {};
  const mrxCount: Record<string, number> = {};
  const timeline: [string, number][] = [];
  hs.forEach((h, i) => {
    const ms = activeMs(h.at, hs[i + 1]?.at ?? o.endedAt, o.pauses, o.endedAt);
    mrxMs[h.to] = (mrxMs[h.to] ?? 0) + ms;
    mrxCount[h.to] = (mrxCount[h.to] ?? 0) + 1;
    timeline.push([h.to, ms]);
  });
  const l = top(mrxMs),
    m = top(mrxCount),
    f = top(o.distM);
  return {
    winner: hs.at(-1)?.to ?? null,
    durationMs: activeMs(o.startedAt, o.endedAt, o.pauses, o.endedAt),
    mrxMs,
    mrxCount,
    longest: l && { teamId: l[0], ms: l[1] },
    most: m && { teamId: m[0], count: m[1] },
    farthest: f && { teamId: f[0], m: f[1] },
    handovers: hs.filter((h) => h.type !== "start").length,
    totalDistM: Object.values(o.distM).reduce((s, d) => s + d, 0),
    timeline,
  };
}

/**
 * Plausibilität eines neuen Standorts gegenüber dem letzten angenommenen (Abschnitt 4.3, E-09):
 * zu ungenau → ignorieren; > 25 m/s → GPS-Sprung; < 10 m → Rauschen; lange Lücke → neu ansetzen ohne Distanz.
 */
export function stepCheck(last: Position | null, next: Position): { kind: "ignore" | "jump" | "noise" | "reset" | "move"; distM: number } {
  if (next.acc > 50) return { kind: "ignore", distM: 0 };
  if (!last) return { kind: "reset", distM: 0 };
  const dt = (next.t - last.t) / 1000;
  const d = distanceM(last, next);
  if (dt <= 0) return { kind: "ignore", distM: 0 };
  if (dt > 120) return { kind: "reset", distM: 0 };
  if (d / dt > 25) return { kind: "jump", distM: 0 };
  if (d < 10) return { kind: "noise", distM: 0 };
  return { kind: "move", distM: d };
}
