// Übergabe, Strafübergabe und Rückgängig (Regel 3, 4, 11, 13; KONZEPT Abschnitt 6.2).
import type { CallableRequest } from "firebase-functions/v2/https";
import {
  FRESH_MS,
  MELDUNG,
  teamsToLock,
  type ApiReason,
  type ApiResults,
  type GameState,
  type HandoverRecord,
  type Lock,
  type Position,
  type ReportSource,
} from "@mrx/shared";
import { audit, clean, db, fail, gameId, requireRole, val } from "../util.ts";
import { changeState, config, MIN, sysMsg, teams } from "../ablauf.ts";

type Req = CallableRequest<Record<string, unknown>>;
const REQUEST_ID = /^[A-Za-z0-9_-]{8,40}$/;
const fresh = (p: Position | null | undefined, now: number) => (p && !p.suspect && now - p.t <= FRESH_MS ? p : null);

/**
 * Fahne geht an ein anderes Team. Nur wenn Mister X noch `expectedMrx` ist (zwei Schiris gleichzeitig → nur einer zählt).
 * `requestId` vom Handy: dieselbe Anfrage nach Netzabbruch nochmal → keine zweite Übergabe (Abschnitt 9.1).
 */
export async function handover(req: Req): Promise<ApiResults["handover"]> {
  const g = gameId(req.data.gameId);
  const who = await requireRole(req, g, ["schiri", "admin"]);
  const { to, expectedMrx, requestId: rid } = req.data;
  const type = req.data.type;
  if (type !== "fang" && type !== "strafe") fail("invalid", "Art der Übergabe fehlt");
  if (typeof rid !== "string" || !REQUEST_ID.test(rid)) fail("invalid", "Anfrage-Kennung fehlt");
  const [ts, cfg, pos, staff] = await Promise.all([
    teams(g),
    config(g),
    val<Record<string, Position>>(`games/${g}/pos`),
    val<Position>(`games/${g}/staffPos/${who.uid}`),
  ]);
  if (typeof to !== "string" || !ts[to]) fail("invalid", "Team unbekannt");

  const now = Date.now();
  let why = undefined as ApiReason | undefined;
  let prev = undefined as GameState | undefined;
  const s = await changeState(g, (cur) => {
    why = undefined;
    if (cur.lastHandover === rid) return void (why = "exists");
    if (cur.phase !== "laeuft") return void (why = "wrongPhase");
    if (cur.mrx !== expectedMrx || cur.mrx === to) return void (why = "conflict");
    prev = cur;
    // F10: Übergabe-Meldung sofort, die nächste automatische nach dem vollen Intervall
    return { ...cur, mrx: to, mrxSince: now, lastReportAt: now, nextReportAt: now + cfg.intervalMin * MIN, lastHandover: rid };
  });
  if (why === "exists") return { handoverId: rid, locked: (await val<string[]>(`games/${g}/handovers/${rid}/locked`)) ?? [] };
  if (!s || !prev) fail(why ?? "conflict", why === "wrongPhase" ? "Das Spiel läuft nicht" : "Mister X hat sich inzwischen geändert");

  const from = prev.mrx!;
  // Übergabeort = Standort des neuen Mister X; sonst altes Mister-X-Handy, sonst der Schiri, der übergibt
  const placeList: [Position | null, ReportSource][] = [
    [fresh(pos?.[to], now), "handy"],
    [fresh(pos?.[from], now), "handy"],
    [fresh(staff, now), "schiri"],
  ];
  const [place, src] = placeList.find(([p]) => p) ?? [null, "handy"];

  // Regel 4: altes Team + Teams im Umkreis warten; der neue Mister X hat nie Wartezeit
  const locked = teamsToLock({ at: place, from, to, positions: pos ?? {}, radiusM: cfg.radiusM, now });
  const locks = (await val<Record<string, Lock>>(`games/${g}/locks`)) ?? {};
  const until = now + cfg.waitMin * MIN;
  const prevLocks: Record<string, Lock> = {};
  const upd: Record<string, unknown> = {};
  for (const t of [...locked, to]) if (locks[t]) prevLocks[t] = locks[t];
  if (cfg.waitMin > 0)
    for (const t of locked)
      if ((locks[t]?.until ?? 0) < until) upd[`games/${g}/locks/${t}`] = { until, reason: "uebergabe" } satisfies Lock;
  if (locks[to]) upd[`games/${g}/locks/${to}`] = null;

  const reportId = place ? db().ref().push().key! : undefined;
  if (place)
    upd[`games/${g}/reports/${reportId}`] = { teamId: to, lat: place.lat, lng: place.lng, t: now, posAt: place.t, src, kind: "uebergabe" };
  const rec: HandoverRecord = {
    from,
    to,
    at: now,
    type,
    byName: who.name,
    byUid: who.uid,
    locked,
    ...(place ? { lat: place.lat, lng: place.lng, reportId } : {}),
    prev: { mrx: prev.mrx, mrxSince: prev.mrxSince, lastReportAt: prev.lastReportAt, nextReportAt: prev.nextReportAt },
    prevLocks,
  };
  upd[`games/${g}/handovers/${rid}`] = rec;
  const text = (type === "fang" ? MELDUNG.fang : MELDUNG.strafe)(ts[to]!.name, ts[from]?.name ?? "?", cfg.waitMin);
  Object.assign(upd, sysMsg(g, text, now, reportId ? { reportId } : {}));
  await db().ref().update(clean(upd));
  await audit(
    g,
    who,
    type === "fang" ? "Übergabe" : "Strafübergabe",
    `${ts[from]?.name ?? "?"} → ${ts[to]!.name}; Wartezeit: ${locked.map((t) => ts[t]?.name ?? t).join(", ") || "niemand"}`,
  );
  return { handoverId: rid, locked };
}

/** Nur die letzte Übergabe, nur innerhalb `undoMin`: Zustand, Wartezeiten und Meldung wie vorher */
export async function undo(req: Req): Promise<ApiResults["undo"]> {
  const g = gameId(req.data.gameId);
  const who = await requireRole(req, g, ["schiri", "admin"]);
  const id = String(req.data.handoverId ?? "");
  const h = REQUEST_ID.test(id) ? await val<HandoverRecord>(`games/${g}/handovers/${id}`) : null;
  if (!h || h.type === "start" || !h.prev) fail("invalid", "Übergabe unbekannt");
  if (h.undoneAt) return {}; // schon erledigt (z. B. Wiederholung nach Netzabbruch)
  const [cfg, ts] = await Promise.all([config(g), teams(g)]);
  const now = Date.now();
  // ponytail: eine Pause zwischen Übergabe und Rückgängig zählt mit – die Frist ist ohnehin kurz
  if (now - h.at > cfg.undoMin * MIN) fail("tooLate", "Zu spät für Rückgängig");

  let why = undefined as ApiReason | undefined;
  const s = await changeState(g, (cur) => {
    why = undefined;
    if (cur.phase !== "laeuft" && cur.phase !== "pause") return void (why = "wrongPhase");
    if (cur.lastHandover !== id || cur.mrx !== h.to) return void (why = "conflict");
    const { lastHandover: _, ...rest } = cur;
    return { ...rest, ...h.prev };
  });
  if (!s) fail(why ?? "conflict", "Nur die letzte Übergabe kann rückgängig gemacht werden");

  const upd: Record<string, unknown> = {
    [`games/${g}/handovers/${id}/undoneAt`]: now,
    ...sysMsg(g, MELDUNG.rueckgaengig(ts[h.to]?.name ?? "?", ts[h.from!]?.name ?? "?"), now),
  };
  for (const t of new Set([...(h.locked ?? []), h.to])) upd[`games/${g}/locks/${t}`] = h.prevLocks?.[t] ?? null;
  if (h.reportId) upd[`games/${g}/reports/${h.reportId}/void`] = true;
  await db().ref().update(upd);
  await audit(g, who, "Übergabe rückgängig", `${ts[h.to]?.name ?? "?"} → wieder ${ts[h.from!]?.name ?? "?"}`);
  return {};
}
