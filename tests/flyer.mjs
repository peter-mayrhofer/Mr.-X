// Beispiel-Flyer als PDF (docs/flyer-beispiel.pdf): genau die Druckansicht, die die Spielleitung unter
// „Teams & Zugänge → Zugänge → QR-Code für Teams → Drucken“ bekommt – hier mit dem Beispielspiel des Prototyps.
// Aufruf wie bei den Screenshots: npm run build, in app/ `npx vite preview --port 4173`, dann `npm run flyer`.
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:4173/";
const OUT = new URL("../docs/flyer-beispiel.pdf", import.meta.url).pathname;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${BASE}#/prototyp/15?v=zugaenge&clean`);
await page.locator(".flyer").waitFor({ state: "attached" });
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: OUT, format: "A4", printBackground: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } });
await browser.close();
console.log(`Flyer: ${OUT}`);
