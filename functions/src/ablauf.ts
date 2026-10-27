// Spielablauf am Server (KONZEPT Abschnitt 5 + 6): Zustand ändern, Mister X melden, Spielende mit Auswertung und Archiv.
// Alle Zeiten sind Server-Zeit. Jede Änderung am Zustand läuft als Transaktion auf games/{g}/state – zwei gleichzeitige
// Aufrufe (Takt + Handy, zwei Schiris) können so nie doppelt melden oder doppelt übergeben.
import {
  bestPosition,
  MELDUNG,
  results,
  uhr,
  type ChatMessage,
  type Config,
  type CutEvent,
  type GameState,
  type HandoverRecord,
  type Member,
  type Pause,
  type Position,
  type Report,
  type ReportKind,
  type ReportSource,
  type Team,
  type TeamStats,
} from "@mrx/shared";
import { clean, db, newKey, val } from "./util.ts";

export const MIN = 60_000;

/**
 * Transaktion auf den Spielzustand. `fn` gibt den neuen Zustand zurück oder `undefined` (= nichts ändern).
 * `fn` darf nicht werfen (läuft evtl. mehrfach, auch außerhalb des Aufrufs) – Gründe über eine Variable melden.
 */
export async function changeState(g: string, fn: (cur: GameState) => GameState | undefined): Promise<GameState | null> {
  const r = await db()
    .ref(`games/${g}/state`)
    .transaction((cur: GameState | null) => {
      if (!cur) return cur; // erster Versuch mit leerem Zwischenspeicher – die Datenbank liefert dann den echten Wert
      const next = fn(cur);
      return next && clean({ ...next, rev: (cur.rev ?? 0) + 1 });
    });
  return r.committed && r.snapshot.exists() ? (r.snapshot.val() as GameState) : null;
}

export const config = async (g: string) => (await val<Config>(`games/${g}/config`))!;
export const teams = async (g: string) => (await val<Record<string, Team>>(`games/${g}/teams`)) ?? {};

export function sysMsg(g: string, text: string, t: number, extra: Partial<ChatMessage> = {}): Record<string, ChatMessage> {
  return { [`games/${g}/chat/${newKey()}`]: { uid: "system", name: "System", text, t, kind: "sys", ...extra } };
}

/** Wo ist Mister X? Quellen nach Abschnitt 4.3: Mister-X-Handy, sonst ein Schiri, der der Fahne folgt; sonst der letzte bekannte. */
export async function locate(g: string, mrx: string, now: number): Promise<{ pos: Position; src: ReportSource } | null> {
  const [team, members, staff] = await Promise.all([
    val<Position>(`games/${g}/pos/${mrx}`),
    val<Record<string, Member>>(`games/${g}/members`),
    val<Record<string, Position>>(`games/${g}/staffPos`),
  ]);
  const following = Object.entries(members ?? {})
    .filter(([, m]) => m.role === "schiri" && m.followsFlag)
    .map(([uid]) => staff?.[uid])
    .filter((p) => p != null)
    .sort((a, b) => b.t - a.t);
  // ponytail: Tracker der Fahne kommt mit der Tracker-Schnittstelle (Meilenstein 11) als erste Quelle dazu
  return bestPosition({ team, schiri: following[0] }, now);
}

/** Meldung schreiben (+ System-Nachricht im Chat). Ohne irgendeinen Standort nur ein Hinweis im Chat. */
export async function writeReport(
  g: string,
  o: { mrx: string; kind: ReportKind; now: number; at?: { pos: Position; src: ReportSource } | null; text?: string },
): Promise<string | null> {
  const [found, ts] = await Promise.all([o.at === undefined ? locate(g, o.mrx, o.now) : o.at, teams(g)]);
  const name = ts[o.mrx]?.name ?? "?";
  if (!found) {
    await db()
      .ref()
      .update(sysMsg(g, MELDUNG.keinStandort(name), o.now));
    return null;
  }
  const id = newKey();
  const r: Report = { teamId: o.mrx, lat: found.pos.lat, lng: found.pos.lng, t: o.now, posAt: found.pos.t, src: found.src, kind: o.kind };
  await db()
    .ref()
    .update({
      [`games/${g}/reports/${id}`]: r,
      ...sysMsg(g, o.text ?? MELDUNG.meldung(name, found.src, uhr(found.pos.t)), o.now, { reportId: id }),
    });
  return id;
}

/** Regel 5: automatische Meldung, wenn `nextReportAt` erreicht ist. Nur wer die Transaktion gewinnt, meldet. */
async function autoReport(g: string, due: number, now: number): Promise<boolean> {
  const cfg = await config(g);
  let mrx = "";
  const s = await changeState(g, (cur) => {
    if (cur.phase !== "laeuft" || cur.nextReportAt !== due || !cur.mrx) return;
    mrx = cur.mrx;
    let next = due + cfg.intervalMin * MIN;
    if (next <= now) next = now + cfg.intervalMin * MIN; // Server war länger weg: nicht mehrere Meldungen nachholen
    return { ...cur, lastReportAt: now, nextReportAt: next };
  });
  if (!s) return false;
  await writeReport(g, { mrx, kind: "auto", now });
  return true;
}

/** Alles erledigen, was jetzt fällig ist (Takt jede Minute, und jedes Handy darf anstoßen: `poke`). Idempotent. */
export async function advance(g: string, now = Date.now()): Promise<string[]> {
  const [st, endAt] = await Promise.all([val<GameState>(`games/${g}/state`), val<number>(`secrets/${g}/endAt`)]);
  if (st?.phase !== "laeuft") return [];
  if (endAt && endAt <= now) return (await finish(g, endAt, "zufall")) ? ["ende"] : [];
  if (st.nextReportAt && st.nextReportAt <= now && (await autoReport(g, st.nextReportAt, now))) return ["meldung"];
  return [];
}

/** Nächster Termin (Meldung oder Ende) für den Takt – damit er bis zur Sekunde warten kann */
export async function nextDue(g: string): Promise<number | null> {
  const [st, endAt] = await Promise.all([val<GameState>(`games/${g}/state`), val<number>(`secrets/${g}/endAt`)]);
  if (st?.phase !== "laeuft") return null;
  return Math.min(st.nextReportAt ?? Infinity, endAt ?? Infinity);
}

/**
 * Spielende (Abschnitt 6.3): Phase beendet, Auswertung, Archiv, Live-Standorte löschen (Datenschutz).
 * `endedAt` = geheimer Zeitpunkt bzw. Notstopp-Zeit.
 */
export async function finish(g: string, endedAt: number, reason: "zufall" | "notstopp"): Promise<boolean> {
  const run = newKey();
  let was: GameState | undefined;
  const s = await changeState(g, (cur) => {
    if (cur.phase !== "laeuft" && cur.phase !== "pause") return;
    was = cur;
    const { pausedAt: _, ...rest } = cur;
    return { ...rest, phase: "beendet", endedAt, run };
  });
  if (!s || !was) return false;

  const p = `games/${g}`;
  const [info, ts, handovers, pauses, stats, reports, cutLog, chat, field] = await Promise.all([
    val<{ name: string }>(`${p}/info`),
    teams(g),
    val<Record<string, HandoverRecord>>(`${p}/handovers`),
    val<Record<string, Pause>>(`${p}/pauses`),
    val<Record<string, TeamStats>>(`${p}/stats`),
    val<Record<string, Report>>(`${p}/reports`),
    val<Record<string, CutEvent>>(`${p}/cutLog`),
    val<Record<string, ChatMessage>>(`${p}/chat`),
    val<unknown>(`${p}/field`),
  ]);
  const upd: Record<string, unknown> = {};
  // offene Pause (Notstopp während der Pause) schließen
  for (const [k, ps] of Object.entries(pauses ?? {}))
    if (ps.to === undefined) {
      ps.to = endedAt;
      upd[`${p}/pauses/${k}/to`] = endedAt;
    }
  const res = results({
    handovers: Object.values(handovers ?? {}),
    startedAt: was.startedAt ?? endedAt,
    endedAt,
    pauses: Object.values(pauses ?? {}),
    distM: Object.fromEntries(Object.entries(stats ?? {}).map(([t, v]) => [t, v.distM])),
  });
  const ende = sysMsg(g, MELDUNG.ende(res.winner ? (ts[res.winner]?.name ?? "?") : "Niemand"), endedAt);
  Object.assign(upd, ende, {
    [`${p}/info/phase`]: "beendet",
    [`${p}/archive/${run}`]: clean({
      name: info?.name,
      reason,
      startedAt: was.startedAt,
      endedAt,
      results: res,
      teams: ts,
      // ohne Vorzustände (prev) – die braucht nur „Rückgängig“
      handovers: Object.fromEntries(Object.entries(handovers ?? {}).map(([k, { prev: _a, prevLocks: _b, ...h }]) => [k, h])),
      reports: Object.fromEntries(Object.entries(reports ?? {}).filter(([, r]) => !r.void)),
      cutLog,
      pauses,
      field,
      chat: { ...chat, ...Object.fromEntries(Object.entries(ende).map(([k, v]) => [k.split("/").pop(), v])) },
    }),
    // Datenschutz (Abschnitt 9.2): Live-Standorte sofort löschen
    [`${p}/pos`]: null,
    [`${p}/staffPos`]: null,
    [`${p}/trackerPos`]: null,
    [`${p}/track`]: null,
    [`${p}/locks`]: null,
    [`running/${g}`]: null,
    [`secrets/${g}/endAt`]: null,
  });
  await db().ref().update(upd);
  return true;
}
