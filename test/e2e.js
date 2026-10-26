// End-to-end-Test gegen den Firebase-Emulator (Anleitung siehe README).
// Simuliert Spielleitung, Schiri und drei Team-Handys und prüft Rechte, Meldungen, Übergabe, Chat und Auswertung.
const { chromium } = require("playwright");
const assert = require("assert");
const URL = "http://localhost:8080/index.html?emu";
const NS = "mr-x-ooe-default-rtdb";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function phone(browser, name, lat, lng) {
  const ctx = await browser.newContext({ geolocation: { latitude: lat, longitude: lng, accuracy: 10 }, permissions: ["geolocation"], viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept().catch(() => {}));
  page.on("pageerror", (e) => console.log(name, "PAGEERROR", e.message));
  await page.goto(URL);
  await page.fill("#lname", name);
  await page.fill("#lpass", "geheim123");
  await page.click("#btnRegister");
  await page.waitForSelector("#app:not([hidden])");
  return { ctx, page };
}

async function token(name) {
  const r = await fetch("http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=x", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@r0.mrx-team.app`, password: "geheim123", returnSecureToken: true }),
  });
  return (await r.json()).idToken;
}
const read = async (path, tok) => (await fetch(`http://localhost:9000/${path}.json?ns=${NS}&auth=${tok}`)).status;

(async () => {
  // Emulator leeren
  await fetch(`http://localhost:9000/.json?ns=${NS}`, { method: "PUT", body: "null", headers: { Authorization: "Bearer owner" } });
  await fetch("http://localhost:9099/emulator/v1/projects/mr-x-ooe/accounts", { method: "DELETE" });
  const browser = await chromium.launch();
  const L = await phone(browser, "Leitung", 48.3000, 14.2900);
  await L.page.click("#btnClaim");
  await L.page.waitForSelector("#leitung:not([hidden])");
  const R = await phone(browser, "Schiri Eins", 48.3001, 14.2901);
  const A = await phone(browser, "Team A", 48.3010, 14.2920);
  const B = await phone(browser, "Team B", 48.3011, 14.2921); // ~15 m neben A
  const C = await phone(browser, "Team C", 48.2980, 14.2880); // weit weg

  await L.page.waitForFunction(() => document.querySelectorAll("#rTeam option").length === 4);
  await L.page.selectOption("#rTeam", { label: "Schiri Eins" });
  await L.page.click("#btnSchiri");
  await R.page.waitForSelector("#staff:not([hidden])");

  // Rechte: Teams dürfen keine Live-Standorte lesen, Schiri schon
  assert.equal(await read("pos", await token("Team B")), 401, "Team darf pos nicht lesen");
  assert.equal(await read("pos", await token("Schiri Eins")), 200, "Schiri darf pos lesen");
  assert.equal(await read("secret", await token("Schiri Eins")), 401, "Schiri darf secret nicht lesen");

  await L.page.fill("#sInterval", "0.1"); // 6 s statt 10 min
  await L.page.click("#btnSave");
  await L.page.selectOption("#sStart", { label: "Team A" });
  await L.page.click("#btnStart");
  await A.page.waitForSelector(".banner.mrx");
  console.log("A:", await A.page.textContent("#banners"));

  await B.page.waitForFunction(() => [...document.querySelectorAll(".msg.sys")].some((m) => m.textContent.includes("Standort von Mister X")), null, { timeout: 15000 });
  console.log("B sieht Meldung + Karte:", await B.page.locator(".leaflet-tooltip").allTextContents(), await B.page.locator(".leaflet-interactive").count());

  // Übergabe A -> B durch Schiri: A (alter Mr X) bekommt Wartezeit, C (weit weg) nicht
  await R.page.waitForFunction(() => [...document.querySelectorAll("#hTo option")].some((o) => o.textContent === "Team B"));
  await R.page.selectOption("#hTo", { label: "Team B" });
  await R.page.click("#btnHand");
  await B.page.waitForSelector(".banner.mrx");
  await A.page.waitForFunction(() => document.querySelector("#banners").textContent.includes("Wartezeit"));
  await sleep(1500);
  assert(!(await C.page.textContent("#banners")).includes("Wartezeit"), "C ist weit weg");
  await B.page.waitForFunction(() => [...document.querySelectorAll(".msg.sys")].filter((m) => m.textContent.includes("(Team B) gemeldet")).length >= 1);

  // Chat + Direktnachricht
  await C.page.fill("#chatText", "Hallo alle");
  await C.page.click("#chatForm button");
  await C.page.click("#tabDm");
  await C.page.fill("#chatText", "Frage an Leitung");
  await C.page.click("#chatForm button");
  await A.page.waitForFunction(() => document.querySelector("#msgs").textContent.includes("Hallo alle"));
  await L.page.click("#tabDm");
  await L.page.selectOption("#dmTeam", { label: "Team C" });
  await L.page.waitForFunction(() => document.querySelector("#msgs").textContent.includes("Frage an Leitung"));
  await A.page.click("#tabDm");
  assert(!(await A.page.textContent("#msgs")).includes("Frage an Leitung"), "DM privat");

  // Rückgängig
  await R.page.click("#btnUndo");
  await A.page.waitForSelector(".banner.mrx");

  // Spielfeld verkleinern: A steht danach im weggefallenen Nordbereich
  await L.page.check("#cut0");
  await A.ctx.setGeolocation({ latitude: 48.3058, longitude: 14.2864 }); // Hauptplatz = Nordbereich
  await L.page.click("#btnSave");
  await A.page.waitForFunction(() => document.querySelector("#banners").textContent.includes("außerhalb"));

  await sleep(7000);
  await L.page.click("#btnStop");
  await A.page.waitForSelector("#results:not([hidden])");
  console.log("Auswertung:", (await A.page.textContent("#results")).replace(/\s+/g, " "));
  const reports = await (await fetch(`http://localhost:9000/reports.json?ns=${NS}`, { headers: { Authorization: "Bearer owner" } })).json();
  console.log("Meldungen:", Object.keys(reports).length);
  const chat = await (await fetch(`http://localhost:9000/chat.json?ns=${NS}`, { headers: { Authorization: "Bearer owner" } })).json();
  const texts = Object.values(chat).map((m) => m.text);
  console.log(texts.join("\n"));
  assert(texts.some((t) => t.startsWith("🏁")), "Spielende im Chat");

  // Archiv: beendetes Spiel ist nachschaubar
  await A.page.waitForSelector("#archive:not([hidden])");
  await A.page.selectOption("#archSel", { index: 1 });
  await A.page.waitForFunction(() => document.querySelector("#archView").textContent.includes("Letzter Mister X: Team A"));
  console.log("Archiv:", (await A.page.textContent("#archView")).replace(/\s+/g, " ").slice(0, 160));

  // Neue Spielleitung: falscher Code -> normales Team, richtiger Code -> Spielleitung
  await L.page.fill("#sCode", "geheimcode");
  await L.page.click("#btnCode");
  async function regLeitung(n, code) {
    const ctx = await browser.newContext({ geolocation: { latitude: 48.30, longitude: 14.29 }, permissions: ["geolocation"] });
    const page = await ctx.newPage();
    page.on("dialog", (d) => d.accept().catch(() => {}));
    await page.goto(URL);
    await page.fill("#lname", n); await page.fill("#lpass", "geheim123");
    await page.click("details summary"); await page.fill("#lcode", code);
    await page.click("#btnRegLeitung");
    await sleep(4000);
    return page.isVisible("#leitung");
  }
  assert.equal(await regLeitung("Falsch", "nein123"), false, "falscher Code");
  const gone = await (await fetch("http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=x", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "falsch@mrx-team.app", password: "geheim123", returnSecureToken: true }) })).json();
  assert(gone.error, "Konto mit falschem Code ist gelöscht");
  assert.equal(await regLeitung("Leitung Zwei", "geheimcode"), true, "richtiger Code");

  // Neues Spiel: Chat leer, Archiv bleibt
  await L.page.selectOption("#sStart", { label: "Team B" });
  await L.page.click("#btnStart");
  await B.page.waitForSelector(".banner.mrx");
  await sleep(1000);
  assert(!(await B.page.textContent("#msgs")).includes("Hallo alle"), "Chat geleert");
  const arch = await (await fetch(`http://localhost:9000/archive.json?ns=${NS}`, { headers: { Authorization: "Bearer owner" } })).json();
  assert.equal(Object.keys(arch).length, 1, "Archiv bleibt");

  // Neue Runde: Teams und Schiris fliegen raus, Spielleitung bleibt, Namen sind wieder frei
  await L.page.click("#btnStop");
  await L.page.click("#btnReset");
  await A.page.waitForSelector("#login:not([hidden])", { timeout: 15000 });
  await R.page.waitForSelector("#login:not([hidden])", { timeout: 15000 });
  await sleep(1500);
  assert(await L.page.isVisible("#leitung"), "Spielleitung bleibt angemeldet");
  await A.page.fill("#lname", "Team A"); await A.page.fill("#lpass", "neuespw1");
  await A.page.click("#btnRegister");
  await A.page.waitForSelector("#app:not([hidden])");
  await L.page.waitForFunction(() => [...document.querySelectorAll("#sStart option")].map((o) => o.textContent).join() === "Team A");
  // altes Passwort der alten Runde gilt nicht mehr
  await B.page.reload();
  await B.page.fill("#lname", "Team B"); await B.page.fill("#lpass", "geheim123");
  await B.page.click("#btnLogin");
  await B.page.waitForFunction(() => document.querySelector("#lerr").textContent.length > 0);
  await browser.close();
  console.log("OK");
})().catch((e) => { console.error(e); process.exit(1); });
