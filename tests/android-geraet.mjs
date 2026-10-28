// Gerätetest im Android-Emulator (CI: .github/workflows/android.yml, Job „emulator“). Die Test-APK spielt gegen den
// lokalen Spiel-Server (wrangler dev, über `adb reverse` als 127.0.0.1:8787 erreichbar). Nachweis für die Definition
// of Done (PROMPT-NEUBAU §13):
//   1. Standort kommt an, solange die App offen ist (Live-Verbindung),
//   2. Bildschirm schon im Warteraum aus, dann Spielstart: neue Standorte kommen weiter an (Vordergrund-Dienst +
//      natives HTTP) – auch der Spielbeginn darf den Dienst nicht anhalten,
//   3. eine Durchsage erscheint als Android-Benachrichtigung, während der Bildschirm aus ist.
// Ergebnis: android-ergebnis.md (Artefakt) und Ausgabe im Log; Exit-Code 1, wenn etwas nicht klappt.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
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

  // 4. Bildschirm aus – das Handy kommt schon im Warteraum in die Hosentasche –, dann startet die Spielleitung
  adb("shell", "input", "keyevent", "KEYCODE_SLEEP");
  await sleep(3000);
  const wake = () => adb("shell", "dumpsys", "power").match(/mWakefulness=(\w+)/)?.[1] ?? "?";
  ok = check("Bildschirm aus", wake() !== "Awake", `mWakefulness=${wake()}`) && ok;
  await call(admin.token, { action: "startGame", gameId: G, mrx: other.teamId });

  // 5. mit ausgeschaltetem Bildschirm 150 s die Landstraße entlang gehen
  const tOff = Date.now();
  const seen = [];
  for (let i = 1; i <= 30; i++) {
    geo(START.lat - i * STEP, START.lng);
    await sleep(5000);
    const p = await val(`positions/${team.teamId}`);
    if (p && p.t > tOff && !seen.some((x) => x.t === p.t)) seen.push({ s: Math.round((Date.now() - tOff) / 1000), lat: p.lat });
  }
  const stillOff = wake() !== "Awake";
  const moved = seen.length ? Math.round((START.lat - seen.at(-1).lat) / (STEP / 25)) : 0;
  ok =
    check(
      "Standorte bei ausgeschaltetem Bildschirm",
      stillOff && seen.length >= 3 && moved >= 200,
      `${seen.length} neue Standorte in 150 s (nach ${seen.map((x) => `${x.s} s`).join(", ")}), zuletzt ${moved} m südlich vom Start; Bildschirm blieb aus: ${stillOff ? "ja" : "nein"}`,
    ) && ok;
  ok = check("Vordergrund-Dienst läuft nach dem Spielstart weiter", service(), service() ? "ja" : "nein") && ok;

  // 6. Durchsage, während der Bildschirm aus ist → Android-Benachrichtigung
  await call(admin.token, { action: "announce", gameId: G, text: DURCHSAGE });
  const shown = await until(
    "Benachrichtigung",
    () => adb("shell", "dumpsys", "notification", "--noredact").includes(DURCHSAGE),
    90_000,
  ).catch(() => false);
  ok = check("Durchsage als Benachrichtigung bei ausgeschaltetem Bildschirm", !!shown, shown ? "angezeigt" : "nicht angezeigt") && ok;
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
    ].join("\n"),
  );
} catch (e) {
  ok = false;
  console.error(e);
  rows.push(`| Abbruch | ✖ | ${String(e).replace(/\|/g, "/")} |`);
  writeFileSync(
    "android-ergebnis.md",
    ["# Gerätetest Android-App (Emulator)", "", "| Prüfung | Ergebnis | Details |", "|---|---|---|", ...rows, ""].join("\n"),
  );
} finally {
  // Protokoll des Geräts für die Fehlersuche (Artefakt)
  try {
    writeFileSync("logcat.txt", adb("logcat", "-d", "-t", "3000"));
  } catch {
    /* Emulator weg */
  }
}
process.exit(ok ? 0 : 1);
