// Desktop-App (docs/DESKTOP-APP.md, Phase 4): Brücke zur Tauri-Hülle. Die Hülle wird hier durch ein falsches
// `__TAURI_INTERNALS__` ersetzt, das alle Aufrufe protokolliert: Großbild-Knopf, Hinweis „Neue Version“, Benachrichtigung.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { T } from "../app/src/texte.ts";
import { call, join, resetServer, startApp, superAdminToken, type Device } from "./helpers.ts";

const G = "linz-desktop";
const PORT = 5193;
const URL = `http://127.0.0.1:${PORT}/`;
const WIN_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const DATEIEN = { windows: { datei: "download/Mister-X-Setup.exe", groesse: 6_400_000 } };
let vite: ViteDevServer;
let browser: Browser;
let admin: Device;
let urfahr: Device;

type Aufruf = { befehl: string; args: Record<string, unknown> };
declare global {
  interface Window {
    __aufrufe: Aufruf[];
  }
}

/** Seite in der „Desktop-App“; `antwort` = was die Hülle auf grossbild_oeffnen antwortet */
async function desktop(opts: { downloads?: object; antwort?: string; sitzung?: Device; hintergrund?: boolean }) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 860 },
    locale: "de-AT",
    userAgent: WIN_UA,
    reducedMotion: "reduce",
  });
  await ctx.addInitScript(
    ([antwort, hintergrund]) => {
      window.__aufrufe = [];
      window.__MRX_DESKTOP__ = "2.0.0-beta.1";
      window.__TAURI_INTERNALS__ = {
        invoke: async (befehl, args) => {
          window.__aufrufe.push({ befehl, args: args ?? {} });
          return befehl === "grossbild_oeffnen" ? antwort : undefined;
        },
      };
      if (hintergrund) document.hasFocus = () => false;
    },
    [opts.antwort ?? "beamer", !!opts.hintergrund] as const,
  );
  if (opts.sitzung)
    await ctx.addInitScript(
      ([s]) => localStorage.setItem("mrx.sitzung", s!),
      [JSON.stringify({ gameId: G, token: opts.sitzung.token, uid: opts.sitzung.uid, role: "admin" })],
    );
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("PAGEERROR desktop", e.message));
  await page.route("**/downloads.json", (r) => r.fulfill({ json: opts.downloads ?? {} }));
  return { ctx, page };
}
const aufrufe = (page: Page) => page.evaluate(() => window.__aufrufe);

beforeAll(async () => {
  await resetServer();
  const sa = await superAdminToken();
  await call(sa, { action: "createGame", gameId: G, name: "Desktop-Test", template: "linz", adminPassword: "admin1234" });
  admin = await join(G, "admin", "Peter", "admin1234");
  await call(admin.token, { action: "setSecret", gameId: G, kind: "teamPw", value: "falke27" });
  urfahr = await join(G, "team", "Urfahr", "falke27");
  vite = await startApp(PORT);
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await vite?.close();
});

describe("Desktop-App", { timeout: 60_000 }, () => {
  it("Update-Hinweis bei anderer Version: Klick öffnet den Installer im Browser", async () => {
    const { ctx, page } = await desktop({ downloads: { ...DATEIEN, desktopVersion: "2.0.0-beta.2" } });
    await page.goto(URL);
    await page.getByText(T.update.desktopTitel).waitFor();
    await page.getByRole("button", { name: T.update.desktopLaden }).click();
    expect(await aufrufe(page)).toContainEqual({
      befehl: "plugin:opener|open_url",
      args: { url: `${URL}download/Mister-X-Setup.exe` },
    });
    await ctx.close();
  });

  it("kein Hinweis bei gleicher Version, ohne Version oder ohne Installer", async () => {
    for (const d of [{ ...DATEIEN, desktopVersion: "2.0.0-beta.1" }, DATEIEN, { desktopVersion: "2.0.0-beta.2" }]) {
      const { ctx, page } = await desktop({ downloads: d });
      await page.goto(URL);
      await page.getByRole("button", { name: T.start.teamBeitreten, exact: true }).waitFor();
      await page.waitForTimeout(500);
      expect(await page.getByText(T.update.desktopTitel).count()).toBe(0);
      await ctx.close();
    }
  });

  it("kein Download-Knopf auf der Startseite", async () => {
    const { ctx, page } = await desktop({ downloads: { ...DATEIEN, desktopVersion: "2.0.0-beta.1" } });
    await page.goto(URL);
    await page.getByRole("button", { name: T.start.teamBeitreten, exact: true }).waitFor();
    await page.waitForTimeout(500);
    expect(await page.locator(".karte").count()).toBe(0);
    expect(await page.getByRole("link", { name: T.start.windowsApp }).count()).toBe(0);
    await ctx.close();
  });

  it("Großbild-Knopf: ruft grossbild_oeffnen mit der Großbild-Adresse, Meldung je nach Bildschirm", async () => {
    for (const [antwort, text] of [
      ["beamer", T.grossbild.beamerOk],
      ["gleicher-bildschirm", T.grossbild.beamerGleich],
    ] as const) {
      const { ctx, page } = await desktop({ sitzung: admin, antwort });
      await page.goto(`${URL}#/spiel?b=teams`);
      await page.getByText(T.admin.zugaenge, { exact: true }).click();
      await page.getByRole("button", { name: T.grossbild.beamer }).click();
      await page.getByText(text).waitFor();
      expect((await aufrufe(page)).filter((a) => a.befehl === "grossbild_oeffnen")).toEqual([
        { befehl: "grossbild_oeffnen", args: { url: `${URL}#/grossbild` } },
      ]);
      await ctx.close();
    }
  });

  it("im Browser gibt es den Knopf nicht", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: "de-AT", reducedMotion: "reduce" });
    await ctx.addInitScript(
      ([s]) => localStorage.setItem("mrx.sitzung", s!),
      [JSON.stringify({ gameId: G, token: admin.token, uid: admin.uid, role: "admin" })],
    );
    const page = await ctx.newPage();
    await page.goto(`${URL}#/spiel?b=teams`);
    await page.getByText(T.admin.zugaenge, { exact: true }).click();
    await page.getByText(T.zugang.grossbildZeigen).waitFor();
    expect(await page.getByRole("button", { name: T.grossbild.beamer }).count()).toBe(0);
    await ctx.close();
  });

  it("neue Nachricht eines Teams: Benachrichtigung nur bei Fenster im Hintergrund, einmal", async () => {
    const { ctx, page } = await desktop({ sitzung: admin, hintergrund: true });
    await page.goto(`${URL}#/spiel?b=live`);
    await page.getByText(T.admin.nav.chat).first().waitFor();
    await call(urfahr.token, { action: "chat", gameId: G, text: "Wir stehen am Hauptplatz", dm: urfahr.teamId });
    await page.waitForFunction(() => window.__aufrufe.some((a) => a.befehl === "melden"));
    expect((await aufrufe(page)).filter((a) => a.befehl === "melden")).toEqual([
      { befehl: "melden", args: { titel: T.melden.nachrichtTitel, text: T.melden.nachricht("Urfahr", "Wir stehen am Hauptplatz") } },
    ]);
    await ctx.close();
  });
});
