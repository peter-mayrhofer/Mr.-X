// Gemeinsame Helfer der Spiel-Server-Aktionen: Datenbank, Fehler, Prüfungen, Protokoll.
import { getApp } from "firebase-admin/app";
import { getDatabaseWithUrl, type Database } from "firebase-admin/database";
import { HttpsError, type CallableRequest, type FunctionsErrorCode } from "firebase-functions/v2/https";
import { GAME_ID, type ApiReason, type Member, type Role } from "@mrx/shared";
import { DATABASE_URL } from "./env.ts";

let _db: Database | undefined;
export const db = () => (_db ??= getDatabaseWithUrl(DATABASE_URL.value(), getApp()));

const CODE: Record<ApiReason, FunctionsErrorCode> = {
  unauthenticated: "unauthenticated",
  invalid: "invalid-argument",
  notFound: "not-found",
  wrongSecret: "permission-denied",
  noTeamPassword: "failed-precondition",
  noSpectators: "failed-precondition",
  tooMany: "resource-exhausted",
  forbidden: "permission-denied",
  exists: "already-exists",
};

/** Ablehnung mit Grund; die App zeigt den passenden Text aus texte.ts */
export function fail(reason: ApiReason, message: string = reason): never {
  throw new HttpsError(CODE[reason], message, { reason });
}

export function uidOf(req: CallableRequest): string {
  if (!req.auth) fail("unauthenticated");
  return req.auth.uid;
}

export const isSuperAdmin = (req: CallableRequest) => req.auth?.token.superAdmin === true;

export function str(v: unknown, [min, max]: readonly [number, number], what: string): string {
  if (typeof v !== "string") fail("invalid", `${what} fehlt`);
  const s = v.trim().replace(/\s+/g, " ");
  if (s.length < min || s.length > max) fail("invalid", `${what}: ${min}–${max} Zeichen`);
  return s;
}

export function gameId(v: unknown): string {
  const g = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (!GAME_ID.test(g)) fail("invalid", "Spiel-Code ungültig");
  return g;
}

export async function member(g: string, uid: string): Promise<Member | null> {
  return (await db().ref(`games/${g}/members/${uid}`).get()).val() as Member | null;
}

/** Nur diese Rollen (oder Super-Admin) dürfen weiter */
export async function requireRole(
  req: CallableRequest,
  g: string,
  roles: Role[],
): Promise<{ uid: string; name: string; role: Role | "superadmin" }> {
  const uid = uidOf(req);
  const m = await member(g, uid);
  if (m && roles.includes(m.role)) return { uid, name: m.name, role: m.role };
  if (isSuperAdmin(req)) return { uid, name: String(req.auth?.token.email ?? "Super-Admin"), role: "superadmin" };
  fail("forbidden");
}

/** Protokoll (Abschnitt 7.7): wer hat wann was ausgelöst */
export function audit(g: string, who: { uid: string; name: string; role: string }, action: string, details = "") {
  return db().ref(`games/${g}/audit`).push({ t: Date.now(), uid: who.uid, name: who.name, role: who.role, action, details });
}
