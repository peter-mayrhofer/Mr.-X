// Spielfeld speichern und Spiele verwalten (Meilenstein 7): Prüfung am Server, nur vor dem Start, Organisator öffnet
// Spiele ohne Passwort, Archivieren sperrt den Beitritt, Löschen räumt alles weg (Spielraum + Datenbank).
import { beforeAll, describe, expect, it } from "vitest";
import { LINZ_INNENSTADT, type Polygon } from "@mrx/shared";
import { call, connect, eventually, join, reason, resetServer, set, superAdminToken, val, type Device } from "./helpers.ts";

const G = "feld-test";
let sa = "";
let admin: Device;
const run = (token: string | null, action: string, extra: Record<string, unknown> = {}) => call(token, { action, gameId: G, ...extra });
const sq = (d: number): Polygon => [
  [14.29 - d, 48.3 - d],
  [14.29 + d, 48.3 - d],
  [14.29 + d, 48.3 + d],
  [14.29 - d, 48.3 + d],
];
const games = async () => (await call(sa, { action: "listGames" })).result!.games as { id: string; archived: boolean }[];

beforeAll(async () => {
  await resetServer();
  sa = await superAdminToken();
  await call(sa, { action: "createGame", gameId: G, name: "Feld-Test", template: "leer", adminPassword: "admin1234" });
  admin = await join(G, "admin", "Peter", "admin1234");
}, 60_000);

describe("Spielfeld speichern", () => {
  it("nur Spielleitung", async () => {
    const t = await join(G, "viewer", "");
    expect(reason(await run(t.token, "setField", { field: LINZ_INNENSTADT }))).toBe("forbidden");
  });
  it("Server prüft: Selbstschnitt, Bereich außerhalb, kaputte Punkte, Farbe", async () => {
    const crossed = sq(0.01);
    [crossed[1], crossed[2]] = [crossed[2]!, crossed[1]!];
    const bad = [
      { name: "x", toleranceM: 20, base: crossed, cuts: {} },
      {
        name: "x",
        toleranceM: 20,
        base: sq(0.01),
        cuts: { weit: { name: "W", short: "W", color: "#ff0000", order: 1, poly: sq(0.001).map(([a, b]) => [a + 1, b]) } },
      },
      {
        name: "x",
        toleranceM: 20,
        base: [
          [1, "a"],
          [2, 3],
          [4, 5],
        ],
        cuts: {},
      },
      { name: "x", toleranceM: 20, base: sq(0.01), cuts: { a: { name: "A", short: "A", color: "rot", order: 1, poly: sq(0.005) } } },
      { name: "x", toleranceM: 99, base: sq(0.01), cuts: {} },
    ];
    for (const field of bad) expect(reason(await run(admin.token, "setField", { field }))).toBe("invalid");
  });
  it("gültiges Feld wird gespeichert, Ring wird geschlossen", async () => {
    expect((await run(admin.token, "setField", { field: { name: "Quadrat", toleranceM: 15, base: sq(0.01), cuts: {} } })).result).toEqual({});
    const f = await val(`games/${G}/field`);
    expect(f.base).toHaveLength(5);
    expect(f.base[4]).toEqual(f.base[0]);
    expect(f.toleranceM).toBe(15);
  });
  it("Linz-Vorlage übernehmen; im laufenden Spiel gesperrt", async () => {
    expect((await run(admin.token, "setField", { field: LINZ_INNENSTADT })).result).toEqual({});
    expect(Object.keys(await val(`games/${G}/field/cuts`))).toHaveLength(4);
    await set(`games/${G}/state/phase`, "laeuft");
    expect(reason(await run(admin.token, "setField", { field: LINZ_INNENSTADT }))).toBe("wrongPhase");
    await set(`games/${G}/state/phase`, "vorbereitung");
  });
});

describe("Spiele verwalten (Organisator)", () => {
  it("Organisator öffnet das Spiel ohne Admin-Passwort, andere nicht", async () => {
    expect((await run(sa, "join", { role: "admin", name: "Orga" })).result).toMatchObject({ status: "joined", role: "admin" });
    expect(reason(await run(null, "join", { role: "admin", name: "Fremd" }))).toBe("wrongSecret");
  });
  it("nur der Organisator archiviert und löscht", async () => {
    expect(reason(await run(admin.token, "archiveGame", { archived: true }))).toBe("forbidden");
    expect(reason(await run(admin.token, "deleteGame"))).toBe("forbidden");
  });
  it("archiviert: kein Beitritt mehr; reaktiviert: wieder möglich", async () => {
    await run(admin.token, "setSecret", { kind: "teamPw", value: "falke27" });
    expect((await run(sa, "archiveGame", { archived: true })).result).toEqual({});
    expect((await games()).find((g) => g.id === G)?.archived).toBe(true);
    expect(reason(await run(null, "join", { role: "team", name: "Urfahr", secret: "falke27" }))).toBe("archived");
    await run(sa, "archiveGame", { archived: false });
    expect((await run(null, "join", { role: "team", name: "Urfahr", secret: "falke27" })).result).toMatchObject({ status: "joined" });
    expect((await games()).find((g) => g.id === G)).toMatchObject({ archived: false, teams: 1 });
  });
  it("laufendes Spiel kann nicht gelöscht werden", async () => {
    await set(`games/${G}/state/phase`, "laeuft");
    expect(reason(await run(sa, "deleteGame"))).toBe("wrongPhase");
    await set(`games/${G}/state/phase`, "vorbereitung");
  });
  it("löschen räumt alles weg, Geräte bekommen den Hinweis", async () => {
    const phone = connect(admin.token);
    await phone.until(() => true);
    expect((await run(sa, "deleteGame")).result).toEqual({});
    expect(await val(`games/${G}/info`)).toBeNull();
    expect(await val(`games/${G}/members`)).toEqual({});
    expect((await games()).map((g) => g.id)).not.toContain(G);
    expect(reason(await call(null, { action: "gameInfo", gameId: G }))).toBe("notFound");
    await eventually(async () => phone.bye, (b) => b !== null);
    expect(phone.bye).toBe("removed");
  });
});
