// Spielsteuerung (Abschnitt 7.7): Start, Pause, Notstopp, Regeln live ändern, Bereiche sperren, Wartezeit,
// Sofort-Meldung, Durchsage, Spielende aufdecken, Schiri folgt der Fahne, Anstoßen (`poke`).
import { randomInt } from "node:crypto";
import type { CallableRequest } from "firebase-functions/v2/https";
import {
  DEFAULT_CONFIG,
  LIMITS,
  MELDUNG,
  PUSH_TITLE,
  nextReportAfterIntervalChange,
  randomEnd,
  type ApiReason,
  type ApiResults,
  type Config,
  type Field,
  type GameState,
  type Lock,
  type Pause,
} from "@mrx/shared";
import { audit, clean, db, fail, gameId, newKey, requireRole, str, val } from "../util.ts";
import { advance, changeState, config, finish, MIN, sysMsg, teams, writeReport } from "../ablauf.ts";
import { notify } from "../push.ts";

type Req = CallableRequest<Record<string, unknown>>;
const rand = () => randomInt(2 ** 30) / 2 ** 30;

/** Regel 1+2, Regel 12: Mister X festlegen oder auslosen, Startsperre für alle anderen, geheimes Spielende */
export async function startGame(req: Req): Promise<ApiResults["startGame"]> {
  const g = gameId(req.data.gameId);
  const who = await requireRole(req, g, ["admin"]);
  const [ts, field, cfg] = await Promise.all([teams(g), val<Field>(`games/${g}/field`), config(g)]);
  const ids = Object.keys(ts);
  if (ids.length < 2) fail("invalid", "Mindestens 2 Teams nötig");
  if ((field?.base?.length ?? 0) < 3) fail("invalid", "Zuerst das Spielfeld festlegen");
  const drawn = req.data.mrx === "random";
  const mrx = drawn ? ids[randomInt(ids.length)]! : String(req.data.mrx ?? "");
  if (!ts[mrx]) fail("invalid", "Team unbekannt");

  const now = Date.now();
  const head = now + cfg.headStartMin * MIN;
  const s = await changeState(g, (cur) =>
    cur.phase !== "vorbereitung"
      ? undefined
      : { phase: "laeuft", rev: cur.rev, cuts: cur.cuts, mrx, mrxSince: now, startedAt: now, nextReportAt: head },
  );
  if (!s) fail("wrongPhase", "Das Spiel läuft schon");

  const upd: Record<string, unknown> = {
    [`games/${g}/info/phase`]: "laeuft",
    [`games/${g}/handovers/${newKey()}`]: { to: mrx, at: now, type: "start", byName: who.name, byUid: who.uid },
    [`running/${g}`]: true,
    [`secrets/${g}/endAt`]: randomEnd(now, cfg.endMinH, cfg.endMaxH, rand()),
    ...sysMsg(g, MELDUNG.start(ts[mrx].name, cfg.headStartMin), now),
  };
  for (const t of ids)
    if (t !== mrx && cfg.headStartMin > 0) upd[`games/${g}/locks/${t}`] = { until: head, reason: "start" } satisfies Lock;
  await db().ref().update(upd);
  await Promise.all([
    notify(g, "spiel", { all: true, except: [mrx] }, PUSH_TITLE.start, MELDUNG.start(ts[mrx].name, cfg.headStartMin)),
    notify(g, "spiel", { teams: [mrx] }, PUSH_TITLE.neuerMrx, MELDUNG.vorsprung(cfg.headStartMin)),
    audit(g, who, "Spiel gestartet", `${ts[mrx].name} ist Mister X${drawn ? " (ausgelost)" : ""}`),
  ]);
  return { mrx };
}

/** Jedes Mitglied darf anstoßen, z. B. wenn sein Countdown abgelaufen ist. Erledigt nur, was wirklich fällig ist. */
export async function poke(req: Req): Promise<ApiResults["poke"]> {
  const g = gameId(req.data.gameId);
  await requireRole(req, g, ["team", "schiri", "admin", "screen", "viewer"]);
  return { done: await advance(g) };
}

/** Pause (F2): friert Meldeplan, Wartezeiten und Spielende ein */
export async function pause(req: Req): Promise<ApiResults["pause"]> {
  const g = gameId(req.data.gameId);
  const who = await requireRole(req, g, ["admin"]);
  const now = Date.now();
  const s = await changeState(g, (cur) => (cur.phase === "laeuft" ? { ...cur, phase: "pause", pausedAt: now } : undefined));
  if (!s) fail("wrongPhase", "Das Spiel läuft nicht");
  await db()
    .ref()
    .update({
      [`games/${g}/info/phase`]: "pause",
      [`games/${g}/pauses/${newKey()}`]: { from: now } satisfies Pause,
      ...sysMsg(g, MELDUNG.pause, now),
    });
  await Promise.all([notify(g, "spiel", { all: true }, PUSH_TITLE.pause, MELDUNG.pause), audit(g, who, "Pause")]);
  return {};
}

/** Fortsetzen: alle Zeiten um die Pausendauer verschieben (KONZEPT Abschnitt 5) */
export async function resume(req: Req): Promise<ApiResults["resume"]> {
  const g = gameId(req.data.gameId);
  const who = await requireRole(req, g, ["admin"]);
  const now = Date.now();
  let since = 0;
  const s = await changeState(g, (cur) => {
    if (cur.phase !== "pause" || !cur.pausedAt) return;
    since = cur.pausedAt;
    const { pausedAt: _, ...rest } = cur;
    return { ...rest, phase: "laeuft", nextReportAt: (cur.nextReportAt ?? now) + (now - since) };
  });
  if (!s) fail("wrongPhase", "Das Spiel ist nicht pausiert");
  const d = now - since;
  const [locks, pauses, endAt] = await Promise.all([
    val<Record<string, Lock>>(`games/${g}/locks`),
    val<Record<string, Pause>>(`games/${g}/pauses`),
    val<number>(`secrets/${g}/endAt`),
  ]);
  const upd: Record<string, unknown> = { [`games/${g}/info/phase`]: "laeuft", ...sysMsg(g, MELDUNG.weiter, now) };
  for (const [t, l] of Object.entries(locks ?? {})) if (l.until > since) upd[`games/${g}/locks/${t}/until`] = l.until + d;
  for (const [k, p] of Object.entries(pauses ?? {})) if (p.to === undefined) upd[`games/${g}/pauses/${k}/to`] = now;
  if (endAt) upd[`secrets/${g}/endAt`] = endAt + d;
  await db().ref().update(upd);
  await Promise.all([
    notify(g, "spiel", { all: true }, PUSH_TITLE.fortsetzung, MELDUNG.weiter),
    audit(g, who, "Fortgesetzt", `nach ${Math.round(d / MIN)} Min Pause`),
  ]);
  return {};
}

/** Notstopp: sofort beenden, der aktuelle Mister X gewinnt */
export async function stopGame(req: Req): Promise<ApiResults["stopGame"]> {
  const g = gameId(req.data.gameId);
  const who = await requireRole(req, g, ["admin"]);
  if (!(await finish(g, Date.now(), "notstopp"))) fail("wrongPhase", "Das Spiel läuft nicht");
  await audit(g, who, "Notstopp");
  return {};
}

const RANGE: Record<Exclude<keyof Config, "spectators">, [number, number, string]> = {
  intervalMin: [1, 60, "Meldeintervall"],
  headStartMin: [0, 60, "Vorsprung"],
  waitMin: [0, 30, "Wartezeit"],
  radiusM: [0, 2000, "Umkreis"],
  undoMin: [0, 10, "Rückgängig-Frist"],
  endMinH: [0.5, 12, "Spielende frühestens"],
  endMaxH: [0.5, 12, "Spielende spätestens"],
};

/** Regeln live ändern (Abschnitt 7.7) – mit automatischer Meldung an alle */
export async function setConfig(req: Req): Promise<ApiResults["setConfig"]> {
  const g = gameId(req.data.gameId);
  const who = await requireRole(req, g, ["admin"]);
  const patch = (req.data.config ?? {}) as Record<string, unknown>;
  const cur = { ...DEFAULT_CONFIG, ...(await config(g)) };
  const next: Config = { ...cur };
  for (const [k, v] of Object.entries(patch)) {
    if (k === "spectators") {
      if (typeof v !== "boolean") fail("invalid", "Zuschauer: ja oder nein");
      next.spectators = v;
      continue;
    }
    const r = RANGE[k as keyof typeof RANGE];
    if (!r) fail("invalid", `Unbekannte Einstellung ${k}`);
    if (typeof v !== "number" || !Number.isFinite(v) || v < r[0] || v > r[1]) fail("invalid", `${r[2]}: ${r[0]}–${r[1]}`);
    next[k as keyof typeof RANGE] = v;
  }
  if (next.endMinH > next.endMaxH) fail("invalid", "Spielende: „frühestens“ muss vor „spätestens“ liegen");
  const changed = (Object.keys(next) as (keyof Config)[]).filter((k) => next[k] !== cur[k]);
  if (!changed.length) return {};

  const now = Date.now();
  const st = await val<GameState>(`games/${g}/state`);
  const live = st?.phase === "laeuft" || st?.phase === "pause";
  const endChanged = changed.includes("endMinH") || changed.includes("endMaxH");
  if (endChanged && st?.phase === "pause") fail("wrongPhase", "Das Spielende-Fenster bitte nach der Pause ändern");

  const upd: Record<string, unknown> = { [`games/${g}/config`]: next, [`games/${g}/info/spectators`]: next.spectators };
  if (live && changed.includes("intervalMin")) {
    // Regel 5: nie früher als 1 Min ab jetzt – Mister X hat immer eine Vorwarnung
    await changeState(g, (c) =>
      c.lastReportAt ? { ...c, nextReportAt: nextReportAfterIntervalChange(c.lastReportAt, next.intervalMin, now) } : undefined,
    );
    Object.assign(upd, sysMsg(g, MELDUNG.intervall(next.intervalMin), now));
  }
  if (live && changed.includes("waitMin")) Object.assign(upd, sysMsg(g, MELDUNG.wartezeit(next.waitMin), now));
  if (live && endChanged && st?.startedAt) {
    const paused = Object.values((await val<Record<string, Pause>>(`games/${g}/pauses`)) ?? {}).reduce(
      (s, p) => s + ((p.to ?? now) - p.from),
      0,
    );
    if (st.startedAt + paused + next.endMaxH * 60 * MIN <= now + MIN) fail("invalid", "Das Fenster liegt schon in der Vergangenheit");
    upd[`secrets/${g}/endAt`] = randomEnd(st.startedAt + paused, next.endMinH, next.endMaxH, rand(), now + MIN);
  }
  await db().ref().update(upd);
  if (live && changed.includes("intervalMin"))
    await notify(g, "spielfeld", { all: true }, PUSH_TITLE.regeln, MELDUNG.intervall(next.intervalMin));
  if (live && changed.includes("waitMin")) await notify(g, "spielfeld", { all: true }, PUSH_TITLE.regeln, MELDUNG.wartezeit(next.waitMin));
  await audit(g, who, "Einstellungen geändert", changed.map((k) => `${k}: ${String(cur[k])} → ${String(next[k])}`).join(", "));
  return {};
}

/** Regel 10: Bereich sperren oder wieder freigeben */
export async function setCut(req: Req): Promise<ApiResults["setCut"]> {
  const g = gameId(req.data.gameId);
  const who = await requireRole(req, g, ["admin"]);
  const id = String(req.data.cutId ?? "");
  const locked = req.data.locked === true;
  const cut = (await val<Field>(`games/${g}/field`))?.cuts?.[id];
  if (!cut) fail("invalid", "Bereich unbekannt");
  const now = Date.now();
  let why = undefined as ApiReason | undefined;
  const s = await changeState(g, (cur) => {
    why = undefined;
    if (cur.phase === "beendet") return void (why = "wrongPhase");
    if (!!cur.cuts?.[id] === locked) return void (why = "conflict");
    const cuts = { ...cur.cuts };
    if (locked) cuts[id] = now;
    else delete cuts[id];
    return { ...cur, cuts };
  });
  if (!s) fail(why ?? "conflict", locked ? "Schon gesperrt" : "Schon frei");
  const text = locked ? MELDUNG.gesperrt(cut.short) : MELDUNG.freigegeben(cut.short);
  await db()
    .ref()
    .update({ [`games/${g}/cutLog/${newKey()}`]: { cut: id, locked, t: now }, ...sysMsg(g, text, now) });
  if (st_live(s)) await notify(g, "spielfeld", { all: true }, locked ? PUSH_TITLE.spielfeld : PUSH_TITLE.regeln, text);
  await audit(g, who, locked ? "Bereich gesperrt" : "Bereich freigegeben", cut.short);
  return {};
}

/** Benachrichtigen nur im laufenden Spiel (vor dem Start sperrt die Spielleitung nur vor) */
const st_live = (s: GameState | null) => s?.phase === "laeuft" || s?.phase === "pause";

/** Wartezeit von Hand geben (1–30 Min) oder aufheben (0) */
export async function setLock(req: Req): Promise<ApiResults["setLock"]> {
  const g = gameId(req.data.gameId);
  const who = await requireRole(req, g, ["admin"]);
  const t = String(req.data.teamId ?? "");
  const min = req.data.min;
  if (typeof min !== "number" || !Number.isInteger(min) || min < 0 || min > 30) fail("invalid", "Wartezeit: 0–30 Min");
  const ts = await teams(g);
  if (!ts[t]) fail("invalid", "Team unbekannt");
  const st = await val<GameState>(`games/${g}/state`);
  if (st?.phase !== "laeuft") fail("wrongPhase", "Das Spiel läuft nicht");
  await db()
    .ref(`games/${g}/locks/${t}`)
    .set(min ? ({ until: Date.now() + min * MIN, reason: "manuell" } satisfies Lock) : null);
  if (min) await notify(g, "wartezeit", { teams: [t] }, PUSH_TITLE.warten, MELDUNG.wartenHand(min));
  await audit(g, who, min ? "Wartezeit gegeben" : "Wartezeit aufgehoben", min ? `${ts[t].name}: ${min} Min` : ts[t].name);
  return {};
}

/** Sofort-Meldung als Strafe – der Meldeplan läuft unverändert weiter */
export async function instantReport(req: Req): Promise<ApiResults["instantReport"]> {
  const g = gameId(req.data.gameId);
  const who = await requireRole(req, g, ["admin"]);
  const st = await val<GameState>(`games/${g}/state`);
  if (st?.phase !== "laeuft" || !st.mrx) fail("wrongPhase", "Das Spiel läuft nicht");
  const name = (await teams(g))[st.mrx]?.name ?? "?";
  const reportId = await writeReport(g, { mrx: st.mrx, kind: "sofort", now: Date.now(), text: MELDUNG.sofort(name) });
  await audit(g, who, "Sofort-Meldung", name);
  return { reportId };
}

/** Durchsage an alle (nur Spielleitung) */
export async function announce(req: Req): Promise<ApiResults["announce"]> {
  const g = gameId(req.data.gameId);
  const who = await requireRole(req, g, ["admin"]);
  const text = str(req.data.text, [1, LIMITS.chat], "Durchsage");
  await db()
    .ref(`games/${g}/chat`)
    .push(clean({ uid: who.uid, name: who.name, text, t: Date.now(), kind: "ann" }));
  await notify(g, "durchsage", { all: true }, PUSH_TITLE.durchsage, text);
  await audit(g, who, "Durchsage", text);
  return {};
}

/** Admin kann den geheimen Zeitpunkt bei Bedarf sehen – wird protokolliert */
export async function revealEnd(req: Req): Promise<ApiResults["revealEnd"]> {
  const g = gameId(req.data.gameId);
  const who = await requireRole(req, g, ["admin"]);
  const endAt = await val<number>(`secrets/${g}/endAt`);
  await audit(g, who, "Spielende aufgedeckt");
  return { endAt };
}

/** Schiri begleitet Mister X → sein Standort ist Ersatz, wenn das Mister-X-Handy keinen schickt */
export async function follow(req: Req): Promise<ApiResults["follow"]> {
  const g = gameId(req.data.gameId);
  const who = await requireRole(req, g, ["schiri"]);
  if (who.role !== "schiri") fail("forbidden");
  const on = req.data.on === true;
  await db()
    .ref(`games/${g}/members/${who.uid}/followsFlag`)
    .set(on || null);
  await audit(g, who, on ? "Begleitet Mister X" : "Begleitet Mister X nicht mehr");
  return {};
}
