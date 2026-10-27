// Passwörter/Codes nur gehasht speichern (E-06): scrypt mit Salz, Vergleich in konstanter Zeit.
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export async function hashSecret(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(plain.normalize("NFC"), salt, 32);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifySecret(plain: string, stored: string | undefined): Promise<boolean> {
  const [kind, salt, key] = (stored ?? "").split("$");
  if (kind !== "scrypt" || !salt || !key) return false;
  const actual = await scrypt(plain.normalize("NFC"), Buffer.from(salt, "base64"), 32);
  return timingSafeEqual(actual, Buffer.from(key, "base64"));
}

export const sameToken = (a: string, b: string | undefined) =>
  !!b && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export const newToken = () => randomBytes(18).toString("base64url");

/** IP-Adressen nie im Klartext speichern (Rate-Limit-Schlüssel) */
export const hashKey = (s: string) => createHash("sha256").update(s).digest("base64url").slice(0, 22);
