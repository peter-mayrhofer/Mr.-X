// Spielsteuerung (Abschnitt 7.7): Start, Pause, Notstopp, Regeln live ändern, Bereiche sperren, Wartezeit,
// Sofort-Meldung, Durchsage, Spielende aufdecken, Schiri folgt der Fahne.
import {
  DEFAULT_CONFIG,
  LIMITS,
  MELDUNG,
  PUSH_TITLE,
  nextReportAfterIntervalChange,
  randomEnd,
  type ApiResults,
  type Config,
  type Lock,
} from "@mrx/shared";
import { fail, MIN, newKey, str } from "../util.ts";
import { finish, lockCut, writeReport } from "../ablauf.ts";
import type { Auth, GameRoom } from "../room.ts";

type D = Record<string, unknown>;
const rand = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;
const live = (room: GameRoom) => room.d.state.phase === "laeuft" || room.d.state.phase === "pause";

/** Regel 1+2, Regel 12: Mister X festlegen oder auslosen, Startsperre für alle anderen, geheimes Spielende */
export function startGame(room: GameRoom, d: D, a: Auth): ApiResults["startGame"] {
  const who = room.who(a, ["admin"]);
  const { teams: ts, field, config: cfg } = room.d;
  const ids = Object.keys(ts);
  if (ids.length < 2) fail("invalid", "Mindestens 2 Teams nötig");
  if ((field.base?.length ?? 0) < 3) fail("invalid", "Zuerst das Spielfeld festlegen");
  const drawn = d.mrx === "random";
  const mrx = drawn ? ids[Math.floor(rand() * ids.length)]! : String(d.mrx ?? "");
  if (!ts[mrx]) fail("invalid", "Team unbekannt");
  if (room.d.state.phase !== "vorbereitung") fail("wrongPhase", "Das Spiel läuft schon");

  const now = Date.now();
  const head = now + cfg.headStartMin * MIN;
  room.setState({
    phase: "laeuft",
    rev: room.d.state.rev,
    cuts: room.d.state.cuts,
    mrx,
    mrxSince: now,
    startedAt: now,
    nextReportAt: head,
  });
  room.set("info", { ...room.d.info!, phase: "laeuft" });
  room.put("handovers", newKey(), { to: mrx, at: now, type: "start", byName: who.name, byUid: who.uid });
  room.set("secrets", { ...room.d.secrets, endAt: randomEnd(now, cfg.endMinH, cfg.endMaxH, rand()) });
  room.set("purgeAt", null);
  room.sys(MELDUNG.start(ts[mrx].name, cfg.headStartMin), now);
  for (const t of ids) if (t !== mrx && cfg.headStartMin > 0) room.put("locks", t, { until: head, reason: "start" } satisfies Lock);
  room.notify("spiel", { all: true, except: [mrx] }, PUSH_TITLE.start, MELDUNG.start(ts[mrx].name, cfg.headStartMin));
  room.notify("spiel", { teams: [mrx] }, PUSH_TITLE.neuerMrx, MELDUNG.vorsprung(cfg.headStartMin));
  room.audit(who, "Spiel gestartet", `${ts[mrx].name} ist Mister X${drawn ? " (ausgelost)" : ""}`);
  return { mrx };
}

/** Pause (F2): friert Meldeplan, Wartezeiten und Spielende ein */
export function pause(room: GameRoom, _d: D, a: Auth): ApiResults["pause"] {
  const who = room.who(a, ["admin"]);
  if (room.d.state.phase !== "laeuft") fail("wrongPhase", "Das Spiel läuft nicht");
  const now = Date.now();
  room.setState({ ...room.d.state, phase: "pause", pausedAt: now });
  room.set("info", { ...room.d.info!, phase: "pause" });
  room.put("pauses", newKey(), { from: now });
  room.sys(MELDUNG.pause, now);
  room.notify("spiel", { all: true }, PUSH_TITLE.pause, MELDUNG.pause);
  room.audit(who, "Pause");
  return {};
}

/** Fortsetzen: alle Zeiten um die Pausendauer verschieben (KONZEPT Abschnitt 5) */
export function resume(room: GameRoom, _d: D, a: Auth): ApiResults["resume"] {
  const who = room.who(a, ["admin"]);
  const cur = room.d.state;
  if (cur.phase !== "pause" || !cur.pausedAt) fail("wrongPhase", "Das Spiel ist nicht pausiert");
  const now = Date.now();
  const since = cur.pausedAt;
  const dur = now - since;
  const { pausedAt: _, ...rest } = cur;
  room.setState({ ...rest, phase: "laeuft", nextReportAt: (cur.nextReportAt ?? now) + dur });
  room.set("info", { ...room.d.info!, phase: "laeuft" });
  for (const [t, l] of Object.entries(room.d.locks)) if (l.until > since) room.put("locks", t, { ...l, until: l.until + dur });
  for (const [k, p] of Object.entries(room.d.pauses)) if (p.to === undefined) room.put("pauses", k, { ...p, to: now });
  if (room.d.secrets.endAt) room.set("secrets", { ...room.d.secrets, endAt: room.d.secrets.endAt + dur });
  room.sys(MELDUNG.weiter, now);
  room.notify("spiel", { all: true }, PUSH_TITLE.fortsetzung, MELDUNG.weiter);
  room.audit(who, "Fortgesetzt", `nach ${Math.round(dur / MIN)} Min Pause`);
  return {};
}

/** Notstopp: sofort beenden, der aktuelle Mister X gewinnt */
export function stopGame(room: GameRoom, _d: D, a: Auth): ApiResults["stopGame"] {
  const who = room.who(a, ["admin"]);
  if (!finish(room, Date.now(), "notstopp")) fail("wrongPhase", "Das Spiel läuft nicht");
  room.audit(who, "Notstopp");
  return {};
}

const RANGE: Record<
  Exclude<keyof Config, "spectators" | "rulesText" | "refereeHunters" | "announceTemplates" | "trial">,
  [number, number, string]
> = {
  intervalMin: [1, 60, "Meldeintervall"],
  headStartMin: [0, 60, "Vorsprung"],
  waitMin: [0, 30, "Wartezeit"],
  radiusM: [0, 2000, "Umkreis"],
  undoMin: [0, 10, "Rückgängig-Frist"],
  endMinH: [0.5, 12, "Spielende frühestens"],
  endMaxH: [0.5, 12, "Spielende spätestens"],
};

/** Regeln live ändern (Abschnitt 7.7) – mit automatischer Meldung an alle */
export function setConfig(room: GameRoom, d: D, a: Auth): ApiResults["setConfig"] {
  const who = room.who(a, ["admin"]);
  const patch = (d.config ?? {}) as Record<string, unknown>;
  if (typeof patch !== "object") fail("invalid", "Einstellungen fehlen");
  const cur = { ...DEFAULT_CONFIG, ...room.d.config };
  const next: Config = { ...cur };
  for (const [k, v] of Object.entries(patch)) {
    // eigene Regeln der Spielleitung (Abschnitt 7.11): Text mit einfacher Formatierung, leer = keine
    if (k === "rulesText") {
      if (typeof v !== "string" || v.length > LIMITS.rulesText) fail("invalid", `Regeltext: höchstens ${LIMITS.rulesText} Zeichen`);
      const text = v.trim();
      if (text) next.rulesText = text;
      else delete next.rulesText;
      continue;
    }
    if (k === "announceTemplates") {
      if (!Array.isArray(v) || v.length > LIMITS.announceTemplates)
        fail("invalid", `Höchstens ${LIMITS.announceTemplates} Durchsage-Vorlagen`);
      const list = [...new Set(v.map((x) => (typeof x === "string" ? x.trim() : "")))];
      if (list.some((x) => !x || x.length > LIMITS.announceTemplate))
        fail("invalid", `Durchsage-Vorlage: 1–${LIMITS.announceTemplate} Zeichen`);
      if (list.length) next.announceTemplates = list;
      else delete next.announceTemplates;
      continue;
    }
    if (k === "trial") {
      if (typeof v !== "boolean") fail("invalid", "Probelauf: ja oder nein");
      if (v !== !!cur.trial && room.d.state.phase !== "vorbereitung")
        fail("wrongPhase", "Probelauf nur vor dem Start ein- oder ausschalten");
      if (v) next.trial = true;
      else delete next.trial;
      continue;
    }
    if (k === "refereeHunters") {
      if (typeof v !== "boolean") fail("invalid", "Jäger für Schiris: ja oder nein");
      next.refereeHunters = v;
      continue;
    }
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
  // auch entfernte Werte zählen (leerer Regeltext)
  const changed = [...new Set([...Object.keys(cur), ...Object.keys(next)])].filter(
    (k) => next[k as keyof Config] !== cur[k as keyof Config],
  ) as (keyof Config)[];
  if (!changed.length) return {};

  const now = Date.now();
  const st = room.d.state;
  const isLive = live(room);
  const endChanged = changed.includes("endMinH") || changed.includes("endMaxH");
  if (endChanged && st.phase === "pause") fail("wrongPhase", "Das Spielende-Fenster bitte nach der Pause ändern");
  let endAt: number | undefined;
  if (isLive && endChanged && st.startedAt) {
    const paused = Object.values(room.d.pauses).reduce((s, p) => s + ((p.to ?? now) - p.from), 0);
    if (st.startedAt + paused + next.endMaxH * 60 * MIN <= now + MIN) fail("invalid", "Das Fenster liegt schon in der Vergangenheit");
    endAt = randomEnd(st.startedAt + paused, next.endMinH, next.endMaxH, rand(), now + MIN);
  }

  room.set("config", next);
  room.set("info", { ...room.d.info!, spectators: next.spectators });
  // Schiris bekommen die Standorte neu – ohne bzw. wieder mit den Jägern
  if (changed.includes("refereeHunters")) room.resendPositions();
  if (isLive && changed.includes("intervalMin")) {
    // Regel 5: nie früher als 1 Min ab jetzt – Mister X hat immer eine Vorwarnung
    if (st.lastReportAt) room.setState({ ...st, nextReportAt: nextReportAfterIntervalChange(st.lastReportAt, next.intervalMin, now) });
    room.sys(MELDUNG.intervall(next.intervalMin), now);
    room.notify("spielfeld", { all: true }, PUSH_TITLE.regeln, MELDUNG.intervall(next.intervalMin));
  }
  if (isLive && changed.includes("waitMin")) {
    room.sys(MELDUNG.wartezeit(next.waitMin), now);
    room.notify("spielfeld", { all: true }, PUSH_TITLE.regeln, MELDUNG.wartezeit(next.waitMin));
  }
  if (isLive && changed.includes("rulesText") && next.rulesText) {
    room.sys(MELDUNG.regeltext, now);
    room.notify("spielfeld", { all: true }, PUSH_TITLE.regeln, MELDUNG.regeltext);
  }
  if (endAt !== undefined) room.set("secrets", { ...room.d.secrets, endAt });
  room.audit(
    who,
    "Einstellungen geändert",
    changed
      .map((k) =>
        k === "rulesText"
          ? "Regeltext"
          : k === "announceTemplates"
            ? "Durchsage-Vorlagen"
            : k === "trial"
              ? `Probelauf: ${next.trial ? "an" : "aus"}`
              : k === "refereeHunters"
                ? `Schiris sehen Jäger: ${next.refereeHunters === false ? "aus" : "an"}`
                : `${k}: ${String(cur[k])} → ${String(next[k])}`,
      )
      .join(", "),
  );
  return {};
}

/** Regel 10: Bereich sperren (sofort oder mit Vorwarnung von `inMin` Minuten) oder wieder freigeben bzw. Vorwarnung abbrechen */
export function setCut(room: GameRoom, d: D, a: Auth): ApiResults["setCut"] {
  const who = room.who(a, ["admin"]);
  const id = String(d.cutId ?? "");
  const locked = d.locked === true;
  const inMin = d.inMin ?? 0;
  if (typeof inMin !== "number" || !Number.isInteger(inMin) || inMin < 0 || inMin > 60) fail("invalid", "Vorwarnung: 0–60 Min");
  const cut = room.d.field.cuts?.[id];
  if (!cut) fail("invalid", "Bereich unbekannt");
  const cur = room.d.state;
  if (cur.phase === "beendet") fail("wrongPhase", "Das Spiel ist vorbei");
  const now = Date.now();
  const pending = cur.warnCuts?.[id] !== undefined;
  if (locked ? !!cur.cuts?.[id] : !cur.cuts?.[id] && !pending) fail("conflict", locked ? "Schon gesperrt" : "Schon frei");
  if (locked && inMin > 0) {
    if (!live(room)) fail("wrongPhase", "Vorwarnung gibt es nur im laufenden Spiel");
    if (pending) fail("conflict", "Schon angekündigt");
    room.setState({ ...cur, warnCuts: { ...cur.warnCuts, [id]: now + inMin * MIN } });
    const text = MELDUNG.sperreAngekuendigt(cut.short, inMin);
    room.sys(text, now);
    room.notify("spielfeld", { all: true }, PUSH_TITLE.spielfeld, text);
    room.audit(who, "Sperre angekündigt", `${cut.short} in ${inMin} Min`);
  } else if (locked) {
    lockCut(room, id, now);
    room.audit(who, "Bereich gesperrt", cut.short);
  } else if (pending) {
    // Vorwarnung zurücknehmen
    const { [id]: _, ...warn } = cur.warnCuts!;
    room.setState({ ...cur, warnCuts: Object.keys(warn).length ? warn : undefined });
    const text = MELDUNG.sperreAbgesagt(cut.short);
    room.sys(text, now);
    room.notify("spielfeld", { all: true }, PUSH_TITLE.regeln, text);
    room.audit(who, "Sperre abgesagt", cut.short);
  } else {
    const cuts = { ...cur.cuts };
    delete cuts[id];
    room.setState({ ...cur, cuts });
    const text = MELDUNG.freigegeben(cut.short);
    room.put("cutLog", newKey(), { cut: id, locked: false, t: now });
    room.sys(text, now);
    if (live(room)) room.notify("spielfeld", { all: true }, PUSH_TITLE.regeln, text);
    room.audit(who, "Bereich freigegeben", cut.short);
  }
  return {};
}

/** Wartezeit von Hand geben (1–30 Min) oder aufheben (0) */
export function setLock(room: GameRoom, d: D, a: Auth): ApiResults["setLock"] {
  const who = room.who(a, ["admin"]);
  const t = String(d.teamId ?? "");
  const min = d.min;
  if (typeof min !== "number" || !Number.isInteger(min) || min < 0 || min > 30) fail("invalid", "Wartezeit: 0–30 Min");
  const team = room.d.teams[t];
  if (!team) fail("invalid", "Team unbekannt");
  if (room.d.state.phase !== "laeuft") fail("wrongPhase", "Das Spiel läuft nicht");
  room.put("locks", t, min ? ({ until: Date.now() + min * MIN, reason: "manuell" } satisfies Lock) : null);
  if (min) room.notify("wartezeit", { teams: [t] }, PUSH_TITLE.warten, MELDUNG.wartenHand(min));
  room.audit(who, min ? "Wartezeit gegeben" : "Wartezeit aufgehoben", min ? `${team.name}: ${min} Min` : team.name);
  return {};
}

/** Sofort-Meldung als Strafe – der Meldeplan läuft unverändert weiter */
export function instantReport(room: GameRoom, _d: D, a: Auth): ApiResults["instantReport"] {
  const who = room.who(a, ["admin"]);
  const st = room.d.state;
  if (st.phase !== "laeuft" || !st.mrx) fail("wrongPhase", "Das Spiel läuft nicht");
  const name = room.d.teams[st.mrx]?.name ?? "?";
  const reportId = writeReport(room, { mrx: st.mrx, kind: "sofort", now: Date.now(), text: MELDUNG.sofort(name) });
  room.audit(who, "Sofort-Meldung", name);
  return { reportId };
}

/** Durchsage an alle (nur Spielleitung) */
export function announce(room: GameRoom, d: D, a: Auth): ApiResults["announce"] {
  const who = room.who(a, ["admin"]);
  const text = str(d.text, [1, LIMITS.chat], "Durchsage");
  room.put("chat", newKey(), { uid: who.uid, name: who.name, text, t: Date.now(), kind: "ann" });
  room.notify("durchsage", { all: true }, PUSH_TITLE.durchsage, text);
  room.audit(who, "Durchsage", text);
  return {};
}

/** Admin kann den geheimen Zeitpunkt bei Bedarf sehen – wird protokolliert */
export function revealEnd(room: GameRoom, _d: D, a: Auth): ApiResults["revealEnd"] {
  const who = room.who(a, ["admin"]);
  room.audit(who, "Spielende aufgedeckt");
  return { endAt: room.d.secrets.endAt ?? null };
}

/** Schiri begleitet Mister X → sein Standort ist Ersatz, wenn das Mister-X-Handy keinen schickt */
export function follow(room: GameRoom, d: D, a: Auth): ApiResults["follow"] {
  const who = room.who(a, ["schiri"]);
  if (who.role !== "schiri") fail("forbidden");
  const on = d.on === true;
  const { followsFlag: _, ...m } = room.d.members[who.uid]!;
  room.put("members", who.uid, on ? { ...m, followsFlag: true } : m);
  room.audit(who, on ? "Begleitet Mister X" : "Begleitet Mister X nicht mehr");
  return {};
}
