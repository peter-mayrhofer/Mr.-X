import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      { test: { name: "unit", include: ["shared/test/**/*.test.ts", "server/test/**/*.test.ts"] } },
      // gegen den lokal gestarteten Cloudflare-Server (Spielräume, Datenbank, Alarme) – nacheinander, ein Server für alle
      {
        test: {
          name: "server",
          include: ["tests/**/*.test.ts"],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 120_000,
          // Klick → Server → Wert: auf ausgelasteten CI-Rechnern dauert das gelegentlich länger als die 1 s Standard
          expect: { poll: { timeout: 10_000 } },
          globalSetup: ["tests/setup.ts"],
        },
      },
    ],
  },
});
