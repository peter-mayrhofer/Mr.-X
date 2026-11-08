// Ende-zu-Ende (Abschnitt 9.3): simulierte Handys melden sich über die echte App an – gegen den lokalen Spiel-Server.
// Spielleitung legt Zugänge fest, Teams treten per QR-Link bei (falsches Passwort, Ersatzgerät), Schiri, Zuschauer,
// Großbild, Abmelden, angemeldet bleiben nach Neuladen.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ViteDevServer } from "vite";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { T } from "../app/src/texte.ts";
import { call, resetServer, startApp, SUPER_PW, superAdminToken, val } from "./helpers.ts";

const G = "linz-e2e";
const PORT = 5180;
let vite: ViteDevServer;
let browser: Browser;
const URL = `http://127.0.0.1:${PORT}/`;

async function phone(): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "de-AT", reducedMotion: "reduce" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("PAGEERROR", e.message));
  return { ctx, page };
}
/** Team-Handys sehen nach dem Beitritt zuerst das Onboarding */
async function skipOnboarding(page: Page) {
  await page.getByRole("button", { name: T.onboarding.ueberspringen, exact: true }).click();
}
const card = (page: Page, label: string) => page.locator("section.card", { has: page.getByRole("heading", { name: label, exact: true }) });

beforeAll(async () => {
  await resetServer();
  const token = await superAdminToken();
  const r = await call(token, { action: "createGame", gameId: G, name: "E2E Spiel", template: "linz", adminPassword: "admin1234" });
  expect(r.result).toEqual({ gameId: G });
  vite = await startApp(PORT);
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await vite?.close();
});

describe("Anmeldung über die App", () => {
  let adminPage: Page;

  it("Spielleitung meldet sich an und legt Team-Passwort und Schiri-Code fest", async () => {
    adminPage = (await phone()).page;
    await adminPage.goto(`${URL}#/staff/admin?g=${G}`);
    await adminPage.getByLabel(T.staffLogin.name).fill("Peter");
    await adminPage.getByLabel(T.staffLogin.adminPasswort).fill("falsch123");
    await adminPage.getByRole("button", { name: T.staffLogin.los, exact: true }).click();
    await expect.poll(() => adminPage.getByText(T.apiFehler.wrongSecret).isVisible()).toBe(true);
    await adminPage.getByLabel(T.staffLogin.adminPasswort).fill("admin1234");
    await adminPage.getByRole("button", { name: T.staffLogin.los, exact: true }).click();
    // Spielleitung landet vor dem Start in der Steuerung; Zugänge unter „Teams & Zugänge“
    await adminPage.getByText(T.admin.spielStarten).first().waitFor();
    await adminPage.getByRole("button", { name: T.admin.teams, exact: true }).click();
    await adminPage.getByRole("tab", { name: T.admin.zugaenge }).click();

    const teamPw = card(adminPage, T.admin.teamPasswort);
    await teamPw.getByLabel(T.admin.passwortNeu).fill("falke27");
    await teamPw.getByRole("button", { name: T.allgemein.speichern, exact: true }).click();
    await adminPage.getByText(T.zugang.gespeichert(T.admin.teamPasswort)).waitFor();
    const schiri = card(adminPage, T.admin.schiriCode);
    await schiri.getByLabel(T.admin.passwortNeu).fill("pfeife");
    await schiri.getByRole("button", { name: T.allgemein.speichern, exact: true }).click();
    await adminPage.getByText(T.zugang.gespeichert(T.admin.schiriCode)).waitFor();
    expect(await val(`secrets/${G}/teamPw`)).toMatch(/^pbkdf2\$/);
  });

  it("Team kommt über den QR-Link, falsches Passwort wird erklärt, richtiges führt in den Warteraum", async () => {
    const { page } = await phone();
    await page.goto(`${URL}#/s/${G}`);
    await page.getByText("E2E Spiel").waitFor();
    await page.getByRole("button", { name: T.start.teamBeitreten, exact: true }).click();
    await page.getByLabel(T.beitritt.teamname).fill("Urfahr");
    await page.getByLabel(T.beitritt.passwort).fill("falsch");
    await page.getByRole("button", { name: T.beitritt.los, exact: true }).click();
    await page.getByText(T.apiFehler.wrongSecret).waitFor();
    await page.getByLabel(T.beitritt.passwort).fill("falke27");
    await page.getByRole("button", { name: T.beitritt.los, exact: true }).click();
    await skipOnboarding(page);
    await page.getByRole("heading", { name: T.lobby.angemeldet }).waitFor();
    await page.getByText("Urfahr", { exact: true }).first().waitFor();

    // angemeldet bleiben (Abschnitt 7.1)
    await page.reload();
    await page.getByRole("heading", { name: T.lobby.angemeldet }).waitFor();
  });

  it("Ersatzgerät: Rückfrage, dann im selben Team", async () => {
    const { page } = await phone();
    await page.goto(`${URL}#/beitreten/${G}`);
    await page.getByLabel(T.beitritt.teamname).fill("urfahr");
    await page.getByLabel(T.beitritt.passwort).fill("falke27");
    await page.getByRole("button", { name: T.beitritt.los, exact: true }).click();
    await page.getByText(T.beitritt.zweitgeraet("urfahr")).waitFor();
    await page.getByRole("button", { name: T.beitritt.alsErsatz, exact: true }).click();
    await skipOnboarding(page);
    await page.getByRole("heading", { name: T.lobby.angemeldet }).waitFor();
    expect(Object.keys(await val(`games/${G}/teams`))).toHaveLength(1);
  });

  it("zweites Team erscheint live bei der Spielleitung", async () => {
    const { page } = await phone();
    await page.goto(`${URL}#/beitreten/${G}`);
    await page.getByLabel(T.beitritt.teamname).fill("Traun");
    await page.getByLabel(T.beitritt.passwort).fill("falke27");
    await page.getByRole("button", { name: T.beitritt.los, exact: true }).click();
    await skipOnboarding(page);
    await page.getByRole("heading", { name: T.lobby.angemeldet }).waitFor();
    await adminPage.getByRole("tab", { name: `${T.admin.teams} (2)` }).waitFor();

    // Abmelden: Gerät landet auf der Startseite, das Team bleibt bestehen
    await page.getByRole("button", { name: T.warten.abmelden, exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: T.einstellungen.abmelden, exact: true }).click();
    await page.getByRole("button", { name: T.start.teamBeitreten, exact: true }).waitFor();
    await adminPage.getByRole("tab", { name: `${T.admin.teams} (2)` }).waitFor();
  });

  it("Schiri mit Schiri-Code", async () => {
    const { page } = await phone();
    await page.goto(`${URL}#/staff/schiri?g=${G}`);
    await page.getByLabel(T.staffLogin.name).fill("Anna");
    await page.getByLabel(T.staffLogin.schiriCode).fill("pfeife");
    await page.getByRole("button", { name: T.staffLogin.los, exact: true }).click();
    await page.getByText(T.warten.angemeldetAls(T.warten.rolle.schiri, "Anna")).waitFor();
  });

  it("Zuschauer-Link ohne Passwort", async () => {
    const { page } = await phone();
    await page.goto(`${URL}#/z/${G}`);
    await page.getByText(T.grossbild.zuschauer).waitFor();
    await page.getByText(T.grossbild.gleich).waitFor();
  });

  it("Großbild über den Link aus dem Admin-Bereich", async () => {
    const box = card(adminPage, T.admin.grossbildLink);
    await box.getByRole("button", { name: T.zugang.grossbildZeigen, exact: true }).click();
    const link = (await box.locator("code").textContent())!;
    expect(link).toContain(`#/g/${G}?k=`);
    const { page } = await phone();
    await page.goto(link.replace(/^https?:\/\/[^/]+\//, URL));
    await page.getByText(T.grossbild.gleich).waitFor();
    await page.getByText(T.grossbild.teamsAngemeldet(2)).waitFor();
  });

  it("Organisator: falsches Passwort abgelehnt", async () => {
    const { page } = await phone();
    await page.goto(`${URL}#/verwaltung`);
    await page.getByText(T.verwaltung.nurOrganisator).waitFor();
    await page.getByLabel(T.verwaltung.passwort).fill("falsches-passwort");
    await page.getByRole("button", { name: T.verwaltung.anmelden, exact: true }).click();
    await page.getByText(T.apiFehler.wrongSecret).waitFor();
    expect(await page.getByRole("button", { name: T.superadmin.neu, exact: true }).count()).toBe(0);
  });

  it("Organisator: Passwort mit dem Setup-Geheimnis neu festlegen, Spiel anlegen, bleibt angemeldet", async () => {
    const { page } = await phone();
    await page.goto(`${URL}#/verwaltung`);
    await page.getByRole("button", { name: T.verwaltung.ersteinrichtung, exact: true }).click();
    await page.getByLabel(T.verwaltung.setupGeheimnis).fill("test-setup-geheimnis");
    await page.getByLabel(T.verwaltung.neuesPasswort).fill(SUPER_PW);
    await page.getByRole("button", { name: T.verwaltung.festlegen, exact: true }).click();
    await page.getByText(T.superadmin.angemeldet).waitFor();
    await page.getByText("E2E Spiel").waitFor();

    await page.getByRole("button", { name: T.superadmin.neu, exact: true }).click();
    await page.getByLabel(T.superadmin.name).fill("Wels 2028");
    expect(await page.getByLabel(T.superadmin.code).inputValue()).toBe("wels-2028");
    await page.getByLabel(T.staffLogin.adminPasswort).fill("wels12345");
    await page.getByRole("dialog").getByRole("button", { name: T.superadmin.neu, exact: true }).click();
    await page.getByText(T.verwaltung.angelegt("Wels 2028")).waitFor();
    await page.getByText("wels-2028", { exact: true }).waitFor();
    expect(await val("games/wels-2028/info/name")).toBe("Wels 2028");
    expect(await val("secrets/wels-2028/adminPw")).toMatch(/^pbkdf2\$/);

    await page.reload();
    await page.getByText(T.superadmin.angemeldet).waitFor();
    await page.getByRole("button", { name: T.verwaltung.abmelden, exact: true }).click();
    await page.getByLabel(T.verwaltung.passwort).waitFor();
  });

  it("Organisator: Anmeldung mit Passwort", async () => {
    const { page } = await phone();
    await page.goto(`${URL}#/verwaltung`);
    await page.getByLabel(T.verwaltung.passwort).fill(SUPER_PW);
    await page.getByRole("button", { name: T.verwaltung.anmelden, exact: true }).click();
    await page.getByText("Wels 2028").waitFor();
  });

  it("Android im Browser: „Android-App installieren“ nur, wenn die APK in downloads.json steht", async () => {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: "de-AT",
      userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36",
    });
    const page = await ctx.newPage();
    await page.route("**/downloads.json", (r) => r.fulfill({ json: {} }));
    await page.goto(URL);
    await page.getByRole("button", { name: T.start.teamBeitreten, exact: true }).waitFor();
    await page.waitForTimeout(500);
    expect(await page.getByRole("link", { name: T.start.androidApp }).count()).toBe(0);
    await page.route("**/downloads.json", (r) => r.fulfill({ json: { android: { datei: "mister-x.apk", groesse: 8_123_456 } } }));
    await page.reload();
    const link = page.getByRole("link", { name: T.start.androidApp });
    expect(await link.getAttribute("href")).toBe("/mister-x.apk");
    expect(await link.textContent()).toContain("8,1 MB");
    await ctx.close();
  });

  it("unbekanntes Spiel im QR-Link wird freundlich erklärt", async () => {
    const { page } = await phone();
    await page.goto(`${URL}#/s/gibts-nicht`);
    await page.getByRole("heading", { name: T.fehler.nichtGefunden.titel }).waitFor();
  });

  it("Protokoll hält alle Beitritte fest", async () => {
    const audit = Object.values((await val(`games/${G}/audit`)) as Record<string, { action: string }>).map((a) => a.action);
    expect(audit.filter((a) => a === "Beigetreten").length).toBeGreaterThanOrEqual(6);
    expect(audit).toContain("Abgemeldet");
  });
});
