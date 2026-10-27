import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signInAnonymously, createUserWithEmailAndPassword, updatePassword, signOut, deleteUser, connectAuthEmulator,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getDatabase, ref, onValue, get, set, update, push, runTransaction, connectDatabaseEmulator,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { BASE, CUTS, inZone } from "./zones.js";

const fb = initializeApp({
  apiKey: "AIzaSyDtNPyDBqWVMcCv1MQsizkUSxAPhVEcvfg",
  authDomain: "mr-x-ooe.firebaseapp.com",
  databaseURL: "https://mr-x-ooe-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "mr-x-ooe",
  storageBucket: "mr-x-ooe.firebasestorage.app",
  messagingSenderId: "221429629278",
  appId: "1:221429629278:web:1a9828455d04efd5a3cfcf",
});
const auth = getAuth(fb), db = getDatabase(fb);
if (new URLSearchParams(location.search).has("emu")) {
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  connectDatabaseEmulator(db, "localhost", 9000);
}

const DEFAULTS = { interval: 10, wait: 5, radius: 200, cuts: [] };
const PARAMS = new URLSearchParams(location.search);
if (PARAMS.has("screen")) document.body.classList.add("screen");
const S = {
  me: null, teams: {}, roles: {}, game: {}, pos: {}, reports: {}, handovers: {}, locks: {}, stats: {},
  chat: {}, dm: {}, secret: {}, offset: 0, myPos: null, sent: null, dist: 0, tab: "all", staffSubs: false, seen: {},
};
const $ = (id) => document.getElementById(id);
const now = () => Date.now() + S.offset;
const role = () => S.roles[S.me];
const isStaff = () => !!role();
const isAdmin = () => role() === "admin";
const name = (uid) => S.teams[uid]?.name ?? "?";
const teamIds = () => Object.keys(S.teams).filter((uid) => !S.roles[uid]);
const g = () => ({ ...DEFAULTS, ...S.game, cuts: Object.values(S.game.cuts ?? {}) });
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const clock = (t) => new Date(t - S.offset).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });
const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const dist = (a, b) => {
  const r = Math.PI / 180, x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r), y = (b.lat - a.lat) * r;
  return Math.hypot(x, y) * 6371000;
};
const sorted = (o) => Object.entries(o).map(([id, v]) => ({ id, ...v })).sort((a, b) => a.at - b.at || a.t - b.t);
const say = (text, sys = false) => push(ref(db, "chat"), { uid: S.me, name: name(S.me), text, t: now(), sys });

// ---------- Login ----------
// Teams: anonymes Firebase-Konto pro Handy + Teamname + gemeinsames Team-Passwort (prüft database.rules.json).
// Admin: ein festes Konto mit eigenem Passwort; wer es als Erstes anlegt, ist Admin.
const ADMIN_EMAIL = "admin@mrx-team.app";
const loginErr = (msg) => { $("lerr").textContent = msg; };
const showAdmin = (on) => { $("adminLogin").hidden = !on; $("teamLogin").hidden = on; loginErr(""); };
$("btnShowAdmin").onclick = () => showAdmin(true);
$("btnShowTeam").onclick = () => showAdmin(false);

$("btnLogin").onclick = async () => {
  const n = $("lname").value.trim();
  if (!n) return loginErr("Bitte Teamnamen eingeben.");
  S.joining = true;
  try {
    const c = await signInAnonymously(auth);
    await update(ref(db), { [`joins/${c.user.uid}`]: $("lpass").value, [`teams/${c.user.uid}`]: { name: n } });
    S.joining = false;
    enter(c.user);
  } catch {
    if (auth.currentUser) await deleteUser(auth.currentUser).catch(() => signOut(auth));
    S.joining = false;
    loginErr("Team-Passwort falsch (oder vom Admin noch nicht festgelegt).");
  }
};

$("btnAdminLogin").onclick = async () => {
  const pw = $("apass").value;
  try {
    await signInWithEmailAndPassword(auth, ADMIN_EMAIL, pw);
  } catch {
    // Allererste Anmeldung: Admin-Konto anlegen. Gibt es das Konto schon, war das Passwort falsch.
    try {
      S.joining = true;
      const c = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, pw);
      await set(ref(db, `roles/${c.user.uid}`), "admin");
      await set(ref(db, `teams/${c.user.uid}`), { name: "Admin" });
      S.joining = false;
      enter(c.user);
    } catch (e) {
      S.joining = false;
      loginErr(e.code === "auth/weak-password" ? "Passwort zu kurz (mind. 6 Zeichen)." : "Admin-Passwort falsch.");
    }
  }
};
$("btnLogout").onclick = () => (auth.currentUser?.isAnonymous ? deleteUser(auth.currentUser) : signOut(auth)).finally(() => location.reload());

onAuthStateChanged(auth, async (u) => {
  if (!u || S.joining) return;
  // Anonymes Handy ohne Team (z. B. vom Admin entfernt) -> wieder zur Anmeldung
  if (u.isAnonymous && !(await get(ref(db, `teams/${u.uid}`))).exists()) return deleteUser(u).catch(() => signOut(auth));
  enter(u);
});

function enter(u) {
  if (S.me) return;
  S.me = u.uid;
  $("login").hidden = true;
  $("app").hidden = false;
  start();
}

// ---------- Daten ----------
const sub = (path, key, after = renderAll) =>
  onValue(ref(db, path), (s) => { S[key] = s.val() ?? {}; after(); }, () => {});

function start() {
  onValue(ref(db, ".info/serverTimeOffset"), (s) => { S.offset = s.val() ?? 0; });
  ["game", "reports", "handovers", "locks", "stats"].forEach((k) => sub(k, k));
  sub("teams", "teams", () => {
    // Vom Admin entfernt oder neue Runde -> abmelden
    if (!S.teams[S.me] && !S.out) {
      S.out = true;
      alert("Euer Team wurde abgemeldet (z. B. neue Runde). Bitte neu anmelden.");
      return $("btnLogout").onclick();
    }
    renderAll();
  });
  sub("archive", "archive", renderArchive);
  sub("chat", "chat", () => {
    const neu = fresh("chat", S.chat).filter((m) => m.uid !== S.me && (m.sys || m.ann));
    if (neu.length) alarm(neu.some((m) => m.ann));
    renderChat();
  });
  sub("roles", "roles", () => {
    if (isStaff() && !S.staffSubs) {
      S.staffSubs = true;
      sub("pos", "pos", renderMap);
      if (isAdmin()) sub("secret", "secret");
      if (isAdmin()) sub("dm", "dm", () => { dmAlarm(Object.assign({}, ...Object.values(S.dm))); renderChat(); });
    }
    if (!isAdmin() && !S.dmSub) { S.dmSub = true; sub(`dm/${S.me}`, "dmMine", () => { dmAlarm(S.dmMine); renderChat(); }); }
    renderAll();
  });
  sub(`stats/${S.me}`, "myStats", () => { S.dist = S.myStats.dist ?? 0; });
  setupMap();
  watchGps();
  keepAwake();
  setInterval(tick, 1000);
}

// ---------- Ton + Vibration ----------
// Browser erlauben Ton erst nach einer Berührung – der erste Tipp irgendwo schaltet ihn frei.
let audio;
document.addEventListener("pointerdown", () => { audio ??= new AudioContext(); audio.resume(); });
function alarm(strong = false) {
  navigator.vibrate?.(strong ? [400, 150, 400, 150, 400] : [200, 100, 200]);
  if (!audio) return;
  (strong ? [0, 0.25, 0.5] : [0, 0.25]).forEach((d) => {
    const o = audio.createOscillator(), v = audio.createGain();
    o.frequency.value = strong ? 660 : 880;
    v.gain.value = 0.25;
    o.connect(v).connect(audio.destination);
    o.start(audio.currentTime + d);
    o.stop(audio.currentTime + d + 0.15);
  });
}
// liefert nur Einträge, die seit dem letzten Aufruf dazugekommen sind (beim ersten Laden: keine)
function fresh(key, obj) {
  const ids = Object.keys(obj ?? {}), old = S.seen[key];
  S.seen[key] = new Set(ids);
  return old ? ids.filter((id) => !old.has(id)).map((id) => obj[id]) : [];
}
const dmAlarm = (msgs) => { if (fresh("dm", msgs).some((m) => m.uid !== S.me)) alarm(); };
$("btnSound").onclick = () => setTimeout(() => alarm(true), 50);

// ---------- GPS ----------
function watchGps() {
  if (!navigator.geolocation) return alert("Dieses Handy kann keinen Standort senden.");
  navigator.geolocation.watchPosition((p) => {
    const c = { lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy), t: now() };
    S.myPos = c;
    const moved = S.sent ? dist(S.sent, c) : Infinity;
    // ponytail: max. alle 15 m oder 30 s senden – spart Akku und Datenbank-Kontingent
    if (moved < 15 && now() - S.sent.t < 30000) return;
    if (S.sent && c.acc < 50) S.dist += moved;
    S.sent = c;
    set(ref(db, `pos/${S.me}`), c);
    set(ref(db, `stats/${S.me}/dist`), Math.round(S.dist));
    renderAll();
  }, (e) => banner("warn", `Kein GPS: ${e.message}`), { enableHighAccuracy: true, maximumAge: 5000 });
}

async function keepAwake() {
  try {
    await navigator.wakeLock?.request("screen");
  } catch { /* nicht unterstützt */ }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") navigator.wakeLock?.request("screen").catch(() => {});
  });
}

// ---------- Spiel-Logik ----------
function tick() {
  autoReport();
  if (isAdmin() && S.game.status === "running" && S.secret.endAt && now() >= S.secret.endAt && !S.ending) finish();
  renderStatus();
}

// Standort von Mister X wird automatisch gemeldet. Jedes Gerät von Mister X, Schiri und Admin
// versucht es; die Transaktion sorgt dafür, dass pro Termin nur eine Meldung entsteht.
function autoReport() {
  const G = g();
  if (G.status !== "running" || !G.mrx || !(isStaff() || G.mrx === S.me)) return;
  const n = Math.floor((now() - G.since) / (G.interval * 60000));
  if (n < (G.n0 ?? 0)) return;
  const slot = `${G.since}_${n}`;
  if (S.reports[slot] || S.pending === slot) return;
  const p = G.mrx === S.me ? S.myPos : S.pos[G.mrx];
  if (!p) return;
  S.pending = slot;
  runTransaction(ref(db, `reports/${slot}`), (cur) => (cur ? undefined : { team: G.mrx, lat: p.lat, lng: p.lng, pt: p.t, t: now() }))
    .then((r) => {
      if (!r.committed) return;
      const old = now() - p.t > 60000 ? ` (letzter bekannter Standort von ${clock(p.t)})` : "";
      say(`📍 Standort von Mister X (${name(G.mrx)}) gemeldet${old}.`, true);
    })
    .catch(() => { S.pending = null; });
}

function nearbyLocks(from, to, until) {
  const at = S.pos[from] ?? S.pos[to];
  const locks = from ? { [from]: until } : {};
  if (at) for (const uid of teamIds()) if (S.pos[uid] && dist(at, S.pos[uid]) <= g().radius) locks[uid] = until;
  delete locks[to];
  return locks;
}

async function handover(to, type) {
  const G = g(), t = now(), from = G.mrx;
  if (!to || to === from) return;
  const key = push(ref(db, "handovers")).key;
  await update(ref(db), {
    "game/mrx": to, "game/since": t, "game/n0": 0,
    locks: nearbyLocks(from, to, t + G.wait * 60000),
    [`handovers/${key}`]: { from, to, at: t, type },
  });
  say(type === "strafe"
    ? `⚠️ Strafübergabe: Die Fahne geht von ${name(from)} an ${name(to)}. ${G.wait} Min Wartezeit in der Nähe.`
    : `🚩 ${name(to)} hat ${name(from)} gefangen und ist jetzt Mister X! ${G.wait} Min Wartezeit in der Nähe.`, true);
}

async function undo() {
  const hs = sorted(S.handovers), last = hs.at(-1), prev = hs.at(-2);
  if (!last || last.type === "start" || !confirm(`Übergabe an ${name(last.to)} rückgängig machen?`)) return;
  await update(ref(db), {
    "game/mrx": last.from, "game/since": prev.at, "game/n0": prev.type === "start" ? 1 : 0,
    locks: null, [`handovers/${last.id}`]: null,
  });
  say(`↩️ Übergabe an ${name(last.to)} wurde rückgängig gemacht. ${name(last.from)} ist wieder Mister X.`, true);
}

async function startGame(mrx) {
  if (!mrx) return;
  const t = now(), lo = +$("sEndMin").value, hi = Math.max(lo, +$("sEndMax").value);
  await set(ref(db, "secret/endAt"), t + (lo + Math.random() * (hi - lo)) * 3600000);
  const key = push(ref(db, "handovers")).key;
  // Nach einem beendeten Spiel ist alles archiviert -> Chat für das neue Spiel leeren
  const fresh = S.game.status === "ended" ? { chat: null, dm: null } : {};
  await update(ref(db), {
    game: { ...settings(), status: "running", mrx, since: t, n0: 1, startedAt: t },
    handovers: { [key]: { to: mrx, at: t, type: "start" } },
    reports: null, locks: null, stats: null, ...fresh,
  });
  say(`▶️ Spiel gestartet! ${name(mrx)} ist Mister X und hat ${g().interval} Min Vorsprung.`, true);
}

async function finish() {
  S.ending = true;
  const endedAt = now();
  await update(ref(db, "game"), { status: "ended", endedAt });
  await say(`🏁 Spielende! ${name(S.game.mrx)} ist der letzte Mister X und hat gewonnen!`, true);
  // Spiel archivieren, damit es nach einem neuen Spiel noch nachschaubar ist
  const names = Object.fromEntries(Object.entries(S.teams).map(([uid, t]) => [uid, t.name]));
  await set(ref(db, `archive/${S.game.startedAt}`), {
    game: { ...S.game, status: "ended", endedAt }, handovers: S.handovers, reports: S.reports, chat: S.chat, stats: S.stats, names, roles: S.roles,
  });
  S.ending = false;
}

const settings = () => ({
  interval: +$("sInterval").value || DEFAULTS.interval,
  wait: +$("sWait").value,
  radius: +$("sRadius").value,
  cuts: CUTS.map((_, i) => i).filter((i) => $(`cut${i}`).checked),
});

// ---------- Buttons ----------
$("btnHand").onclick = () => confirm(`Fahne an ${name($("hTo").value)} übergeben?`) && handover($("hTo").value, $("hType").value);
$("btnUndo").onclick = undo;
$("btnStart").onclick = () => confirm("Spiel starten?") && startGame($("sStart").value);
$("btnStop").onclick = () => confirm("Spiel jetzt beenden?") && finish();
$("btnSave").onclick = async () => {
  const before = g();
  await update(ref(db, "game"), settings());
  const after = g();
  if (after.interval !== before.interval) say(`📢 Regeländerung: Mister X meldet sich jetzt alle ${after.interval} Min.`, true);
  const added = after.cuts.filter((i) => !before.cuts.includes(i));
  if (added.length) say(`📢 Das Spielfeld wird verkleinert! Gesperrt: ${added.map((i) => CUTS[i].name).join("; ")}.`, true);
  else if (after.cuts.length < before.cuts.length) say("📢 Ein gesperrter Bereich ist wieder freigegeben.", true);
};
$("btnReset").onclick = () => {
  if (!confirm("Neue Runde vorbereiten?\n\nAlle Teams und Schiris werden abgemeldet, das Team-Passwort wird gelöscht. Spiel, Chat und Statistik werden gelöscht. Vergangene Spiele bleiben.\n\nDanach ein neues Team-Passwort festlegen.")) return;
  const roles = Object.fromEntries(Object.entries(S.roles).filter(([, r]) => r === "admin"));
  const teams = Object.fromEntries(Object.keys(roles).filter((uid) => S.teams[uid]).map((uid) => [uid, S.teams[uid]]));
  update(ref(db), {
    game: null, handovers: null, reports: null, locks: null, stats: null, chat: null, dm: null, pos: null, joins: null,
    "secret/endAt": null, "secret/teamPw": null, teams, roles,
  });
};
$("btnSchiri").onclick = () => set(ref(db, `roles/${$("rTeam").value}`), "schiri");
$("btnUnSchiri").onclick = () => set(ref(db, `roles/${$("rTeam").value}`), null);
$("btnKick").onclick = () => {
  const uid = $("rTeam").value;
  if (uid && confirm(`${name(uid)} entfernen? Das Handy wird abgemeldet.`))
    update(ref(db), { [`teams/${uid}`]: null, [`roles/${uid}`]: null, [`pos/${uid}`]: null, [`joins/${uid}`]: null });
};
$("btnTeamPw").onclick = () => {
  const pw = $("sTeamPw").value.trim();
  if (pw.length < 4) return alert("Das Team-Passwort muss mindestens 4 Zeichen haben.");
  set(ref(db, "secret/teamPw"), pw).then(() => alert("Team-Passwort gespeichert."));
};
$("btnTeamPwDel").onclick = () => confirm("Team-Passwort löschen? Dann können sich keine Teams mehr anmelden.") &&
  set(ref(db, "secret/teamPw"), null).then(() => { $("sTeamPw").value = ""; });
$("btnAdminPw").onclick = () => {
  const pw = $("sAdminPw").value;
  if (pw.length < 6) return alert("Das Admin-Passwort muss mindestens 6 Zeichen haben.");
  updatePassword(auth.currentUser, pw)
    .then(() => { $("sAdminPw").value = ""; alert("Admin-Passwort geändert."); })
    .catch(() => alert("Aus Sicherheitsgründen bitte kurz ab- und wieder anmelden und dann nochmal ändern."));
};
$("btnAnn").onclick = () => {
  const text = $("annText").value.trim();
  if (!text) return;
  push(ref(db, "chat"), { uid: S.me, name: name(S.me), text: `📢 ${text}`, t: now(), sys: true, ann: true });
  $("annText").value = "";
};
$("btnNow").onclick = async () => {
  const G = g(), p = S.pos[G.mrx];
  if (G.status !== "running" || !p) return alert("Kein Standort von Mister X vorhanden.");
  if (!confirm(`Standort von ${name(G.mrx)} jetzt sofort an alle melden?`)) return;
  await set(ref(db, `reports/x${now()}`), { team: G.mrx, lat: p.lat, lng: p.lng, pt: p.t, t: now() });
  say(`📍 Sofort-Meldung: Standort von Mister X (${name(G.mrx)}) auf Anweisung des Admins.`, true);
};
$("btnScreen").onclick = () => window.open(`?screen${PARAMS.has("emu") ? "&emu" : ""}`, "_blank");
$("archSel").onchange = () => { renderArchive(); renderMap(); };
$("tabAll").onclick = () => { S.tab = "all"; renderChat(); };
$("tabDm").onclick = () => { S.tab = "dm"; renderChat(); };
$("dmTeam").onchange = renderChat;
$("chatForm").onsubmit = (e) => {
  e.preventDefault();
  const text = $("chatText").value.trim();
  if (!text) return;
  const path = S.tab === "all" ? "chat" : `dm/${isAdmin() ? $("dmTeam").value : S.me}`;
  push(ref(db, path), { uid: S.me, name: name(S.me), text, t: now() });
  $("chatText").value = "";
};

// ---------- Karte ----------
let map, zoneLayer, archLayer;
function setupMap() {
  map = L.map("map").fitBounds(BASE);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
  zoneLayer = L.layerGroup().addTo(map);
  $("sCuts").innerHTML = CUTS.map((c, i) => `<label class="row"><input type="checkbox" id="cut${i}"> ${esc(c.name)}</label>`).join("");
}

// Marker werden wiederverwendet statt neu erzeugt (sonst bleiben Leaflet-Beschriftungen hängen).
const markers = new Map();
function dot(key, p, color, label) {
  let m = markers.get(key);
  if (!m) {
    m = L.circleMarker([p.lat, p.lng], { radius: 9, color: "#fff", weight: 2, fillOpacity: 1 })
      .bindTooltip("", { permanent: true, direction: "top", offset: [0, -8] }).addTo(map);
    markers.set(key, m);
  }
  m.setLatLng([p.lat, p.lng]).setStyle({ fillColor: color }).setTooltipContent(label);
  m.seen = true;
}

function renderMap() {
  if (!map) return;
  const G = g();
  zoneLayer.clearLayers();
  // Alles außerhalb des Spielfelds grau (Welt-Polygon mit dem Spielfeld als Loch)
  L.polygon([[[49, 13], [49, 16], [47, 16], [47, 13]], BASE], { color: "#000", weight: 3, fillColor: "#555", fillOpacity: 0.5, interactive: false }).addTo(zoneLayer);
  // ponytail: gesperrte Flächen einfach grau drüberlegen; Teile außerhalb des Spielfelds sind egal
  G.cuts.forEach((i) => L.polygon(CUTS[i].poly, { stroke: false, fillColor: "#555", fillOpacity: 0.5, interactive: false }).addTo(zoneLayer));

  markers.forEach((m) => { m.seen = false; });
  if (S.myPos && !isAdmin()) dot("me", S.myPos, "#2b6cb0", "Wir");
  if (isStaff()) {
    for (const uid of teamIds()) if (S.pos[uid] && uid !== S.me)
      dot(uid, S.pos[uid], uid === G.mrx ? "#c8102e" : "#666", `${uid === G.mrx ? "🚩 " : ""}${name(uid)} ${clock(S.pos[uid].t)}`);
  }
  archLayer?.remove();
  const A = S.archive?.[$("archSel").value];
  if (A && S.game.status !== "running") {
    const rs = sorted(A.reports ?? {});
    archLayer = L.layerGroup([L.polyline(rs.map((r) => [r.lat, r.lng]), { color: "#c8102e", weight: 3, dashArray: "6 6" }),
      ...rs.map((r) => L.circleMarker([r.lat, r.lng], { radius: 5, color: "#c8102e" }).bindTooltip(`${A.names?.[r.team] ?? "?"} ${clock(r.pt ?? r.t)}`))]).addTo(map);
  }
  const last = sorted(S.reports).at(-1);
  if (last) dot("report", last, "#c8102e", `Mister X ${clock(last.pt ?? last.t)}`);
  markers.forEach((m, key) => { if (!m.seen) { m.remove(); markers.delete(key); } });
}

// ---------- Anzeige ----------
function banner(cls, text) { $("banners").insertAdjacentHTML("beforeend", `<div class="banner ${cls}">${esc(text)}</div>`); }

function renderStatus() {
  const G = g();
  $("who").textContent = S.me ? `${name(S.me)}${role() ? ` (${role()})` : ""}` : "";
  $("banners").innerHTML = "";
  if (G.status === "running") {
    const n = Math.max(Math.floor((now() - G.since) / (G.interval * 60000)) + 1, G.n0 ?? 0);
    const next = mmss(G.since + n * G.interval * 60000 - now());
    if (G.mrx === S.me) banner("mrx", `🚩 Ihr seid Mister X! Nächste automatische Meldung in ${next}`);
    else banner("info", `Mister X: ${name(G.mrx)} · nächste Meldung in ${next}`);
    if (S.locks[S.me] > now()) banner("warn", `⏳ Wartezeit: noch ${mmss(S.locks[S.me] - now())}, bitte stehen bleiben!`);
    if (G.mrx === S.me && S.myPos && !inZone(S.myPos, G.cuts)) banner("warn", "⚠️ Ihr seid außerhalb des Spielfelds! Sofort zurück!");
    if (isStaff() && S.pos[G.mrx] && !inZone(S.pos[G.mrx], G.cuts)) banner("warn", `⚠️ Mister X (${name(G.mrx)}) ist außerhalb des Spielfelds!`);
    if (isStaff()) {
      const off = teamIds().filter((uid) => !S.pos[uid] || now() - S.pos[uid].t > 180000)
        .map((uid) => `${name(uid)} (${S.pos[uid] ? `seit ${clock(S.pos[uid].t)}` : "nie"})`);
      if (off.length) banner("warn", `📵 Kein Standort: ${off.join(", ")}`);
    }
  } else if (G.status === "ended") banner("mrx", `🏁 Spiel vorbei! Gewinner: ${name(G.mrx)}`);
  else banner("info", "Warten auf den Spielstart …");
  // Durchsagen bleiben 3 Minuten oben stehen
  const ann = sorted(S.chat).filter((m) => m.ann && now() - m.t < 180000).at(-1);
  if (ann) banner("ann", ann.text);
  if (isAdmin() && S.secret.endAt && G.status === "running") $("endInfo").textContent = `Geheimes Spielende: ${clock(S.secret.endAt)}`;
}

// Auswahllisten nur neu bauen, wenn sich die Einträge ändern (sonst springt eine offene Liste zu).
const options = (sel, ids) => {
  const html = ids.map((uid) => `<option value="${uid}">${esc(name(uid))}</option>`).join("");
  if ($(sel).dataset.html === html) return;
  const v = $(sel).value;
  $(sel).innerHTML = $(sel).dataset.html = html;
  if (ids.includes(v)) $(sel).value = v;
};

function renderAll() {
  const G = g();
  $("staff").hidden = !isStaff();
  $("admin").hidden = !isAdmin();
  if (isAdmin()) {
    $("teamPwInfo").textContent = S.secret.teamPw ? `Aktuell: ${S.secret.teamPw}` : "Kein Team-Passwort festgelegt – Teams können sich nicht anmelden.";
    if (document.activeElement !== $("sTeamPw")) $("sTeamPw").value = S.secret.teamPw ?? "";
  }
  $("tabDm").hidden = false;
  $("dmTeam").hidden = !isAdmin() || S.tab !== "dm";
  options("hTo", teamIds().filter((uid) => uid !== G.mrx));
  options("sStart", teamIds());
  options("dmTeam", teamIds());
  options("rTeam", Object.keys(S.teams).filter((uid) => S.roles[uid] !== "admin"));
  $("teamList").innerHTML = teamIds().map((uid) => {
    const p = S.pos[uid];
    const where = p ? `${clock(p.t)}${now() - p.t > 120000 ? " ⚠️ offline?" : ""}` : "kein Standort";
    return `<li>${uid === G.mrx ? "🚩 " : ""}${esc(name(uid))} – ${where}${S.locks[uid] > now() ? " ⏳" : ""}</li>`;
  }).join("");
  // Formular nur füllen, wenn sich die gespeicherten Einstellungen geändert haben – sonst gehen Eingaben verloren.
  const cfg = JSON.stringify([G.interval, G.wait, G.radius, G.cuts]);
  if (isAdmin() && S.cfg !== cfg) {
    S.cfg = cfg;
    $("sInterval").value = G.interval;
    $("sWait").value = G.wait;
    $("sRadius").value = G.radius;
    CUTS.forEach((_, i) => { $(`cut${i}`).checked = G.cuts.includes(i); });
  }
  renderResults();
  renderArchive();
  renderMap();
  renderStatus();
  renderChat();
}

function resultsHtml(G, handovers, stats, nameOf, teams) {
  const hs = sorted(handovers ?? {}), time = {}, count = {};
  hs.forEach((h, i) => {
    time[h.to] = (time[h.to] ?? 0) + (hs[i + 1]?.at ?? G.endedAt) - h.at;
    count[h.to] = (count[h.to] ?? 0) + 1;
  });
  const distance = Object.fromEntries(teams.map((uid) => [uid, stats?.[uid]?.dist ?? 0]));
  const top = (o, fmt) => {
    const [uid, v] = Object.entries(o).sort((a, b) => b[1] - a[1])[0] ?? [];
    return uid ? `${esc(nameOf(uid))} (${fmt(v)})` : "–";
  };
  return `<ul>
    <li>Letzter Mister X: <b>${esc(nameOf(G.mrx))}</b></li>
    <li>Am längsten Mister X: ${top(time, (v) => `${Math.round(v / 60000)} Min`)}</li>
    <li>Am öftesten Mister X: ${top(count, (v) => `${v}×`)}</li>
    <li>Meiste Distanz: ${top(distance, (v) => `${(v / 1000).toFixed(1)} km`)}</li></ul>`;
}

function renderResults() {
  const G = g();
  $("results").hidden = G.status !== "ended";
  if (G.status === "ended") $("results").innerHTML = `<h2>🏆 Auswertung</h2>${resultsHtml(G, S.handovers, S.stats, name, teamIds())}`;
}

const day = (t) => new Date(+t).toLocaleString("de-AT", { dateStyle: "medium", timeStyle: "short" });
function renderArchive() {
  const ids = Object.keys(S.archive ?? {}).sort().reverse();
  $("archive").hidden = !ids.length || S.game.status === "running";
  const html = `<option value="">– Spiel auswählen –</option>` + ids.map((id) => `<option value="${id}">${day(id)}</option>`).join("");
  if ($("archSel").dataset.html !== html) { const v = $("archSel").value; $("archSel").innerHTML = $("archSel").dataset.html = html; $("archSel").value = v; }
  const A = S.archive?.[$("archSel").value];
  if (!A) { $("archView").innerHTML = ""; return; }
  const nameOf = (uid) => A.names?.[uid] ?? "?";
  const teams = Object.keys(A.names ?? {}).filter((uid) => !A.roles?.[uid]);
  const dur = Math.round((A.game.endedAt - A.game.startedAt) / 60000);
  $("archView").innerHTML = `<p class="muted">${day(A.game.startedAt)} · ${Math.floor(dur / 60)} h ${dur % 60} min · Route von Mister X auf der Karte</p>
    ${resultsHtml(A.game, A.handovers, A.stats, nameOf, teams)}
    <details><summary>Chat-Verlauf (${Object.keys(A.chat ?? {}).length})</summary><div class="msgs">${sorted(A.chat ?? {}).map((m) =>
      `<div class="msg${m.sys ? " sys" : ""}"><small>${clock(m.t)} ${esc(m.name)}</small><br>${esc(m.text)}</div>`).join("")}</div></details>`;
}

function renderChat() {
  $("tabAll").classList.toggle("on", S.tab === "all");
  $("tabDm").classList.toggle("on", S.tab === "dm");
  $("dmTeam").hidden = !isAdmin() || S.tab !== "dm";
  const src = S.tab === "all" ? S.chat : isAdmin() ? S.dm[$("dmTeam").value] ?? {} : S.dmMine ?? {};
  const box = $("msgs"), atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  box.innerHTML = sorted(src).slice(-200).map((m) =>
    `<div class="msg${m.ann ? " ann" : m.sys ? " sys" : ""}"><small>${clock(m.t)} ${esc(m.name)}</small><br>${esc(m.text)}</div>`).join("");
  if (atBottom || PARAMS.has("screen")) box.scrollTop = box.scrollHeight;
}
