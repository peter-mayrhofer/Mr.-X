// Ruhezustand (WebSocket-Hibernation): Cloudflare legt einen Spielraum ohne Arbeit schlafen und weckt ihn bei der nächsten
// Nachricht – der Speicher ist dann neu. Hier mit eigenem Server, der den Spielraum gezielt schlafen legt: Spielstand und
// offene Verbindungen müssen das überstehen; Meldungen per Alarm kommen trotzdem.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestHarness, type TestHarness } from "wrangler";
import { Live } from "@mrx/shared/client";
import type { View } from "@mrx/shared";
import { TEST_SECRETS } from "./setup.ts";

const G = "schlaf-test";
let server: TestHarness;
let url = "";
const api = async (token: string | null, body: Record<string, unknown>) => {
  const r = await fetch(`${url}/api`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const j = (await r.json()) as { ok: boolean; result: Record<string, unknown>; message?: string };
  if (!j.ok) throw new Error(j.message);
  return j.result;
};
const hook = async (body: Record<string, unknown>) =>
  ((await (await fetch(`${url}/__test/room`, { method: "POST", body: JSON.stringify({ g: G, ...body }) })).json()) as { result: unknown })
    .result;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const evict = () => server.getWorker().evictDurableObject("GameRoom", { name: G, webSockets: "hibernate" });

let admin = "";
let team = "";

beforeAll(async () => {
  server = createTestHarness({ workers: [{ configPath: "server/wrangler.jsonc", vars: { TEST_HOOKS: "1" }, secrets: TEST_SECRETS }] });
  url = (await server.listen()).url.origin;
  const sa = (await api(null, { action: "superSetup", setupSecret: TEST_SECRETS.SETUP_SECRET, password: "organisator-test-123" }))
    .token as string;
  await api(sa, { action: "createGame", gameId: G, name: "Schlaf", template: "linz", adminPassword: "admin1234" });
  admin = (await api(null, { action: "join", gameId: G, role: "admin", name: "Peter", secret: "admin1234" })).token as string;
  await api(admin, { action: "setSecret", gameId: G, kind: "teamPw", value: "falke27" });
  team = (await api(null, { action: "join", gameId: G, role: "team", name: "Urfahr", secret: "falke27" })).token as string;
  await api(null, { action: "join", gameId: G, role: "team", name: "Traun", secret: "falke27" });
}, 120_000);

afterAll(() => server?.close());

describe("Spielraum schläft und wacht wieder auf", () => {
  it("Verbindung bleibt, Zustand kommt aus dem Speicher", async () => {
    let view: View | null = null;
    const live = new Live({ url: `${url.replace(/^http/, "ws")}/ws`, token: admin, onView: (v) => (view = v) });
    while (!view) await sleep(20);
    const teams = Object.keys((view as View).teams);
    await api(admin, { action: "startGame", gameId: G, mrx: teams[0] });
    await sleep(200);
    await evict();
    await sleep(200);
    // nächste Aktion weckt den Spielraum: Zustand muss aus dem Speicher kommen
    await api(admin, { action: "announce", gameId: G, text: "Nach dem Schlaf" });
    const until = Date.now() + 5000;
    while (!Object.values((view as unknown as View).chat ?? {}).some((m) => m.text === "Nach dem Schlaf") && Date.now() < until)
      await sleep(25);
    const v = view as unknown as View;
    expect(v.state.phase).toBe("laeuft");
    expect(Object.values(v.chat!).some((m) => m.text === "Nach dem Schlaf")).toBe(true);
    expect(live.online).toBe(true); // keine neue Verbindung nötig
    live.close();
  });

  it("Alarm weckt den schlafenden Spielraum: Meldung ohne ein einziges Handy", async () => {
    const teams = (await hook({ op: "get", path: "teams" })) as Record<string, unknown>;
    const mrx = ((await hook({ op: "get", path: "state" })) as { mrx: string }).mrx;
    expect(Object.keys(teams)).toContain(mrx);
    await hook({ op: "set", path: "positions/" + mrx, value: { lat: 48.3, lng: 14.28, acc: 5, t: Date.now() } });
    await hook({ op: "set", path: "state/nextReportAt", value: Date.now() + 1500 });
    await evict();
    await sleep(3000);
    const reports = (await hook({ op: "get", path: "reports" })) as Record<string, { kind: string }>;
    expect(Object.values(reports).map((r) => r.kind)).toContain("auto");
  });

  it("Team-Verbindung nach dem Schlaf: Standort wird angenommen", async () => {
    let view: View | null = null;
    const live = new Live({ url: `${url.replace(/^http/, "ws")}/ws`, token: team, onView: (v) => (view = v) });
    while (!view) await sleep(20);
    await evict();
    live.sendPos({ lat: 48.31, lng: 14.29, acc: 6, t: Date.now() });
    const until = Date.now() + 5000;
    let p: unknown = null;
    while (!p && Date.now() < until) {
      await sleep(100);
      const me = (view as unknown as View).me.teamId!;
      p = await hook({ op: "get", path: `positions/${me}` });
    }
    expect(p).toMatchObject({ lat: 48.31 });
    live.close();
  });
});

describe("Löschfristen im Archiv (täglicher Cron, F3)", () => {
  it("Chat nach 30 Tagen weg, ganzer Lauf nach einem Jahr", async () => {
    await api(admin, { action: "stopGame", gameId: G });
    const env = await server.getWorker<{ DB: D1Database }>().getEnv();
    const runs = async () =>
      (await env.DB.prepare("SELECT run, chat IS NOT NULL AS hasChat FROM archive WHERE game = ?1").bind(G).all<{ hasChat: number }>())
        .results;
    expect(await runs()).toEqual([expect.objectContaining({ hasChat: 1 })]);
    const DAY = 24 * 3600_000;
    await env.DB.prepare("UPDATE archive SET endedAt = ?1 WHERE game = ?2")
      .bind(Date.now() - 31 * DAY, G)
      .run();
    await server.getWorker().scheduled({ cron: "17 3 * * *" });
    expect(await runs()).toEqual([expect.objectContaining({ hasChat: 0 })]);
    await env.DB.prepare("UPDATE archive SET endedAt = ?1 WHERE game = ?2")
      .bind(Date.now() - 366 * DAY, G)
      .run();
    await server.getWorker().scheduled({ cron: "17 3 * * *" });
    expect(await runs()).toEqual([]);
  });
});
