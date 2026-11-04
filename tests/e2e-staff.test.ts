// Ende-zu-Ende (Meilenstein 6): Spielleitung am Laptop und Schiri am Handy bedienen das Spiel über die echte App –
// Start mit gewähltem Mister X, Schiri begleitet die Fahne, Übergabe mit Vorschau, Rückgängig, Regeln live ändern,
// Bereich sperren, Durchsage, Wartezeit von Hand, Umbenennen, Postfach, Protokoll, Notstopp mit Auswertung.
// Die Team-Handys werden hier direkt im Spielraum simuliert (ihre Oberfläche testet e2e-team).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { T } from "../app/src/texte.ts";
import { call, join, resetServer, set, sleep, startApp, superAdminToken, val, type Device, visible } from "./helpers.ts";

const G = "linz-staff";
const PORT = 5182;
const URL = `http://127.0.0.1:${PORT}/`;
const HAUPTPLATZ = { lat: 48.3059, lng: 14.2862 };
let vite: ViteDevServer;
let browser: Browser;
let admin: Page;
let schiri: Page;
const team: Record<string, string> = {};
const devices: Record<string, Device> = {};

const setPos = (id: string, dLat: number) =>
  set(`games/${G}/positions/${id}`, { lat: HAUPTPLATZ.lat + dLat, lng: HAUPTPLATZ.lng, acc: 8, t: Date.now() });
const nav = (label: string) => admin.getByRole("link", { name: label }).click();
const confirm = (page: Page, label: string = T.allgemein.bestaetigen) =>
  page.getByRole("dialog").getByRole("button", { name: label, exact: true }).click();

beforeAll(async () => {
  await resetServer();
  const sa = await superAdminToken();
  await call(sa, { action: "createGame", gameId: G, name: "Staff-Test", template: "linz", adminPassword: "admin1234" });
  const a = await join(G, "admin", "Vorab", "admin1234");
  await call(a.token, { action: "setSecret", gameId: G, kind: "teamPw", value: "falke27" });
  await call(a.token, { action: "setSecret", gameId: G, kind: "schiriCode", value: "pfeife" });
  for (const [name, dLat] of [
    ["Urfahr", 0],
    ["Traun", 0.0005],
    ["Leonding", 0.01],
  ] as const) {
    const d = await join(G, "team", name, "falke27");
    devices[name] = d;
    team[name] = d.teamId!;
    await setPos(team[name], dLat);
  }
  vite = await startApp(PORT);
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await vite?.close();
});

describe("Spielleitung und Schiri", { timeout: 60_000 }, () => {
  it("anmelden: Spielleitung am Laptop, Schiri am Handy mit GPS", async () => {
    const actx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: "de-AT", reducedMotion: "reduce" });
    admin = await actx.newPage();
    admin.on("pageerror", (e) => console.error("PAGEERROR admin", e.message));
    await admin.goto(`${URL}#/staff/admin?g=${G}`);
    await admin.getByLabel(T.staffLogin.name).fill("Peter");
    await admin.getByLabel(T.staffLogin.adminPasswort).fill("admin1234");
    await admin.getByRole("button", { name: T.staffLogin.los, exact: true }).click();
    await visible(admin, T.admin.startMrx);

    const sctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: "de-AT",
      reducedMotion: "reduce",
      permissions: ["geolocation"],
      geolocation: { latitude: HAUPTPLATZ.lat + 0.0001, longitude: HAUPTPLATZ.lng, accuracy: 6 },
    });
    schiri = await sctx.newPage();
    schiri.on("pageerror", (e) => console.error("PAGEERROR schiri", e.message));
    await schiri.goto(`${URL}#/staff/schiri?g=${G}`);
    await schiri.getByLabel(T.staffLogin.name).fill("Anna");
    await schiri.getByLabel(T.staffLogin.schiriCode).fill("pfeife");
    await schiri.getByRole("button", { name: T.staffLogin.los, exact: true }).click();
    await schiri.getByRole("heading", { name: T.lobby.angemeldet }).waitFor();
  });

  it("Start mit gewähltem Mister X → Countdown → Live-Übersicht", async () => {
    await admin.getByRole("radio", { name: "Urfahr" }).click();
    await admin.getByRole("button", { name: T.admin.spielStarten, exact: true }).click();
    await confirm(admin, T.admin.spielStarten);
    await expect.poll(() => val(`games/${G}/state/mrx`), { timeout: 10_000 }).toBe(team.Urfahr);
    await admin.getByText(T.admin.warnungen).first().waitFor({ timeout: 15_000 });
    await visible(admin, "Urfahr");
  });

  it("Schiri sieht Mister X, begleitet die Fahne, sein Standort kommt mit Namen an", async () => {
    await visible(schiri, "Urfahr");
    await schiri.getByRole("button", { name: T.tabs.mehr, exact: true }).click();
    await schiri.getByRole("switch", { name: new RegExp(T.schiri.folgen) }).check();
    await schiri.getByRole("button", { name: T.tabs.karte, exact: true }).click();
    await expect
      .poll(async () =>
        Object.values((await val(`games/${G}/members`)) as Record<string, { followsFlag?: boolean }>).some((m) => m.followsFlag),
      )
      .toBe(true);
    await expect
      .poll(async () => Object.values(((await val(`games/${G}/staff`)) ?? {}) as Record<string, { name: string }>)[0]?.name, {
        timeout: 15_000,
      })
      .toBe("Anna");
  });

  it("Schiri übergibt: nächstes Team oben, Vorschau der Wartezeit, dann Rückgängig", async () => {
    await set(`games/${G}/locks`, null);
    await Promise.all([setPos(team.Urfahr!, 0), setPos(team.Traun!, 0.0005), setPos(team.Leonding!, 0.01)]);
    await schiri.getByRole("button", { name: T.schiri.uebergabe, exact: true }).click();
    const sheet = schiri.getByRole("dialog");
    const first = sheet.locator("button.item").first();
    expect(await first.textContent()).toContain("Traun");
    await first.click();
    await sheet.getByText(T.schiri.vorschau(5)).waitFor();
    await sheet.getByRole("button", { name: T.schiri.bestaetigen("Traun"), exact: true }).click();
    await confirm(schiri);
    await expect.poll(() => val(`games/${G}/state/mrx`), { timeout: 10_000 }).toBe(team.Traun);
    expect(Object.keys(await val(`games/${G}/locks`))).toEqual([team.Urfahr]);

    await schiri.getByRole("button", { name: /Rückgängig/ }).click();
    await confirm(schiri, T.schiri.rueckgaengig);
    await expect.poll(() => val(`games/${G}/state/mrx`), { timeout: 10_000 }).toBe(team.Urfahr);
  });

  it("Regeln live ändern und Bereich sperren", async () => {
    await nav(T.admin.nav.steuerung);
    const interval = admin.getByRole("group", { name: T.admin.intervall });
    for (let i = 0; i < 5; i++) await interval.getByRole("button", { name: "weniger" }).click();
    await admin.getByRole("button", { name: T.admin.uebernehmen, exact: true }).click();
    await expect.poll(() => val(`games/${G}/config/intervalMin`)).toBe(5);
    const norden = admin.locator("li", { hasText: "Norden" });
    // Vorwarnung (Standard 10 Min): angekündigt, noch nicht gesperrt → absagen
    await norden.getByRole("button", { name: T.admin.sperren }).click();
    await confirm(admin, T.admin.sperren);
    await expect.poll(() => val(`games/${G}/state/warnCuts/norden`)).toBeGreaterThan(Date.now());
    expect(await val(`games/${G}/state/cuts/norden`)).toBeFalsy();
    await expect.poll(() => norden.textContent()).toContain(T.admin.gesperrtIn(10));
    await norden.getByRole("button", { name: T.admin.absagen }).click();
    await confirm(admin, T.admin.absagen);
    await expect.poll(() => val(`games/${G}/state/warnCuts`)).toBeFalsy();
    // Vorwarnung auf 0 stellen = sofort sperren
    await norden.getByRole("button", { name: T.admin.sperren }).click();
    for (let i = 0; i < 10; i++) await admin.getByRole("dialog").getByRole("button", { name: "weniger" }).click();
    await confirm(admin, T.admin.sperren);
    await expect.poll(() => val(`games/${G}/state/cuts/norden`)).toBeGreaterThan(0);
    // Schalter: Jäger für Schiris ausblenden – der Schiri sieht den Hinweis statt der nächsten Jäger
    await admin.getByRole("switch", { name: T.admin.schiriJaeger }).click();
    await expect.poll(() => val(`games/${G}/config/refereeHunters`)).toBe(false);
    await schiri.getByText(T.schiri.jaegerAus).waitFor();
    await admin.getByRole("switch", { name: T.admin.schiriJaeger }).click();
    await expect.poll(() => val(`games/${G}/config/refereeHunters`)).toBe(true);
    // eigene Regeln (7.11): Vorschau formatiert, gespeichert erst mit „Speichern“
    await admin.getByLabel(T.admin.regeltextFeld).fill("**Treffpunkt:** Hauptplatz\n- keine Fahrräder");
    const preview = admin.getByRole("group", { name: T.admin.regeltextVorschau });
    expect(await preview.locator("strong").textContent()).toBe("Treffpunkt:");
    expect(await preview.getByRole("listitem").textContent()).toContain("keine Fahrräder");
    await admin.getByRole("button", { name: T.allgemein.speichern, exact: true }).click();
    await expect.poll(() => val(`games/${G}/config/rulesText`)).toBe("**Treffpunkt:** Hauptplatz\n- keine Fahrräder");
  });

  it("Durchsage aus der Live-Übersicht", async () => {
    await nav(T.admin.nav.live);
    await admin.getByPlaceholder(T.admin.durchsagePlatzhalter).fill("Treffpunkt Hauptplatz");
    await admin.getByRole("button", { name: T.admin.durchsage, exact: true }).click();
    await expect
      .poll(
        async () =>
          Object.values((await val(`games/${G}/chat`)) as Record<string, { kind: string; text: string }>).find((m) => m.kind === "ann")
            ?.text,
      )
      .toBe("Treffpunkt Hauptplatz");
  });

  it("Teams: Wartezeit von Hand, umbenennen", async () => {
    await nav(T.admin.nav.teams);
    await admin.getByRole("button", { name: T.admin.aktionenFuer("Leonding") }).click();
    await admin.getByRole("button", { name: new RegExp(T.admin.wartezeitGeben) }).click();
    await expect.poll(() => val(`games/${G}/locks/${team.Leonding}/reason`)).toBe("manuell");
    await admin.getByRole("button", { name: T.admin.aktionenFuer("Leonding") }).click();
    await admin.getByRole("button", { name: new RegExp(T.admin.umbenennen) }).click();
    await admin.getByLabel(T.beitritt.teamname).fill("Leonding Süd");
    await admin.getByRole("button", { name: T.allgemein.speichern, exact: true }).click();
    await expect.poll(() => val(`games/${G}/teams/${team.Leonding}/name`)).toBe("Leonding Süd");
  });

  it("Postfach: Nachricht eines Teams erscheint mit Zähler, Antwort geht in den Direktkanal", async () => {
    await sleep(2100); // Chat-Tempolimit des Teams
    await call(devices.Traun!.token, { action: "chat", gameId: G, text: "Unser Akku ist fast leer", dm: team.Traun });
    await admin.getByRole("link", { name: /Chat/ }).getByText("1").waitFor();
    await nav(T.admin.nav.chat);
    await admin.getByRole("tab", { name: T.chat.postfach }).click();
    await admin.getByRole("button", { name: /Traun/ }).click();
    await visible(admin, "Unser Akku ist fast leer");
    await admin.getByPlaceholder(T.chat.platzhalter).fill("Powerbank anstecken!");
    await admin.getByRole("button", { name: T.chat.senden }).click();
    await expect
      .poll(async () => Object.values((await val(`games/${G}/dm/${team.Traun}`)) as Record<string, { text: string }>).map((m) => m.text))
      .toContain("Powerbank anstecken!");
  });

  it("Protokoll zeigt Start, Übergabe und Rückgängig", async () => {
    await nav(T.admin.nav.protokoll);
    await visible(admin, "Spiel gestartet");
    await visible(admin, "Übergabe rückgängig");
  });

  it("Notstopp beendet das Spiel, Spielleitung und Schiri sehen die Auswertung", async () => {
    await nav(T.admin.nav.steuerung);
    await admin.getByRole("button", { name: T.admin.notstopp, exact: true }).click();
    await confirm(admin, T.admin.notstopp);
    await visible(admin, T.ende.sieger);
    await visible(schiri, T.ende.sieger);
    expect(await val(`games/${G}/state/phase`)).toBe("beendet");
    expect(await val(`games/${G}/staff`)).toEqual({});
  });
});
