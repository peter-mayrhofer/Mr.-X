// Wiederholung eines beendeten Laufs (Abschnitt 7.10): Was war zum Zeitpunkt t auf der Karte zu sehen?
// Rein und ohne Seiteneffekte – die Replay-Ansicht ruft es bei jeder Bewegung des Zeitschiebereglers auf.
import type { CutEvent, Handover, Report } from "./types.ts";

export interface ReplayInput {
  startedAt: number;
  endedAt: number;
  reports: Record<string, Report>;
  handovers: Record<string, Handover>;
  cutLog: Record<string, CutEvent>;
}

export interface ReplayFrame {
  /** Mister X zu diesem Zeitpunkt */
  mrx: string | null;
  /** seit wann (Start oder letzte Übergabe) */
  since: number;
  /** Meldungen des aktuellen Mister X seit der letzten Übergabe (die Spur) */
  trail: (Report & { id: string })[];
  /** Fangorte bis jetzt (Übergaben mit Ort) */
  catches: (Handover & { id: string; lat: number; lng: number })[];
  /** zu diesem Zeitpunkt gesperrte Bereiche */
  locked: string[];
}

const sorted = <T>(o: Record<string, T>, at: (x: T) => number): (T & { id: string })[] =>
  Object.entries(o)
    .map(([id, x]) => ({ ...x, id }))
    .sort((a, b) => at(a) - at(b));

export function replayAt(a: ReplayInput, t: number): ReplayFrame {
  const hs = sorted(a.handovers, (h) => h.at).filter((h) => !h.undoneAt && h.at <= t);
  const last = hs.at(-1);
  const since = last?.at ?? a.startedAt;
  const trail = sorted(a.reports, (r) => r.t).filter((r) => !r.void && r.teamId === last?.to && r.t >= since && r.t <= t);
  const catches = hs.filter(
    (h): h is Handover & { id: string; lat: number; lng: number } => h.type !== "start" && h.lat !== undefined && h.lng !== undefined,
  );
  const locked = new Set<string>();
  for (const c of sorted(a.cutLog, (c) => c.t)) {
    if (c.t > t) break;
    if (c.locked) locked.add(c.cut);
    else locked.delete(c.cut);
  }
  return { mrx: last?.to ?? null, since, trail, catches, locked: [...locked] };
}

/** Markierungen für den Zeitschieberegler: Übergaben (mit neuem Mister X) und Sperren */
export function replayMarks(a: ReplayInput): { t: number; kind: "uebergabe" | "sperre"; teamId?: string; cut?: string }[] {
  return [
    ...Object.values(a.handovers)
      .filter((h) => !h.undoneAt && h.type !== "start")
      .map((h) => ({ t: h.at, kind: "uebergabe" as const, teamId: h.to })),
    ...Object.values(a.cutLog)
      .filter((c) => c.locked && c.t >= a.startedAt)
      .map((c) => ({ t: c.t, kind: "sperre" as const, cut: c.cut })),
  ].sort((x, y) => x.t - y.t);
}

export type Spur = [sek: number, lat: number, lng: number][];

/**
 * Wo waren die Teams zum Zeitpunkt t (E-72)? Spur = Punkte alle 20 s ([Sekunden seit Start, Breite·1e5, Länge·1e5]).
 * Zwischen nahen Punkten (≤ 2 Min) geradlinig, sonst steht das Team am letzten Punkt; ohne Punkt seit 10 Min
 * (Handy aus, Funkloch) ist es nicht zu sehen.
 */
export function replayTeams(
  a: { startedAt: number; tracks?: Record<string, Spur> },
  t: number,
): { teamId: string; lat: number; lng: number }[] {
  const sek = (t - a.startedAt) / 1000;
  const out: { teamId: string; lat: number; lng: number }[] = [];
  for (const [teamId, spur] of Object.entries(a.tracks ?? {})) {
    // erster Punkt nach `sek` (binäre Suche – die Spur ist nach Zeit sortiert)
    let lo = 0;
    let hi = spur.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (spur[m]![0] <= sek) lo = m + 1;
      else hi = m;
    }
    const p = spur[lo - 1];
    if (!p || sek - p[0] > 600) continue;
    const q = spur[lo];
    const f = q && q[0] - p[0] <= 120 ? (sek - p[0]) / (q[0] - p[0]) : 0;
    out.push({ teamId, lat: (p[1] + f * ((q?.[1] ?? p[1]) - p[1])) / 1e5, lng: (p[2] + f * ((q?.[2] ?? p[2]) - p[2])) / 1e5 });
  }
  return out;
}
