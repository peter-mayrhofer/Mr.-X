// Übergabe, Strafübergabe und Rückgängig (Regel 3, 4, 11, 13; KONZEPT Abschnitt 6.2).
import {
  FRESH_MS,
  MELDUNG,
  PUSH_TITLE,
  teamsToLock,
  type ApiResults,
  type HandoverRecord,
  type Lock,
  type Position,
  type ReportSource,
} from "@mrx/shared";
import { fail, MIN, newKey } from "../util.ts";
import type { Auth, GameRoom, Who } from "../room.ts";
import { flagTracker } from "../ablauf.ts";

type D = Record<string, unknown>;
const REQUEST_ID = /^[A-Za-z0-9_-]{8,40}$/;
const fresh = (p: Position | null | undefined, now: number) => (p && !p.suspect && now - p.t <= FRESH_MS ? p : null);

/**
 * Fahne geht an ein anderes Team. Nur wenn Mister X noch `expectedMrx` ist (zwei Schiris gleichzeitig → nur einer zählt).
 * `requestId` vom Handy: dieselbe Anfrage nach Netzabbruch nochmal → keine zweite Übergabe (Abschnitt 9.1).
 */
export function handover(room: GameRoom, d: D, a: Auth): ApiResults["handover"] {
  const { to, expectedMrx, requestId: rid, type } = d;
  // Schiri und Spielleitung immer; ein Team nur, wenn die Spielleitung es freigegeben hat – und nur als Mister X für
  // den eigenen Fang („Wir wurden gefangen“), nie als Strafübergabe und nie für ein anderes Team
  const m = a.uid ? room.d.members[a.uid] : undefined;
  let who: Who;
  if (m?.role === "team" && m.teamId) {
    const team = room.d.teams[m.teamId];
    if (!team?.handover) fail("forbidden", "Die Spielleitung hat die Übergabe für euer Team nicht freigegeben");
    if (type !== "fang") fail("forbidden", "Strafübergaben nur durch Schiri oder Spielleitung");
    if (room.d.state.lastHandover !== rid && (room.d.state.mrx !== m.teamId || expectedMrx !== m.teamId))
      fail("conflict", "Ihr seid gerade nicht Mister X");
    who = { uid: a.uid!, name: `${team.name} (Mister X)`, role: "team" };
  } else who = room.who(a, ["schiri", "admin"]);
  if (type !== "fang" && type !== "strafe") fail("invalid", "Art der Übergabe fehlt");
  if (typeof rid !== "string" || !REQUEST_ID.test(rid)) fail("invalid", "Anfrage-Kennung fehlt");
  const { teams: ts, config: cfg, positions: pos, state: cur } = room.d;
  if (typeof to !== "string" || !ts[to]) fail("invalid", "Team unbekannt");
  if (cur.lastHandover === rid) return { handoverId: rid, locked: room.d.handovers[rid]?.locked ?? [] };
  if (cur.phase !== "laeuft") fail("wrongPhase", "Das Spiel läuft nicht");
  if (cur.mrx !== expectedMrx || cur.mrx === to) fail("conflict", "Mister X hat sich inzwischen geändert");

  const now = Date.now();
  const from = cur.mrx!;
  // F10: Übergabe-Meldung sofort, die nächste automatische nach dem vollen Intervall
  room.setState({ ...cur, mrx: to, mrxSince: now, lastReportAt: now, nextReportAt: now + cfg.intervalMin * MIN, lastHandover: rid });

  // Übergabeort = Tracker der Fahne (wird gerade übergeben), sonst Standort des neuen Mister X, sonst altes
  // Mister-X-Handy, sonst der Schiri, der übergibt
  const placeList: [Position | null, ReportSource][] = [
    [fresh(flagTracker(room.d), now), "tracker"],
    [fresh(pos[to], now), "handy"],
    [fresh(pos[from], now), "handy"],
    [fresh(room.d.staff[who.uid], now), "schiri"],
  ];
  const [place, src] = placeList.find(([p]) => p) ?? [null, "handy"];

  // Regel 4: altes Team + Teams im Umkreis warten; der neue Mister X hat nie Wartezeit
  const locked = teamsToLock({ at: place, from, to, positions: pos, radiusM: cfg.radiusM, now });
  const locks = room.d.locks;
  const until = now + cfg.waitMin * MIN;
  const prevLocks: Record<string, Lock> = {};
  for (const t of [...locked, to]) if (locks[t]) prevLocks[t] = locks[t];
  if (cfg.waitMin > 0)
    for (const t of locked) if ((locks[t]?.until ?? 0) < until) room.put("locks", t, { until, reason: "uebergabe" } satisfies Lock);
  if (locks[to]) room.put("locks", to, null);

  const reportId = place ? newKey() : undefined;
  if (place && reportId)
    room.put("reports", reportId, { teamId: to, lat: place.lat, lng: place.lng, t: now, posAt: place.t, src, kind: "uebergabe" });
  const rec: HandoverRecord = {
    from,
    to,
    at: now,
    type,
    byName: who.name,
    byUid: who.uid,
    locked,
    ...(place ? { lat: place.lat, lng: place.lng, reportId } : {}),
    prev: { mrx: cur.mrx, mrxSince: cur.mrxSince, lastReportAt: cur.lastReportAt, nextReportAt: cur.nextReportAt },
    prevLocks,
  };
  room.put("handovers", rid, rec);
  const text = (type === "fang" ? MELDUNG.fang : MELDUNG.strafe)(ts[to]!.name, ts[from]?.name ?? "?", cfg.waitMin);
  room.sys(text, now, reportId ? { reportId } : {});
  const others = locked.filter((t) => t !== from);
  room.notify("uebergabe", { teams: [to] }, PUSH_TITLE.neuerMrx, MELDUNG.vorsprung(cfg.waitMin));
  if (locked.includes(from)) room.notify("wartezeit", { teams: [from] }, PUSH_TITLE.warten, MELDUNG.gefangen(cfg.waitMin));
  if (others.length) room.notify("wartezeit", { teams: others }, PUSH_TITLE.warten, MELDUNG.warten(cfg.waitMin));
  room.notify("uebergabe", { all: true, except: [to, ...locked] }, PUSH_TITLE.uebergabe, text);
  room.audit(
    who,
    type === "fang" ? "Übergabe" : "Strafübergabe",
    `${ts[from]?.name ?? "?"} → ${ts[to]!.name}; Wartezeit: ${locked.map((t) => ts[t]?.name ?? t).join(", ") || "niemand"}`,
  );
  return { handoverId: rid, locked };
}

/** Nur die letzte Übergabe, nur innerhalb `undoMin`: Zustand, Wartezeiten und Meldung wie vorher */
export function undo(room: GameRoom, d: D, a: Auth): ApiResults["undo"] {
  const who = room.who(a, ["schiri", "admin"]);
  const id = String(d.handoverId ?? "");
  const h = REQUEST_ID.test(id) ? room.d.handovers[id] : undefined;
  if (!h || h.type === "start" || !h.prev) fail("invalid", "Übergabe unbekannt");
  if (h.undoneAt) return {}; // schon erledigt (z. B. Wiederholung nach Netzabbruch)
  const ts = room.d.teams;
  const now = Date.now();
  // ponytail: eine Pause zwischen Übergabe und Rückgängig zählt mit – die Frist ist ohnehin kurz
  if (now - h.at > room.d.config.undoMin * MIN) fail("tooLate", "Zu spät für Rückgängig");
  const cur = room.d.state;
  if (cur.phase !== "laeuft" && cur.phase !== "pause") fail("wrongPhase", "Das Spiel läuft nicht");
  if (cur.lastHandover !== id || cur.mrx !== h.to) fail("conflict", "Nur die letzte Übergabe kann rückgängig gemacht werden");

  const { lastHandover: _, ...rest } = cur;
  room.setState({ ...rest, ...h.prev });
  room.put("handovers", id, { ...h, undoneAt: now });
  const text = MELDUNG.rueckgaengig(ts[h.to]?.name ?? "?", ts[h.from!]?.name ?? "?");
  room.sys(text, now);
  for (const t of new Set([...(h.locked ?? []), h.to])) room.put("locks", t, h.prevLocks?.[t] ?? null);
  if (h.reportId && room.d.reports[h.reportId]) room.put("reports", h.reportId, { ...room.d.reports[h.reportId], void: true });
  room.notify("uebergabe", { all: true }, PUSH_TITLE.rueckgaengig, text);
  room.audit(who, "Übergabe rückgängig", `${ts[h.to]?.name ?? "?"} → wieder ${ts[h.from!]?.name ?? "?"}`);
  return {};
}
