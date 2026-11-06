// Startet den Spiel-Server einmal für alle Server-Tests: der echte Worker mit Spielräumen (Durable Objects), D1 und
// Alarmen in der lokalen Cloudflare-Laufzeit (workerd). Test-Geheimnisse statt echter; TEST_HOOKS öffnet /__test.
import { mkdirSync } from "node:fs";
import type { TestProject } from "vitest/node";
import { createTestHarness } from "wrangler";

export const TEST_SECRETS = {
  TOKEN_SECRET: "test-token-geheimnis-nur-fuer-tests",
  SETUP_SECRET: "test-setup-geheimnis",
  // Schlüsselpaar nur für Tests (Push wird in Tests nicht verschickt, sondern im Postausgang gesammelt)
  VAPID_PUBLIC: "BMQZNyxv8II21DU8j-dMzyu5nbiqFtIYHge0L5HW-rqMI4Z8anYJfDZ6dl8PNvcn24ugjTNT-NhMeQd5FTewyRs",
  VAPID_PRIVATE: "QFWrC22vXkHUpV-7QXysNftN_ZG8UKHcDZvZibfpcoU",
};

export default async function setup(project: TestProject) {
  mkdirSync("app/dist", { recursive: true }); // Worker braucht den App-Ordner; die E2E-Tests nehmen den Vite-Server
  const server = createTestHarness({
    workers: [{ configPath: "server/wrangler.jsonc", vars: { TEST_HOOKS: "1" }, secrets: TEST_SECRETS }],
  });
  const { url } = await server.listen();
  project.provide("server", url.origin);
  return () => server.close();
}

declare module "vitest" {
  export interface ProvidedContext {
    server: string;
  }
}
