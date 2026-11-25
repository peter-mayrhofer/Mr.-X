// Ende-zu-Ende: Organisator-Konten mit Gratis-Code (E-84). Der Eigentümer meldet sich mit dem Organisator-Passwort an,
// legt sein Eigentümer-Konto an und erstellt einen Code; ein Verein erstellt damit ein Konto, legt ein Spiel an und
// sieht nur seins; der Code ist danach aufgebraucht.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { T } from "../app/src/texte.ts";
import { resetServer, startApp, SUPER_PW, superAdminToken } from "./helpers.ts";

const PORT = 5201;
const URL = `http://127.0.0.1:${PORT}/#/verwaltung`;
const K = T.konto;
const VEREIN = "verein@beispiel.at";
let vite: ViteDevServer;
let browser: Browser;
let eig: Page;
let verein: Page;
let code = "";

beforeAll(async () => {
  await resetServer();
  await superAdminToken(); // Organisator-Passwort SUPER_PW
  vite = await startApp(PORT);
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await vite?.close();
});

const seite = async () => {
  const p = await (
    await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "de-AT", reducedMotion: "reduce" })
  ).newPage();
  p.on("pageerror", (e) => console.error("PAGEERROR", e.message));
  await p.goto(URL);
  return p;
};
const karte = (p: Page, titel: string) => p.locator("section.card", { has: p.getByRole("heading", { name: titel }) });

describe("Organisator-Konten mit Gratis-Code", { timeout: 60_000 }, () => {
  it("Eigentümer: mit Organisator-Passwort anmelden, Eigentümer-Konto anlegen, Code erstellen", async () => {
    eig = await seite();
    await eig.getByRole("button", { name: K.mitOrganisatorPw }).click();
    await eig.getByLabel(T.verwaltung.passwort).fill(SUPER_PW);
    await eig.getByRole("button", { name: T.verwaltung.anmelden, exact: true }).click();
    await eig.getByText(K.angemeldetEigentuemer).waitFor();

    const ek = karte(eig, K.eigentuemerKonto);
    await ek.getByLabel(K.email).fill("peter@beispiel.at");
    await ek.getByLabel(K.passwort, { exact: true }).fill("eigentuemer-2026");
    await ek.getByRole("button", { name: K.eigentuemerKonto }).click();
    await eig.getByText(K.eigentuemerAngelegt).waitFor();
    // jetzt gibt es ein Eigentümer-Konto – die Karte zum Anlegen verschwindet
    await ek.waitFor({ state: "detached" });

    const codes = karte(eig, K.codes);
    await codes.getByRole("tab", { name: K.monate(3) }).click();
    await codes.getByRole("button", { name: K.codeErstellen }).click();
    code = (await codes.locator("code").first().innerText()).trim();
    expect(code).toMatch(/^MRX-\w{4}-\w{4}$/);
    expect(await codes.locator("li").first().innerText()).toContain(K.benutzt(0, 1));
  });

  it("Verein: Konto mit Code erstellen, Spiel anlegen, nur eigene Spiele", async () => {
    verein = await seite();
    await verein.getByRole("button", { name: K.zumErstellen }).click();
    await verein.getByLabel(K.email).fill(VEREIN);
    await verein.getByLabel(K.code).fill(code.toLowerCase());
    await verein.getByLabel(K.passwort, { exact: true }).fill("vereinsheim-2026");
    await verein.getByRole("button", { name: K.erstellen, exact: true }).click();
    await verein.getByText(K.angemeldetAls(VEREIN)).waitFor();
    expect(await karte(verein, K.meinKonto).innerText()).toContain(VEREIN);
    // Codes und Konten sieht nur der Eigentümer
    expect(await karte(verein, K.codes).count()).toBe(0);

    await verein.getByRole("button", { name: T.superadmin.neu, exact: true }).click();
    await verein.getByLabel(T.superadmin.name).fill("Verein Linz");
    await verein.getByLabel(T.staffLogin.adminPasswort).fill("verein1234");
    await verein.getByRole("dialog").getByRole("button", { name: T.superadmin.neu, exact: true }).click();
    await verein.getByText(T.verwaltung.angelegt("Verein Linz")).waitFor();
    await verein.getByRole("heading", { name: "Verein Linz" }).waitFor();
  });

  it("Eigentümer sieht: Code aufgebraucht, Konto mit 1 Spiel, Spiel in der Liste", async () => {
    await eig.reload();
    await eig.getByText(K.angemeldetEigentuemer).waitFor();
    await eig.getByRole("heading", { name: "Verein Linz" }).waitFor();
    const c = await karte(eig, K.codes).locator("li").first().innerText();
    expect(c).toContain(K.benutzt(1, 1));
    expect(c).toContain(K.aufgebraucht);
    const konto = karte(eig, K.konten).locator("li", { hasText: VEREIN });
    expect(await konto.innerText()).toContain(K.spiele(1));
  });

  it("Anmeldung: falsches Passwort, dann richtig", async () => {
    await verein.getByRole("button", { name: T.verwaltung.abmelden }).click();
    await verein.getByLabel(K.email).fill(VEREIN);
    await verein.getByLabel(K.passwort, { exact: true }).fill("falsches-passwort");
    await verein.getByRole("button", { name: K.anmelden, exact: true }).click();
    await verein.getByText(K.falsch).waitFor();
    await verein.getByLabel(K.passwort, { exact: true }).fill("vereinsheim-2026");
    await verein.getByRole("button", { name: K.anmelden, exact: true }).click();
    await verein.getByText(K.angemeldetAls(VEREIN)).waitFor();
  });
});
