// Sitzungen und Geheimnisse (E-33): HMAC-signierte Tokens, Passwörter nur als PBKDF2-Hash, Vergleiche in konstanter Zeit.
const enc = new TextEncoder();

export const b64u = (b: ArrayBuffer | Uint8Array): string =>
  btoa(String.fromCharCode(...new Uint8Array(b)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
export const unb64u = (s: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

export const randomId = (bytes = 16) => b64u(crypto.getRandomValues(new Uint8Array(bytes)));

/** gleich lang und gleicher Inhalt – ohne früh abzubrechen (Workers: timingSafeEqual) */
export function same(a: Uint8Array, b: Uint8Array): boolean {
  return a.byteLength === b.byteLength && crypto.subtle.timingSafeEqual(a, b);
}
export const sameText = (a: string, b: string | undefined) => !!b && same(enc.encode(a), enc.encode(b));

/** Inhalt eines Sitzungs-Tokens: Spiel + Gerät (Rolle steht im Spielraum) oder Organisator mit Passwort-Version */
export type Claims = { g: string; u: string; e: number } | { s: number; e: number };

const keys = new Map<string, Promise<CryptoKey>>();
const hmacKey = (secret: string) => {
  let k = keys.get(secret);
  if (!k) keys.set(secret, (k = crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"])));
  return k;
};

export async function sign(secret: string, c: Claims): Promise<string> {
  const body = b64u(enc.encode(JSON.stringify(c)));
  return `${body}.${b64u(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(body)))}`;
}

/** gültige Unterschrift und nicht abgelaufen → Inhalt, sonst null */
export async function verify(secret: string, token: string | null | undefined): Promise<Claims | null> {
  const [body, sig, extra] = (token ?? "").split(".");
  if (!body || !sig || extra !== undefined) return null;
  try {
    if (!(await crypto.subtle.verify("HMAC", await hmacKey(secret), unb64u(sig), enc.encode(body)))) return null;
    const c = JSON.parse(new TextDecoder().decode(unb64u(body))) as Claims;
    return typeof c.e === "number" && c.e > Date.now() ? c : null;
  } catch {
    return null;
  }
}

/** Höchstwert der Cloudflare-Laufzeit für PBKDF2 (E-33) */
const ITER = 100_000;

async function derive(plain: string, salt: Uint8Array<ArrayBuffer>, iter: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(plain.normalize("NFC")), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, key, 256));
}

export async function hashSecret(plain: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITER}$${b64u(salt)}$${b64u(await derive(plain, salt, ITER))}`;
}

export async function verifySecret(plain: string, stored: string | undefined): Promise<boolean> {
  const [kind, iter, salt, key] = (stored ?? "").split("$");
  if (kind !== "pbkdf2" || !iter || !salt || !key) return false;
  return same(await derive(plain, unb64u(salt), Number(iter)), unb64u(key));
}

/** IP-Adressen nie im Klartext speichern (Rate-Limit-Schlüssel) */
export async function hashKey(s: string): Promise<string> {
  return b64u(await crypto.subtle.digest("SHA-256", enc.encode(s))).slice(0, 22);
}
