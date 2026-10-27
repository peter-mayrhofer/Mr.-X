import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync(new URL("package.json", import.meta.url), "utf8")) as { version: string };
// Entwicklung: Spiel-Server lokal mit `npm run dev:server` (wrangler dev, Port 8787); Tests setzen MRX_SERVER
const server = process.env.MRX_SERVER ?? "http://127.0.0.1:8787";

export default defineConfig({
  plugins: [svelte()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: { target: "es2022", chunkSizeWarningLimit: 1200 },
  server: {
    proxy: {
      "/api": server,
      "/ws": { target: server, ws: true },
      "/health": server,
    },
  },
});
