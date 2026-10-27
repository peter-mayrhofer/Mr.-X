// Gemeinsame Helfer für Tests gegen die Emulatoren (Projekt demo-mrx, E-22).
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabaseWithUrl } from "firebase-admin/database";

export const PROJECT = "demo-mrx";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
process.env.FIREBASE_DATABASE_EMULATOR_HOST ??= "127.0.0.1:9000";
const AUTH = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`;
const API = `http://127.0.0.1:5001/${PROJECT}/europe-west1/api`;

export const admin = getApps()[0] ?? initializeApp({ projectId: PROJECT });
export const db = getDatabaseWithUrl("https://mr-x-ooe-neu.europe-west1.firebasedatabase.app", admin);
export const val = async (path: string) => (await db.ref(path).get()).val();

export interface Res {
  result?: Record<string, unknown>;
  error?: { status: string; message: string; details?: { reason?: string } };
}

export async function call(token: string | null, data: Record<string, unknown>): Promise<Res> {
  const r = await fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ data }),
  });
  const j = (await r.json()) as Res;
  if (process.env.DEBUG_API) console.log(JSON.stringify(data).slice(0, 80), "→", JSON.stringify(j).slice(0, 200));
  return j;
}
export const reason = (r: Res) => r.error?.details?.reason;

/** neues anonymes Gerät (wie ein Handy, das die App öffnet) */
export async function device(): Promise<{ uid: string; token: string }> {
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  const j = (await r.json()) as { localId: string; idToken: string };
  return { uid: j.localId, token: j.idToken };
}

export async function emailUser(email: string, verified: boolean): Promise<{ uid: string; token: () => Promise<string> }> {
  const pw = "geheim123";
  const u = await getAuth(admin).createUser({ email, password: pw, emailVerified: verified });
  const token = async () => {
    const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: pw, returnSecureToken: true }),
    });
    return ((await r.json()) as { idToken: string }).idToken;
  };
  return { uid: u.uid, token };
}

/** Super-Admin mit Claim (Freigabeliste der Emulator-Umgebung: functions/.env.demo-mrx) */
export async function superAdminToken(): Promise<string> {
  const u = await emailUser(`super@test.at`, true).catch(async () => {
    const existing = await getAuth(admin).getUserByEmail("super@test.at");
    await getAuth(admin).deleteUser(existing.uid);
    return emailUser("super@test.at", true);
  });
  await call(await u.token(), { action: "claimSuperAdmin" });
  return u.token();
}

export async function resetEmulators() {
  await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: "DELETE" });
  await db.ref().set(null);
}
