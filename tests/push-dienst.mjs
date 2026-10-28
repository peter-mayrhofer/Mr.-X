// Web Push über einen echten Push-Dienst (Definition of Done: „Push kommt auf der installierten PWA an“), der Weg wie im
// Betrieb: Spiel-Server (wrangler dev, OHNE Testmodus, eigener VAPID-Schlüssel) → Durchsage der Spielleitung → der
// Spielraum verschlüsselt per Alarm und schickt → Mozillas Push-Dienst (den nutzt Firefox) → „Browser“.
// Den Browser spielt dieses Skript: Es meldet sich wie Firefox per WebSocket beim Push-Dienst an, gibt das Abo der App,
// empfängt die Nachricht und entschlüsselt sie (RFC 8291). Die Anzeige im Service Worker prüft
// tests/e2e-benachrichtigung.test.ts; die Dienste von Apple und Google (iPhone, Chrome) bleiben dem Feldtest.
// Aufruf im Hauptordner: node tests/push-dienst.mjs (startet den Server selbst, braucht Internet; hinter einem Proxy
// mit NODE_USE_ENV_PROXY=1). Ergebnis: push-ergebnis.md und Ausgabe im Log; Exit-Code 1, wenn etwas nicht klappt.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 8792;
const SERVER = `http://127.0.0.1:${PORT}`;
const PUSH_DIENST = "wss://push.services.mozilla.com/";
const G = "push-dienst";
const TEXT = "Push-Test: Treffpunkt Hauptplatz um 17 Uhr";

const b64u = (b) => Buffer.from(b).toString("base64url");
const text = (s) => new TextEncoder().encode(s);
const cat = (...parts) => new Uint8Array(Buffer.concat(parts));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = [];
const check = (what, ok, detail) => {
  rows.push(`| ${what} | ${ok ? "✔" : "✖"} | ${detail} |`);
  console.log(`${ok ? "✔" : "✖"} ${what}: ${detail}`);
  return ok;
};

async function call(token, data) {
  const r = await fetch(`${SERVER}/api`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(data),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`${data.action}: ${j.message}`);
  return j.result;
}

async function hkdf(salt, ikm, info, bytes) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, bytes * 8));
}

/** aes128gcm entschlüsseln wie ein Browser (RFC 8188 + RFC 8291): Kopf = Salz ‖ Datensatzgröße ‖ Schlüssel des Servers */
async function decrypt(body, ua, uaPub, auth) {
  const salt = body.slice(0, 16);
  const asPub = body.slice(21, 21 + body[20]);
  const asKey = await crypto.subtle.importKey("raw", asPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asKey }, ua.privateKey, 256));
  const ikm = await hkdf(auth, ecdh, cat(text("WebPush: info\0"), uaPub, asPub), 32);
  const cek = await hkdf(salt, ikm, text("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, text("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, body.slice(21 + body[20])));
  let end = plain.length - 1;
  while (end > 0 && plain[end] === 0) end--; // Füllbytes
  if (plain[end] !== 2) throw new Error("Ende-Markierung fehlt");
  return new TextDecoder().decode(plain.slice(0, end));
}

let ok = true;
let server;
let ws;
try {
  // Schlüssel: VAPID für den Server (wie npm run schluessel), P-256 + Auth-Geheimnis für den „Browser“
  const vapid = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
  const VAPID_PUBLIC = b64u(await crypto.subtle.exportKey("raw", vapid.publicKey));
  const VAPID_PRIVATE = (await crypto.subtle.exportKey("jwk", vapid.privateKey)).d;
  const ua = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const uaPub = new Uint8Array(await crypto.subtle.exportKey("raw", ua.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));

  // 1. Spiel-Server wie im Betrieb (kein Testmodus), mit leerem Speicher
  server = spawn(
    "npx",
    [
      "wrangler",
      "dev",
      "-c",
      "server/wrangler.jsonc",
      "--ip",
      "127.0.0.1",
      "--port",
      String(PORT),
      "--persist-to",
      mkdtempSync(join(tmpdir(), "mrx-push-")),
      "--var",
      "TOKEN_SECRET:push-test",
      "--var",
      "SETUP_SECRET:lokal",
      "--var",
      `VAPID_PUBLIC:${VAPID_PUBLIC}`,
      "--var",
      `VAPID_PRIVATE:${VAPID_PRIVATE}`,
    ],
    { stdio: "ignore", env: { ...process.env, WRANGLER_SEND_METRICS: "false" } },
  );
  for (let i = 0; ; i++) {
    if ((await fetch(`${SERVER}/health`).catch(() => null))?.ok) break;
    if (i > 90) throw new Error("Spiel-Server startet nicht");
    await sleep(1000);
  }

  // 2. „Browser“ meldet sich beim Push-Dienst an – das Abo gilt nur für den VAPID-Schlüssel unseres Servers
  ws = new WebSocket(PUSH_DIENST);
  const inbox = [];
  ws.onmessage = (e) => inbox.push(JSON.parse(String(e.data)));
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error("Push-Dienst nicht erreichbar"));
  });
  const next = async (type, ms) => {
    for (const end = Date.now() + ms; Date.now() < end; await sleep(200)) {
      const i = inbox.findIndex((m) => m.messageType === type);
      if (i >= 0) return inbox.splice(i, 1)[0];
    }
    throw new Error(`Zeitüberschreitung beim Push-Dienst: ${type}`);
  };
  ws.send(JSON.stringify({ messageType: "hello", use_webpush: true }));
  await next("hello", 15_000);
  ws.send(JSON.stringify({ messageType: "register", channelID: crypto.randomUUID(), key: VAPID_PUBLIC }));
  const reg = await next("register", 15_000);
  if (reg.status !== 200 || !reg.pushEndpoint) throw new Error(`Anmeldung beim Push-Dienst: ${JSON.stringify(reg)}`);
  ok = check("Abo beim Push-Dienst", true, new URL(reg.pushEndpoint).host) && ok;

  // 3. Spiel anlegen, Team-Handy gibt sein Abo (wie die App nach „Benachrichtigungen erlauben“) und ist nicht online
  const sa = await call(null, { action: "superSetup", setupSecret: "lokal", password: "push-test-123" });
  await call(sa.token, { action: "createGame", gameId: G, name: "Push-Test", template: "linz", adminPassword: "admin1234" });
  const admin = await call(null, { action: "join", gameId: G, role: "admin", name: "Peter", secret: "admin1234" });
  await call(admin.token, { action: "setSecret", gameId: G, kind: "teamPw", value: "falke27" });
  const team = await call(null, { action: "join", gameId: G, role: "team", name: "Urfahr", secret: "falke27" });
  const sub = { endpoint: reg.pushEndpoint, keys: { p256dh: b64u(uaPub), auth: b64u(auth) } };
  await call(team.token, { action: "pushSubscribe", gameId: G, sub, prefs: {} });

  // 4. Durchsage → Server → Push-Dienst → „Browser“
  const t0 = Date.now();
  await call(admin.token, { action: "announce", gameId: G, text: TEXT });
  const n = await next("notification", 60_000);
  ws.send(JSON.stringify({ messageType: "ack", updates: [{ channelID: n.channelID, version: n.version }] }));
  ok = check("Durchsage über den Push-Dienst zugestellt", true, `nach ${((Date.now() - t0) / 1000).toFixed(1)} s`) && ok;
  const msg = JSON.parse(await decrypt(new Uint8Array(Buffer.from(n.data, "base64url")), ua, uaPub, auth));
  ok =
    check(
      "Inhalt entschlüsselt (wie im Browser)",
      msg.title === "Durchsage" && msg.body === TEXT && msg.kind === "durchsage",
      `„${msg.title}: ${msg.body}“`,
    ) && ok;
} catch (e) {
  ok = false;
  console.error(e);
  rows.push(`| Abbruch | ✖ | ${String(e).replace(/\|/g, "/")} |`);
} finally {
  ws?.close();
  server?.kill();
}
writeFileSync(
  "push-ergebnis.md",
  [
    "# Web Push über einen echten Push-Dienst",
    "",
    `${new Date().toISOString()} · Spiel-Server (wrangler dev, ohne Testmodus) → Mozilla-Push-Dienst → Browser-Ersatz`,
    "",
    "| Prüfung | Ergebnis | Details |",
    "|---|---|---|",
    ...rows,
    "",
  ].join("\n"),
);
process.exit(ok ? 0 : 1);
