// Ende-zu-Ende (Meilenstein 10): Großbild am Laptop und Zuschauer am Handy über die echte App – Warteraum, Start,
// Meldung per Alarm, Durchsage, Übergabe, Spielende mit Auswertung; danach Archiv mit Wiederholung und Datei-Export.
// Der Zuschauer bekommt keine Live-Positionen (der Server schickt sie nicht – hier sichtbar: keine Team-Marker).
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { T } from "../app/src/texte.ts";
import { call, join, resetServer, set, startApp, superAdminToken, val, type Device } from "./helpers.ts";

const G = "linz-gross";
const PORT = 5184;
const URL = `http://127.0.0.1:${PORT}/`;
let vite: ViteDevServer;
let browser: Browser;
let admin: Device;
let screen: Page;
let viewer: Page;
const team: Record<string, Device> = {};

const api = async (action: string, extra: Record<string, unknown> = {}) => {
  const r = await call(admin.token, { action, gameId: G, ...extra });
  if (r.error) throw new Error(`${action}: ${r.error.message}`);
  return r.result!;
};
const visible = (page: Page, text: string) => page.getByText(text, { exact: false }).first().waitFor({ timeout: 15_000 });
const at = (dLat: number) => ({ lat: 48.3059 + dLat, lng: 14.2862, acc: 8, t: Date.now() });

/** Gerät mit gespeicherter Sitzung öffnen (wie nach einem Beitritt) */
async function asDevice(d: Device, role: string, viewport = { width: 1280, height: 860 }) {
  const ctx = await browser.newContext({ viewport, locale: "de-AT", reducedMotion: "reduce", acceptDownloads: true });
  await ctx.addInitScript(
    ([s]) => localStorage.setItem("mrx.sitzung", s!),
    [JSON.stringify({ gameId: G, token: d.token, uid: d.uid, role })],
  );
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("PAGEERROR", role, e.message));
  return page;
}

beforeAll(async () => {
  await resetServer();
  const sa = await superAdminToken();
  await call(sa, { action: "createGame", gameId: G, name: "Großbild-Test", template: "linz", adminPassword: "admin1234" });
  admin = await join(G, "admin", "Peter", "admin1234");
  await api("setSecret", { kind: "teamPw", value: "falke27" });
  for (const [name, dLat] of [
    ["Urfahr", 0],
    ["Traun", 0.0005],
    ["Leonding", 0.01],
  ] as const) {
    team[name] = await join(G, "team", name, "falke27");
    await set(`games/${G}/positions/${team[name].teamId}`, at(dLat));
  }
  vite = await startApp(PORT);
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await vite?.close();
});

describe("Großbild und Zuschauer", { timeout: 60_000 }, () => {
  it("vor dem Start: beide zeigen „Gleich geht's los“ mit Anzahl Teams", async () => {
    const key = (await api("screenLink")).key as string;
    const sctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, locale: "de-AT", reducedMotion: "reduce" });
    screen = await sctx.newPage();
    screen.on("pageerror", (e) => console.error("PAGEERROR screen", e.message));
    await screen.goto(`${URL}#/g/${G}?k=${key}`);
    await visible(screen, T.grossbild.gleich);
    await visible(screen, T.grossbild.teamsAngemeldet(3));

    const vctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "de-AT", reducedMotion: "reduce" });
    viewer = await vctx.newPage();
    viewer.on("pageerror", (e) => console.error("PAGEERROR viewer", e.message));
    await viewer.goto(`${URL}#/z/${G}`);
    await visible(viewer, T.grossbild.zuschauer);
    await visible(viewer, T.grossbild.gleich);
  });

  it("Start: Mister X groß; Großbild zeigt alle Teams auf der Karte, Zuschauer keine", async () => {
    await api("startGame", { mrx: team.Urfahr!.teamId });
    await screen.locator(".who strong", { hasText: "Urfahr" }).waitFor();
    await viewer.locator(".who strong", { hasText: "Urfahr" }).waitFor();
    await screen.locator(".maplibregl-marker", { hasText: "Traun" }).waitFor();
    await screen.locator(".maplibregl-marker", { hasText: "Leonding" }).waitFor();
    expect(await viewer.locator(".maplibregl-marker", { hasText: "Traun" }).count()).toBe(0);
    expect(await viewer.getByText("Leonding").count()).toBe(0);
  });

  it("Meldung per Alarm erscheint im Ticker beider Ansichten", async () => {
    await set(`games/${G}/state/nextReportAt`, Date.now() - 500);
    await visible(screen, T.grossbild.evMeldung("Urfahr"));
    await visible(viewer, T.grossbild.evMeldung("Urfahr"));
  });

  it("Durchsage groß auf dem Großbild (Zuschauer sehen den Chat nicht)", async () => {
    await api("announce", { text: "Treffpunkt um 17 Uhr beim Brunnen" });
    await screen.getByRole("alert").getByText("Treffpunkt um 17 Uhr beim Brunnen").waitFor();
    expect(await viewer.getByText("Treffpunkt um 17 Uhr beim Brunnen").count()).toBe(0);
  });

  it("Übergabe: neuer Mister X, Ereignis im Ticker, Rangliste", async () => {
    await set(`games/${G}/locks`, null);
    await api("handover", { to: team.Traun!.teamId, type: "fang", expectedMrx: team.Urfahr!.teamId, requestId: "gross-fang-1" });
    await screen.locator(".who strong", { hasText: "Traun" }).waitFor();
    await visible(viewer, T.grossbild.evUebergabe("Traun", "Urfahr"));
    await screen.locator(".rank li", { hasText: "Urfahr" }).waitFor();
    await screen.locator(".rank li", { hasText: "Traun" }).waitFor();
  });

  it("Spielleitung zeigt das Großbild auf dem eigenen Laptop und kommt zurück", async () => {
    const page = await asDevice(admin, "admin");
    await page.goto(`${URL}#/grossbild`);
    await page.locator(".who strong", { hasText: "Traun" }).waitFor();
    await page.locator(".maplibregl-marker", { hasText: "Leonding" }).waitFor();
    // die Durchsage von vorhin liegt evtl. noch groß darüber → ausblenden
    const hide = page.getByRole("button", { name: T.grossbild.ausblenden });
    if (await hide.isVisible()) await hide.click();
    await page.getByRole("button", { name: T.grossbild.zurueck }).click();
    await visible(page, T.admin.warnungen);
    await page.context().close();
  });

  it("Spielende: beide zeigen die Auswertung mit dem Sieger", async () => {
    await api("stopGame");
    for (const p of [screen, viewer]) {
      await visible(p, T.ende.sieger);
      await p.locator("h1", { hasText: "Traun" }).waitFor();
    }
  });

  it("Zuschauer meldet sich ab", async () => {
    await viewer.getByRole("button", { name: T.warten.abmelden }).click();
    await viewer.getByRole("button", { name: T.start.teamBeitreten, exact: true }).waitFor();
  });
});

describe("Archiv und Wiederholung", { timeout: 60_000 }, () => {
  let page: Page;

  it("Liste der Läufe mit Sieger", async () => {
    page = await asDevice(team.Leonding!, "team", { width: 390, height: 844 });
    await page.goto(`${URL}#/archiv`);
    await page.getByRole("button", { name: /Großbild-Test/ }).waitFor();
    await visible(page, `${T.ende.sieger}: Traun`);
  });

  it("Wiederholung: Zeitschieberegler zeigt, wer wann Mister X war", async () => {
    await page.getByRole("button", { name: /Großbild-Test/ }).click();
    const slider = page.getByRole("slider", { name: T.archiv.replay });
    await slider.waitFor();
    await page.locator(".now", { hasText: "Traun" }).waitFor(); // Ende
    const min = Number(await slider.getAttribute("min"));
    await slider.fill(String(min)); // Anfang
    await page.locator(".now", { hasText: "Urfahr" }).waitFor();
    await page.getByRole("tab", { name: T.archiv.chat }).click();
    await visible(page, "Treffpunkt um 17 Uhr beim Brunnen");
  });

  it("Als Datei sichern: JSON mit Auswertung, ohne Live-Standorte", async () => {
    await page.getByRole("tab", { name: T.archiv.auswertung }).click();
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: T.archiv.sichern }).click()]);
    const data = JSON.parse(readFileSync((await dl.path())!, "utf8")) as Record<string, unknown> & { results: { winner: string } };
    expect(data.name).toBe("Großbild-Test");
    expect(data.results.winner).toBe(team.Traun!.teamId);
    expect(data).not.toHaveProperty("positions");
    expect(JSON.stringify(data)).not.toContain('"acc"');
  });

  it("Zuschauer dürfen das Archiv nicht lesen (Server)", async () => {
    const v = await join(G, "viewer", "");
    expect((await call(v.token, { action: "archiveList", gameId: G })).error?.details.reason).toBe("forbidden");
    expect(await val(`games/${G}/positions`)).toEqual({});
  });
});
