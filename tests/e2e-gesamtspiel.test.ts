// Ende-zu-Ende-Gesamtspiel (Abschnitt 9.3, Meilenstein 12): Spielleitung am Laptop, Schiri und drei Team-Handys mit
// Fake-GPS spielen ein ganzes Spiel über die echte App – Beitritt → Start → Meldungen → Übergabe → Rückgängig →
// Verkleinerung → Spielende → Archiv → Neue Runde. Zeitraffer: Termine (Meldung, Ende) werden im Spielraum vorgezogen,
// der Server löst sie selbst per Alarm aus.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ViteDevServer } from "vite";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { T } from "../app/src/texte.ts";
import { call, resetServer, set, startApp, superAdminToken, val } from "./helpers.ts";

const G = "linz-gesamt";
const PORT = 5187;
const URL = `http://127.0.0.1:${PORT}/`;
const HAUPTPLATZ = { latitude: 48.3059, longitude: 14.2862 };
let vite: ViteDevServer;
let browser: Browser;
let admin: Page;
let schiri: Page;
const phones: Record<string, { ctx: BrowserContext; page: Page; id: string }> = {};

// nur sichtbare Treffer: Namen an den Kartenmarkern blendet die Karte unter Zoom 15,5 aus
const visible = (page: Page, text: string) =>
  page.getByText(text, { exact: false }).filter({ visible: true }).first().waitFor({ timeout: 15_000 });
const confirm = (page: Page, label: string = T.allgemein.bestaetigen) =>
  page.getByRole("dialog").getByRole("button", { name: label, exact: true }).click();
const nav = (label: string) => admin.getByRole("link", { name: label }).click();

async function device(dLat: number, viewport = { width: 390, height: 844 }) {
  return browser.newContext({
    viewport,
    locale: "de-AT",
    reducedMotion: "reduce",
    permissions: ["geolocation"],
    geolocation: { latitude: HAUPTPLATZ.latitude + dLat, longitude: HAUPTPLATZ.longitude, accuracy: 8 },
  });
}

async function staffLogin(page: Page, role: "admin" | "schiri", name: string, secret: string) {
  await page.goto(`${URL}#/staff/${role}?g=${G}`);
  await page.getByLabel(T.staffLogin.name).fill(name);
  await page.getByLabel(role === "admin" ? T.staffLogin.adminPasswort : T.staffLogin.schiriCode).fill(secret);
  await page.getByRole("button", { name: T.staffLogin.los, exact: true }).click();
}

beforeAll(async () => {
  await resetServer();
  const sa = await superAdminToken();
  await call(sa, { action: "createGame", gameId: G, name: "Gesamtspiel", template: "linz", adminPassword: "admin1234" });
  vite = await startApp(PORT);
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await vite?.close();
});

describe("Ein ganzes Spiel", { timeout: 90_000 }, () => {
  it("Spielleitung meldet sich an und legt Team-Passwort und Schiri-Code fest", async () => {
    admin = await (await device(0, { width: 1280, height: 860 })).newPage();
    admin.on("pageerror", (e) => console.error("PAGEERROR admin", e.message));
    await staffLogin(admin, "admin", "Peter", "admin1234");
    await admin.getByText(T.admin.spielStarten).first().waitFor();
    await nav(T.admin.nav.teams);
    await admin.getByRole("tab", { name: T.admin.zugaenge }).click();
    for (const [label, value] of [
      [T.admin.teamPasswort, "falke27"],
      [T.admin.schiriCode, "pfeife"],
    ] as const) {
      const card = admin.locator("section.card", { has: admin.getByRole("heading", { name: label, exact: true }) });
      await card.getByLabel(T.admin.passwortNeu).fill(value);
      await card.getByRole("button", { name: T.allgemein.speichern, exact: true }).click();
      await admin.getByText(T.zugang.gespeichert(label)).waitFor();
    }
  });

  it("drei Teams treten mit dem Handy bei, ein Schiri mit dem Schiri-Code", async () => {
    for (const [name, dLat] of [
      ["Urfahr", 0],
      ["Traun", 0.0005],
      ["Leonding", 0.003],
    ] as const) {
      const ctx = await device(dLat);
      const page = await ctx.newPage();
      page.on("pageerror", (e) => console.error("PAGEERROR", name, e.message));
      await page.goto(`${URL}#/beitreten/${G}`);
      await page.getByLabel(T.beitritt.teamname).fill(name);
      await page.getByLabel(T.beitritt.passwort).fill("falke27");
      await page.getByRole("button", { name: T.beitritt.los, exact: true }).click();
      await page.getByRole("button", { name: T.onboarding.ueberspringen, exact: true }).click();
      await page.getByRole("heading", { name: T.lobby.angemeldet }).waitFor();
      const teams = (await val(`games/${G}/teams`)) as Record<string, { name: string }>;
      phones[name] = { ctx, page, id: Object.entries(teams).find(([, t]) => t.name === name)![0] };
    }
    schiri = await (await device(0.0001)).newPage();
    schiri.on("pageerror", (e) => console.error("PAGEERROR schiri", e.message));
    await staffLogin(schiri, "schiri", "Anna", "pfeife");
    await schiri.getByRole("heading", { name: T.lobby.angemeldet }).waitFor();
    // alle Standorte kommen über das Fake-GPS der Handys an
    await expect.poll(async () => Object.keys((await val(`games/${G}/positions`)) ?? {}).length, { timeout: 20_000 }).toBe(3);
  });

  it("Start: Spielleitung wählt Mister X, alle Handys wechseln ins Spiel", async () => {
    await nav(T.admin.nav.steuerung);
    await admin.getByRole("radio", { name: "Urfahr" }).click();
    await admin.getByRole("button", { name: T.admin.spielStarten, exact: true }).click();
    await confirm(admin, T.admin.spielStarten);
    await visible(phones.Urfahr!.page, T.status.ihrSeidMrx);
    await phones.Traun!.page.getByRole("alertdialog", { name: T.wartezeit.titel }).waitFor();
    await visible(schiri, "Urfahr");
    await admin.getByText(T.admin.warnungen).first().waitFor({ timeout: 15_000 });
  });

  it("Meldung: der Server meldet Mister X zum Termin, alle Jäger sehen sie auf der Karte", async () => {
    await set(`games/${G}/locks`, null);
    await set(`games/${G}/state/nextReportAt`, Date.now() + 1000);
    await expect.poll(async () => Object.keys((await val(`games/${G}/reports`)) ?? {}).length, { timeout: 20_000 }).toBe(1);
    for (const n of ["Traun", "Leonding"]) await visible(phones[n]!.page, T.karte.letzteMeldung);
  });

  it("Übergabe durch den Schiri: Traun ist Mister X, Urfahr bekommt Wartezeit", async () => {
    await schiri.getByRole("button", { name: T.schiri.uebergabe, exact: true }).click();
    const sheet = schiri.getByRole("dialog");
    await sheet.locator("button.item", { hasText: "Traun" }).click();
    await sheet.getByRole("button", { name: T.schiri.bestaetigen("Traun"), exact: true }).click();
    await confirm(schiri);
    await expect.poll(() => val(`games/${G}/state/mrx`), { timeout: 10_000 }).toBe(phones.Traun!.id);
    await phones.Traun!.page.getByRole("alertdialog", { name: T.uebergabe.ihrSeidMrx }).waitFor();
    await visible(phones.Urfahr!.page, T.uebergabe.erwischt);
    await visible(phones.Leonding!.page, T.uebergabe.gefangen);
    expect(Object.keys(await val(`games/${G}/locks`))).toContain(phones.Urfahr!.id);
  });

  it("Rückgängig: Urfahr ist wieder Mister X, Traun bekommt die Erklärung", async () => {
    await schiri.getByRole("button", { name: /Rückgängig/ }).click();
    await confirm(schiri, T.schiri.rueckgaengig);
    await expect.poll(() => val(`games/${G}/state/mrx`), { timeout: 10_000 }).toBe(phones.Urfahr!.id);
    await visible(phones.Traun!.page, T.uebergabe.zurueck);
    await visible(phones.Urfahr!.page, T.status.ihrSeidMrx);
    expect((await val(`games/${G}/locks`)) ?? {}).not.toHaveProperty(phones.Urfahr!.id);
  });

  it("Verkleinerung: Spielleitung sperrt den Norden, die Teams sehen es groß", async () => {
    for (const n of ["Urfahr", "Leonding"]) {
      // Szene der Übergabe schließen, falls sie noch offen ist
      const ok = phones[n]!.page.getByRole("alertdialog").getByRole("button", { name: T.allgemein.ok, exact: true });
      if (await ok.isVisible()) await ok.click({ timeout: 3000 }).catch(() => {});
    }
    await nav(T.admin.nav.steuerung);
    await admin.locator("li", { hasText: "Norden" }).getByRole("button", { name: T.admin.sperren }).click();
    await confirm(admin, T.admin.sperren);
    await expect.poll(() => val(`games/${G}/state/cuts/norden`)).toBeGreaterThan(0);
    await visible(phones.Leonding!.page, T.verkleinerung.titel("Norden"));
  });

  it("zweite Meldung nach der Verkleinerung", async () => {
    await set(`games/${G}/state/nextReportAt`, Date.now() + 1000);
    await expect.poll(async () => Object.keys((await val(`games/${G}/reports`)) ?? {}).length, { timeout: 20_000 }).toBe(2);
  });

  it("Spielende zum (vorgezogenen) Zufallstermin: alle sehen die Auswertung, Live-Standorte sind gelöscht", async () => {
    await set(`secrets/${G}/endAt`, Date.now() - 1000);
    for (const p of [schiri, ...Object.values(phones).map((x) => x.page)]) await visible(p, T.ende.sieger);
    // die Spielleitung war gerade in der Steuerung: dort geht es mit einem Knopf zur Auswertung
    await admin.getByRole("button", { name: T.admin.auswertungZeigen, exact: true }).click();
    await visible(admin, T.ende.sieger);
    await visible(phones.Leonding!.page, "Urfahr");
    expect(await val(`games/${G}/state/phase`)).toBe("beendet");
    expect(await val(`games/${G}/positions`)).toEqual({});
    expect(await val(`games/${G}/staff`)).toEqual({});
  });

  it("Archiv: der Lauf steht mit Sieger in der Liste, die Wiederholung zeigt Mister X", async () => {
    await nav(T.admin.nav.archiv);
    await visible(admin, `${T.ende.sieger}: Urfahr`);
    await admin.getByRole("button", { name: /Gesamtspiel/ }).click();
    const slider = admin.getByRole("slider", { name: T.archiv.replay });
    await slider.waitFor();
    await admin.locator(".now", { hasText: "Urfahr" }).waitFor();
  });

  it("Neue Runde: Teams und Schiri werden abgemeldet, Team-Passwort gelöscht, Archiv bleibt", async () => {
    await admin.goto(`${URL}#/spiel?b=teams`);
    await admin.getByRole("tab", { name: T.admin.zugaenge }).click();
    await admin.getByRole("button", { name: T.admin.neueRunde, exact: true }).click();
    await confirm(admin, T.admin.neueRunde);
    for (const p of [schiri, ...Object.values(phones).map((x) => x.page)]) await visible(p, T.fehler.entfernt.titel);
    expect(await val(`games/${G}/teams`)).toEqual({});
    expect(await val(`secrets/${G}/teamPw`)).toBeNull();
    expect(await val(`games/${G}/state/phase`)).toBe("vorbereitung");
    const admins = Object.values((await val(`games/${G}/members`)) as Record<string, { role: string }>).map((m) => m.role);
    expect(admins).toEqual(["admin"]);
    const tokens = (await admin.evaluate(() => localStorage.getItem("mrx.sitzung"))) ?? "";
    const runs = await call(JSON.parse(tokens).token as string, { action: "archiveList", gameId: G });
    expect((runs.result!.runs as { winner: string }[])[0]!.winner).toBe("Urfahr");
  });
});
