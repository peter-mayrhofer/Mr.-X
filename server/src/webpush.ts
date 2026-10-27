// Web Push ohne Google-Konto (E-34): Inhalt verschlüsselt nach RFC 8291 (aes128gcm), Absender nach RFC 8292 (VAPID).
// Nur WebCrypto – läuft im Worker und in Node (Test mit dem Beispiel aus RFC 8291, server/test/webpush.test.ts).
import type { PushSub } from "@mrx/shared";
import { b64u, unb64u } from "./auth.ts";

export interface Vapid {
  /** öffentlicher Schlüssel, 65 Bytes (unkomprimierter P-256-Punkt), base64url */
  publicKey: string;
  /** privater Schlüssel d, 32 Bytes, base64url */
  privateKey: string;
  /** Kontakt für die Push-Dienste, z. B. mailto:… */
  subject: string;
}

const enc = new TextEncoder();
const cat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.byteLength, 0));
  let i = 0;
  for (const p of parts) out.set(p, (i += p.byteLength) - p.byteLength);
  return out;
};

/** P-256-Schlüssel als JWK aus den rohen Bytes (öffentlich: 0x04 ‖ x ‖ y) */
function jwk(pub: Uint8Array, d?: Uint8Array): JsonWebKey {
  return { kty: "EC", crv: "P-256", x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), ...(d ? { d: b64u(d) } : {}) };
}

async function hkdf(salt: BufferSource, ikm: BufferSource, info: BufferSource, bytes: number) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, bytes * 8));
}

/** Inhalt für ein Abo verschlüsseln. `salt`/`local` nur für den Test mit festen Werten. */
export async function encrypt(
  sub: PushSub,
  plaintext: string,
  fixed?: { salt: Uint8Array<ArrayBuffer>; local: { pub: Uint8Array; priv: Uint8Array } },
): Promise<Uint8Array> {
  const uaPub = unb64u(sub.keys.p256dh);
  const auth = unb64u(sub.keys.auth);
  const ecdh = { name: "ECDH", namedCurve: "P-256" } as const;
  let asPriv: CryptoKey;
  let asPub: Uint8Array<ArrayBuffer>;
  if (fixed) {
    asPriv = await crypto.subtle.importKey("jwk", jwk(fixed.local.pub, fixed.local.priv), ecdh, false, ["deriveBits"]);
    asPub = new Uint8Array(fixed.local.pub);
  } else {
    const pair = (await crypto.subtle.generateKey(ecdh, true, ["deriveBits"])) as CryptoKeyPair;
    asPriv = pair.privateKey;
    asPub = new Uint8Array((await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer);
  }
  const uaKey = await crypto.subtle.importKey("raw", uaPub, ecdh, false, []);
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey } as unknown as SubtleCryptoDeriveKeyAlgorithm, asPriv, 256));
  const ikm = await hkdf(auth, secret, cat(enc.encode("WebPush: info\0"), uaPub, asPub), 32);
  const salt = fixed?.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  // ein einziger Datensatz: Inhalt ‖ 0x02 (Ende-Markierung)
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, cat(enc.encode(plaintext), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 0x10, 0]); // Datensatzgröße 4096
  return cat(salt, rs, new Uint8Array([asPub.byteLength]), asPub, data);
}

const jwts = new Map<string, { jwt: string; exp: number }>();

/** VAPID-Ausweis für den Push-Dienst (gilt 12 h, wird pro Dienst wiederverwendet) */
export async function vapidHeader(endpoint: string, v: Vapid): Promise<string> {
  const aud = new URL(endpoint).origin;
  const now = Math.floor(Date.now() / 1000);
  let c = jwts.get(aud);
  if (!c || c.exp - now < 3600) {
    const exp = now + 12 * 3600;
    const part = (o: object) => b64u(enc.encode(JSON.stringify(o)));
    const unsigned = `${part({ typ: "JWT", alg: "ES256" })}.${part({ aud, exp, sub: v.subject })}`;
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk(unb64u(v.publicKey), unb64u(v.privateKey)),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(unsigned));
    jwts.set(aud, (c = { jwt: `${unsigned}.${b64u(sig)}`, exp }));
  }
  return `vapid t=${c.jwt}, k=${v.publicKey}`;
}

/** Senden; liefert den HTTP-Status (404/410 = Abo gibt es nicht mehr) */
export async function sendPush(sub: PushSub, payload: string, v: Vapid, topic: string): Promise<number> {
  const r = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidHeader(sub.endpoint, v),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      // ältere Meldungen derselben Art ersetzen; nach 10 Min ist eine Meldung wertlos
      Topic: topic,
      TTL: "600",
      Urgency: "high",
    },
    body: await encrypt(sub, payload),
  });
  return r.status;
}
