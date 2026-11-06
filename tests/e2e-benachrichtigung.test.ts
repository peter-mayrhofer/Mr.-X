// Benachrichtigungen der installierten Web-App (PWA, Abschnitt 7.6 / Definition of Done): eine Push-Nachricht – genau so,
// wie der Server sie verschickt – wird über das DevTools-Protokoll direkt an den echten Service Worker der App
// (app/public/sw.js) zugestellt. Ist die App zu, erscheint eine Benachrichtigung; ist sie offen und sichtbar, keine
// doppelte (die App meldet sich dann selbst). Verschlüsselung und Empfänger prüfen server/test/webpush.test.ts
// (Testvektor RFC 8291) und tests/push.test.ts – nur der Weg über den Push-Dienst von Google/Apple/Mozilla bleibt dem
// Feldtest.
import { afterAll, beforeAll, expect, it } from "vitest";
import type { ViteDevServer } from "vite";
import { chromium, type Browser, type CDPSession, type Page } from "playwright";
import { PUSH_TITLE } from "@mrx/shared";
import { startApp } from "./helpers.ts";

const PORT = 5188;
const ORIGIN = `http://127.0.0.1:${PORT}`;
let vite: ViteDevServer;
let browser: Browser;
let page: Page;
let cdp: CDPSession;
let registrationId = "";

/** wie GameRoom.notify(): Titel, Text, Art, Kennung, Link */
const payload = (title: string, body: string) => JSON.stringify({ title, body, kind: "durchsage", tag: "durchsage", link: "/#/spiel" });
const notifications = () =>
  page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => `${n.title}: ${n.body}`));

beforeAll(async () => {
  vite = await startApp(PORT);
  // vollständiges Chromium (neuer Headless-Modus) – die schlanke Headless-Variante kann keine Benachrichtigungen
  browser = await chromium.launch({ channel: "chromium" });
  const ctx = await browser.newContext({ locale: "de-AT" });
  await ctx.grantPermissions(["notifications"], { origin: ORIGIN });
  page = await ctx.newPage();
  cdp = await ctx.newCDPSession(page);
  await cdp.send("ServiceWorker.enable");
  cdp.on("ServiceWorker.workerRegistrationUpdated", (e) => {
    for (const r of e.registrations) if (r.scopeURL.startsWith(ORIGIN) && !r.isDeleted) registrationId = r.registrationId;
  });
  await page.goto(`${ORIGIN}/`);
  // wie die App beim Einschalten der Benachrichtigungen (app/src/lib/push.svelte.ts)
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
  });
  for (let i = 0; i < 50 && !registrationId; i++) await page.waitForTimeout(100);
  if (!registrationId) throw new Error("Service Worker nicht registriert");
}, 60_000);

afterAll(async () => {
  await browser?.close();
  await vite?.close();
});

it("App offen und sichtbar: keine doppelte Benachrichtigung", async () => {
  await cdp.send("ServiceWorker.deliverPushMessage", {
    origin: ORIGIN,
    registrationId,
    data: payload(PUSH_TITLE.durchsage, "Erst um 17 Uhr"),
  });
  await page.waitForTimeout(1500);
  expect(await notifications()).toEqual([]);
});

it("App zu: die Push-Nachricht wird als Benachrichtigung angezeigt", async () => {
  // App „schließen“: das Fenster zeigt etwas anderes, es gibt kein sichtbares App-Fenster mehr
  await page.goto("about:blank");
  await cdp.send("ServiceWorker.deliverPushMessage", {
    origin: ORIGIN,
    registrationId,
    data: payload(PUSH_TITLE.durchsage, "Treffpunkt Hauptplatz um 17 Uhr"),
  });
  await page.waitForTimeout(1500);
  await page.goto(`${ORIGIN}/`);
  await expect.poll(notifications, { timeout: 10_000 }).toEqual([`${PUSH_TITLE.durchsage}: Treffpunkt Hauptplatz um 17 Uhr`]);
});
