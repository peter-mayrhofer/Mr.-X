// Spielfeld speichern und Spiele verwalten (Meilenstein 7) gegen die Emulatoren: Prüfung am Server, nur vor dem Start,
// Organisator öffnet Spiele ohne Passwort, Archivieren sperrt den Beitritt, Löschen räumt alles weg.
import { beforeAll, describe, expect, it } from "vitest";
import { LINZ_INNENSTADT, type Polygon } from "@mrx/shared";
import { call, db, device, reason, resetEmulators, superAdminToken, val } from "./helpers.ts";

const G = "feld-test";
let sa = "";
let admin: { uid: string; token: string };
const run = (token: string, action: string, extra: Record<string, unknown> = {}) => call(token, { action, gameId: G, ...extra });
const sq = (d: number): Polygon => [
  [14.29 - d, 48.3 - d],
  [14.29 + d, 48.3 - d],
  [14.29 + d, 48.3 + d],
  [14.29 - d, 48.3 + d],
];

beforeAll(async () => {
  await resetEmulators();
  sa = await superAdminToken();
  await call(sa, { action: "createGame", gameId: G, name: "Feld-Test", template: "leer", adminPassword: "admin1234" });
  admin = await device();
  await run(admin.token, "join", { role: "admin", name: "Peter", secret: "admin1234" });
}, 60_000);

describe("Spielfeld speichern", () => {
  it("nur Spielleitung", async () => {
    const d = await device();
    expect(reason(await run(d.token, "setField", { field: LINZ_INNENSTADT }))).toBe("forbidden");
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
    expect((await run(admin.token, "setField", { field: { name: "Quadrat", toleranceM: 15, base: sq(0.01), cuts: {} } })).result).toEqual(
      {},
    );
    const f = await val(`games/${G}/field`);
    expect(f.base).toHaveLength(5);
    expect(f.base[4]).toEqual(f.base[0]);
    expect(f.toleranceM).toBe(15);
  });
  it("Linz-Vorlage übernehmen; im laufenden Spiel gesperrt", async () => {
    expect((await run(admin.token, "setField", { field: LINZ_INNENSTADT })).result).toEqual({});
    expect(Object.keys(await val(`games/${G}/field/cuts`))).toHaveLength(4);
    await db.ref(`games/${G}/state/phase`).set("laeuft");
    expect(reason(await run(admin.token, "setField", { field: LINZ_INNENSTADT }))).toBe("wrongPhase");
    await db.ref(`games/${G}/state/phase`).set("vorbereitung");
  });
});

describe("Spiele verwalten (Organisator)", () => {
  it("Organisator öffnet das Spiel ohne Admin-Passwort, andere nicht", async () => {
    expect((await run(sa, "join", { role: "admin", name: "Orga" })).result).toMatchObject({ status: "joined", role: "admin" });
    const d = await device();
    expect(reason(await run(d.token, "join", { role: "admin", name: "Fremd" }))).toBe("wrongSecret");
  });
  it("nur der Organisator archiviert und löscht", async () => {
    expect(reason(await run(admin.token, "archiveGame", { archived: true }))).toBe("forbidden");
    expect(reason(await run(admin.token, "deleteGame"))).toBe("forbidden");
  });
  it("archiviert: kein Beitritt mehr; reaktiviert: wieder möglich", async () => {
    await run(admin.token, "setSecret", { kind: "teamPw", value: "falke27" });
    expect((await run(sa, "archiveGame", { archived: true })).result).toEqual({});
    expect(await val(`gameIndex/${G}/archived`)).toBe(true);
    const d = await device();
    expect(reason(await run(d.token, "join", { role: "team", name: "Urfahr", secret: "falke27" }))).toBe("archived");
    await run(sa, "archiveGame", { archived: false });
    expect((await run(d.token, "join", { role: "team", name: "Urfahr", secret: "falke27" })).result).toMatchObject({ status: "joined" });
  });
  it("laufendes Spiel kann nicht gelöscht werden", async () => {
    await db.ref(`games/${G}/state/phase`).set("laeuft");
    expect(reason(await run(sa, "deleteGame"))).toBe("wrongPhase");
    await db.ref(`games/${G}/state/phase`).set("vorbereitung");
  });
  it("löschen räumt alles weg, Geräte bekommen den Hinweis", async () => {
    expect((await run(sa, "deleteGame")).result).toEqual({});
    for (const p of [`games/${G}`, `secrets/${G}`, `gameIndex/${G}`]) expect(await val(p)).toBeNull();
    expect(await val(`userGames/${admin.uid}`)).toEqual({ removedFrom: G });
  });
});
