// Ende-zu-Ende: Wiederholung mit allen Teams und Video-Export (E-72). Die Wege der Teams werden direkt eingespielt
// (das Sammeln am Server prüft spiel.test.ts); dann Spielende, Archiv öffnen, Teams auf der Karte, Video speichern.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { T } from "../app/src/texte.ts";
import { call, eventually, join, resetServer, set, startApp, superAdminToken, val, visible, type Device } from "./helpers.ts";

const G = "linz-video";
const PORT = 5197;
const MIN = 60_000;
let vite: ViteDevServer;
let browser: Browser;
let p: Page;
let admin: Device;

const run = (d: Device, action: string, extra: Record<string, unknown> = {}) => call(d.token, { action, gameId: G, ...extra });
/** 10 Minuten unterwegs, ein Punkt alle 20 s ([Sekunden, Breite·1e5, Länge·1e5]) */
const weg = (lat: number, lng: number, dLat: number, dLng: number) =>
  Array.from({ length: 30 }, (_, i) => [i * 20, lat + i * dLat, lng + i * dLng]);

beforeAll(async () => {
  await resetServer();
  const sa = await superAdminToken();
  await call(sa, { action: "createGame", gameId: G, name: "Video-Test", template: "linz", adminPassword: "admin1234" });
  admin = await join(G, "admin", "Vorab", "admin1234");
  await run(admin, "setSecret", { kind: "teamPw", value: "falke27" });
  const urfahr = await join(G, "team", "Urfahr", "falke27");
  const traun = await join(G, "team", "Traun", "falke27");
  await run(admin, "startGame", { mrx: urfahr.teamId });
  // Spiel lief schon 10 Minuten, mit einer Meldung von Mister X nach 5 Minuten
  const start = Date.now() - 10 * MIN;
  await set(`games/${G}/state/startedAt`, start);
  await set(`games/${G}/handovers/${Object.keys(await val(`games/${G}/handovers`))[0]}/at`, start);
  const meldung = {
    teamId: urfahr.teamId,
    t: start + 5 * MIN,
    posAt: start + 5 * MIN,
    lat: 48.3045,
    lng: 14.2865,
    src: "handy",
    kind: "auto",
  };
  await set(`games/${G}/reports/m1`, meldung);
  await set(`games/${G}/spuren`, { [urfahr.teamId!]: weg(4830200, 1428300, 8, 6), [traun.teamId!]: weg(4830700, 1429000, -10, -3) });
  await set(`secrets/${G}/endAt`, Date.now() - 1000);
  await eventually(
    () => val(`games/${G}/state/phase`),
    (x) => x === "beendet",
  );
  vite = await startApp(PORT);
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await vite?.close();
});

describe("Wiederholung mit allen Teams", { timeout: 300_000 }, () => {
  it("Archiv zeigt alle Teams auf der Karte", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, reducedMotion: "reduce", acceptDownloads: true });
    p = await ctx.newPage();
    let neuLaden = false;
    p.on("pageerror", (e) => (neuLaden ||= /dynamically imported module/.test(e.message)));
    await p.goto(`http://127.0.0.1:${PORT}/#/staff/admin?g=${G}`);
    await p.getByLabel(T.staffLogin.name).fill("Peter");
    await p.getByLabel(T.staffLogin.adminPasswort).fill("admin1234");
    await p.getByRole("button", { name: T.staffLogin.los, exact: true }).click();
    await visible(p, T.ende.sieger);
    await p.goto(`http://127.0.0.1:${PORT}/#/archiv`);
    await p.getByRole("button", { name: /Video-Test/ }).click();
    await p.getByRole("slider", { name: T.archiv.replay }).waitFor();
    if (neuLaden) await p.reload();
    await p.locator(".maplibregl-marker .team", { hasText: "Traun" }).waitFor();
    await p.locator(".maplibregl-marker .team", { hasText: "Urfahr" }).waitFor();
  });

  it("Video im Querformat: MP4 in 1920 × 1080", async () => {
    await p.getByRole("button", { name: T.archiv.video, exact: true }).click();
    await p.getByRole("tab", { name: T.archiv.querformat }).click();
    const download = p.waitForEvent("download", { timeout: 280_000 });
    const t0 = Date.now();
    await p.getByRole("button", { name: T.archiv.videoErstellen, exact: true }).click();
    await p.getByRole("progressbar", { name: T.archiv.videoLaeuft }).waitFor();
    const d = await download;
    console.log("VIDEO", d.suggestedFilename(), `${Math.round((Date.now() - t0) / 1000)} s`);
    expect(d.suggestedFilename()).toMatch(/^Video-Test-\d{4}-\d\d-\d\d-quer\.mp4$/);
    const mp4 = readFileSync((await d.path())!);
    expect(mp4.subarray(4, 8).toString()).toBe("ftyp");
    expect(mp4.length).toBeGreaterThan(50_000);
  });
});
