// Ende-zu-Ende für die Ergänzungen nach dem ersten echten Spiel: Teamgröße beim Beitritt, Probelauf und Vorlagen in
// der Steuerung, Kompass zur letzten Meldung, Sperrgebiet-Warnung für Jäger, Notfall-Knopf, Durchsage-Vorlagen,
// Team aufteilen, Sammelruf mit Kopfzählung, Probelauf-Ende. Zwei Team-Handys mit Fake-GPS, Spielleitung am Laptop.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ViteDevServer } from "vite";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { T } from "../app/src/texte.ts";
import { call, join, resetServer, set, startApp, superAdminToken, val, type Device, visible } from "./helpers.ts";

const G = "linz-neu";
const PORT = 5189;
const URL = `http://127.0.0.1:${PORT}/`;
const HAUPTPLATZ = { latitude: 48.3059, longitude: 14.2862 };
let vite: ViteDevServer;
let browser: Browser;
let api: Device;
let admin: Page;
const phones: Record<string, { ctx: BrowserContext; page: Page; id: string }> = {};

const run = async (action: string, extra: Record<string, unknown> = {}) => {
  const r = await call(api.token, { action, gameId: G, ...extra });
  if (r.error) throw new Error(`${action}: ${r.error.message}`);
  return r.result!;
};
const nav = (label: string) => admin.getByRole("link", { name: label }).click();
const shot = async (page: Page, name: string) => {
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}.png` });
};
const confirm = (page: Page, label: string) => page.getByRole("dialog").getByRole("button", { name: label, exact: true }).click();

async function joinTeam(name: string, dLat: number, plus: number) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "de-AT",
    reducedMotion: "reduce",
    permissions: ["geolocation"],
    geolocation: { latitude: HAUPTPLATZ.latitude + dLat, longitude: HAUPTPLATZ.longitude, accuracy: 8 },
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("PAGEERROR", name, e.message));
  await page.goto(`${URL}#/beitreten/${G}`);
  await page.getByLabel(T.beitritt.teamname).fill(name);
  const size = page.getByRole("group", { name: T.beitritt.groesse });
  for (let i = 0; i < plus; i++) await size.getByRole("button", { name: "mehr" }).click();
  await page.getByLabel(T.beitritt.passwort).fill("falke27");
  await page.getByRole("button", { name: T.beitritt.los, exact: true }).click();
  await page.getByRole("button", { name: T.onboarding.ueberspringen, exact: true }).click();
  await page.getByRole("heading", { name: T.lobby.angemeldet }).waitFor();
  const teams = (await val(`games/${G}/teams`)) as Record<string, { name: string }>;
  phones[name] = { ctx, page, id: Object.entries(teams).find(([, t]) => t.name === name)![0] };
}

beforeAll(async () => {
  await resetServer();
  const sa = await superAdminToken();
  await call(sa, { action: "createGame", gameId: G, name: "Neu-Test", template: "linz", adminPassword: "admin1234" });
  api = await join(G, "admin", "Vorab", "admin1234");
  await run("setSecret", { kind: "teamPw", value: "falke27" });
  vite = await startApp(PORT);
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await vite?.close();
});

describe("Neue Funktionen in der echten App", { timeout: 60_000 }, () => {
  it("Beitritt mit Teamgröße", async () => {
    await joinTeam("Urfahr", 0.002, 2); // 6 + 2 = 8 Personen
    await joinTeam("Traun", 0, 0);
    expect(await val(`games/${G}/teams/${phones.Urfahr!.id}/size`)).toBe(8);
    expect(await val(`games/${G}/teams/${phones.Traun!.id}/size`)).toBe(6);
  });

  it("Steuerung vor dem Start: Probelauf einschalten, Vorlage speichern", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: "de-AT", reducedMotion: "reduce" });
    admin = await ctx.newPage();
    admin.on("pageerror", (e) => console.error("PAGEERROR admin", e.message));
    await admin.goto(`${URL}#/staff/admin?g=${G}`);
    await admin.getByLabel(T.staffLogin.name).fill("Peter");
    await admin.getByLabel(T.staffLogin.adminPasswort).fill("admin1234");
    await admin.getByRole("button", { name: T.staffLogin.los, exact: true }).click();
    await visible(admin, T.admin.startMrx);
    await admin.getByRole("switch", { name: T.admin.probelauf }).click();
    await expect.poll(() => val(`games/${G}/config/trial`)).toBe(true);
    await visible(admin, T.status.probelauf);
    await admin.getByLabel(T.admin.vorlageName).fill("Mister X Herbst");
    await admin.getByRole("button", { name: T.admin.vorlageSpeichern }).click();
    await visible(admin, "Mister X Herbst");
    await shot(admin, "steuerung-vorher");
    // Teams sehen den Probelauf im Warteraum
    await visible(phones.Urfahr!.page, T.status.probelauf);
    // Teams-Bereich: Personen gezählt
    await nav(T.admin.nav.teams);
    await visible(admin, T.admin.personenGesamt(14, 2));
  });

  it("Kompass zur letzten Meldung: Entfernung und Google-Maps-Link", async () => {
    await run("setConfig", { config: { headStartMin: 0 } }); // ohne Startsperre: Jäger sehen gleich die Karte
    await run("startGame", { mrx: phones.Traun!.id });
    const u = phones.Urfahr!.page;
    await u.getByRole("button", { name: T.tabs.kompass, exact: true }).click();
    // ohne Vorsprung kommt die erste Meldung gleich beim Start; eine Sofort-Meldung dazu
    await run("instantReport");
    await visible(u, T.kompass.zurMeldung);
    await expect.poll(async () => (await u.locator(".compass .big").textContent())?.trim()).toMatch(/^\d+ m$/);
    const href = await u.getByRole("link", { name: T.kompass.karten }).getAttribute("href");
    expect(href).toContain("google.com/maps/dir/?api=1&destination=48.3059");
    await shot(u, "kompass");
    // Handy drehen: der Pfeil dreht sich mit (Kompass-Ereignisse wie vom Lagesensor)
    // der Test-Browser hat keinen Lagesensor: die Erlaubnis-Abfrage wie am Handy mit „erlaubt“ beantworten
    await u.evaluate(() => {
      (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission = async () => "granted";
    });
    const tap = u.getByRole("button", { name: T.kompass.aktivieren });
    if (await tap.count()) await tap.click();
    const turn = (alpha: number) =>
      u.evaluate((a) => {
        window.dispatchEvent(new DeviceOrientationEvent("deviceorientationabsolute", { alpha: a, beta: 0, gamma: 0, absolute: true }));
      }, alpha);
    const arrow = async () =>
      Number((await u.locator(".compass .arrow").evaluate((el) => (el as SVGElement).style.transform)).match(/-?[\d.]+/)![0]);
    await turn(0); // Handy zeigt nach Norden → Pfeil nach Süden (Mister X wurde südlich gemeldet)
    const norm = async () => (((await arrow()) % 360) + 360) % 360;
    await expect.poll(norm).toBeCloseTo(180, 0);
    await visible(u, T.kompass.flach);
    await turn(270); // Handy nach Osten gedreht → Pfeil zeigt nach rechts hinten (90°)
    await expect.poll(norm).toBeCloseTo(90, 0);
    await turn(90); // Handy nach Westen → 270° bzw. -90° (kurzer Weg)
    await expect.poll(norm).toBeCloseTo(270, 0);
  });

  it("Sperrgebiet-Warnung auch für Jäger; Spielleitung sieht es in den Warnungen", async () => {
    const u = phones.Urfahr!;
    await u.page.getByRole("button", { name: T.tabs.karte, exact: true }).click();
    await run("setCut", { cutId: "norden", locked: true });
    await u.ctx.setGeolocation({ latitude: 48.31, longitude: 14.285, accuracy: 8 }); // nördlich der Promenade
    await visible(u.page, T.zone.sperrgebiet("Norden"));
    await shot(u.page, "sperrgebiet");
    await nav(T.admin.nav.live);
    await visible(admin, T.admin.teamImSperrgebiet("Urfahr", "Norden"));
    // fast leerer Akku: Warnung in der Liste und als Hinweis
    const traun = phones.Traun!.id;
    const p = await val(`games/${G}/positions/${traun}`);
    await set(`games/${G}/positions/${traun}`, { ...p, battery: 9, t: Date.now() });
    await visible(admin, T.admin.akkuLeer("Traun", 9));
    await u.ctx.setGeolocation({ latitude: HAUPTPLATZ.latitude + 0.002, longitude: HAUPTPLATZ.longitude, accuracy: 8 });
  });

  it("Notfall-Knopf: Spielleitung sieht den Alarm und erledigt ihn", async () => {
    const u = phones.Urfahr!.page;
    await u.getByRole("button", { name: T.notfall.melden }).first().click();
    await confirm(u, T.notfall.melden);
    await visible(u, T.notfall.gemeldet);
    await visible(admin, T.notfall.alarm("Urfahr"));
    await shot(admin, "notfall-admin");
    await shot(u, "notfall-team");
    await admin.getByRole("button", { name: T.notfall.erledigt }).click();
    await expect.poll(async () => admin.getByText(T.notfall.alarm("Urfahr")).count()).toBe(0);
    await expect.poll(async () => u.getByText(T.notfall.gemeldet).count()).toBe(0);
  });

  it("Durchsage-Vorlagen: Vorschlag antippen füllt den Text, eigene Vorlage merken", async () => {
    await admin.getByRole("button", { name: T.admin.durchsageVorschlaege[4] }).click();
    expect(await admin.locator("#ann").inputValue()).toBe(T.admin.durchsageVorschlaege[4]);
    await admin.locator("#ann").fill("Treffpunkt nach dem Spiel: Hauptplatz beim Brunnen");
    await admin.getByRole("button", { name: T.admin.alsVorlage }).click();
    await expect.poll(() => val(`games/${G}/config/announceTemplates`)).toEqual(["Treffpunkt nach dem Spiel: Hauptplatz beim Brunnen"]);
    await admin.getByRole("button", { name: T.admin.durchsage, exact: true }).click();
    await visible(phones.Traun!.page, "Treffpunkt nach dem Spiel");
  });

  it("Team aufteilen: das Handy wechselt ins neue Team", async () => {
    await nav(T.admin.nav.teams);
    await admin.getByRole("button", { name: T.admin.aktionenFuer("Urfahr") }).click();
    await admin.getByText(T.admin.aufteilen, { exact: true }).first().click();
    await admin.getByLabel(T.admin.neuesTeam).fill("Urfahr Minis");
    await admin.getByLabel(/Handy 1/).check();
    await shot(admin, "aufteilen");
    await admin.getByRole("button", { name: T.admin.aufteilen, exact: true }).last().click();
    await expect
      .poll(async () => Object.values((await val(`games/${G}/teams`)) as Record<string, { name: string }>).map((t) => t.name))
      .toContain("Urfahr Minis");
    const u = phones.Urfahr!.page;
    await u.getByRole("button", { name: T.tabs.mehr, exact: true }).click();
    await visible(u, "Urfahr Minis");
    await u.getByRole("button", { name: T.tabs.karte, exact: true }).click();
  });

  it("Sammelruf: Team bekommt ihn, meldet „Wir sind da“, Spielleitung zählt mit", async () => {
    await nav(T.admin.nav.steuerung);
    await admin.getByRole("button", { name: T.admin.sammelrufStarten }).click();
    const t = phones.Traun!.page;
    await visible(t, T.sammelruf.titel(T.admin.spielfeldmitte));
    await t.getByRole("button", { name: T.sammelruf.daKnopf }).click();
    await visible(t, T.sammelruf.angekommen);
    await visible(admin, T.admin.angekommenTeams(1, 3));
    await shot(admin, "sammelruf-admin");
    await shot(t, "sammelruf-team");
    // Weg zeigen: Kompass zum Treffpunkt
    await t.getByRole("button", { name: T.sammelruf.kompass }).click();
    await visible(t, T.kompass.zumTreffpunkt(T.admin.spielfeldmitte));
  });

  it("Übergabe durch Teams: Spielleitung gibt Traun frei, Traun bestätigt als Mister X den Fang selbst", async () => {
    const t = phones.Traun!.page;
    await t.getByRole("button", { name: T.tabs.karte, exact: true }).click();
    expect(await t.getByRole("button", { name: T.gefangen.knopf }).count()).toBe(0); // noch nicht freigegeben
    await admin.getByRole("switch", { name: "Traun", exact: true }).click();
    await expect.poll(() => val(`games/${G}/teams/${phones.Traun!.id}/handover`)).toBe(true);
    await t.getByRole("button", { name: T.gefangen.knopf }).click();
    await t.getByText(T.gefangen.hinweis).waitFor();
    await t.getByRole("button", { name: /Urfahr Minis/ }).click();
    await confirm(t, T.gefangen.bestaetigen);
    const minis = Object.entries((await val(`games/${G}/teams`)) as Record<string, { name: string }>).find(
      ([, x]) => x.name === "Urfahr Minis",
    )![0];
    await expect.poll(() => val(`games/${G}/state/mrx`)).toBe(minis);
    // das neue Mister-X-Handy sieht seine Szene
    await visible(phones.Urfahr!.page, T.uebergabe.ihrSeidMrx);
    await visible(t, T.uebergabe.erwischt);
    for (const p of [phones.Urfahr!.page, t]) await p.getByRole("button", { name: T.allgemein.ok, exact: true }).click();
  });

  it("Endphase: zu Beginn des Spielende-Fensters Durchsage an alle und Hinweis am Team-Handy", async () => {
    await set(`secrets/${G}/endAt`, Date.now() + 60 * 60_000);
    await set(`games/${G}/state`, { ...(await val(`games/${G}/state`)), startedAt: Date.now() - 31 * 60_000 });
    await run("setConfig", { config: { endMinH: 0.5, endMaxH: 2 } });
    await set(`secrets/${G}/endAt`, Date.now() + 60 * 60_000);
    await expect.poll(() => val(`games/${G}/state/endPhase`), { timeout: 15_000 }).toBeGreaterThan(0);
    const u = phones.Urfahr!.page;
    await visible(u, T.status.endphase);
    await shot(u, "endphase");
    await u.getByRole("button", { name: new RegExp(`^${T.tabs.chat}`) }).click();
    await visible(u, "Endphase! Das Spiel kann ab jetzt jederzeit enden");
    await u.getByRole("button", { name: T.tabs.karte, exact: true }).click();
  });

  it("Probelauf-Ende: Auswertung mit Hinweis, Sammelruf bleibt, nichts im Archiv", async () => {
    await run("stopGame");
    const t = phones.Traun!.page;
    await visible(t, T.ende.probelauf);
    await visible(t, T.sammelruf.angekommen);
    expect(((await run("archiveList")) as { runs: unknown[] }).runs).toHaveLength(0);
  });
});
