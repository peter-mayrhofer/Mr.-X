// Ende-zu-Ende: Übungsspiel mit Computer-Teams (E-78) und Android-QR auf dem Team-Flyer (E-77).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { PROTOKOLL } from "../shared/src/index.ts";
import { T } from "../app/src/texte.ts";
import { call, join, resetServer, startApp, superAdminToken, val, type Device } from "./helpers.ts";

const G = "linz-uebung";
const PORT = 5200;
let vite: ViteDevServer;
let browser: Browser;
let p: Page;
let admin: Device;
const run = (action: string, extra: Record<string, unknown> = {}) => call(admin.token, { action, gameId: G, ...extra });
const botIds = async () =>
  Object.entries((await val(`games/${G}/teams`)) as Record<string, { uebung?: boolean }>)
    .filter(([, t]) => t.uebung)
    .map(([id]) => id);

beforeAll(async () => {
  await resetServer();
  const sa = await superAdminToken();
  await call(sa, { action: "createGame", gameId: G, name: "Übungs-Test", template: "linz", adminPassword: "admin1234" });
  admin = await join(G, "admin", "Vorab", "admin1234");
  await run("setSecret", { kind: "teamPw", value: "falke27" });
  await run("setConfig", { config: { trial: true } });
  vite = await startApp(PORT);
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await vite?.close();
});

describe("Übungsspiel", { timeout: 60_000 }, () => {
  it("Computer-Teams anlegen und loslaufen lassen", async () => {
    p = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" })).newPage();
    await p.goto(`http://127.0.0.1:${PORT}/#/staff/admin?g=${G}`);
    await p.getByLabel(T.staffLogin.name).fill("Peter");
    await p.getByLabel(T.staffLogin.adminPasswort).fill("admin1234");
    await p.getByRole("button", { name: T.staffLogin.los, exact: true }).click();
    await p.getByRole("link", { name: T.admin.nav.steuerung }).click();
    await p.getByRole("heading", { name: T.uebung.titel }).waitFor();
    await p.getByRole("button", { name: T.uebung.anlegen }).click();
    await expect.poll(async () => (await botIds()).length).toBe(4);
    await p.getByRole("button", { name: T.uebung.loslaufen }).click();
    const ids = await botIds();
    await expect.poll(async () => (await Promise.all(ids.map((id) => val(`games/${G}/positions/${id}`)))).every(Boolean)).toBe(true);
    const vorher = await val(`games/${G}/positions/${ids[0]}`);
    // nach dem nächsten Takt (5 s) ein Stück weiter
    await expect.poll(async () => (await val(`games/${G}/positions/${ids[0]}`)).t, { timeout: 12_000 }).toBeGreaterThan(vorher.t);
    // weiter, während die Spielleitung in „Live“ zuschaut (der Treiber hängt nicht an der Steuerung)
    await p.getByRole("link", { name: T.admin.nav.live }).first().click();
    const inLive = (await val(`games/${G}/positions/${ids[0]}`)).t;
    await expect.poll(async () => (await val(`games/${G}/positions/${ids[0]}`)).t, { timeout: 12_000 }).toBeGreaterThan(inLive);
    await p.getByRole("link", { name: T.admin.nav.steuerung }).first().click();
    await p.getByRole("button", { name: T.uebung.anhalten }).click();
  });

  it("Team-Flyer: kleiner QR-Code für die Android-App", async () => {
    await p.getByRole("link", { name: T.admin.nav.teams }).click();
    await p.getByRole("tab", { name: T.admin.zugaenge }).click();
    await p.emulateMedia({ media: "print" });
    const apk = p.locator(".sheet.team .apk");
    expect(await apk.locator("svg").count()).toBe(1);
    expect(await apk.innerText()).toContain(T.druck.android.toUpperCase());
    await p.emulateMedia({ media: "screen" });
  });

  it("Fehler in der App landen im Protokoll (E-79)", async () => {
    await p.evaluate(() =>
      setTimeout(() => {
        throw new Error("Testfehler für das Protokoll");
      }),
    );
    await expect
      .poll(
        async () =>
          Object.values((await val(`games/${G}/audit`)) as Record<string, { action: string; details: string }>).find(
            (e) => e.action === PROTOKOLL.appFehler,
          )?.details,
      )
      .toMatch(/^Error: Testfehler für das Protokoll.* – #\/spiel – Browser, /);
  });
});
