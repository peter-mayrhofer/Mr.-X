// Ende-zu-Ende: Bonus-Posten (E-75). Spielleitung druckt die QR-Blätter im Spielfeld-Editor; ein Jäger-Team sieht den
// Scan-Knopf auf der Karte und bekommt nach dem Scannen (Link aus dem QR-Code) Richtung und Entfernung zu Mister X.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { T } from "../app/src/texte.ts";
import { call, connect, eventually, join, resetServer, set, startApp, superAdminToken, val, visible, type Device } from "./helpers.ts";

const G = "linz-posten";
const PORT = 5199;
const URL = `http://127.0.0.1:${PORT}/`;
// Hauptplatz Linz
const HP = { lat: 48.3059, lng: 14.2862 };
let vite: ViteDevServer;
let browser: Browser;
let admin: Device, urfahr: Device;
let codes: Record<string, string>;
let team: Page;

const run = (d: Device, action: string, extra: Record<string, unknown> = {}) => call(d.token, { action, gameId: G, ...extra });

beforeAll(async () => {
  await resetServer();
  const sa = await superAdminToken();
  await call(sa, { action: "createGame", gameId: G, name: "Posten-Test", template: "linz", adminPassword: "admin1234" });
  admin = await join(G, "admin", "Vorab", "admin1234");
  await run(admin, "setSecret", { kind: "teamPw", value: "falke27" });
  const field = await val(`games/${G}/field`);
  await run(admin, "setField", {
    field: {
      ...field,
      posten: [
        { id: "brunnen1", name: "Brunnen", ...HP },
        { id: "turm22", name: "Turm", lat: HP.lat + 0.003, lng: HP.lng },
      ],
    },
  });
  codes = (await run(admin, "postenCodes")).result!.codes as Record<string, string>;
  urfahr = await join(G, "team", "Urfahr", "falke27");
  vite = await startApp(PORT);
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await vite?.close();
});

describe("Bonus-Posten", { timeout: 60_000 }, () => {
  it("Spielleitung: Posten im Editor, QR-Blätter zum Drucken", async () => {
    const p = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" })).newPage();
    await p.goto(`${URL}#/staff/admin?g=${G}`);
    await p.getByLabel(T.staffLogin.name).fill("Peter");
    await p.getByLabel(T.staffLogin.adminPasswort).fill("admin1234");
    await p.getByRole("button", { name: T.staffLogin.los, exact: true }).click();
    await p.getByRole("link", { name: T.admin.nav.zonen }).click();
    await p.getByRole("button", { name: new RegExp(`^${T.zonen.posten}`) }).click();
    await p.getByRole("button", { name: "Turm", exact: true }).waitFor();
    // Druckdialog gibt es im Test nicht – nur prüfen, dass die Blätter mit QR-Code eingehängt werden
    await p.evaluate(() => (window.print = () => {}));
    await p.getByRole("button", { name: T.zonen.postenDrucken }).click();
    await expect.poll(() => p.locator(".posten-blaetter .blatt").count()).toBe(2);
    expect(await p.locator(".posten-blaetter .blatt").first().innerText()).toContain("Brunnen");
    expect(await p.locator(".posten-blaetter .blatt svg").count()).toBe(2);
    expect(await p.evaluate(() => document.documentElement.dataset.druck)).toBe("posten");
    // beim Drucken sichtbar – das Druckblatt der Zugänge darf sie nicht verstecken
    await p.emulateMedia({ media: "print" });
    expect(
      await p
        .locator(".posten-blaetter .blatt")
        .first()
        .evaluate((e) => getComputedStyle(e).visibility),
    ).toBe("visible");
  });

  it("Jäger-Team: Scan-Knopf auf der Karte, Hinweis nach dem Scannen", async () => {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: "de-AT",
      reducedMotion: "reduce",
      geolocation: { latitude: HP.lat + 0.0001, longitude: HP.lng, accuracy: 8 },
      permissions: ["geolocation"],
    });
    team = await ctx.newPage();
    await team.goto(`${URL}#/beitreten/${G}`);
    await team.getByLabel(T.beitritt.teamname).fill("Traun");
    await team.getByLabel(T.beitritt.passwort).fill("falke27");
    await team.getByRole("button", { name: T.beitritt.los, exact: true }).click();
    await team.getByRole("button", { name: T.onboarding.ueberspringen, exact: true }).click();
    await team.getByRole("heading", { name: T.lobby.angemeldet }).waitFor();
    await run(admin, "startGame", { mrx: urfahr.teamId });
    await set(`games/${G}/locks`, null);
    // Mister X gut 1 km nördlich
    const mrx = connect(urfahr.token);
    await mrx.until(() => true);
    mrx.sendPos({ lat: HP.lat + 0.009, lng: HP.lng, acc: 8, t: Date.now() });
    const traun = Object.entries((await val(`games/${G}/teams`)) as Record<string, { name: string }>).find(
      ([, t]) => t.name === "Traun",
    )![0];
    await eventually(
      () => val(`games/${G}/positions/${traun}`),
      (x) => !!x,
    );
    await team.getByRole("button", { name: T.posten.scannen }).waitFor();
    // was der Scanner liefert: der Link aus dem QR-Code
    await team.goto(`${URL}#/posten/${G}/${codes.brunnen1}`);
    await visible(team, T.posten.hinweis(1000, T.posten.richtungen[0]));
    await team.getByRole("button", { name: T.posten.zurueck }).click();
    await team.getByRole("button", { name: T.posten.scannen }).waitFor();
    // zweites Mal: schon eingelöst
    await team.goto(`${URL}#/posten/${G}/${codes.brunnen1}`);
    await visible(team, T.posten.schon);
    mrx.close();
  });
});
