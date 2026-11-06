// Ende-zu-Ende: Sprache der Team-Oberfläche. Deutsch als Grundlage, umschaltbar auf Englisch, Türkisch und BKS –
// auf der Startseite und in den Einstellungen; die Wahl bleibt gespeichert und gilt auch für den Beitritt.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { T } from "../app/src/texte.ts";
import en from "../app/src/texte/en.ts";
import tr from "../app/src/texte/tr.ts";
import bks from "../app/src/texte/bks.ts";
import { call, resetServer, startApp, superAdminToken } from "./helpers.ts";

const G = "linz-sprache";
const PORT = 5191;
const URL = `http://127.0.0.1:${PORT}/`;
let vite: ViteDevServer;
let browser: Browser;

beforeAll(async () => {
  await resetServer();
  const sa = await superAdminToken();
  await call(sa, { action: "createGame", gameId: G, name: "Sprachen-Test", template: "linz", adminPassword: "admin1234" });
  vite = await startApp(PORT);
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await vite?.close();
});

const phone = async (): Promise<Page> => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "de-AT", reducedMotion: "reduce" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.error("PAGEERROR", e.message));
  return p;
};

describe("Sprachen", { timeout: 60_000 }, () => {
  it("Startseite: Deutsch, dann Englisch, Türkisch und BKS über die Sprachwahl", async () => {
    const p = await phone();
    await p.goto(URL);
    await p.getByRole("button", { name: T.start.teamBeitreten }).waitFor();
    expect(await p.evaluate(() => document.documentElement.lang)).toBe("de");
    await p.getByRole("button", { name: "English" }).click();
    await p.getByRole("button", { name: en.start.teamBeitreten }).waitFor();
    expect(await p.getByRole("button", { name: "English" }).getAttribute("aria-pressed")).toBe("true");
    expect(await p.evaluate(() => document.documentElement.lang)).toBe("en");
    await p.getByRole("button", { name: "Türkçe" }).click();
    await p.getByRole("button", { name: tr.start.teamBeitreten }).waitFor();
    await p.getByRole("button", { name: "BKS" }).click();
    await p.getByRole("button", { name: bks.start.teamBeitreten }).waitFor();
    expect(await p.evaluate(() => document.documentElement.lang)).toBe("bs");
  });

  it("die Wahl bleibt: Beitritt auf Englisch", async () => {
    const p = await phone();
    await p.addInitScript(() => localStorage.setItem("mrx.sprache", "en"));
    await p.goto(`${URL}#/beitreten/${G}`);
    await p.getByText("Sprachen-Test").first().waitFor();
    await p.getByLabel(en.beitritt.teamname).waitFor();
    await p.getByLabel(en.beitritt.passwort).waitFor();
    await p.getByRole("button", { name: en.beitritt.los, exact: true }).waitFor();
  });
});
