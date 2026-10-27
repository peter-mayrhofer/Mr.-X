// Teams verwalten und neue Runde (Abschnitt 7.7). Entfernte Geräte bekommen über ihre Verbindung den Grund („removed“) –
// die App erklärt ihnen freundlich, was passiert ist, und zeigt die Startseite.
import { LIMITS, sameName, teamShort, type ApiResults } from "@mrx/shared";
import { fail, str } from "../util.ts";
import type { Auth, GameRoom } from "../room.ts";

type D = Record<string, unknown>;

/**
 * Neue Runde (Design: „Alle Teams und Schiris werden abgemeldet, das Team-Passwort wird gelöscht, Spiel, Chat und
 * Standorte werden geleert. Das Archiv bleibt.“). Nur vor dem Start oder nach dem Spielende.
 */
export function resetRound(room: GameRoom, _d: D, a: Auth): ApiResults["resetRound"] {
  const who = room.who(a, ["admin"]);
  const st = room.d.state;
  if (st.phase !== "vorbereitung" && st.phase !== "beendet") fail("wrongPhase", "Zuerst das Spiel beenden");
  for (const [uid, m] of Object.entries(room.d.members)) if (m.role === "team" || m.role === "schiri") room.removeMember(uid, "removed");
  room.setState({ phase: "vorbereitung", rev: st.rev });
  room.set("info", { ...room.d.info!, phase: "vorbereitung" });
  room.set("secrets", { ...room.d.secrets, teamPw: undefined });
  for (const k of ["teams", "reports", "handovers", "locks", "stats", "chat", "dm", "pauses", "cutLog", "positions", "staff", "track"] as const)
    room.set(k, {});
  room.set("purgeAt", null);
  room.audit(who, "Neue Runde vorbereitet");
  return {};
}

export function removeMember(room: GameRoom, d: D, a: Auth): ApiResults["removeMember"] {
  const who = room.who(a, ["admin"]);
  const uid = String(d.uid ?? "");
  const m = room.d.members[uid];
  if (!m) fail("invalid", "Gerät unbekannt");
  room.removeMember(uid, "removed");
  room.audit(who, "Gerät entfernt", `${m.name} (${m.role})`);
  return {};
}

export function removeTeam(room: GameRoom, d: D, a: Auth): ApiResults["removeTeam"] {
  const who = room.who(a, ["admin"]);
  const t = String(d.teamId ?? "");
  const team = room.d.teams[t];
  if (!team) fail("invalid", "Team unbekannt");
  const st = room.d.state;
  if (st.mrx === t && (st.phase === "laeuft" || st.phase === "pause")) fail("conflict", "Mister X kann nicht entfernt werden – zuerst übergeben");
  room.put("teams", t, null);
  room.put("positions", t, null);
  room.put("locks", t, null);
  room.put("track", t, null);
  for (const [uid, m] of Object.entries(room.d.members)) if (m.teamId === t) room.removeMember(uid, "removed");
  room.audit(who, "Team entfernt", team.name);
  return {};
}

export function renameTeam(room: GameRoom, d: D, a: Auth): ApiResults["renameTeam"] {
  const who = room.who(a, ["admin"]);
  const t = String(d.teamId ?? "");
  const name = str(d.name, LIMITS.teamName, "Teamname");
  const team = room.d.teams[t];
  if (!team) fail("invalid", "Team unbekannt");
  const others = Object.entries(room.d.teams).filter(([id]) => id !== t);
  if (others.some(([, o]) => sameName(o.name, name))) fail("exists", "Diesen Teamnamen gibt es schon");
  room.put("teams", t, {
    ...team,
    name,
    short: teamShort(
      name,
      others.map(([, o]) => o.short),
    ),
  });
  // Geräte des Teams tragen den Teamnamen als Namen (Chat, Mitgliederliste)
  for (const [uid, m] of Object.entries(room.d.members)) if (m.teamId === t) room.put("members", uid, { ...m, name });
  room.audit(who, "Team umbenannt", `${team.name} → ${name}`);
  return {};
}
