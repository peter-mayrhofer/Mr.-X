// Ende-zu-Ende (Meilenstein 5): drei simulierte Team-Handys mit Fake-GPS spielen durch die echte App –
// Onboarding, Warteraum mit Standort-Check, Start mit Wartezeit, Meldung (per Alarm des Servers), Chat, Übergabe mit
// Szenen, Rückgängig, Durchsage, Verkleinerung, Spielfeld-Warnung für Mister X, Spielende mit Auswertung.
// Die Spielleitung bedient hier noch die Server-Schnittstelle direkt (ihre Oberfläche folgt in Meilenstein 6).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ViteDevServer } from "vite";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { PUSH_TITLE } from "@mrx/shared";
import { T } from "../app/src/texte.ts";
import { call, join, outbox, resetServer, set, startApp, superAdminToken, val, type Device, visible } from "./helpers.ts";

const G = "linz-team";
const PORT = 5181;
const URL = `http://127.0.0.1:${PORT}/`;
const HAUPTPLATZ = { latitude: 48.3059, longitude: 14.2862 };
let vite: ViteDevServer;
let browser: Browser;
let admin: Device;
const phones: Record<string, { ctx: BrowserContext; page: Page; id: string }> = {};

const api = async (action: string, extra: Record<string, unknown> = {}) => {
  const r = await call(admin.token, { action, gameId: G, ...extra });
  if (r.error) throw new Error(`${action}: ${r.error.message}`);
  return r.result!;
};

async function joinTeam(name: string, dLat: number, viaOnboarding = false) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "de-AT",
    reducedMotion: "reduce",
    permissions: ["geolocation", "notifications"],
    geolocation: { latitude: HAUPTPLATZ.latitude + dLat, longitude: HAUPTPLATZ.longitude, accuracy: 8 },
  });
  // GPS-Starts zählen (Spielbeginn darf das GPS nicht neu starten – in der Android-App wäre das der Vordergrund-Dienst)
  await ctx.addInitScript(() => {
    const geo = navigator.geolocation;
    const watch = geo.watchPosition.bind(geo);
    const w = window as unknown as { gpsStarts: number };
    w.gpsStarts = 0;
    geo.watchPosition = (...a) => (w.gpsStarts++, watch(...a));
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("PAGEERROR", name, e.message));
  await page.goto(`${URL}#/beitreten/${G}`);
  await page.getByLabel(T.beitritt.teamname).fill(name);
  await page.getByLabel(T.beitritt.passwort).fill("falke27");
  await page.getByRole("button", { name: T.beitritt.los, exact: true }).click();
  if (viaOnboarding) {
    await page.getByRole("heading", { name: T.onboarding.schritte[0].titel }).waitFor();
    await page.getByRole("button", { name: T.allgemein.weiter, exact: true }).click();
    await page.getByRole("button", { name: T.onboarding.schritte[1].knopf, exact: true }).click();
    await page.getByRole("button", { name: T.onboarding.schritte[2].knopf, exact: true }).click();
    await page.getByRole("button", { name: T.onboarding.ueberspringen, exact: true }).click();
  } else await page.getByRole("button", { name: T.onboarding.ueberspringen, exact: true }).click();
  await page.getByRole("heading", { name: T.lobby.angemeldet }).waitFor();
  const teams = (await val(`games/${G}/teams`)) as Record<string, { name: string }>;
  const id = Object.entries(teams).find(([, t]) => t.name === name)![0];
  phones[name] = { ctx, page, id };
}

beforeAll(async () => {
  await resetServer();
  const sa = await superAdminToken();
  await call(sa, { action: "createGame", gameId: G, name: "Team-Test", template: "linz", adminPassword: "admin1234" });
  admin = await join(G, "admin", "Peter", "admin1234");
  await api("setSecret", { kind: "teamPw", value: "falke27" });
  vite = await startApp(PORT);
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await vite?.close();
});

// mehrere Handys + Karte im Browser: großzügige Zeitgrenze pro Schritt (CI-Rechner sind langsamer)
describe("Team-Handys im Spiel", { timeout: 60_000 }, () => {
  it("Onboarding fragt den Standort an, Warteraum zeigt „Standort: gut“, Position kommt beim Server an", async () => {
    await joinTeam("Urfahr", 0, true);
    await joinTeam("Traun", 0.0005);
    await joinTeam("Leonding", 0.003);
    const p = phones.Urfahr!;
    await visible(p.page, `${T.lobby.check.standort}: ${T.lobby.gut}`);
    await expect.poll(() => val(`games/${G}/positions/${p.id}/lat`), { timeout: 15_000 }).toBeCloseTo(HAUPTPLATZ.latitude, 4);
    // Benachrichtigungen erlaubt → Gerät ist mit Web-Push-Abo und Push-Arten angemeldet, Warteraum zeigt es an
    await expect
      .poll(
        async () => Object.values(((await val(`games/${G}/push`)) ?? {}) as Record<string, { sub?: unknown }>).filter((x) => x.sub).length,
      )
      .toBe(1);
    await visible(p.page, `${T.lobby.check.push}: ${T.lobby.gut}`);
  }, 90_000);

  it("Start: Mister X sieht den roten Modus, Jäger die Wartezeit mit Countdown, GPS läuft ohne Neustart weiter", async () => {
    const gpsStarts = () => phones.Traun!.page.evaluate(() => (window as unknown as { gpsStarts: number }).gpsStarts);
    const before = await gpsStarts();
    expect(before).toBeGreaterThan(0);
    await api("startGame", { mrx: phones.Urfahr!.id });
    await visible(phones.Urfahr!.page, T.status.ihrSeidMrx);
    // „Ihr seid Mister X!“ geht an Urfahr – die App ist offen und sichtbar, also über die Verbindung statt per Web-Push
    await expect.poll(async () => (await outbox(G)).find((x) => x.title === PUSH_TITLE.neuerMrx)?.to).toHaveLength(1);
    const lock = phones.Traun!.page.getByRole("alertdialog", { name: T.wartezeit.titel });
    await lock.waitFor();
    expect(await lock.getByText(T.wartezeit.grundStart).isVisible()).toBe(true);
    await visible(phones.Leonding!.page, "Urfahr");
    expect(await gpsStarts()).toBe(before);
  });

  it("Termin erreicht → der Server meldet per Alarm → Meldung auf der Karte", async () => {
    await set(`games/${G}/locks`, null);
    await phones.Traun!.page.getByRole("alertdialog", { name: T.wartezeit.titel }).waitFor({ state: "detached" });
    await set(`games/${G}/state/nextReportAt`, Date.now() + 2000);
    await expect.poll(async () => Object.keys((await val(`games/${G}/reports`)) ?? {}).length, { timeout: 20_000 }).toBe(1);
    await visible(phones.Traun!.page, T.karte.letzteMeldung);
  });

  it("Chat: Nachricht kommt beim anderen Team an, mit Ungelesen-Zähler", async () => {
    const t = phones.Traun!.page;
    await t.getByRole("button", { name: T.tabs.chat, exact: true }).click();
    await t.getByPlaceholder(T.chat.platzhalter).fill("Wir sind beim Brunnen!");
    await t.getByRole("button", { name: T.chat.senden }).click();
    const l = phones.Leonding!.page;
    const chatTab = l.getByRole("button", { name: `${T.tabs.chat}, 1 neu`, exact: true });
    await chatTab.waitFor({ timeout: 10_000 });
    await chatTab.click();
    await visible(l, "Wir sind beim Brunnen!");
    await l.getByRole("button", { name: T.tabs.karte, exact: true }).click();
    await t.getByRole("button", { name: T.tabs.karte, exact: true }).click();
  });

  it("Regeln: Hinweise der Spielleitung erscheinen formatiert über den Spielregeln", async () => {
    await api("setConfig", { config: { rulesText: "**Treffpunkt nach dem Spiel:** Dreifaltigkeitssäule\n- keine E-Scooter" } });
    const l = phones.Leonding!.page;
    await l.getByRole("button", { name: T.tabs.regeln, exact: true }).click();
    await visible(l, T.regeln.eigene);
    expect(await l.locator("strong", { hasText: "Treffpunkt nach dem Spiel:" }).isVisible()).toBe(true);
    expect(await l.getByRole("listitem").filter({ hasText: "keine E-Scooter" }).isVisible()).toBe(true);
    await l.getByRole("button", { name: T.tabs.karte, exact: true }).click();
  });

  it("Übergabe: neuer Mister X, Erwischt + Wartezeit, alle anderen sehen „Gefangen!“", async () => {
    const before = (await val(`games/${G}/state/mrx`)) as string;
    expect(before).toBe(phones.Urfahr!.id);
    await api("handover", { to: phones.Traun!.id, type: "fang", expectedMrx: before, requestId: "e2e-fang-1" });
    await phones.Traun!.page.getByRole("alertdialog", { name: T.uebergabe.ihrSeidMrx }).waitFor();
    await visible(phones.Urfahr!.page, T.uebergabe.erwischt);
    await visible(phones.Leonding!.page, T.uebergabe.gefangen);
  });

  it("Rückgängig schließt die Szene und erklärt es", async () => {
    await api("undo", { handoverId: "e2e-fang-1" });
    await phones.Traun!.page.getByRole("alertdialog", { name: T.uebergabe.ihrSeidMrx }).waitFor({ state: "detached" });
    await visible(phones.Traun!.page, T.uebergabe.zurueck);
    await visible(phones.Urfahr!.page, T.status.ihrSeidMrx);
  });

  it("Durchsage und Verkleinerung erscheinen groß oben", async () => {
    // Szenen der Übergabe schließen
    for (const n of ["Urfahr", "Leonding"]) {
      const ok = phones[n]!.page.getByRole("alertdialog").getByRole("button", { name: T.allgemein.ok, exact: true });
      // die Szene schließt sich nach dem Rückgängig evtl. gerade selbst
      if (await ok.isVisible()) await ok.click({ timeout: 3000 }).catch(() => {});
    }
    await api("announce", { text: "Treffpunkt Hauptplatz um 17 Uhr" });
    await visible(phones.Leonding!.page, "Treffpunkt Hauptplatz um 17 Uhr");
    await api("setCut", { cutId: "norden", locked: true });
    await visible(phones.Leonding!.page, T.verkleinerung.titel("Norden"));
  });

  it("Mister X verlässt das Spielfeld → rote Warnung", async () => {
    await phones.Urfahr!.ctx.setGeolocation({ latitude: 48.33, longitude: 14.24, accuracy: 8 });
    await visible(phones.Urfahr!.page, T.mrx.draussen);
  });

  it("Spielende: alle sehen die Auswertung, Standorte sind gelöscht und werden nicht neu gesendet", async () => {
    await set(`secrets/${G}/endAt`, Date.now() - 1000);
    for (const n of ["Urfahr", "Traun", "Leonding"]) await visible(phones[n]!.page, T.ende.sieger);
    await visible(phones.Traun!.page, "Urfahr");
    await phones.Traun!.ctx.setGeolocation({ latitude: 48.307, longitude: 14.287, accuracy: 8 });
    await new Promise((r) => setTimeout(r, 2500));
    expect(await val(`games/${G}/positions`)).toEqual({});
  });
});
