// Barrierefreiheit (Abschnitt 8.6, Meilenstein 12): axe-core prüft jeden Screen des Klick-Prototyps – dieselben
// Komponenten wie die echte App – in jeder Variante und in allen drei Darstellungen (dunkel, hell, Sonne) auf
// WCAG 2.1 A/AA: Kontraste, Beschriftungen für Screenreader, Rollen, Formular-Labels; dazu axe-Empfehlungen
// (Seitenbereiche, Überschriften-Reihenfolge).
// Geprüft wird die gebaute App (wie sie ausgeliefert wird) – der Entwicklungsserver lädt Seiten manchmal neu.
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { build, preview, type PreviewServer } from "vite";
import { chromium, type Browser } from "playwright";
import { SCREENS } from "../app/src/proto/registry.ts";

const PORT = 5186;
const AXE = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
const THEMES = ["dunkel", "hell", "sonne"];
/** Screens mit Karte brauchen etwas länger, bis die Marker stehen */
const MAP = new Set([6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22]);
const OUT = mkdtempSync(join(tmpdir(), "mrx-a11y-"));
const VITE = { root: "app", configFile: "app/vite.config.ts", logLevel: "error", build: { outDir: OUT, emptyOutDir: true } } as const;
let app: PreviewServer;
let browser: Browser;

beforeAll(async () => {
  await build(VITE);
  app = await preview({ ...VITE, preview: { port: PORT, strictPort: true, host: "127.0.0.1" } });
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await app?.close();
  rmSync(OUT, { recursive: true, force: true });
});

it("alle Screens und Varianten erfüllen WCAG 2.1 AA (und die axe-Empfehlungen) in dunkel, hell und Sonne", async () => {
  const jobs = THEMES.flatMap((theme) =>
    SCREENS.flatMap((s) => (s.variants?.length ? s.variants : [{ id: "" }]).map((v) => ({ theme, n: s.n, v: v.id, wide: !!s.wide }))),
  );
  const found: string[] = [];
  const work = async () => {
    for (let j = jobs.shift(); j; j = jobs.shift()) {
      const ctx = await browser.newContext({
        viewport: j.wide ? { width: 1440, height: 900 } : { width: 390, height: 844 },
        reducedMotion: "reduce",
        locale: "de-AT",
      });
      await ctx.addInitScript((t) => localStorage.setItem("mrx.theme", t), j.theme);
      const page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${PORT}/#/prototyp/${j.n}?v=${j.v}&clean`);
      await page.waitForTimeout(MAP.has(j.n) ? 2500 : 700);
      // Animationen sofort beenden: unter Last zeichnet der Test-Browser kaum Bilder, axe würde Zwischenstände messen
      await page.evaluate(() => {
        for (const a of document.getAnimations())
          try {
            a.finish();
          } catch {
            /* endlose Animation */
          }
      });
      await page.addScriptTag({ path: AXE });
      const violations = await page.evaluate(async () => {
        const axe = (window as unknown as { axe: { run: (c: Document, o: object) => Promise<AxeResult> } }).axe;
        const r = await axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] },
        });
        return r.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")} – ${n.failureSummary.split("\n")[1] ?? ""}`));
      });
      for (const v of violations) found.push(`#${j.n}${j.v ? `?v=${j.v}` : ""} ${j.theme}: ${v.trim()}`);
      await ctx.close();
    }
  };
  await Promise.all(Array.from({ length: 6 }, work));
  if (found.length) console.log(found.sort().join("\n"));
  expect(found).toEqual([]);
}, 600_000);

interface AxeResult {
  violations: { id: string; nodes: { target: string[]; failureSummary: string }[] }[];
}
