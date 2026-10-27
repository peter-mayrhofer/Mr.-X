// Ende-zu-Ende (Meilenstein 7): Organisator legt ein Spiel ohne Vorlage an, öffnet es, zeichnet ein Spielfeld,
// lädt die Linz-Vorlage, speichert, archiviert, reaktiviert und löscht das Spiel – alles über die echte App.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { T } from "../app/src/texte.ts";
import { resetEmulators, superAdminToken, val } from "./helpers.ts";

const PORT = 5183;
const URL = `http://127.0.0.1:${PORT}/`;
const G = "wels-2028";
let vite: ViteDevServer;
let browser: Browser;
let page: Page;

beforeAll(async () => {
  await resetEmulators();
  await superAdminToken(); // legt super@test.at an (Freigabeliste der Emulator-Umgebung)
  vite = await createServer({
    root: "app",
    configFile: "app/vite.config.ts",
    mode: "emu",
    logLevel: "error",
    server: { port: PORT, strictPort: true, host: "127.0.0.1" },
  });
  await vite.listen();
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await vite?.close();
});

const confirm = (label: string) => page.getByRole("dialog").getByRole("button", { name: label, exact: true }).click();

describe("Organisator: Spiel anlegen, Spielfeld zeichnen, verwalten", { timeout: 60_000 }, () => {
  it("Google-Login und Spiel ohne Vorlage anlegen", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: "de-AT", reducedMotion: "reduce" });
    page = await ctx.newPage();
    page.on("pageerror", (e) => console.error("PAGEERROR", e.message));
    await page.goto(`${URL}#/verwaltung`);
    const [popup] = await Promise.all([
      page.waitForEvent("popup"),
      page.getByRole("button", { name: T.verwaltung.anmelden, exact: true }).click(),
    ]);
    await popup.waitForLoadState("load");
    await popup.locator("#email-input, #add-account-button").first().waitFor();
    if (await popup.locator("#add-account-button").isVisible()) await popup.locator("#add-account-button").click();
    await popup.locator("#email-input").fill("orga@test.at");
    await popup.locator("#sign-in").click();
    await page.getByText(T.superadmin.angemeldet("orga@test.at")).waitFor();

    await page.getByRole("button", { name: T.superadmin.neu, exact: true }).click();
    await page.getByLabel(T.superadmin.name).fill("Wels 2028");
    await page.getByRole("tab", { name: T.verwaltung.leeresFeld }).click();
    await page.getByLabel(T.staffLogin.adminPasswort).fill("wels12345");
    await page.getByRole("dialog").getByRole("button", { name: T.superadmin.neu, exact: true }).click();
    await page.getByText(T.verwaltung.angelegt("Wels 2028")).waitFor();
  });

  it("Öffnen ohne Admin-Passwort → Steuerung meldet fehlendes Spielfeld", async () => {
    await page.getByRole("button", { name: T.verwaltung.oeffnen, exact: true }).click();
    await page.getByText(T.admin.feldFehlt).waitFor();
  });

  it("Spielfeld anlegen und speichern, dann Linz-Vorlage laden und speichern", async () => {
    await page.getByRole("link", { name: T.admin.nav.zonen }).click();
    await page.getByText(T.zonen.nochKeinFeld).waitFor();
    await page.getByRole("button", { name: T.zonen.feldAnlegen, exact: true }).click();
    await page.getByText(T.zonen.ok).waitFor();
    await page.getByRole("button", { name: T.allgemein.speichern, exact: true }).click();
    await page.getByRole("button", { name: T.zonen.allesGespeichert, exact: true }).waitFor();
    expect(await val(`games/${G}/field/base`)).toHaveLength(5);

    await page.getByRole("button", { name: T.zonen.vorlageLaden, exact: true }).click();
    await page.getByRole("button", { name: T.allgemein.speichern, exact: true }).click();
    await page.getByRole("button", { name: T.zonen.allesGespeichert, exact: true }).waitFor();
    expect(Object.keys(await val(`games/${G}/field/cuts`))).toHaveLength(4);
    // GeoJSON exportieren …
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: T.zonen.exportieren }).click()]);
    const exported = JSON.parse(readFileSync((await dl.path())!, "utf8")) as { features: { properties: { rolle: string } }[] };
    expect(exported.features.map((f) => f.properties.rolle)).toEqual(["spielfeld", ...Array(4).fill("sperrbereich")]);
    // … und eine Datei mit nur einem Sperrbereich importieren
    const one = { ...exported, features: exported.features.slice(0, 2) };
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: "feld.geojson", mimeType: "application/geo+json", buffer: Buffer.from(JSON.stringify(one)) });
    await page.getByText(T.zonen.importiert).waitFor();
    await page.getByRole("button", { name: T.allgemein.speichern, exact: true }).click();
    await page.getByRole("button", { name: T.zonen.allesGespeichert, exact: true }).waitFor();
    expect(Object.keys(await val(`games/${G}/field/cuts`))).toHaveLength(1);
    await page.getByRole("button", { name: T.zonen.vorlageLaden, exact: true }).click();
    await page.getByRole("button", { name: T.allgemein.speichern, exact: true }).click();
    await page.getByRole("button", { name: T.zonen.allesGespeichert, exact: true }).waitFor();
    // Steuerung zeigt die Bereiche zum Sperren
    await page.getByRole("link", { name: T.admin.nav.steuerung }).click();
    await page.getByText("Mitte-Ost").first().waitFor();
  });

  it("archivieren, reaktivieren, löschen", async () => {
    await page.goto(`${URL}#/verwaltung`);
    const row = page.locator("section.card", { hasText: "Wels 2028" });
    await row.getByRole("button", { name: T.superadmin.archivieren }).click();
    await row.getByText(T.superadmin.phase.archiviert).waitFor();
    expect(await val(`gameIndex/${G}/archived`)).toBe(true);
    await row.getByRole("button", { name: T.superadmin.reaktivieren }).click();
    await row.getByRole("button", { name: T.superadmin.archivieren }).waitFor();
    await row.getByRole("button", { name: T.allgemein.loeschen }).click();
    await confirm(T.allgemein.loeschen);
    await page.getByText(T.verwaltung.leer).waitFor();
    expect(await val(`games/${G}`)).toBeNull();
  });
});
