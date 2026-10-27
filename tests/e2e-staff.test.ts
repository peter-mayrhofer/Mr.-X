// Ende-zu-Ende (Meilenstein 6): Spielleitung am Laptop und Schiri am Handy bedienen das Spiel über die echte App –
// Start mit gewähltem Mister X, Schiri begleitet die Fahne, Übergabe mit Vorschau, Rückgängig, Regeln live ändern,
// Bereich sperren, Durchsage, Wartezeit von Hand, Umbenennen, Postfach, Protokoll, Notstopp mit Auswertung.
// Die Team-Handys werden hier direkt über die Datenbank simuliert (ihre Oberfläche testet e2e-team).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { T } from "../app/src/texte.ts";
import { call, db, device, resetEmulators, superAdminToken, val } from "./helpers.ts";

const G = "linz-staff";
const PORT = 5182;
const URL = `http://127.0.0.1:${PORT}/`;
const HAUPTPLATZ = { lat: 48.3059, lng: 14.2862 };
let vite: ViteDevServer;
let browser: Browser;
let admin: Page;
let schiri: Page;
const team: Record<string, string> = {};

const visible = (page: Page, text: string) => page.getByText(text, { exact: false }).first().waitFor({ timeout: 15_000 });
const setPos = (id: string, dLat: number) =>
  db.ref(`games/${G}/pos/${id}`).set({ lat: HAUPTPLATZ.lat + dLat, lng: HAUPTPLATZ.lng, acc: 8, t: Date.now() });
const nav = (label: string) => admin.getByRole("link", { name: label }).click();
const confirm = (page: Page, label: string = T.allgemein.bestaetigen) =>
  page.getByRole("dialog").getByRole("button", { name: label, exact: true }).click();

beforeAll(async () => {
  await resetEmulators();
  const sa = await superAdminToken();
  await call(sa, { action: "createGame", gameId: G, name: "Staff-Test", template: "linz", adminPassword: "admin1234" });
  const a = await device();
  await call(a.token, { action: "join", gameId: G, role: "admin", name: "Vorab", secret: "admin1234" });
  await call(a.token, { action: "setSecret", gameId: G, kind: "teamPw", value: "falke27" });
  await call(a.token, { action: "setSecret", gameId: G, kind: "schiriCode", value: "pfeife" });
  for (const [name, dLat] of [
    ["Urfahr", 0],
    ["Traun", 0.0005],
    ["Leonding", 0.01],
  ] as const) {
    const d = await device();
    const r = await call(d.token, { action: "join", gameId: G, role: "team", name, secret: "falke27" });
    team[name] = r.result!.teamId as string;
    await setPos(team[name], dLat);
  }
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
      .poll(async () => Object.values(((await val(`games/${G}/staffPos`)) ?? {}) as Record<string, { name: string }>)[0]?.name, {
        timeout: 15_000,
      })
      .toBe("Anna");
  });

  it("Schiri übergibt: nächstes Team oben, Vorschau der Wartezeit, dann Rückgängig", async () => {
    await db.ref(`games/${G}/locks`).set(null);
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
    await admin.locator("li", { hasText: "Norden" }).getByRole("button", { name: T.admin.sperren }).click();
    await confirm(admin, T.admin.sperren);
    await expect.poll(() => val(`games/${G}/state/cuts/norden`)).toBeGreaterThan(0);
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
    const t = Date.now();
    await db
      .ref(`games/${G}/dm/${team.Traun}/m1`)
      .set({ uid: "x", name: "Traun", teamId: team.Traun, kind: "msg", t, text: "Unser Akku ist fast leer" });
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
    expect(await val(`games/${G}/staffPos`)).toBeNull();
  });
});
