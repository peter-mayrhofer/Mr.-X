// Gerätetest im Android-Emulator (CI: .github/workflows/android.yml, Job „emulator“). Die Test-APK spielt gegen den
// lokalen Spiel-Server (wrangler dev, über `adb reverse` als 127.0.0.1:8787 erreichbar). Nachweis für die Definition
// of Done (PROMPT-NEUBAU §13):
//   1. Standort kommt an, solange die App offen ist (Live-Verbindung),
//   2. App im Hintergrund (Home-Taste), dann Spielstart: neue Standorte kommen weiter an (Vordergrund-Dienst +
//      natives HTTP) – auch der Spielbeginn darf den Dienst nicht anhalten,
//   3. Bildschirm aus (Handy in der Hosentasche): neue Standorte kommen weiter an,
//   4. eine Durchsage erscheint als Android-Benachrichtigung, während der Bildschirm aus ist.
// Ergebnis: android-ergebnis.md (mit Verlauf alle 5 s), logcat.txt, geraet.txt (Artefakt); Exit-Code 1 bei Fehlern.
import { execFileSync, spawnSync } from "node:child_process";
import { openSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const { _android: android } = createRequire(import.meta.url)("playwright");
const SERVER = "http://127.0.0.1:8787";
const PKG = "at.rotefalken.misterx";
const G = "emulator";
const START = { lat: 48.3059, lng: 14.2862 }; // Hauptplatz
const STEP = 0.000225; // ≈ 25 m nach Süden pro Schritt (Landstraße entlang, bleibt im Spielfeld)
const DURCHSAGE = "Emulator-Test: Treffpunkt Hauptplatz";

const rows = [];
const check = (what, ok, detail) => {
  rows.push(`| ${what} | ${ok ? "✔" : "✖"} | ${detail} |`);
  console.log(`${ok ? "✔" : "✖"} ${what}: ${detail}`);
  return ok;
};
const adb = (...a) => execFileSync("adb", a, { encoding: "utf8" }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Standort des Emulators setzen (Reihenfolge bei geo fix: Länge, Breite) */
const geo = (lat, lng) => adb("emu", "geo", "fix", String(lng), String(lat));
const pidof = (name) => {
  try {
    return adb("shell", "pidof", name);
  } catch {
    return ""; // Prozess läuft nicht
  }
};
const wake = () => adb("shell", "dumpsys", "power").match(/mWakefulness=(\w+)/)?.[1] ?? "?";
const verlauf = [];

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
/** Spielraum direkt lesen (nur mit TEST_HOOKS, wie in den Server-Tests) */
async function val(path) {
  const r = await fetch(`${SERVER}/__test/room`, { method: "POST", body: JSON.stringify({ g: G, op: "get", path }) });
  return (await r.json()).result ?? null;
}
async function until(what, fn, ms) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`Zeitüberschreitung: ${what}`);
    await sleep(1000);
  }
}

/**
 * Nach dem Kaltstart arbeiten System und Google Play-Dienste minutenlang. Auf dem kleinen CI-Rechner (2 Kerne) reagieren
 * sie dann nicht mehr (ANR), Android beendet sie – und der GPS-Teil des Emulators verklemmt sich (Watchdog startet das
 * System neu). Darum: Apps abschalten, die mit dem Spiel nichts zu tun haben, und warten, bis die CPU zur Ruhe kommt.
 */
async function settle(maxMs) {
  for (const p of [
    "com.google.android.googlequicksearchbox",
    "com.google.android.apps.wellbeing",
    "com.google.android.as",
    "com.google.android.tts",
  ]) {
    try {
      adb("shell", "pm", "disable-user", "--user", "0", p);
    } catch {
      /* gibt es in diesem Image nicht */
    }
  }
  const t0 = Date.now();
  for (;;) {
    let m = null;
    try {
      m = adb("shell", "cat", "/proc/pressure/cpu").match(/some avg10=([\d.]+) avg60=([\d.]+)/);
    } catch {
      /* nicht lesbar: dann feste Wartezeit */
    }
    const s = Math.round((Date.now() - t0) / 1000);
    if (!m) {
      if (s >= 150) return `nach ${s} s (feste Wartezeit, CPU-Druck nicht lesbar)`;
    } else if ((Number(m[1]) < 20 && Number(m[2]) < 30) || Date.now() - t0 > maxMs)
      return `nach ${s} s (CPU-Druck ${m[1]} % / ${m[2]} % in 10 s / 60 s)`;
    await sleep(5000);
  }
}

/**
 * `steps` Schritte zu 5 s die Landstraße entlang, ab Schritt `from`. Liefert die neuen Standorte am Server, die Strecke
 * seit dem ersten Schritt und ob der Bildschirm aus blieb; schreibt den Verlauf (Bildschirm, Android-System, App) mit.
 */
async function walk(label, teamId, from, steps, sys0) {
  const t0 = Date.now();
  const seen = [];
  let stayedOff = true;
  for (let i = from; i < from + steps; i++) {
    geo(START.lat - i * STEP, START.lng);
    await sleep(5000);
    const p = await val(`positions/${teamId}`);
    if (p && p.t > t0 && !seen.some((x) => x.t === p.t)) seen.push({ s: Math.round((Date.now() - t0) / 1000), lat: p.lat, t: p.t });
    const w = wake();
    const sys = pidof("system_server");
    if (w === "Awake") stayedOff = false;
    const line = `${label} +${Math.round((Date.now() - t0) / 1000)} s: Bildschirm ${w}, Android-System ${sys === sys0 ? "läuft" : `NEU GESTARTET (${sys || "weg"})`}, App ${pidof(PKG) ? "läuft" : "BEENDET"}, neue Standorte ${seen.length}`;
    verlauf.push(line);
    console.log(line);
  }
  const startLat = START.lat - (from - 1) * STEP;
  const moved = seen.length ? Math.round((startLat - seen.at(-1).lat) / (STEP / 25)) : 0;
  const when = seen.map((x) => `${x.s} s`).join(", ") || "–";
  return { seen, moved, stayedOff, when };
}

let ok = true;
try {
  // 1. Spiel am Server anlegen, Team-Handy (Emulator) und ein zweites Team treten bei
  const sa = await call(null, { action: "superSetup", setupSecret: "lokal", password: "emulator-test-123" });
  await call(sa.token, { action: "createGame", gameId: G, name: "Emulator-Test", template: "linz", adminPassword: "admin1234" });
  const admin = await call(null, { action: "join", gameId: G, role: "admin", name: "Peter", secret: "admin1234" });
  await call(admin.token, { action: "setSecret", gameId: G, kind: "teamPw", value: "falke27" });
  const team = await call(null, { action: "join", gameId: G, role: "team", name: "Urfahr", secret: "falke27" });
  const other = await call(null, { action: "join", gameId: G, role: "team", name: "Traun", secret: "falke27" });

  // 2. App starten: Server über adb reverse, Berechtigungen wie nach dem Onboarding, Startpunkt Hauptplatz
  const ruhe = await settle(300_000);
  verlauf.push(`Emulator bereit ${ruhe}`);
  console.log(`Emulator bereit ${ruhe}`);
  adb("logcat", "-b", "all", "-c"); // Protokoll nur ab hier
  const sys0 = pidof("system_server");
  adb("reverse", "tcp:8787", "tcp:8787");
  for (const p of ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION", "POST_NOTIFICATIONS"])
    adb("shell", "pm", "grant", PKG, `android.permission.${p}`);
  geo(START.lat, START.lng);
  adb("shell", "am", "start", "-n", `${PKG}/.MainActivity`);
  // ohne Playwright-Hilfs-APK: hier reichen adb und die WebView-Fernsteuerung
  const [device] = await android.devices({ omitDriverInstall: true });
  const model = `${adb("shell", "getprop", "ro.product.model")}, Android ${adb("shell", "getprop", "ro.build.version.release")}`;
  const webview = await device.webView({ pkg: PKG }, { timeout: 120_000 });
  const page = await webview.page();
  // Sitzung und „Onboarding erledigt“ – wie nach dem Beitritt über die Oberfläche (die testen die Browser-Tests)
  await page.evaluate(
    ([s, p]) => {
      localStorage.setItem("mrx.sitzung", s);
      localStorage.setItem("mrx.prefs", p);
    },
    [
      JSON.stringify({ gameId: G, token: team.token, uid: team.uid, role: "team" }),
      JSON.stringify({ sound: true, wake: true, onboarded: true, background: true }),
    ],
  );
  await page.reload();

  // 3. App offen (Warteraum): Standort kommt über die Live-Verbindung. `geo fix` wiederholen – der Emulator meldet
  // einen gesetzten Standort nicht von selbst noch einmal
  const first = await until("Standort bei offener App", () => (geo(START.lat, START.lng), val(`positions/${team.teamId}`)), 120_000);
  ok = check("Standort bei offener App (Warteraum)", true, `${first.lat.toFixed(5)}, ${first.lng.toFixed(5)} am Server`) && ok;
  const service = () => adb("shell", "dumpsys", "notification", "--noredact").includes("Mister X läuft");
  const fgs = await until("Dauer-Benachrichtigung", service, 30_000).catch(() => false);
  ok = check("Vordergrund-Dienst (Dauer-Benachrichtigung „Mister X läuft“)", fgs, fgs ? "läuft" : "fehlt") && ok;

  // 4. App in den Hintergrund (Home-Taste) – das Handy wandert schon im Warteraum in die Tasche –, dann startet die
  // Spielleitung das Spiel; 90 s gehen: Standorte kommen über natives HTTP (im Hintergrund alle 30 s)
  adb("shell", "input", "keyevent", "KEYCODE_HOME");
  await sleep(3000);
  await call(admin.token, { action: "startGame", gameId: G, mrx: other.teamId });
  const a = await walk("Hintergrund", team.teamId, 1, 18, sys0);
  ok =
    check(
      "Standorte mit App im Hintergrund, Spielstart währenddessen",
      a.seen.length >= 2 && a.moved >= 100,
      `${a.seen.length} neue Standorte in 90 s (nach ${a.when}), ${a.moved} m weiter südlich`,
    ) && ok;
  ok = check("Vordergrund-Dienst läuft nach dem Spielstart weiter", service(), service() ? "ja" : "nein") && ok;

  // 5. Bildschirm aus – wie das Handy in der Hosentasche – und 150 s weitergehen
  adb("shell", "input", "keyevent", "KEYCODE_SLEEP");
  await sleep(3000);
  ok = check("Bildschirm aus", wake() !== "Awake", `mWakefulness=${wake()}`) && ok;
  const b = await walk("Bildschirm aus", team.teamId, 19, 30, sys0);
  ok =
    check(
      "Standorte bei ausgeschaltetem Bildschirm",
      b.stayedOff && b.seen.length >= 3 && b.moved >= 200,
      `${b.seen.length} neue Standorte in 150 s (nach ${b.when}), ${b.moved} m weiter südlich; Bildschirm blieb aus: ${b.stayedOff ? "ja" : "nein"}`,
    ) && ok;

  // im Hintergrund schickt die App ihren Standort per nativem HTTP (die WebView drosselt Android dort) – wrangler.log
  // ist das Protokoll des Spiel-Servers aus dem CI-Schritt davor
  let posts = -1;
  try {
    posts = readFileSync("wrangler.log", "utf8").split("POST /api/pos").length - 1;
  } catch {
    /* lokal ohne Protokoll */
  }
  if (posts >= 0) ok = check("Standorte im Hintergrund per nativem HTTP (/api/pos)", posts >= 3, `${posts} Anfragen`) && ok;

  // 6. Durchsage, während der Bildschirm aus ist → Android-Benachrichtigung
  await call(admin.token, { action: "announce", gameId: G, text: DURCHSAGE });
  const shown = await until(
    "Benachrichtigung",
    () => adb("shell", "dumpsys", "notification", "--noredact").includes(DURCHSAGE),
    90_000,
  ).catch(() => false);
  ok = check("Durchsage als Benachrichtigung bei ausgeschaltetem Bildschirm", !!shown, shown ? "angezeigt" : "nicht angezeigt") && ok;
  const sysEnd = pidof("system_server");
  ok =
    check("Android-System lief ohne Neustart durch", sysEnd === sys0, sysEnd === sys0 ? "ja" : `nein (${sys0} → ${sysEnd || "weg"})`) && ok;
  adb("shell", "input", "keyevent", "KEYCODE_WAKEUP");

  writeFileSync(
    "android-ergebnis.md",
    [
      "# Gerätetest Android-App (Emulator)",
      "",
      `${new Date().toISOString()} · ${model} · Test-APK gegen den lokalen Spiel-Server`,
      "",
      "| Prüfung | Ergebnis | Details |",
      "|---|---|---|",
      ...rows,
      "",
      "Verlauf alle 5 s:",
      "",
      "```text",
      ...verlauf,
      "```",
      "",
    ].join("\n"),
  );
} catch (e) {
  ok = false;
  console.error(e);
  rows.push(`| Abbruch | ✖ | ${String(e).replace(/\|/g, "/")} |`);
  writeFileSync(
    "android-ergebnis.md",
    [
      "# Gerätetest Android-App (Emulator)",
      "",
      "| Prüfung | Ergebnis | Details |",
      "|---|---|---|",
      ...rows,
      "",
      "```text",
      ...verlauf,
      "```",
      "",
    ].join("\n"),
  );
} finally {
  // Protokoll des Geräts für die Fehlersuche (Artefakt)
  // (direkt in Dateien: das ganze Protokoll ist größer als der Puffer von execFileSync)
  spawnSync("adb", ["logcat", "-d", "-b", "main,system,crash,events", "-v", "time"], {
    stdio: ["ignore", openSync("logcat.txt", "w"), "ignore"],
  });
  spawnSync("adb", ["shell", "dumpsys", "activity", "services", PKG], { stdio: ["ignore", openSync("geraet.txt", "w"), "ignore"] });
}
process.exit(ok ? 0 : 1);
