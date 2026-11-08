// Download-Karte auf der Startseite (docs/DESKTOP-APP.md): je Gerät der passende Knopf, sonst keiner.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ViteDevServer } from "vite";
import { chromium, type Browser } from "playwright";
import { T } from "../app/src/texte.ts";
import { startApp } from "./helpers.ts";

const PORT = 5192;
const URL = `http://127.0.0.1:${PORT}/`;
let vite: ViteDevServer;
let browser: Browser;

const ALLE = {
  android: { datei: "mister-x.apk", groesse: 8_123_456 },
  windows: { datei: "download/Mister-X-Setup.exe", groesse: 6_400_000 },
  mac: { datei: "download/Mister-X.dmg", groesse: 9_800_000 },
  linux: { datei: "download/mister-x.deb", groesse: 5_200_000 },
};
const UA = {
  windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
};

/** Startseite mit gegebenem Gerät und gegebener downloads.json (null = Datei fehlt am Server) */
async function startseite(userAgent: string, downloads: object | null, touchPunkte = 0) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: "de-AT", userAgent, reducedMotion: "reduce" });
  await ctx.addInitScript(`Object.defineProperty(navigator, "maxTouchPoints", { get: () => ${touchPunkte} })`);
  // Chromium meldet über userAgentData weiter das Wirtssystem – wie Firefox/Safari nur den User-Agent gelten lassen
  await ctx.addInitScript(`Object.defineProperty(navigator, "userAgentData", { get: () => undefined })`);
  const page = await ctx.newPage();
  await page.route("**/downloads.json", (r) => (downloads ? r.fulfill({ json: downloads }) : r.fulfill({ status: 404, body: "" })));
  await page.goto(URL);
  await page.getByRole("button", { name: T.start.teamBeitreten, exact: true }).waitFor();
  await page.waitForTimeout(500);
  return { ctx, page };
}

beforeAll(async () => {
  vite = await startApp(PORT);
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await vite?.close();
});

describe("Download-Karte", () => {
  it("Windows: Installer mit Größe, Hinweis, andere Systeme", async () => {
    const { ctx, page } = await startseite(UA.windows, ALLE);
    const link = page.getByRole("link", { name: T.start.windowsApp });
    expect(await link.getAttribute("href")).toBe("/download/Mister-X-Setup.exe");
    expect(await link.textContent()).toContain("6,4 MB");
    await page.getByText(T.start.windowsHinweis).waitFor();
    await page.getByText(T.start.andereSysteme).click();
    expect(await page.getByRole("link", { name: /^macOS/ }).getAttribute("href")).toBe("/download/Mister-X.dmg");
    expect(await page.getByRole("link", { name: T.start.androidApp }).count()).toBe(0);
    await ctx.close();
  });

  it("Mac: dmg", async () => {
    const { ctx, page } = await startseite(UA.mac, ALLE);
    expect(await page.getByRole("link", { name: T.start.macApp }).getAttribute("href")).toBe("/download/Mister-X.dmg");
    await ctx.close();
  });

  it("iPad (meldet sich als Mac, hat Touch) und iPhone: kein Knopf", async () => {
    for (const [ua, touch] of [
      [UA.mac, 5],
      [UA.iphone, 5],
    ] as const) {
      const { ctx, page } = await startseite(ua, ALLE, touch);
      expect(await page.locator(".karte").count()).toBe(0);
      await ctx.close();
    }
  });

  it("downloads.json fehlt oder ist leer: kein Knopf", async () => {
    for (const d of [null, {}]) {
      const { ctx, page } = await startseite(UA.windows, d);
      expect(await page.locator(".karte").count()).toBe(0);
      await ctx.close();
    }
  });
});
