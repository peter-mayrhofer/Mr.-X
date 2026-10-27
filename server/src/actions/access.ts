// Zugang zu einem Spiel: anlegen, Beitritt mit Passwort/Code, Abmelden, Passwörter festlegen, Großbild-Link.
import {
  DEFAULT_CONFIG,
  LIMITS,
  LINZ_INNENSTADT,
  sameName,
  teamColor,
  teamShort,
  type ApiResults,
  type Field,
  type GameInfo,
  type Member,
  type Role,
  type SecretKind,
} from "@mrx/shared";
import { hashKey, hashSecret, randomId, sameText, sign, verifySecret } from "../auth.ts";
import { ensureSchema } from "../d1.ts";
import { DAY, fail, gameId, str } from "../util.ts";
import type { Auth, GameRoom } from "../room.ts";

type D = Record<string, unknown>;

/** Sitzung eines Geräts gilt 7 Tage; widerrufen wird über die Mitgliedschaft im Spielraum (E-33) */
const SESSION_MS = 7 * DAY;
const WINDOW_MS = 10 * 60_000;
/**
 * Rate-Limit für Beitrittsversuche (Abschnitt 9.2): 20 Fehlversuche in 10 Min pro IP und Spiel. Großzügig, weil viele
 * Handys im Mobilfunk dieselbe IP teilen (Carrier-NAT); Passwörter raten geht so trotzdem nicht.
 */
const MAX_FAILS = 20;

const EMPTY_FIELD: Field = { name: "Neues Spielfeld", toleranceM: 20, base: [], cuts: {} };

/** Neues Spiel (Super-Admin). Der Spielraum zum Spiel-Code ist die Autorität – gibt es ihn schon, ist der Code vergeben. */
export async function createGame(room: GameRoom, d: D, a: Auth): Promise<ApiResults["createGame"]> {
  if (!a.superAdmin) fail("forbidden");
  const g = gameId(d.gameId);
  const name = str(d.name, LIMITS.gameName, "Name");
  const pw = typeof d.adminPassword === "string" ? d.adminPassword : "";
  if (pw.length < LIMITS.adminPw || pw.length > 64) fail("invalid", `Admin-Passwort: ${LIMITS.adminPw}–64 Zeichen`);
  if (room.d.info) fail("exists", "Diesen Spiel-Code gibt es schon");
  const hash = await hashSecret(pw);
  if (room.d.info) fail("exists", "Diesen Spiel-Code gibt es schon");
  const now = Date.now();
  await ensureSchema(room.env.DB);
  await room.env.DB.prepare("INSERT OR REPLACE INTO games (id, name, createdAt) VALUES (?1, ?2, ?3)").bind(g, name, now).run();
  room.set("gid", g);
  room.set("info", { name, phase: "vorbereitung", createdAt: now, spectators: DEFAULT_CONFIG.spectators } satisfies GameInfo);
  room.set("config", DEFAULT_CONFIG);
  room.set("field", d.template === "linz" ? LINZ_INNENSTADT : EMPTY_FIELD);
  room.set("state", { phase: "vorbereitung", rev: 0 });
  room.set("secrets", { adminPw: hash, screenKey: randomId(18) });
  room.audit({ uid: "super", name: "Organisator", role: "superadmin" }, "Spiel angelegt", name);
  return { gameId: g };
}

/** öffentlich: Name/Phase für Startseite und QR-Link */
export function gameInfo(room: GameRoom): ApiResults["gameInfo"] {
  if (!room.d.info) fail("notFound", "Spiel nicht gefunden");
  return room.d.info;
}

const ROLES: Role[] = ["team", "schiri", "admin", "screen", "viewer"];

export async function join(room: GameRoom, d: D, a: Auth): Promise<ApiResults["join"]> {
  const info = room.d.info!;
  if (info.archived) fail("archived", "Spiel ist archiviert");
  const role = d.role as Role;
  if (!ROLES.includes(role)) fail("invalid", "Rolle ungültig");
  const secret = typeof d.secret === "string" ? d.secret.slice(0, 200) : "";
  const sec = room.d.secrets;
  const now = Date.now();

  const ipKey = `ip_${await hashKey(a.ip ?? "?")}`;
  const r = room.d.rate[ipKey];
  if (role !== "viewer" && r && now - r.since < WINDOW_MS && r.n >= MAX_FAILS) fail("tooMany", "Zu viele Versuche");

  // Passwort / Code prüfen
  let ok = true;
  if (role === "team") {
    if (!sec.teamPw) fail("noTeamPassword", "Noch kein Team-Passwort festgelegt");
    ok = await verifySecret(secret, sec.teamPw);
  } else if (role === "schiri") ok = await verifySecret(secret, sec.schiriCode);
  // der Organisator öffnet jedes Spiel ohne Admin-Passwort (Abschnitt 5)
  else if (role === "admin") ok = !!a.superAdmin || (await verifySecret(secret, sec.adminPw));
  else if (role === "screen") ok = sameText(secret, sec.screenKey);
  else if (room.d.config.spectators === false) fail("noSpectators", "Zuschauer sind in diesem Spiel nicht vorgesehen");
  if (!ok) {
    const cur = room.d.rate[ipKey];
    room.put("rate", ipKey, !cur || now - cur.since >= WINDOW_MS ? { n: 1, since: now } : { n: cur.n + 1, since: cur.since });
    fail("wrongSecret", "Passwort oder Code falsch");
  }

  const name =
    role === "screen"
      ? "Großbild"
      : role === "viewer"
        ? "Zuschauer"
        : str(d.name, role === "team" ? LIMITS.teamName : LIMITS.personName, "Name");

  // Team finden oder anlegen (der Spielraum macht eins nach dem anderen – zwei Handys erzeugen nie zwei gleiche Teams)
  let teamId: string | undefined;
  if (role === "team") {
    const found = Object.entries(room.d.teams).find(([, t]) => sameName(t.name, name));
    // Ersatzgerät (F14): nur mit ausdrücklicher Bestätigung im selben Team anmelden
    if (found && d.secondDevice !== true) return { status: "teamExists", teamName: found[1].name };
    if (found) teamId = found[0];
    else {
      teamId = randomId(9);
      const list = Object.values(room.d.teams);
      room.put("teams", teamId, {
        name,
        short: teamShort(
          name,
          list.map((t) => t.short),
        ),
        color: teamColor(list.map((t) => t.color)),
      });
    }
  }

  const uid = randomId();
  const m: Member = { role, name, joinedAt: now, ...(teamId ? { teamId } : {}) };
  room.put("members", uid, m);
  room.audit({ uid, name, role }, "Beigetreten", role === "team" ? `Team ${name}` : role);
  const token = await sign(room.env.TOKEN_SECRET, { g: room.d.gid, u: uid, e: now + SESSION_MS });
  return { status: "joined", role, ...(teamId ? { teamId } : {}), token, uid };
}

export function leave(room: GameRoom, _d: D, a: Auth): ApiResults["leave"] {
  const m = a.uid ? room.d.members[a.uid] : undefined;
  if (!m) return {}; // schon weg (entfernt, neue Runde) – nichts zu tun
  room.removeMember(a.uid!, null);
  room.audit({ uid: a.uid!, name: m.name, role: m.role }, "Abgemeldet");
  return {};
}

const MIN: Record<SecretKind, number> = { teamPw: LIMITS.teamPw, schiriCode: LIMITS.schiriCode, adminPw: LIMITS.adminPw };
const LABEL: Record<SecretKind, string> = { teamPw: "Team-Passwort", schiriCode: "Schiri-Code", adminPw: "Admin-Passwort" };

export async function setSecret(room: GameRoom, d: D, a: Auth): Promise<ApiResults["setSecret"]> {
  const who = room.who(a, ["admin"]);
  const kind = d.kind as SecretKind;
  if (!(kind in MIN)) fail("invalid", "Art ungültig");
  const value = d.value;
  if (value === null) {
    if (kind === "adminPw") fail("invalid", "Das Admin-Passwort kann nicht gelöscht werden");
    room.set("secrets", { ...room.d.secrets, [kind]: undefined });
    room.audit(who, `${LABEL[kind]} gelöscht`);
    return {};
  }
  if (typeof value !== "string" || value.length < MIN[kind] || value.length > 64)
    fail("invalid", `${LABEL[kind]}: ${MIN[kind]}–64 Zeichen`);
  const hash = await hashSecret(value);
  room.set("secrets", { ...room.d.secrets, [kind]: hash });
  // Admin-Passwort geändert → alle anderen Admin-Geräte müssen sich neu anmelden (Sitzungen widerrufen)
  if (kind === "adminPw")
    for (const [uid, m] of Object.entries(room.d.members)) if (m.role === "admin" && uid !== who.uid) room.removeMember(uid, "session");
  room.audit(who, `${LABEL[kind]} festgelegt`);
  return {};
}

export function screenLink(room: GameRoom, _d: D, a: Auth): ApiResults["screenLink"] {
  room.who(a, ["admin"]);
  if (!room.d.secrets.screenKey) room.set("secrets", { ...room.d.secrets, screenKey: randomId(18) });
  return { key: room.d.secrets.screenKey! };
}
