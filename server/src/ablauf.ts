// Spielablauf am Server (KONZEPT Abschnitt 5 + 6): Mister X melden, Wartezeiten beenden, Spielende mit Auswertung und
// Archiv. Alle Zeiten sind Server-Zeit. Läuft im Spielraum – eine Sache nach der anderen, darum ohne Transaktionen.
import {
  bestPosition,
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

/** Alles erledigen, was jetzt fällig ist (Alarm). Mehrfach aufrufen ist harmlos. */
export function advance(room: GameRoom, now: number): string[] {
  const d = room.d;
  if (d.state.phase !== "laeuft") return [];
  const endAt = d.secrets.endAt;
  if (endAt && endAt <= now) return finish(room, endAt, "zufall") ? ["ende"] : [];
  const done: string[] = [];
  const st = d.state;
  if (st.nextReportAt && st.nextReportAt <= now && st.mrx) {
    // Regel 5; war der Server länger weg: nicht mehrere Meldungen nachholen
    let next = st.nextReportAt + d.config.intervalMin * MIN;
    if (next <= now) next = now + d.config.intervalMin * MIN;
    room.setState({ ...st, lastReportAt: now, nextReportAt: next });
    writeReport(room, { mrx: st.mrx, kind: "auto", now });
    done.push("meldung");
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
  const t = Math.min(d.state.nextReportAt ?? Infinity, d.secrets.endAt ?? Infinity, ...Object.values(d.locks).map((l) => l.until));
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
  const run = newKey();
  const { pausedAt: _, ...rest } = was;
  room.setState({ ...rest, phase: "beendet", endedAt, run });
  // offene Pause (Notstopp während der Pause) schließen
  for (const [k, ps] of Object.entries(d.pauses)) if (ps.to === undefined) room.put("pauses", k, { ...ps, to: endedAt });
  const res = results({
    handovers: Object.values(d.handovers),
    startedAt: was.startedAt ?? endedAt,
    endedAt,
    pauses: Object.values(d.pauses),
    distM: Object.fromEntries(Object.entries(d.stats).map(([t, v]) => [t, v.distM])),
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
  room.set("secrets", { ...d.secrets, endAt: undefined });
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
  // das Protokoll nennt Namen von Teams und Schiris – gleiche Frist wie der Chat
  room.set("audit", {});
  room.set("purgeAt", null);
}
