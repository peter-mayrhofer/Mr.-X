// Super-Admin (Organisator): Freischaltung per Google-Login + Freigabeliste, Spiele anlegen (Abschnitt 5, E-05).
import { getAuth } from "firebase-admin/auth";
import type { CallableRequest } from "firebase-functions/v2/https";
import {
  DEFAULT_CONFIG,
  LIMITS,
  LINZ_INNENSTADT,
  type ApiResults,
  type Field,
  type GameInfo,
  type GameState,
  type Member,
} from "@mrx/shared";
import { SUPER_ADMINS } from "../env.ts";
import { audit, db, fail, gameId, isSuperAdmin, str, uidOf, val } from "../util.ts";
import { hashSecret, newToken } from "../secrets.ts";

/** Custom Claim `superAdmin` setzen bzw. entfernen – nur für bestätigte E-Mails auf der Freigabeliste */
export async function claimSuperAdmin(req: CallableRequest): Promise<ApiResults["claimSuperAdmin"]> {
  const uid = uidOf(req);
  const email = String(req.auth?.token.email ?? "").toLowerCase();
  const allowed = SUPER_ADMINS.value()
    .split(",")
    .map((e) => e.trim().toLowerCase());
  const ok = !!email && req.auth?.token.email_verified === true && allowed.includes(email);
  if (ok !== isSuperAdmin(req)) await getAuth().setCustomUserClaims(uid, ok ? { superAdmin: true } : null);
  return { superAdmin: ok };
}

const EMPTY_FIELD: Field = { name: "Neues Spielfeld", toleranceM: 20, base: [], cuts: {} };

export async function createGame(req: CallableRequest<Record<string, unknown>>): Promise<ApiResults["createGame"]> {
  const uid = uidOf(req);
  if (!isSuperAdmin(req)) fail("forbidden");
  const d = req.data;
  const g = gameId(d.gameId);
  const name = str(d.name, LIMITS.gameName, "Name");
  const pw = typeof d.adminPassword === "string" ? d.adminPassword : "";
  if (pw.length < LIMITS.adminPw) fail("invalid", `Admin-Passwort: mindestens ${LIMITS.adminPw} Zeichen`);
  const field = d.template === "linz" ? LINZ_INNENSTADT : EMPTY_FIELD;

  const now = Date.now();
  const claimed = await db()
    .ref(`gameIndex/${g}`)
    .transaction((cur) => (cur === null ? { name, createdAt: now, createdBy: uid } : undefined));
  if (!claimed.committed) fail("exists", "Diesen Spiel-Code gibt es schon");

  const info: GameInfo = { name, phase: "vorbereitung", createdAt: now, spectators: DEFAULT_CONFIG.spectators };
  await db()
    .ref()
    .update({
      [`games/${g}/info`]: info,
      [`games/${g}/config`]: DEFAULT_CONFIG,
      [`games/${g}/field`]: field,
      [`games/${g}/state`]: { phase: "vorbereitung" },
      [`secrets/${g}`]: { adminPw: await hashSecret(pw), screenKey: newToken() },
    });
  await audit(g, { uid, name: String(req.auth?.token.email ?? "Super-Admin"), role: "superadmin" }, "Spiel angelegt", name);
  return { gameId: g };
}

const running = async (g: string) => {
  const p = (await val<GameState>(`games/${g}/state`))?.phase;
  return p === "laeuft" || p === "pause";
};

/** Archivieren (Abschnitt 5): Spiel bleibt lesbar (Archiv, Auswertung), aber niemand kann mehr beitreten */
export async function archiveGame(req: CallableRequest<Record<string, unknown>>): Promise<ApiResults["archiveGame"]> {
  const uid = uidOf(req);
  if (!isSuperAdmin(req)) fail("forbidden");
  const g = gameId(req.data.gameId);
  if (!(await val(`gameIndex/${g}`))) fail("notFound", "Spiel nicht gefunden");
  if (await running(g)) fail("wrongPhase", "Zuerst das Spiel beenden");
  const on = req.data.archived !== false;
  await db()
    .ref()
    .update({ [`gameIndex/${g}/archived`]: on || null, [`games/${g}/info/archived`]: on || null });
  await audit(
    g,
    { uid, name: String(req.auth?.token.email ?? "Super-Admin"), role: "superadmin" },
    on ? "Spiel archiviert" : "Spiel reaktiviert",
  );
  return {};
}

/** Endgültig löschen – mit allen Daten inkl. Archiv. Geräte im Spiel bekommen den Hinweis „entfernt“. */
export async function deleteGame(req: CallableRequest<Record<string, unknown>>): Promise<ApiResults["deleteGame"]> {
  if (!isSuperAdmin(req)) fail("forbidden");
  const g = gameId(req.data.gameId);
  if (!(await val(`gameIndex/${g}`))) fail("notFound", "Spiel nicht gefunden");
  if (await running(g)) fail("wrongPhase", "Zuerst das Spiel beenden");
  const members = (await val<Record<string, Member>>(`games/${g}/members`)) ?? {};
  const upd: Record<string, unknown> = { [`games/${g}`]: null, [`secrets/${g}`]: null, [`gameIndex/${g}`]: null, [`running/${g}`]: null };
  for (const uid of Object.keys(members)) upd[`userGames/${uid}`] = { removedFrom: g };
  await db().ref().update(upd);
  return {};
}
