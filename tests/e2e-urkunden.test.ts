// Urkunden (E-65): ein A4-Blatt pro Team, beim Druck nur die Urkunden – das Zugangs-Druckblatt bleibt weg,
// nach dem Druckdialog ist alles wieder wie vorher. Geprüft am Klick-Prototyp (12 Beispiel-Teams).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { T } from "../app/src/texte.ts";
import { startApp } from "./helpers.ts";

const PORT = 5194;
const URL = `http://127.0.0.1:${PORT}/`;
let vite: ViteDevServer;
let browser: Browser;

/** Seite öffnen; print() zählt nur mit, statt den Dialog zu öffnen */
async function seite(pfad: string) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  await page.addInitScript(() => {
    (window as unknown as { gedruckt: number }).gedruckt = 0;
    window.print = () => void (window as unknown as { gedruckt: number }).gedruckt++;
  });
  await page.goto(`${URL}#${pfad}`);
  return page;
}
const druckZustand = (page: Page) =>
  page.evaluate(() => ({
    gedruckt: (window as unknown as { gedruckt: number }).gedruckt,
    blaetter: document.querySelectorAll(".urkunden .urk").length,
    modus: document.documentElement.dataset.druck ?? null,
  }));

beforeAll(async () => {
  vite = await startApp(PORT);
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await vite?.close();
});

describe("Urkunden", () => {
  it("Auswertung: ein Blatt pro Team mit Name, der Sieger mit Stempel; danach aufgeräumt", async () => {
    const page = await seite("/prototyp/19");
    await page.getByRole("button", { name: T.urkunde.knopf }).click();
    await expect.poll(() => druckZustand(page)).toEqual({ gedruckt: 1, blaetter: 12, modus: "urkunden" });
    const urk = page.locator(".urkunden .urk");
    await expect.poll(() => urk.filter({ hasText: "Auwiesen" }).locator(".stempel.sieger").count()).toBe(1);
    expect(await urk.locator(".stempel.sieger").count()).toBe(1);
    // „Mission erfüllt“ bekommt jedes Team
    expect(await urk.locator(".stempel.rund").count()).toBe(12);
    expect(await urk.first().textContent()).toContain("Mister X Linz 2027");
    // im Druck: nur die Urkunden, der Rest der App ist ganz weg
    await page.emulateMedia({ media: "print" });
    expect(await page.locator("#app").evaluate((e) => getComputedStyle(e).display)).toBe("none");
    expect(await urk.first().evaluate((e) => getComputedStyle(e).display)).toBe("flex");
    // Druckdialog zu → Urkunden weg, Modus zurück
    await page.evaluate(() => dispatchEvent(new Event("afterprint")));
    await expect.poll(() => druckZustand(page)).toEqual({ gedruckt: 1, blaetter: 0, modus: null });
    await page.close();
  });

  it("Teams & Zugänge: Urkunden ohne Sieger; danach druckt das Zugangs-Blatt wieder wie bisher", async () => {
    const page = await seite("/prototyp/15?v=zugaenge");
    await page.getByRole("button", { name: T.urkunde.knopf }).click();
    await expect.poll(() => druckZustand(page)).toMatchObject({ gedruckt: 1, modus: "urkunden" });
    expect((await druckZustand(page)).blaetter).toBeGreaterThan(0);
    expect(await page.locator(".urkunden .stempel.sieger").count()).toBe(0);
    await page.emulateMedia({ media: "print" });
    expect(await page.locator("section.sheet").evaluate((e) => getComputedStyle(e).display)).toBe("none");
    await page.evaluate(() => dispatchEvent(new Event("afterprint")));
    await expect.poll(() => druckZustand(page)).toMatchObject({ blaetter: 0, modus: null });
    // ohne Urkunden-Modus druckt das Zugangs-Blatt wie bisher (sichtbar im Druck), Urkunden gibt es keine
    expect(await page.locator("section.sheet").evaluate((e) => getComputedStyle(e).display)).toBe("flex");
    expect(await page.locator(".urkunden").count()).toBe(0);
    await page.close();
  });
});
