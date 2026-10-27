// Zugang zu einem Spiel: Beitritt mit Passwort/Code, Abmelden, Passwörter festlegen, Großbild-Link.
import type { CallableRequest } from "firebase-functions/v2/https";
import { LIMITS, sameName, teamColor, teamShort, type ApiResults, type Member, type Role, type SecretKind, type Team } from "@mrx/shared";
import { audit, db, fail, gameId, isSuperAdmin, requireRole, str, uidOf } from "../util.ts";
import { hashKey, hashSecret, newToken, sameToken, verifySecret } from "../secrets.ts";

const WINDOW_MS = 10 * 60_000;
/**
 * Rate-Limit für Beitrittsversuche (Abschnitt 9.2): 5 Fehlversuche in 10 Min pro Gerät, 30 pro IP.
 * Pro IP großzügiger, weil viele Handys im Mobilfunk dieselbe IP teilen (Carrier-NAT); anonyme Konten
 * sind billig, deshalb braucht es die IP-Grenze trotzdem.
 */
const maxFails = (key: string) => (key.startsWith("ip_") ? 30 : 5);

async function tooMany(keys: string[]): Promise<boolean> {
  const now = Date.now();
  const snaps = await Promise.all(keys.map((k) => db().ref(`rate/join/${k}`).get()));
  return snaps.some((s, i) => {
    const v = s.val() as { n: number; since: number } | null;
    return !!v && now - v.since < WINDOW_MS && v.n >= maxFails(keys[i]!);
  });
}

function countFail(keys: string[]) {
  const now = Date.now();
  return Promise.all(
    keys.map((k) =>
      db()
        .ref(`rate/join/${k}`)
        .transaction((v: { n: number; since: number } | null) =>
          !v || now - v.since >= WINDOW_MS ? { n: 1, since: now } : { n: v.n + 1, since: v.since },
        ),
    ),
  );
}

const ROLES: Role[] = ["team", "schiri", "admin", "screen", "viewer"];

export async function join(req: CallableRequest<Record<string, unknown>>): Promise<ApiResults["join"]> {
  const uid = uidOf(req);
  const d = req.data;
  const g = gameId(d.gameId);
  const role = d.role as Role;
  if (!ROLES.includes(role)) fail("invalid", "Rolle ungültig");
  const secret = typeof d.secret === "string" ? d.secret : "";

  const [infoSnap, secSnap, cfgSnap] = await Promise.all([
    db().ref(`games/${g}/info`).get(),
    db().ref(`secrets/${g}`).get(),
    db().ref(`games/${g}/config/spectators`).get(),
  ]);
  if (!infoSnap.exists()) fail("notFound", "Spiel nicht gefunden");
  if ((infoSnap.val() as { archived?: boolean }).archived) fail("archived", "Spiel ist archiviert");
  const sec = (secSnap.val() ?? {}) as Partial<Record<SecretKind | "screenKey", string>>;

  const keys = [`u_${uid}`, `ip_${hashKey(req.rawRequest?.ip ?? "?")}`];
  if (role !== "viewer" && (await tooMany(keys))) fail("tooMany", "Zu viele Versuche");

  // Passwort / Code prüfen
  let ok = true;
  if (role === "team") {
    if (!sec.teamPw) fail("noTeamPassword", "Noch kein Team-Passwort festgelegt");
    ok = await verifySecret(secret, sec.teamPw);
  } else if (role === "schiri") ok = await verifySecret(secret, sec.schiriCode);
  // der Organisator öffnet jedes Spiel ohne Admin-Passwort (Abschnitt 5)
  else if (role === "admin") ok = isSuperAdmin(req) || (await verifySecret(secret, sec.adminPw));
  else if (role === "screen") ok = sameToken(secret, sec.screenKey);
  else if (cfgSnap.val() === false) fail("noSpectators", "Zuschauer sind in diesem Spiel nicht vorgesehen");
  if (!ok) {
    await countFail(keys);
    fail("wrongSecret", "Passwort oder Code falsch");
  }

  const name =
    role === "screen"
      ? "Großbild"
      : role === "viewer"
        ? "Zuschauer"
        : str(d.name, role === "team" ? LIMITS.teamName : LIMITS.personName, "Name");

  // Team finden oder anlegen – als Transaktion, damit zwei Handys mit gleichem Namen nicht zwei Teams erzeugen
  let teamId: string | undefined;
  if (role === "team") {
    let exists = false;
    const newId = db().ref(`games/${g}/teams`).push().key!;
    await db()
      .ref(`games/${g}/teams`)
      .transaction((teams: Record<string, Team> | null) => {
        const all = teams ?? {};
        const found = Object.entries(all).find(([, t]) => sameName(t.name, name));
        exists = !!found;
        if (found) {
          teamId = found[0];
          return undefined; // nichts ändern
        }
        teamId = newId;
        const list = Object.values(all);
        return {
          ...all,
          [newId]: {
            name,
            short: teamShort(
              name,
              list.map((t) => t.short),
            ),
            color: teamColor(list.map((t) => t.color)),
          },
        };
      });
    // Ersatzgerät (F14): nur mit ausdrücklicher Bestätigung im selben Team anmelden
    if (exists && d.secondDevice !== true) return { status: "teamExists", teamName: name };
  }

  // Ein Gerät ist immer nur in einem Spiel
  const prev = (await db().ref(`userGames/${uid}`).get()).val() as { gameId: string } | null;
  const m: Member = { role, name, joinedAt: Date.now(), ...(teamId ? { teamId } : {}) };
  await db()
    .ref()
    .update({
      ...(prev && prev.gameId !== g ? { [`games/${prev.gameId}/members/${uid}`]: null } : {}),
      [`games/${g}/members/${uid}`]: m,
      [`userGames/${uid}`]: { gameId: g, role },
      [`rate/join/u_${uid}`]: null,
    });
  await audit(g, { uid, name, role }, "Beigetreten", role === "team" ? `Team ${name}` : role);
  return { status: "joined", role, ...(teamId ? { teamId } : {}) };
}

export async function leave(req: CallableRequest<Record<string, unknown>>): Promise<ApiResults["leave"]> {
  const uid = uidOf(req);
  // ohne Spiel-Code: nur den Hinweis „ihr wurdet entfernt“ quittieren
  if (!req.data.gameId) {
    await db().ref(`userGames/${uid}`).remove();
    return {};
  }
  const g = gameId(req.data.gameId);
  const m = (await db().ref(`games/${g}/members/${uid}`).get()).val() as Member | null;
  await db()
    .ref()
    .update({ [`games/${g}/members/${uid}`]: null, [`userGames/${uid}`]: null });
  if (m) await audit(g, { uid, name: m.name, role: m.role }, "Abgemeldet");
  return {};
}

const MIN: Record<SecretKind, number> = { teamPw: LIMITS.teamPw, schiriCode: LIMITS.schiriCode, adminPw: LIMITS.adminPw };
const LABEL: Record<SecretKind, string> = { teamPw: "Team-Passwort", schiriCode: "Schiri-Code", adminPw: "Admin-Passwort" };

export async function setSecret(req: CallableRequest<Record<string, unknown>>): Promise<ApiResults["setSecret"]> {
  const g = gameId(req.data.gameId);
  const who = await requireRole(req, g, ["admin"]);
  const kind = req.data.kind as SecretKind;
  if (!(kind in MIN)) fail("invalid", "Art ungültig");
  const value = req.data.value;
  if (value === null) {
    if (kind === "adminPw") fail("invalid", "Das Admin-Passwort kann nicht gelöscht werden");
    await db().ref(`secrets/${g}/${kind}`).remove();
    await audit(g, who, `${LABEL[kind]} gelöscht`);
    return {};
  }
  if (typeof value !== "string" || value.length < MIN[kind] || value.length > 64)
    fail("invalid", `${LABEL[kind]}: ${MIN[kind]}–64 Zeichen`);
  await db()
    .ref(`secrets/${g}/${kind}`)
    .set(await hashSecret(value));
  await audit(g, who, `${LABEL[kind]} festgelegt`);
  return {};
}

export async function screenLink(req: CallableRequest<Record<string, unknown>>): Promise<ApiResults["screenLink"]> {
  const g = gameId(req.data.gameId);
  await requireRole(req, g, ["admin"]);
  const res = await db()
    .ref(`secrets/${g}/screenKey`)
    .transaction((k: string | null) => k ?? newToken());
  return { key: String(res.snapshot.val()) };
}
