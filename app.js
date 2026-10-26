import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, connectAuthEmulator,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getDatabase, ref, onValue, set, update, push, runTransaction, connectDatabaseEmulator,
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

const DEFAULTS = { interval: 10, wait: 5, radius: 200, zone: 0 };
const S = {
  me: null, teams: {}, roles: {}, game: {}, pos: {}, reports: {}, handovers: {}, locks: {}, stats: {},
  chat: {}, dm: {}, secret: {}, offset: 0, myPos: null, sent: null, dist: 0, tab: "all", staffSubs: false,
};
const $ = (id) => document.getElementById(id);
const now = () => Date.now() + S.offset;
const role = () => S.roles[S.me];
const isStaff = () => !!role();
const isLeitung = () => role() === "leitung";
const name = (uid) => S.teams[uid]?.name ?? "?";
const teamIds = () => Object.keys(S.teams).filter((uid) => !S.roles[uid]);
const g = () => ({ ...DEFAULTS, ...S.game });
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
const email = (n) => `${n.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}@mrx-team.app`;
const loginErr = (e) => { $("lerr").textContent = { "auth/invalid-credential": "Teamname oder Passwort falsch.", "auth/email-already-in-use": "Diesen Teamnamen gibt es schon.", "auth/weak-password": "Passwort zu kurz (mind. 6 Zeichen)." }[e.code] ?? e.message; };
$("btnLogin").onclick = () => signInWithEmailAndPassword(auth, email($("lname").value), $("lpass").value).catch(loginErr);
$("btnRegister").onclick = async () => {
  const n = $("lname").value.trim();
  if (!n) return loginErr({ message: "Bitte Teamnamen eingeben." });
  try {
    const c = await createUserWithEmailAndPassword(auth, email(n), $("lpass").value);
    await set(ref(db, `teams/${c.user.uid}`), { name: n });
  } catch (e) { loginErr(e); }
};
$("btnLogout").onclick = () => signOut(auth).then(() => location.reload());

onAuthStateChanged(auth, (u) => {
  if (!u) return;
  S.me = u.uid;
  $("login").hidden = true;
  $("app").hidden = false;
  start();
});

// ---------- Daten ----------
const sub = (path, key, after = renderAll) =>
  onValue(ref(db, path), (s) => { S[key] = s.val() ?? {}; after(); }, () => {});

function start() {
  onValue(ref(db, ".info/serverTimeOffset"), (s) => { S.offset = s.val() ?? 0; });
  ["teams", "game", "reports", "handovers", "locks", "stats"].forEach((k) => sub(k, k));
  sub("chat", "chat", renderChat);
  sub("roles", "roles", () => {
    if (isStaff() && !S.staffSubs) {
      S.staffSubs = true;
      sub("pos", "pos", renderMap);
      if (isLeitung()) { sub("secret", "secret"); sub("dm", "dm", renderChat); }
    }
    if (!isLeitung() && !S.dmSub) { S.dmSub = true; sub(`dm/${S.me}`, "dmMine", renderChat); }
    renderAll();
  });
  sub(`stats/${S.me}`, "myStats", () => { S.dist = S.myStats.dist ?? 0; });
  setupMap();
  watchGps();
  keepAwake();
  setInterval(tick, 1000);
}

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
  if (isLeitung() && S.game.status === "running" && S.secret.endAt && now() >= S.secret.endAt && !S.ending) finish();
  renderStatus();
}

// Standort von Mister X wird automatisch gemeldet. Jedes Gerät von Mister X, Schiri und Spielleitung
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
  await update(ref(db), {
    game: { ...settings(), status: "running", mrx, since: t, n0: 1, startedAt: t },
    handovers: { [key]: { to: mrx, at: t, type: "start" } },
    reports: null, locks: null, stats: null,
  });
  say(`▶️ Spiel gestartet! ${name(mrx)} ist Mister X und hat ${g().interval} Min Vorsprung.`, true);
}

async function finish() {
  S.ending = true;
  await update(ref(db, "game"), { status: "ended", endedAt: now() });
  say(`🏁 Spielende! ${name(S.game.mrx)} ist der letzte Mister X und hat gewonnen!`, true);
}

const settings = () => ({
  interval: +$("sInterval").value || DEFAULTS.interval,
  wait: +$("sWait").value,
  radius: +$("sRadius").value,
  zone: +$("sZone").value,
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
  if (after.zone !== before.zone) say(`📢 Das Spielfeld wird verkleinert: ${CUTS.slice(0, after.zone).map((c) => c.name).join(", ") || "volles Spielfeld"} ${after.zone ? "fällt weg" : ""}.`, true);
};
$("btnReset").onclick = () => confirm("Wirklich ALLES löschen (Spiel, Chat, Statistik)?") &&
  update(ref(db), { game: null, handovers: null, reports: null, locks: null, stats: null, chat: null, dm: null, secret: null });
$("btnClaim").onclick = () => set(ref(db, `roles/${S.me}`), "leitung");
$("btnSchiri").onclick = () => set(ref(db, `roles/${$("rTeam").value}`), "schiri");
$("btnUnSchiri").onclick = () => $("rTeam").value !== S.me && set(ref(db, `roles/${$("rTeam").value}`), null);
$("tabAll").onclick = () => { S.tab = "all"; renderChat(); };
$("tabDm").onclick = () => { S.tab = "dm"; renderChat(); };
$("dmTeam").onchange = renderChat;
$("chatForm").onsubmit = (e) => {
  e.preventDefault();
  const text = $("chatText").value.trim();
  if (!text) return;
  const path = S.tab === "all" ? "chat" : `dm/${isLeitung() ? $("dmTeam").value : S.me}`;
  push(ref(db, path), { uid: S.me, name: name(S.me), text, t: now() });
  $("chatText").value = "";
};

// ---------- Karte ----------
let map, zoneLayer;
function setupMap() {
  map = L.map("map").fitBounds(BASE);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
  zoneLayer = L.layerGroup().addTo(map);
  $("sZone").innerHTML = ["volles Spielfeld", ...CUTS.map((c, i) => `ohne ${CUTS.slice(0, i + 1).map((x) => x.name.split(" ")[0]).join(", ")}`)]
    .map((label, i) => `<option value="${i}">${i}: ${label}</option>`).join("");
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
  L.polygon(BASE, { color: "#000", weight: 3, fill: false, interactive: false }).addTo(zoneLayer);
  CUTS.slice(0, G.zone).forEach((c) => L.polygon(c.poly, { stroke: false, fillColor: "#555", fillOpacity: 0.45, interactive: false }).addTo(zoneLayer));

  markers.forEach((m) => { m.seen = false; });
  if (S.myPos) dot("me", S.myPos, "#2b6cb0", "Wir");
  if (isStaff()) {
    for (const uid of teamIds()) if (S.pos[uid] && uid !== S.me)
      dot(uid, S.pos[uid], uid === G.mrx ? "#c8102e" : "#666", `${uid === G.mrx ? "🚩 " : ""}${name(uid)} ${clock(S.pos[uid].t)}`);
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
    if (G.mrx === S.me && S.myPos && !inZone(S.myPos, G.zone)) banner("warn", "⚠️ Ihr seid außerhalb des Spielfelds! Sofort zurück!");
    if (isStaff() && S.pos[G.mrx] && !inZone(S.pos[G.mrx], G.zone)) banner("warn", `⚠️ Mister X (${name(G.mrx)}) ist außerhalb des Spielfelds!`);
  } else if (G.status === "ended") banner("mrx", `🏁 Spiel vorbei! Gewinner: ${name(G.mrx)}`);
  else banner("info", "Warten auf den Spielstart …");
  if (isLeitung() && S.secret.endAt && G.status === "running") $("endInfo").textContent = `Geheimes Spielende: ${clock(S.secret.endAt)}`;
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
  $("leitung").hidden = !isLeitung();
  $("claim").hidden = Object.keys(S.roles).length > 0;
  $("tabDm").hidden = false;
  $("dmTeam").hidden = !isLeitung() || S.tab !== "dm";
  options("hTo", teamIds().filter((uid) => uid !== G.mrx));
  options("sStart", teamIds());
  options("dmTeam", teamIds());
  options("rTeam", Object.keys(S.teams).filter((uid) => uid !== S.me));
  $("teamList").innerHTML = teamIds().map((uid) => {
    const p = S.pos[uid];
    const where = p ? `${clock(p.t)}${now() - p.t > 120000 ? " ⚠️ offline?" : ""}` : "kein Standort";
    return `<li>${uid === G.mrx ? "🚩 " : ""}${esc(name(uid))} – ${where}${S.locks[uid] > now() ? " ⏳" : ""}</li>`;
  }).join("");
  // Formular nur füllen, wenn sich die gespeicherten Einstellungen geändert haben – sonst gehen Eingaben verloren.
  const cfg = JSON.stringify([G.interval, G.wait, G.radius, G.zone]);
  if (isLeitung() && S.cfg !== cfg) {
    S.cfg = cfg;
    $("sInterval").value = G.interval;
    $("sWait").value = G.wait;
    $("sRadius").value = G.radius;
    $("sZone").value = G.zone;
  }
  renderResults();
  renderMap();
  renderStatus();
  renderChat();
}

function renderResults() {
  const G = g();
  $("results").hidden = G.status !== "ended";
  if (G.status !== "ended") return;
  const hs = sorted(S.handovers), time = {}, count = {};
  hs.forEach((h, i) => {
    time[h.to] = (time[h.to] ?? 0) + (hs[i + 1]?.at ?? G.endedAt) - h.at;
    count[h.to] = (count[h.to] ?? 0) + 1;
  });
  const distance = Object.fromEntries(teamIds().map((uid) => [uid, S.stats[uid]?.dist ?? 0]));
  const top = (o, fmt) => {
    const [uid, v] = Object.entries(o).sort((a, b) => b[1] - a[1])[0] ?? [];
    return uid ? `${esc(name(uid))} (${fmt(v)})` : "–";
  };
  $("results").innerHTML = `<h2>🏆 Auswertung</h2><ul>
    <li>Letzter Mister X: <b>${esc(name(G.mrx))}</b></li>
    <li>Am längsten Mister X: ${top(time, (v) => `${Math.round(v / 60000)} Min`)}</li>
    <li>Am öftesten Mister X: ${top(count, (v) => `${v}×`)}</li>
    <li>Meiste Distanz: ${top(distance, (v) => `${(v / 1000).toFixed(1)} km`)}</li></ul>`;
}

function renderChat() {
  $("tabAll").classList.toggle("on", S.tab === "all");
  $("tabDm").classList.toggle("on", S.tab === "dm");
  $("dmTeam").hidden = !isLeitung() || S.tab !== "dm";
  const src = S.tab === "all" ? S.chat : isLeitung() ? S.dm[$("dmTeam").value] ?? {} : S.dmMine ?? {};
  const box = $("msgs"), atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  box.innerHTML = sorted(src).slice(-200).map((m) =>
    `<div class="msg${m.sys ? " sys" : ""}"><small>${clock(m.t)} ${esc(m.name)}</small><br>${esc(m.text)}</div>`).join("");
  if (atBottom) box.scrollTop = box.scrollHeight;
}
