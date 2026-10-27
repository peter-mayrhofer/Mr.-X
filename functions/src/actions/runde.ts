// Teams verwalten und neue Runde (Abschnitt 7.7). Entfernte Geräte bekommen userGames/{uid}.removedFrom –
// die App erklärt ihnen freundlich, was passiert ist, und zeigt die Startseite.
import type { CallableRequest } from "firebase-functions/v2/https";
import { LIMITS, sameName, teamShort, type ApiResults, type GameState, type Member } from "@mrx/shared";
import { audit, db, fail, gameId, requireRole, str, val } from "../util.ts";
import { changeState, teams } from "../ablauf.ts";

type Req = CallableRequest<Record<string, unknown>>;

const members = async (g: string) => (await val<Record<string, Member>>(`games/${g}/members`)) ?? {};

/** Schreibvorgänge, die ein Gerät aus dem Spiel nehmen */
const removal = (g: string, uid: string) => ({
  [`games/${g}/members/${uid}`]: null,
  [`games/${g}/push/${uid}`]: null,
  [`games/${g}/staffPos/${uid}`]: null,
  [`userGames/${uid}`]: { removedFrom: g },
});

/**
 * Neue Runde (Design: „Alle Teams und Schiris werden abgemeldet, das Team-Passwort wird gelöscht, Spiel, Chat und
 * Standorte werden geleert. Das Archiv bleibt.“). Nur vor dem Start oder nach dem Spielende.
 */
export async function resetRound(req: Req): Promise<ApiResults["resetRound"]> {
  const g = gameId(req.data.gameId);
  const who = await requireRole(req, g, ["admin"]);
  const s = await changeState(g, (cur) =>
    cur.phase === "vorbereitung" || cur.phase === "beendet" ? ({ phase: "vorbereitung", rev: cur.rev } satisfies GameState) : undefined,
  );
  if (!s) fail("wrongPhase", "Zuerst das Spiel beenden");
  const p = `games/${g}`;
  const upd: Record<string, unknown> = { [`${p}/info/phase`]: "vorbereitung", [`secrets/${g}/teamPw`]: null };
  for (const k of [
    "teams",
    "reports",
    "handovers",
    "locks",
    "stats",
    "chat",
    "dm",
    "pauses",
    "cutLog",
    "pos",
    "staffPos",
    "trackerPos",
    "track",
    "rate",
  ])
    upd[`${p}/${k}`] = null;
  for (const [uid, m] of Object.entries(await members(g)))
    if (m.role === "team" || m.role === "schiri")
      Object.assign(upd, { [`${p}/members/${uid}`]: null, [`${p}/push/${uid}`]: null, [`userGames/${uid}`]: { removedFrom: g } });
  await db().ref().update(upd);
  await audit(g, who, "Neue Runde vorbereitet");
  return {};
}

export async function removeMember(req: Req): Promise<ApiResults["removeMember"]> {
  const g = gameId(req.data.gameId);
  const who = await requireRole(req, g, ["admin"]);
  const uid = String(req.data.uid ?? "");
  const m = (await members(g))[uid];
  if (!m) fail("invalid", "Gerät unbekannt");
  await db().ref().update(removal(g, uid));
  await audit(g, who, "Gerät entfernt", `${m.name} (${m.role})`);
  return {};
}

export async function removeTeam(req: Req): Promise<ApiResults["removeTeam"]> {
  const g = gameId(req.data.gameId);
  const who = await requireRole(req, g, ["admin"]);
  const t = String(req.data.teamId ?? "");
  const [ts, ms, st] = await Promise.all([teams(g), members(g), val<GameState>(`games/${g}/state`)]);
  if (!ts[t]) fail("invalid", "Team unbekannt");
  if (st?.mrx === t && (st.phase === "laeuft" || st.phase === "pause"))
    fail("conflict", "Mister X kann nicht entfernt werden – zuerst übergeben");
  const upd: Record<string, unknown> = {
    [`games/${g}/teams/${t}`]: null,
    [`games/${g}/pos/${t}`]: null,
    [`games/${g}/locks/${t}`]: null,
    [`games/${g}/track/${t}`]: null,
  };
  for (const [uid, m] of Object.entries(ms)) if (m.teamId === t) Object.assign(upd, removal(g, uid));
  await db().ref().update(upd);
  await audit(g, who, "Team entfernt", ts[t].name);
  return {};
}

export async function renameTeam(req: Req): Promise<ApiResults["renameTeam"]> {
  const g = gameId(req.data.gameId);
  const who = await requireRole(req, g, ["admin"]);
  const t = String(req.data.teamId ?? "");
  const name = str(req.data.name, LIMITS.teamName, "Teamname");
  const [ts, ms] = await Promise.all([teams(g), members(g)]);
  const team = ts[t];
  if (!team) fail("invalid", "Team unbekannt");
  const others = Object.entries(ts).filter(([id]) => id !== t);
  if (others.some(([, o]) => sameName(o.name, name))) fail("exists", "Diesen Teamnamen gibt es schon");
  const upd: Record<string, unknown> = {
    [`games/${g}/teams/${t}/name`]: name,
    [`games/${g}/teams/${t}/short`]: teamShort(
      name,
      others.map(([, o]) => o.short),
    ),
  };
  // Chat-Regeln prüfen den Namen am Mitglied → mitändern
  for (const [uid, m] of Object.entries(ms)) if (m.teamId === t) upd[`games/${g}/members/${uid}/name`] = name;
  await db().ref().update(upd);
  await audit(g, who, "Team umbenannt", `${team.name} → ${name}`);
  return {};
}
