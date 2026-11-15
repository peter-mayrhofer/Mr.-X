// Ende-zu-Ende: „neu“-Zähler am Chat. Eigene Nachrichten zählen nie als ungelesen – weder beim Team (an alle oder an
// die Spielleitung) noch bei der Spielleitung (Antwort im Postfach). Nachrichten der anderen schon.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { T } from "../app/src/texte.ts";
import { call, join, resetServer, set, sleep, startApp, superAdminToken, visible, type Device } from "./helpers.ts";

const G = "linz-ungelesen";
const PORT = 5195;
const URL = `http://127.0.0.1:${PORT}/`;
let vite: ViteDevServer;
let browser: Browser;
let admin: Device, urfahr: Device;
let teamPage: Page, adminPage: Page;

const run = (d: Device, action: string, extra: Record<string, unknown> = {}) => call(d.token, { action, gameId: G, ...extra });

beforeAll(async () => {
  await resetServer();
  const sa = await superAdminToken();
  await call(sa, { action: "createGame", gameId: G, name: "Ungelesen-Test", template: "linz", adminPassword: "admin1234" });
  admin = await join(G, "admin", "Vorab", "admin1234");
  await run(admin, "setSecret", { kind: "teamPw", value: "falke27" });
  urfahr = await join(G, "team", "Urfahr", "falke27");
  vite = await startApp(PORT);
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await vite?.close();
});

async function phone(viewport = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport, locale: "de-AT", reducedMotion: "reduce" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.error("PAGEERROR", e.message));
  return p;
}

const chatTab = (p: Page) => p.getByRole("button", { name: new RegExp(`^${T.tabs.chat}`) });

describe("Ungelesen-Zähler", { timeout: 60_000 }, () => {
  it("Team: eigene Nachricht an alle und an die Spielleitung zählt nicht als neu", async () => {
    teamPage = await phone();
    await teamPage.goto(`${URL}#/beitreten/${G}`);
    await teamPage.getByLabel(T.beitritt.teamname).fill("Traun");
    await teamPage.getByLabel(T.beitritt.passwort).fill("falke27");
    await teamPage.getByRole("button", { name: T.beitritt.los, exact: true }).click();
    await teamPage.getByRole("button", { name: T.onboarding.ueberspringen, exact: true }).click();
    await teamPage.getByRole("heading", { name: T.lobby.angemeldet }).waitFor();
    await run(admin, "startGame", { mrx: urfahr.teamId });
    // Wartezeit zum Start aufheben, sonst deckt sie den Bildschirm ab
    await set(`games/${G}/locks`, null);
    await teamPage.getByRole("alertdialog", { name: T.wartezeit.titel }).waitFor({ state: "detached" });
    await chatTab(teamPage).waitFor();
    await chatTab(teamPage).click();
    await teamPage.getByPlaceholder(T.chat.platzhalter).fill("Hallo alle");
    await teamPage.getByRole("button", { name: T.chat.senden }).click();
    await visible(teamPage, "Hallo alle");
    await sleep(2100);
    await teamPage.getByRole("tab", { name: new RegExp(T.chat.spielleitung) }).click();
    await teamPage.getByPlaceholder(T.chat.platzhalter).fill("Frage an die Spielleitung");
    await teamPage.getByRole("button", { name: T.chat.senden }).click();
    await visible(teamPage, "Frage an die Spielleitung");
    await teamPage.getByRole("button", { name: T.tabs.karte, exact: true }).click();
    await sleep(1000);
    expect(await chatTab(teamPage).getAttribute("aria-label")).toBe(T.tabs.chat);
    // Nachricht eines anderen Teams zählt
    await run(urfahr, "chat", { text: "Wir sind am Hauptplatz" });
    await expect.poll(() => chatTab(teamPage).getAttribute("aria-label")).toBe(T.allgemein.ungelesen(T.tabs.chat, 1));
  });

  it("Team: „Neue Nachrichten“ erscheint nur für fremde Nachrichten, nicht für die eigene", async () => {
    // viele Nachrichten, damit die Liste scrollt
    for (let i = 0; i < 25; i++)
      await set(`games/${G}/chat/alt${String(i).padStart(2, "0")}`, {
        uid: urfahr.uid,
        name: "Urfahr",
        teamId: urfahr.teamId,
        text: `Alte Nachricht ${i}`,
        t: Date.now() - 60_000 + i,
        kind: "msg",
      });
    await chatTab(teamPage).click();
    await teamPage.getByRole("tab", { name: new RegExp(`^${T.chat.alle}`) }).click();
    await visible(teamPage, "Alte Nachricht 24");
    // nicht ganz unten (wie wenn die Tastatur die Liste verschiebt)
    const nachOben = () =>
      teamPage.locator(".msgs").evaluate((b) => {
        b.scrollTop = 0;
        b.dispatchEvent(new Event("scroll"));
      });
    await nachOben();
    // der Server nimmt pro Gerät höchstens alle 2 s eine Nachricht an (CHAT_GAP_MS)
    await sleep(2100);
    await teamPage.getByPlaceholder(T.chat.platzhalter).fill("Unsere eigene Nachricht");
    await teamPage.getByRole("button", { name: T.chat.senden }).click();
    await visible(teamPage, "Unsere eigene Nachricht");
    await sleep(800);
    expect(await teamPage.locator(".newpill").count()).toBe(0);
    // ein anderes Team schreibt, während man oben liest → Hinweis mit (1)
    await nachOben();
    await sleep(2100);
    await run(urfahr, "chat", { text: "Fremde Nachricht" });
    await teamPage.locator(".newpill", { hasText: "(1)" }).waitFor();
  });

  it("Spielleitung: eigene Antwort im Postfach zählt nicht als neu", async () => {
    adminPage = await phone({ width: 1280, height: 860 });
    await adminPage.goto(`${URL}#/staff/admin?g=${G}`);
    await adminPage.getByLabel(T.staffLogin.name).fill("Peter");
    await adminPage.getByLabel(T.staffLogin.adminPasswort).fill("admin1234");
    await adminPage.getByRole("button", { name: T.staffLogin.los, exact: true }).click();
    await adminPage.getByRole("link", { name: /Chat/ }).first().click();
    await adminPage.getByRole("tab", { name: T.chat.postfach }).click();
    await adminPage.getByRole("button", { name: /Traun/ }).click();
    await visible(adminPage, "Frage an die Spielleitung");
    await adminPage.getByPlaceholder(T.chat.platzhalter).fill("Ist notiert");
    await adminPage.getByRole("button", { name: T.chat.senden }).click();
    await visible(adminPage, "Ist notiert");
    await sleep(1000);
    // Menü „Chat“, Reiter „Postfach“ und die Zeile des Teams: keine Zahl mehr
    console.log(
      "ZAEHLER",
      JSON.stringify(
        await adminPage.evaluate(() =>
          [...document.querySelectorAll(".badge.num, .unread, [class*=badge]")].map(
            (e) => `${e.className}=${(e as HTMLElement).innerText}`,
          ),
        ),
      ),
    );
    expect((await adminPage.getByRole("link", { name: /Chat/ }).first().innerText()).replace(/\D/g, "")).toBe("");
    expect(await adminPage.locator(".unread").count()).toBe(0);
  });
});
