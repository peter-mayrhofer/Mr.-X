// Web Push über echte Push-Dienste (Definition of Done: „Push kommt auf der installierten PWA an“), der Weg wie im
// Betrieb: Spiel-Server (wrangler dev, OHNE Testmodus, eigener VAPID-Schlüssel, liefert auch die gebaute App aus) →
// Durchsage der Spielleitung → der Spielraum verschlüsselt per Alarm und schickt →
//   A. Mozillas Push-Dienst (den nutzt Firefox): dieses Skript meldet sich wie Firefox per WebSocket an, gibt das Abo
//      der App, empfängt die Nachricht und entschlüsselt sie (RFC 8291),
//   B. Googles Push-Dienst (FCM, den nutzt Chrome): echtes Google Chrome mit der echten App – die App legt ihr Abo selbst
//      an, wird geschlossen, und der Service Worker der App zeigt die Durchsage als Benachrichtigung.
// Nur Apples Dienst (iPhone) braucht ein echtes Gerät und bleibt dem Feldtest.
// Aufruf im Hauptordner nach `npm run build`: node tests/push-dienst.mjs (startet den Server selbst, braucht Internet;
// hinter einem Proxy mit NODE_USE_ENV_PROXY=1; Chrome aus CHROME_PATH oder /usr/bin/google-chrome).
// Ergebnis: push-ergebnis.md und Ausgabe im Log; Exit-Code 1, wenn etwas nicht klappt.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 8792;
const SERVER = `http://127.0.0.1:${PORT}`;
const PUSH_DIENST = "wss://push.services.mozilla.com/";
const G = "push-dienst";
const TEXT = "Push-Test: Treffpunkt Hauptplatz um 17 Uhr";
const TEXT_CHROME = "Push-Test: Chrome bekommt die Durchsage";
const CHROME = process.env.CHROME_PATH ?? ["/usr/bin/google-chrome", "/opt/google/chrome/chrome"].find((p) => existsSync(p));
const { chromium } = createRequire(import.meta.url)("playwright");
const { T } = await import("../app/src/texte.ts"); // Node entfernt die Typen selbst

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
let chrome;

/** Verbindung von Chrome zu Googles Push-Dienst (chrome://gcm-internals) – zeigt, woran es hängt, wenn nichts ankommt */
async function gcm() {
  const p = await chrome.newPage();
  try {
    await p.goto("chrome://gcm-internals");
    await p.waitForTimeout(500);
    const t = await p.locator("body").innerText();
    const field = (name) => t.match(new RegExp(`${name}\\t([^\\n]*)`))?.[1] || "–";
    const rows = (from, to) => (t.split(from)[1] ?? "").split(to)[0].trim().split("\n").length - 1;
    return `Verbindung ${field("Connection State")}, Check-in ${field("Last Checkin")}, empfangen ${rows("Receive Message Log", "Message Decryption")}`;
  } finally {
    await p.close();
  }
}
try {
  // Schlüssel: VAPID für den Server (wie npm run schluessel), P-256 + Auth-Geheimnis für den „Browser“
  const vapid = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
  const VAPID_PUBLIC = b64u(await crypto.subtle.exportKey("raw", vapid.publicKey));
  const VAPID_PRIVATE = (await crypto.subtle.exportKey("jwk", vapid.privateKey)).d;
  const ua = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const uaPub = new Uint8Array(await crypto.subtle.exportKey("raw", ua.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));

  // 1. Spiel-Server wie im Betrieb (kein Testmodus), mit leerem Speicher; der Worker braucht den App-Ordner
  mkdirSync("app/dist", { recursive: true });
  const log = openSync("push-server.log", "w");
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
    // eigene Prozessgruppe: npx → wrangler → workerd lassen sich am Ende gemeinsam beenden
    { stdio: ["ignore", log, log], detached: true, env: { ...process.env, WRANGLER_SEND_METRICS: "false" } },
  );
  for (let i = 0; ; i++) {
    if ((await fetch(`${SERVER}/health`).catch(() => null))?.ok) break;
    if (i > 90) throw new Error(`Spiel-Server startet nicht:\n${readFileSync("push-server.log", "utf8").slice(-2000)}`);
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

  // 5. Web-App in Google Chrome: Benachrichtigungen erlaubt (wie nach „Erlauben“ – Chromes Push prüft die
  // Profil-Einstellung), Team tritt bei, die App legt ihr Abo bei Googles Push-Dienst selbst an
  if (!CHROME) throw new Error("Google Chrome nicht gefunden (CHROME_PATH)");
  const traun = await call(null, { action: "join", gameId: G, role: "team", name: "Traun", secret: "falke27" });
  const profil = mkdtempSync(join(tmpdir(), "mrx-chrome-"));
  mkdirSync(join(profil, "Default"));
  const erlaubt = { [`${SERVER},*`]: { last_modified: "13300000000000000", setting: 1 } };
  writeFileSync(
    join(profil, "Default", "Preferences"),
    JSON.stringify({ profile: { content_settings: { exceptions: { notifications: erlaubt } } } }),
  );
  chrome = await chromium.launchPersistentContext(profil, { executablePath: CHROME, headless: true, locale: "de-AT" });
  const page = chrome.pages()[0] ?? (await chrome.newPage());
  await page.goto(`${SERVER}/`);
  // angemeldet wie nach dem Beitritt über die Oberfläche (den prüfen die Browser-Tests)
  await page.evaluate(
    ([s, p]) => {
      localStorage.setItem("mrx.sitzung", s);
      localStorage.setItem("mrx.prefs", p);
    },
    [
      JSON.stringify({ gameId: G, token: traun.token, uid: traun.uid, role: "team" }),
      JSON.stringify({ sound: false, wake: false, onboarded: true, background: true }),
    ],
  );
  await page.reload();
  await page.getByText(`${T.lobby.check.push}: ${T.lobby.gut}`).first().waitFor({ timeout: 60_000 });
  const endpoint = await page.evaluate(
    async () => (await (await navigator.serviceWorker.ready).pushManager.getSubscription())?.endpoint ?? "",
  );
  ok =
    check("Web-App in Chrome: Abo bei Googles Push-Dienst", endpoint.startsWith("https://fcm.googleapis.com/"), new URL(endpoint).host) &&
    ok;

  // 6. App schließen (kein sichtbares Fenster mehr), Durchsage → Server → Google → Chrome → Service Worker der App
  await page.goto("about:blank");
  await sleep(2000);
  const t1 = Date.now();
  await call(admin.token, { action: "announce", gameId: G, text: TEXT_CHROME });
  // nachsehen, ohne ein App-Fenster zu öffnen (dann würde der Service Worker die Benachrichtigung auslassen)
  let shown = [];
  // Chrome baut seine Verbindung zu Google nach dem Start erst auf – darum großzügig warten
  for (let i = 0; i < 360 && !shown.some((x) => x.includes(TEXT_CHROME)); i++, await sleep(500)) {
    for (const w of chrome.serviceWorkers())
      shown = await w
        .evaluate(async () => (await self.registration.getNotifications()).map((n) => `${n.title}: ${n.body}`))
        .catch(() => shown);
    if (i % 20 === 0) console.log(`  … ${Math.round((Date.now() - t1) / 1000)} s: ${await gcm()}`);
  }
  // zur Sicherheit am Ende auch über ein App-Fenster nachsehen (jetzt darf eins offen sein)
  if (!shown.some((x) => x.includes(TEXT_CHROME))) {
    await page.goto(`${SERVER}/`);
    shown = await page.evaluate(async () =>
      (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => `${n.title}: ${n.body}`),
    );
  }
  const da = shown.find((x) => x.includes(TEXT_CHROME));
  ok =
    check(
      "Durchsage über Googles Push-Dienst als Benachrichtigung der Web-App",
      !!da,
      da ? `„${da}“ nach ${((Date.now() - t1) / 1000).toFixed(1)} s` : `nicht angezeigt (${await gcm()})`,
    ) && ok;
} catch (e) {
  ok = false;
  console.error(e);
  rows.push(`| Abbruch | ✖ | ${String(e).replace(/\|/g, "/")} |`);
} finally {
  if (!ok && existsSync("push-server.log"))
    console.log(`Protokoll des Spiel-Servers (Ende):\n${readFileSync("push-server.log", "utf8").slice(-3000)}`);
  ws?.close();
  await chrome?.close();
  if (server) process.kill(-server.pid);
}
writeFileSync(
  "push-ergebnis.md",
  [
    "# Web Push über echte Push-Dienste",
    "",
    `${new Date().toISOString()} · Spiel-Server (wrangler dev, ohne Testmodus) → Mozilla bzw. Google (${CHROME ? execFileSync(CHROME, ["--version"], { encoding: "utf8" }).trim() : "–"})`,
    "",
    "| Prüfung | Ergebnis | Details |",
    "|---|---|---|",
    ...rows,
    "",
  ].join("\n"),
);
process.exit(ok ? 0 : 1);
