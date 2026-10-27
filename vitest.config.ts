import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      { test: { name: "unit", include: ["shared/test/**/*.test.ts"] } },
      // gegen die Firebase-Emulatoren (npm run test:emu), nacheinander, weil sie eine Datenbank teilen
      { test: { name: "emulator", include: ["tests/**/*.test.ts"], fileParallelism: false, testTimeout: 30_000, hookTimeout: 60_000 } },
    ],
  },
});
