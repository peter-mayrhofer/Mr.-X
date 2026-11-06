// Ende-zu-Ende (Meilenstein 11): Spielleitung legt einen Tracker über die echte App an, liest die Einrichtung ab
// (Geräte-Kennung + Server-Adresse), ordnet ihn der Fahne zu; ein simulierter Traccar Client sendet – die App zeigt
// „sendet“ mit Akku an.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { T } from "../app/src/texte.ts";
import { call, join, resetServer, SERVER, startApp, superAdminToken, val, type Device } from "./helpers.ts";

const G = "linz-geraete";
const PORT = 5185;
const URL = `http://127.0.0.1:${PORT}/`;
let vite: ViteDevServer;
let browser: Browser;
let admin: Device;
let page: Page;

beforeAll(async () => {
  await resetServer();
  const sa = await superAdminToken();
  await call(sa, { action: "createGame", gameId: G, name: "Geräte-Test", template: "linz", adminPassword: "admin1234" });
  admin = await join(G, "admin", "Peter", "admin1234");
  vite = await startApp(PORT);
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "de-AT", reducedMotion: "reduce" });
  await ctx.addInitScript(
    ([s]) => localStorage.setItem("mrx.sitzung", s!),
    [JSON.stringify({ gameId: G, token: admin.token, uid: admin.uid, role: "admin" })],
  );
  page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("PAGEERROR", e.message));
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await vite?.close();
});

describe("Tracker einrichten", { timeout: 60_000 }, () => {
  let deviceId = "";

  it("anlegen: Einrichtung zeigt Geräte-Kennung und Server-Adresse", async () => {
    await page.goto(`${URL}#/spiel?b=teams`);
    await page.getByRole("tab", { name: /Tracker/ }).click();
    await page.getByText(T.tracker.keine).waitFor();
    await page.getByLabel(T.tracker.name).fill("Tracker Fahne");
    await page.getByRole("button", { name: T.tracker.hinzufuegen }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByText(T.tracker.schritt2).waitFor();
    const codes = await sheet.locator("code").allTextContents();
    deviceId = codes[0]!;
    expect(deviceId.startsWith(`${G}.`)).toBe(true);
    expect(codes[1]).toBe(`${URL.replace(/\/$/, "")}/tracker`);
    await page.keyboard.press("Escape");
  });

  it("der Fahne zuordnen; simulierter Traccar Client sendet → „sendet“ mit Akku", async () => {
    await page.getByRole("combobox", { name: T.tracker.zuordnungFuer("Tracker Fahne") }).selectOption("fahne");
    await page.getByText(T.tracker.zugeordnet("Tracker Fahne", T.tracker.fahne)).waitFor();
    const r = await fetch(
      `${SERVER}/tracker?id=${encodeURIComponent(deviceId)}&lat=48.3059&lon=14.2862&timestamp=${Math.floor(Date.now() / 1000)}&batt=81`,
    );
    expect(r.status).toBe(200);
    await page.getByText(T.tracker.sendet).waitFor();
    await page.getByText("81 %").waitFor();
    const devices = await val(`games/${G}/devices`);
    expect(Object.values(devices as Record<string, { assign: string }>)[0]!.assign).toBe("fahne");
  });
});
