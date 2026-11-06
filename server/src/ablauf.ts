// Spielablauf am Server (KONZEPT Abschnitt 5 + 6): Mister X melden, Wartezeiten beenden, Spielende mit Auswertung und
// Archiv. Alle Zeiten sind Server-Zeit. Läuft im Spielraum – eine Sache nach der anderen, darum ohne Transaktionen.
import {
  bestPosition,
  distanceM,
  MELDUNG,
  PUSH_TITLE,
  results,
  uhr,
  type Position,
  type Report,
  type ReportKind,
  type ReportSource,
} from "@mrx/shared";
import { DAY, MIN, newKey } from "./util.ts";
import type { Data, GameRoom } from "./room.ts";

/** Chat-Aufbewahrung nach Spielende (F3) */
export const CHAT_KEEP_MS = 30 * DAY;

/** Neuester Standort eines Trackers in der Fahne (die Fahne ist immer bei Mister X) */
export const flagTracker = (d: Data): Position | undefined =>
  Object.values(d.devices)
    .filter((dev) => dev.assign === "fahne" && dev.pos)
    .map((dev) => dev.pos!)
    .sort((a, b) => b.t - a.t)[0];

/**
 * Wo ist Mister X? Quellen nach Abschnitt 4.3: Tracker der Fahne, Mister-X-Handy (bzw. Tracker des Teams), ein Schiri,
 * der der Fahne folgt; sonst der letzte bekannte.
 */
export function locate(d: Data, mrx: string, now: number): { pos: Position; src: ReportSource } | null {
  const following = Object.entries(d.members)
    .filter(([, m]) => m.role === "schiri" && m.followsFlag)
    .map(([uid]) => d.staff[uid])
    .filter((p) => p != null)
    .sort((a, b) => b.t - a.t);
  return bestPosition({ tracker: flagTracker(d), team: d.positions[mrx], schiri: following[0] }, now);
}

/** Meldung schreiben (+ System-Nachricht im Chat). Ohne irgendeinen Standort nur ein Hinweis im Chat. */
export function writeReport(
  room: GameRoom,
  o: { mrx: string; kind: ReportKind; now: number; at?: { pos: Position; src: ReportSource } | null; text?: string },
): string | null {
  const found = o.at === undefined ? locate(room.d, o.mrx, o.now) : o.at;
  const name = room.d.teams[o.mrx]?.name ?? "?";
  if (!found) {
    room.sys(MELDUNG.keinStandort(name), o.now);
    return null;
  }
  const id = newKey();
  const r: Report = { teamId: o.mrx, lat: found.pos.lat, lng: found.pos.lng, t: o.now, posAt: found.pos.t, src: found.src, kind: o.kind };
  const text = o.text ?? MELDUNG.meldung(name, found.src, uhr(found.pos.t));
  room.put("reports", id, r);
  room.sys(text, o.now, { reportId: id });
  room.notify("meldung", { all: true }, PUSH_TITLE.meldung, text);
  return id;
}

/** Bereich jetzt wirklich sperren (sofort oder wenn die Vorwarnung abgelaufen ist) */
export function lockCut(room: GameRoom, id: string, now: number) {
  const cut = room.d.field.cuts[id]!;
  const { [id]: _, ...warn } = room.d.state.warnCuts ?? {};
  room.setState({ ...room.d.state, cuts: { ...room.d.state.cuts, [id]: now }, warnCuts: Object.keys(warn).length ? warn : undefined });
  const text = MELDUNG.gesperrt(cut.short);
  room.put("cutLog", newKey(), { cut: id, locked: true, t: now });
  room.sys(text, now);
  // vor dem Start sperrt die Spielleitung nur vor – dann ohne Benachrichtigung
  if (room.d.state.phase === "laeuft" || room.d.state.phase === "pause")
    room.notify("spielfeld", { all: true }, PUSH_TITLE.spielfeld, text);
}

/** wie lange ein Team an einem Essens-Ort bleiben muss, damit es als Besuch zählt */
export const FOOD_MIN_MS = 10 * MIN;
/** größere Lücke zwischen zwei Standorten = Team war zwischendurch weg */
const FOOD_GAP_MS = 3 * MIN;

export interface Presence {
  spot: number;
  since: number;
  last: number;
  counted: boolean;
}

function foodAdd(room: GameRoom, t: string, add: { visits?: number; ms?: number }) {
  const cur = room.d.secrets.food?.[t] ?? { visits: 0, ms: 0 };
  room.set("secrets", {
    ...room.d.secrets,
    food: { ...room.d.secrets.food, [t]: { visits: cur.visits + (add.visits ?? 0), ms: cur.ms + (add.ms ?? 0) } },
  });
}

/** Aufenthalt beenden: war es ein gültiger Besuch, die Zeit dort gutschreiben */
function foodLeave(room: GameRoom, t: string) {
  const c = room.food.get(t);
  room.food.delete(t);
  if (c?.counted) foodAdd(room, t, { ms: Math.max(0, c.last - c.since) });
}

/**
 * „Futter-Profi“: Standort eines Teams gegen die Essens-Orte des Spielfelds prüfen. Ein Besuch zählt, sobald das Team
 * FOOD_MIN_MS lang am selben Ort war. Gespeichert werden nur Besuche und Zeit, nie der Standort.
 */
export function foodStep(room: GameRoom, t: string, p: Position) {
  const spots = room.d.field.spots;
  if (!spots?.length || p.acc > 40 || p.suspect) return;
  const idx = spots.findIndex((s) => distanceM(p, s) <= s.radiusM);
  const cur = room.food.get(t);
  if (cur && (cur.spot !== idx || p.t - cur.last > FOOD_GAP_MS)) foodLeave(room, t);
  if (idx < 0 || p.t < (room.food.get(t)?.last ?? 0)) return;
  let c = room.food.get(t);
  if (!c) room.food.set(t, (c = { spot: idx, since: p.t, last: p.t, counted: false }));
  c.last = p.t;
  if (!c.counted && p.t - c.since >= FOOD_MIN_MS) {
    c.counted = true;
    foodAdd(room, t, { visits: 1 });
  }
}

/**
 * Spielende-Fenster (Regel 12) in Server-Zeit: ab Start plus Pausen, frühestens/spätestens laut Einstellung.
 * `from` = Beginn der Endphase, die automatisch angekündigt wird.
 */
export function endWindow(d: Data): { from: number; to: number } | null {
  const st = d.state;
  if (!st.startedAt) return null;
  const paused = Object.values(d.pauses).reduce((s, p) => s + ((p.to ?? p.from) - p.from), 0);
  const base = st.startedAt + paused;
  return { from: base + d.config.endMinH * 60 * MIN, to: base + d.config.endMaxH * 60 * MIN };
}

/** Alles erledigen, was jetzt fällig ist (Alarm). Mehrfach aufrufen ist harmlos. */
export function advance(room: GameRoom, now: number): string[] {
  const d = room.d;
  if (d.state.phase !== "laeuft") return [];
  const endAt = d.secrets.endAt;
  if (endAt && endAt <= now) return finish(room, endAt, "zufall") ? ["ende"] : [];
  const done: string[] = [];
  // Endphase: einmal ankündigen, dass das Spiel jetzt jederzeit enden kann (ohne den geheimen Zeitpunkt zu verraten)
  const win = endWindow(d);
  if (win && !d.state.endPhase && win.from <= now) {
    room.setState({ ...d.state, endPhase: now });
    const text = MELDUNG.endphase(uhr(win.to));
    room.sys(text, now);
    room.notify("spiel", { all: true }, PUSH_TITLE.endphase, text);
    done.push("endphase");
  }
  const st = d.state;
  if (st.nextReportAt && st.nextReportAt <= now && st.mrx) {
    // Regel 5; war der Server länger weg: nicht mehrere Meldungen nachholen
    let next = st.nextReportAt + d.config.intervalMin * MIN;
    if (next <= now) next = now + d.config.intervalMin * MIN;
    room.setState({ ...st, lastReportAt: now, nextReportAt: next });
    writeReport(room, { mrx: st.mrx, kind: "auto", now });
    done.push("meldung");
  }
  // Vorwarnung abgelaufen: Bereich jetzt wirklich sperren
  for (const [id, at] of Object.entries(d.state.warnCuts ?? {}))
    if (at <= now && d.field.cuts[id]) {
      lockCut(room, id, now);
      done.push("sperre");
    }
  // abgelaufene Wartezeiten entfernen und dem Team Bescheid geben
  for (const [t, l] of Object.entries(d.locks))
    if (l.until <= now) {
      room.put("locks", t, null);
      room.notify("wartezeit", { teams: [t] }, PUSH_TITLE.weiter, MELDUNG.warteEnde);
      if (!done.includes("wartezeit")) done.push("wartezeit");
    }
  return done;
}

/** Nächster Termin (Meldung, Ende einer Wartezeit, Spielende) für den Alarm */
export function nextDue(d: Data): number | null {
  if (d.state.phase !== "laeuft") return null;
  const win = endWindow(d);
  const t = Math.min(
    d.state.nextReportAt ?? Infinity,
    d.secrets.endAt ?? Infinity,
    win && !d.state.endPhase ? win.from : Infinity,
    ...Object.values(d.locks).map((l) => l.until),
    ...Object.values(d.state.warnCuts ?? {}),
  );
  return t === Infinity ? null : t;
}

/**
 * Spielende (Abschnitt 6.3): Phase beendet, Auswertung, Archiv (D1), Live-Standorte löschen (Datenschutz).
 * `endedAt` = geheimer Zeitpunkt bzw. Notstopp-Zeit.
 */
export function finish(room: GameRoom, endedAt: number, reason: "zufall" | "notstopp"): boolean {
  const d = room.d;
  const was = d.state;
  if (was.phase !== "laeuft" && was.phase !== "pause") return false;
  // Probelauf: eigene Kennung – taucht im Archiv nicht auf und wird mit der neuen Runde gelöscht
  const run = d.config.trial ? `probe-${newKey()}` : newKey();
  const { pausedAt: _, warnCuts: _w, ...rest } = was;
  room.setState({ ...rest, phase: "beendet", endedAt, run });
  // offene Pause (Notstopp während der Pause) schließen
  for (const [k, ps] of Object.entries(d.pauses)) if (ps.to === undefined) room.put("pauses", k, { ...ps, to: endedAt });
  for (const t of [...room.food.keys()]) foodLeave(room, t);
  const res = results({
    handovers: Object.values(d.handovers),
    startedAt: was.startedAt ?? endedAt,
    endedAt,
    pauses: Object.values(d.pauses),
    distM: Object.fromEntries(Object.entries(d.stats).map(([t, v]) => [t, v.distM])),
    food: room.d.secrets.food ?? {},
  });
  room.sys(MELDUNG.ende(res.winner ? (d.teams[res.winner]?.name ?? "?") : "Niemand"), endedAt);
  room.set("info", { ...d.info!, phase: "beendet" });
  const archive = {
    name: d.info!.name,
    reason,
    startedAt: was.startedAt,
    endedAt,
    results: res,
    teams: d.teams,
    // ohne Vorzustände (prev) – die braucht nur „Rückgängig“
    handovers: Object.fromEntries(Object.entries(d.handovers).map(([k, { prev: _a, prevLocks: _b, ...h }]) => [k, h])),
    reports: Object.fromEntries(Object.entries(d.reports).filter(([, r]) => !r.void)),
    cutLog: d.cutLog,
    pauses: d.pauses,
    field: d.field,
  };
  const chat = d.chat;
  // Datenschutz (Abschnitt 9.2): Live-Standorte sofort löschen, Chat nach der Frist
  room.set("positions", {});
  room.set("staff", {});
  room.set("devices", Object.fromEntries(Object.entries(d.devices).map(([id, { pos: _p, ...dev }]) => [id, dev])));
  room.set("track", {});
  room.set("locks", {});
  // Zählerstände für „Futter-Profi“ stehen jetzt in der Auswertung, hier nicht mehr nötig
  room.set("secrets", { ...room.d.secrets, endAt: undefined, food: undefined });
  room.set("purgeAt", endedAt + CHAT_KEEP_MS);
  room.notify("spiel", { all: true }, PUSH_TITLE.ende, MELDUNG.ende(res.winner ? (d.teams[res.winner]?.name ?? "?") : "Niemand"));
  void room.env.DB.prepare(
    "INSERT INTO archive (game, run, name, startedAt, endedAt, winner, data, chat) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
  )
    .bind(d.gid, run, archive.name, archive.startedAt ?? null, endedAt, res.winner ?? null, JSON.stringify(archive), JSON.stringify(chat))
    .run()
    .catch((e: unknown) => console.error("Archiv", String(e)));
  return true;
}

/** Löschfrist erreicht: Chat und Direktnachrichten des beendeten Laufs leeren */
export function purgeChat(room: GameRoom) {
  room.set("chat", {});
  room.set("dm", {});
  // Notfälle enthalten Standorte – gleiche Frist wie der Chat
  room.set("alerts", {});
  // das Protokoll nennt Namen von Teams und Schiris – gleiche Frist wie der Chat
  room.set("audit", {});
  room.set("purgeAt", null);
}
