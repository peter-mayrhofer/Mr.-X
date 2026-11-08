import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { readFileSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { DOWNLOAD_DATEIEN, DOWNLOAD_SYSTEME, type DownloadsJson } from "../shared/src/geraet.ts";

function sammleDownloads(): DownloadsJson {
  const out: DownloadsJson = {};
  for (const system of DOWNLOAD_SYSTEME) {
    const datei = DOWNLOAD_DATEIEN[system];
    try {
      const s = statSync(new URL(`public/${datei}`, import.meta.url));
      if (s.isFile()) out[system] = { datei, groesse: s.size };
    } catch {
      // Datei fehlt → kein Eintrag
    }
  }
  // Version der Installer (vom Deploy aus dem Release-Tag geschrieben) – nur zusammen mit mindestens einer Desktop-Datei
  if (Object.keys(out).length) {
    try {
      const v = readFileSync(new URL("public/download/VERSION", import.meta.url), "utf8")
        .trim()
        .replace(/^v/, "");
      if (v) out.desktopVersion = v;
    } catch {
      // keine VERSION → keine Angabe
    }
  }
  return out;
}

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
    {
      // downloads.json: welche App-Dateien (Vertrag: shared/src/geraet.ts) liegen in public/ – nur vorhandene, sonst {}
      name: "mrx-downloads",
      generateBundle() {
        this.emitFile({ type: "asset", fileName: "downloads.json", source: JSON.stringify(sammleDownloads()) });
      },
      configureServer(devServer) {
        devServer.middlewares.use("/downloads.json", (_req, res) => {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(sammleDownloads()));
        });
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
