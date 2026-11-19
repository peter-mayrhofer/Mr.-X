// Ende-zu-Ende: Spieltag-Checkliste in der Steuerung (E-74). Was die App sieht, hakt sie selbst ab; der Rest bleibt
// nach dem Neuladen abgehakt (nur in diesem Browser).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { T } from "../app/src/texte.ts";
import { call, connect, join, resetServer, startApp, superAdminToken, type Device } from "./helpers.ts";

const G = "linz-checkliste";
const PORT = 5198;
let vite: ViteDevServer;
let browser: Browser;
let p: Page;
let admin: Device;

const run = (d: Device, action: string, extra: Record<string, unknown> = {}) => call(d.token, { action, gameId: G, ...extra });
const C = T.checkliste;
const zeile = (text: string) => p.locator(".list li", { hasText: text });
const ok = (text: string) => zeile(text).evaluate((e) => e.classList.contains("ok"));

beforeAll(async () => {
  await resetServer();
  const sa = await superAdminToken();
  await call(sa, { action: "createGame", gameId: G, name: "Checklisten-Test", template: "linz", adminPassword: "admin1234" });
  admin = await join(G, "admin", "Vorab", "admin1234");
  vite = await startApp(PORT);
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await vite?.close();
});

describe("Spieltag-Checkliste", { timeout: 60_000 }, () => {
  it("vor dem Start: Spielfeld da, sonst noch offen", async () => {
    p = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" })).newPage();
    await p.goto(`http://127.0.0.1:${PORT}/#/staff/admin?g=${G}`);
    await p.getByLabel(T.staffLogin.name).fill("Peter");
    await p.getByLabel(T.staffLogin.adminPasswort).fill("admin1234");
    await p.getByRole("button", { name: T.staffLogin.los, exact: true }).click();
    await p.getByRole("link", { name: T.admin.nav.steuerung }).click();
    await p.getByRole("heading", { name: C.titel }).waitFor();
    expect(await ok(C.spielfeld)).toBe(true);
    expect(await ok(C.teamPw)).toBe(false);
    expect(await ok(C.teams(0))).toBe(false);
    expect(await ok(C.schiri)).toBe(false);
  });

  it("Passwörter, Teams mit Standort und Akku, Schiri: wird von selbst grün", async () => {
    await run(admin, "setSecret", { kind: "teamPw", value: "falke27" });
    await run(admin, "setSecret", { kind: "schiriCode", value: "pfiff42" });
    const a = await join(G, "team", "Urfahr", "falke27");
    const b = await join(G, "team", "Traun", "falke27");
    await join(G, "schiri", "Sepp", "pfiff42");
    const ha = connect(a.token);
    const hb = connect(b.token);
    await ha.until(() => true);
    await hb.until(() => true);
    ha.sendPos({ lat: 48.3045, lng: 14.2865, acc: 8, t: Date.now(), battery: 80 });
    hb.sendPos({ lat: 48.3047, lng: 14.2869, acc: 8, t: Date.now(), battery: 12 });
    await expect.poll(() => ok(C.teamPw)).toBe(true);
    await expect.poll(() => ok(C.teams(2))).toBe(true);
    await expect.poll(() => ok(C.standorte)).toBe(true);
    await expect.poll(() => ok(C.schiri)).toBe(true);
    expect(await ok(C.begleitung)).toBe(false);
    // ein Team mit fast leerem Akku: Punkt bleibt offen und nennt das Team
    expect(await ok(C.akku(30))).toBe(false);
    expect(await zeile(C.akku(30)).innerText()).toContain("Traun (12 %)");
    ha.close();
    hb.close();
  });

  it("Zugänge: QR-Code zum Download der Android-App (E-77)", async () => {
    await p.getByRole("link", { name: T.admin.nav.teams }).click();
    await p.getByRole("tab", { name: T.admin.zugaenge }).click();
    const karte = p.locator("section.card", { has: p.getByRole("heading", { name: T.zugang.android }) });
    await karte.waitFor();
    expect(await karte.locator("code").innerText()).toBe(`http://127.0.0.1:${PORT}/mister-x.apk`);
    expect(await karte.locator("svg").count()).toBeGreaterThan(0);
    await p.getByRole("link", { name: T.admin.nav.steuerung }).click();
  });

  it("von Hand abgehakt bleibt nach dem Neuladen", async () => {
    await p.getByRole("checkbox", { name: C.manuell[0] }).check();
    await p.reload();
    await p.getByRole("heading", { name: C.titel }).waitFor();
    expect(await p.getByRole("checkbox", { name: C.manuell[0] }).isChecked()).toBe(true);
    expect(await p.getByRole("checkbox", { name: C.manuell[1] }).isChecked()).toBe(false);
  });
});
