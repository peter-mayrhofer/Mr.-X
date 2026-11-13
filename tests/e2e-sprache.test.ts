// Ende-zu-Ende: Sprache der Team-Oberfläche. Deutsch als Grundlage, umschaltbar auf Englisch, Spanisch, Italienisch und
// Türkisch – auf der Startseite hinter dem Zahnrad und in den Einstellungen; die Wahl bleibt gespeichert und gilt auch
// für den Beitritt (E-67).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { T } from "../app/src/texte.ts";
import en from "../app/src/texte/en.ts";
import es from "../app/src/texte/es.ts";
import it_ from "../app/src/texte/it.ts";
import tr from "../app/src/texte/tr.ts";
import { MELDUNG, uebersetze } from "@mrx/shared";
import { call, join, resetServer, startApp, superAdminToken, val, visible, type Device } from "./helpers.ts";

const G = "linz-sprache";
const PORT = 5191;
const URL = `http://127.0.0.1:${PORT}/`;
let vite: ViteDevServer;
let browser: Browser;
let admin: Device;

beforeAll(async () => {
  await resetServer();
  const sa = await superAdminToken();
  await call(sa, { action: "createGame", gameId: G, name: "Sprachen-Test", template: "linz", adminPassword: "admin1234" });
  admin = await join(G, "admin", "Peter", "admin1234");
  await call(admin.token, { action: "setSecret", gameId: G, kind: "teamPw", value: "falke27" });
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
  it("Startseite: Sprache nur hinter dem Zahnrad, alle fünf Sprachen", async () => {
    const p = await phone();
    await p.goto(URL);
    await p.getByRole("button", { name: T.start.teamBeitreten }).waitFor();
    expect(await p.evaluate(() => document.documentElement.lang)).toBe("de");
    // nicht offen auf der Startseite
    expect(await p.getByRole("button", { name: "English" }).count()).toBe(0);
    const waehle = async (titel: string, name: string) => {
      await p.getByRole("button", { name: titel }).click();
      await p.getByRole("dialog").getByRole("button", { name }).click();
    };
    await waehle(T.einstellungen.titel, "English");
    await p.getByRole("button", { name: en.start.teamBeitreten }).waitFor();
    expect(await p.evaluate(() => document.documentElement.lang)).toBe("en");
    await p.getByRole("button", { name: en.einstellungen.titel }).click();
    expect(await p.getByRole("dialog").getByRole("button", { name: "English" }).getAttribute("aria-pressed")).toBe("true");
    await p.getByRole("dialog").getByRole("button", { name: "Español" }).click();
    await p.getByRole("button", { name: es.start.teamBeitreten }).waitFor();
    await waehle(es.einstellungen.titel, "Italiano");
    await p.getByRole("button", { name: it_.start.teamBeitreten }).waitFor();
    await waehle(it_.einstellungen.titel, "Türkçe");
    await p.getByRole("button", { name: tr.start.teamBeitreten }).waitFor();
    expect(await p.evaluate(() => document.documentElement.lang)).toBe("tr");
    await waehle(tr.einstellungen.titel, "Deutsch");
    await p.getByRole("button", { name: T.start.teamBeitreten }).waitFor();
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

  it("im Spiel: Server-Meldungen im Chat auf Spanisch, Push-Abo merkt sich die Sprache", async () => {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: "es-ES",
      reducedMotion: "reduce",
      permissions: ["geolocation", "notifications"],
      geolocation: { latitude: 48.3059, longitude: 14.2862, accuracy: 8 },
    });
    await ctx.addInitScript(() => localStorage.setItem("mrx.sprache", "es"));
    const p = await ctx.newPage();
    await p.goto(`${URL}#/beitreten/${G}`);
    await p.getByLabel(es.beitritt.teamname).fill("Urfahr");
    await p.getByLabel(es.beitritt.passwort).fill("falke27");
    await p.getByRole("button", { name: es.beitritt.los, exact: true }).click();
    // Onboarding auf Spanisch, mit Benachrichtigungen (wie ein echtes Team)
    await p.getByRole("heading", { name: es.onboarding.schritte[0].titel }).waitFor();
    await p.getByRole("button", { name: es.allgemein.weiter, exact: true }).click();
    await p.getByRole("button", { name: es.onboarding.schritte[1].knopf, exact: true }).click();
    await p.getByRole("button", { name: es.onboarding.schritte[2].knopf, exact: true }).click();
    await p.getByRole("button", { name: es.onboarding.ueberspringen, exact: true }).click();
    await p.getByRole("heading", { name: es.lobby.angemeldet }).waitFor();
    // Web-Push-Abo mit Sprache → der Server schickt Pushes auf Spanisch
    await expect
      .poll(async () => Object.values(((await val(`games/${G}/push`)) ?? {}) as Record<string, { lang?: string }>).map((x) => x.lang))
      .toContain("es");
    await join(G, "team", "Traun", "falke27");
    const teams = (await val(`games/${G}/teams`)) as Record<string, { name: string }>;
    const mrx = Object.entries(teams).find(([, t]) => t.name === "Urfahr")![0];
    const r = await call(admin.token, { action: "startGame", gameId: G, mrx });
    expect(r.error).toBeUndefined();
    await visible(p, es.status.ihrSeidMrx);
    await p.getByRole("button", { name: es.tabs.chat, exact: true }).click();
    const cfg = (await val(`games/${G}/config`)) as { headStartMin: number };
    await visible(p, uebersetze(MELDUNG.start("Urfahr", cfg.headStartMin), "es"));
    await ctx.close();
  });
});
