import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const { version } = JSON.parse(readFileSync(new URL("package.json", import.meta.url), "utf8")) as { version: string };
// Build-Kennung = Commit: Web-App und APK aus demselben Stand haben dieselbe → die Android-App erkennt, ob sie veraltet ist
const build = (() => {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync("git rev-parse --short=7 HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
})();
// Entwicklung: Spiel-Server lokal mit `npm run dev:server` (wrangler dev, Port 8787); Tests setzen MRX_SERVER
const server = process.env.MRX_SERVER ?? "http://127.0.0.1:8787";

export default defineConfig({
  plugins: [
    svelte(),
    {
      name: "mrx-version",
      generateBundle() {
        this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ version, build }) });
      },
    },
  ],
  define: { __APP_VERSION__: JSON.stringify(version), __BUILD__: JSON.stringify(build) },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1200,
    // gemeinsam genutzte Module (Knöpfe, Symbole, Texte …) in eine Datei statt vieler Mini-Dateien – schneller über Mobilfunk;
    // was nur Spielleitung, Großbild, Archiv oder Prototyp brauchen, bleibt draußen und wird erst bei Bedarf geladen
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "app",
              minShareCount: 2,
              test: (id) =>
                !/[\\/]src[\\/](proto[\\/]|screens[\\/](admin[\\/]|BigScreen|Replay|Archive|SuperAdmin|parts[\\/](AccessPanel|TrackerPanel)))/.test(
                  id,
                ),
            },
          ],
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": server,
      "/ws": { target: server, ws: true },
      "/health": server,
    },
  },
});
