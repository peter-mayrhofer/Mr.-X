// Visuelle Kontrolle (Abschnitt 9.3): Screenshots aller Prototyp-Screens in dunkel/hell/Sonne,
// Handy (390×844) und – für Spielleitungs-/Großbild-Screens – Laptop (1440×900).
// Aufruf: npm run build && npx vite preview --port 4173 (in app/) und dann: node tests/screenshots.mjs [Filter]
// Ergebnis: docs/screens/<theme>/<nr>-<variante>.jpg
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";

// vorinstalliertes Playwright (CI: npx playwright install chromium)
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:4173/";
const OUT = new URL("../docs/screens/", import.meta.url).pathname;
const THEMES = (process.env.THEMES ?? "dunkel,hell,sonne").split(",");
const only = process.argv[2];

const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
  ...(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" } } : {}),
});

// Screen-Liste aus der Übersicht lesen (Nummer + ob für Laptop optimiert)
async function list() {
  const page = await browser.newPage();
  await page.goto(BASE + "#/prototyp");
  const items = await page.$$eval("a[href^='#/prototyp/']", (as) =>
    as.map((a) => ({ n: Number(a.getAttribute("href").split("/").pop()), wide: !!a.querySelector('[aria-label="für Laptop optimiert"]') })),
  );
  await page.close();
  return items;
}

const screens = await list();
const MAP = new Set([6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22]);
let n = 0;
for (const theme of THEMES) {
  await mkdir(OUT + theme, { recursive: true });
  for (const s of screens) {
    if (only && !String(s.n).match(new RegExp(`^(${only})$`))) continue;
    const sizes = s.wide ? [["laptop", 1440, 900]] : [["handy", 390, 844]];
    for (const [label, width, height] of sizes) {
      const ctx = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
        locale: "de-AT",
        timezoneId: "Europe/Vienna",
      });
      await ctx.addInitScript((t) => localStorage.setItem("mrx.theme", t), theme);
      const page = await ctx.newPage();
      page.on("pageerror", (e) => console.error(`#${s.n} ${theme}: ${e.message}`));
      await page.goto(`${BASE}#/prototyp/${s.n}?clean`);
      await page.waitForTimeout(MAP.has(s.n) ? 4500 : 800);
      const file = `${OUT}${theme}/${String(s.n).padStart(2, "0")}-${label}.jpg`;
      await page.screenshot({ path: file, type: "jpeg", quality: 72 });
      n++;
      await ctx.close();
    }
  }
}
await browser.close();
console.log(`${n} Screenshots in ${OUT}`);
