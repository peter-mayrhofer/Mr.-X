// Ende-zu-Ende: Karte zentrieren und mitdrehen (E-71). 1× tippen = folgen, 2× = Karte dreht mit dem Kompass,
// 3× = Norden oben; mit dem Finger verschieben = frei. Headless-Chromium hat keinen Kompass – darum ein künstlicher.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { T } from "../app/src/texte.ts";
import { startApp } from "./helpers.ts";

const PORT = 5196;
let vite: ViteDevServer;
let browser: Browser;
let p: Page;

beforeAll(async () => {
  vite = await startApp(PORT);
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await vite?.close();
});

const knopf = () => p.getByRole("button", { name: new RegExp(`^(${T.karte.aufMich}|${T.karte.mitdrehen}|${T.karte.nordenOben})$`) });
const peilung = () => p.locator(".maplibregl-map").evaluate((e) => (e as HTMLElement).style.getPropertyValue("--peilung") || "0deg");
const kompass = (alpha: number) =>
  p.evaluate((a) => dispatchEvent(new DeviceOrientationEvent("deviceorientationabsolute", { absolute: true, alpha: a })), alpha);

describe("Karte zentrieren und mitdrehen", { timeout: 60_000 }, () => {
  it("folgen, mitdrehen nach Kompass, Norden oben, Verschieben beendet", async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    await ctx.addInitScript(() => {
      const w = window as unknown as Record<string, unknown>;
      w.DeviceOrientationEvent = class extends Event {
        constructor(n: string, i: Record<string, unknown> = {}) {
          super(n);
          Object.assign(this, i);
        }
      };
      w.ondeviceorientationabsolute = null;
    });
    p = await ctx.newPage();
    // erster Start des Testservers: Vite bereitet maplibre noch vor – dann einmal neu laden
    let neuLaden = false;
    p.on("pageerror", (e) => (neuLaden ||= /dynamically imported module/.test(e.message)));
    await p.goto(`http://127.0.0.1:${PORT}/#/prototyp/6?clean`);
    await p.waitForTimeout(1500);
    if (neuLaden) await p.reload();
    await p.locator(".maplibregl-canvas").waitFor();
    await p.waitForTimeout(500);
    expect(await knopf().getAttribute("aria-label")).toBe(T.karte.aufMich);
    await knopf().click();
    expect(await knopf().getAttribute("aria-label")).toBe(T.karte.mitdrehen);
    await knopf().click();
    expect(await knopf().getAttribute("aria-label")).toBe(T.karte.nordenOben);
    await kompass(270); // Handy zeigt nach Osten
    await expect.poll(peilung).toBe("90deg");
    await kompass(180); // nach Süden
    await expect.poll(peilung).toBe("180deg");
    await knopf().click();
    await expect.poll(peilung).toBe("0deg");
    // wieder mitdrehen, dann mit dem Finger verschieben → frei, Norden oben
    await knopf().click();
    await kompass(270);
    await expect.poll(peilung).toBe("90deg");
    // „Mister X zeigen“ beendet das Mitdrehen: Norden wieder oben (vorher blieb die Karte schief stehen)
    await p.getByRole("button", { name: T.karte.misterXZeigen }).click();
    await expect.poll(peilung).toBe("0deg");
    await knopf().click();
    await knopf().click();
    await kompass(270);
    await expect.poll(peilung).toBe("90deg");
    await p.mouse.move(200, 600);
    await p.mouse.down();
    await p.mouse.move(120, 500, { steps: 8 });
    await p.mouse.up();
    await expect.poll(() => knopf().getAttribute("aria-label")).toBe(T.karte.aufMich);
    await expect.poll(peilung).toBe("0deg");
  });
});
