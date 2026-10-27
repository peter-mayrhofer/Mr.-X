// Security Rules (Abschnitt 6 + 9.2): wer darf was – inkl. Angriffsversuche. Läuft gegen den Datenbank-Emulator.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";

const TS = { ".sv": "timestamp" };
let env: RulesTestEnvironment;

const msg = (uid: string, name: string, extra: Record<string, unknown> = {}) => ({
  uid,
  name,
  text: "Hallo",
  t: TS,
  kind: "msg",
  ...extra,
});
const pos = (extra: Record<string, unknown> = {}) => ({ lat: 48.3, lng: 14.29, acc: 8, t: Date.now(), ...extra });

const SEED = {
  games: {
    g1: {
      info: { name: "Test", phase: "laeuft", createdAt: 1, spectators: true },
      config: { intervalMin: 10 },
      field: { name: "Feld", toleranceM: 20 },
      state: { phase: "laeuft", mrx: "t1" },
      teams: { t1: { name: "Urfahr", short: "UR", color: "#000" }, t2: { name: "Traun", short: "TR", color: "#111" } },
      members: {
        admin1: { role: "admin", name: "Peter", joinedAt: 1 },
        schiri1: { role: "schiri", name: "Anna", joinedAt: 1 },
        team1: { role: "team", name: "Urfahr", teamId: "t1", joinedAt: 1 },
        team2: { role: "team", name: "Traun", teamId: "t2", joinedAt: 1 },
        screen1: { role: "screen", name: "Großbild", joinedAt: 1 },
        viewer1: { role: "viewer", name: "Zuschauer", joinedAt: 1 },
      },
      pos: { t1: { lat: 48.3, lng: 14.29, acc: 5, t: 1 }, t2: { lat: 48.31, lng: 14.28, acc: 5, t: 1 } },
      staffPos: { schiri1: { lat: 48.3, lng: 14.29, acc: 5, t: 1 } },
      trackerPos: { d1: { lat: 48.3, lng: 14.29, t: 1 } },
      reports: { r1: { teamId: "t1", lat: 48.3, lng: 14.29, t: 1 } },
      handovers: { h1: { to: "t1", at: 1, type: "start" } },
      locks: { t2: { until: 2, reason: "start" } },
      chat: { c1: { uid: "team2", name: "Traun", text: "x", t: 1, kind: "msg" } },
      dm: {
        t1: { d1: { uid: "team1", name: "Urfahr", text: "x", t: 1, kind: "msg" } },
        t2: { d2: { uid: "team2", name: "Traun", text: "y", t: 1, kind: "msg" } },
      },
      audit: { a1: { t: 1, action: "x" } },
      devices: { d1: { label: "Tracker" } },
    },
    g2: { members: { other: { role: "admin", name: "Fremd", joinedAt: 1 } }, pos: { x: { lat: 1, lng: 1, acc: 1, t: 1 } } },
  },
  secrets: { g1: { teamPw: "scrypt$…", adminPw: "scrypt$…" } },
  userGames: { team1: { gameId: "g1", role: "team" } },
  gameIndex: { g1: { name: "Test" } },
};

const as = (uid: string | null, claims: Record<string, unknown> = {}) =>
  (uid ? env.authenticatedContext(uid, claims) : env.unauthenticatedContext()).database();
const read = (uid: string | null, path: string, claims?: Record<string, unknown>) => as(uid, claims).ref(path).get();
const write = (uid: string | null, path: string, value: unknown, claims?: Record<string, unknown>) => as(uid, claims).ref(path).set(value);
const multi = (uid: string, values: Record<string, unknown>) => as(uid).ref().update(values);

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-mrx",
    database: { rules: readFileSync("database.rules.json", "utf8"), host: "127.0.0.1", port: 9000 },
  });
});
afterAll(() => env.cleanup());
beforeEach(async () => {
  await env.withSecurityRulesDisabled((ctx) => ctx.database().ref().set(SEED));
});

describe("Lesen: Live-Positionen nur für Admin, Schiri, Großbild", () => {
  it.each(["team1", "team2", "viewer1", "stranger"])("%s sieht keine Positionen – auf keinem Weg", async (uid) => {
    for (const p of [
      "games/g1/pos",
      "games/g1/pos/t1",
      "games/g1/pos/t2",
      "games/g1/staffPos",
      "games/g1/trackerPos",
      "games/g1",
      "games",
      "/",
    ]) {
      await assertFails(read(uid, p));
    }
  });
  it.each(["admin1", "schiri1", "screen1"])("%s sieht Positionen", async (uid) => {
    await assertSucceeds(read(uid, "games/g1/pos"));
    await assertSucceeds(read(uid, "games/g1/staffPos"));
    await assertSucceeds(read(uid, "games/g1/trackerPos"));
  });
  it("Super-Admin sieht Positionen", () => assertSucceeds(read("sa", "games/g1/pos", { superAdmin: true })));
  it("Admin eines anderen Spiels sieht nichts", async () => {
    await assertFails(read("other", "games/g1/pos"));
    await assertFails(read("other", "games/g1/config"));
  });
  it("ein gefälschter Claim ohne true hilft nicht", () => assertFails(read("x", "games/g1/pos", { superAdmin: "true" })));
});

describe("Lesen: Spielzustand für Mitglieder", () => {
  it.each(["team1", "viewer1", "screen1", "schiri1", "admin1"])("%s liest Meldungen, Zustand, Teams", async (uid) => {
    for (const p of ["config", "field", "state", "teams", "reports", "handovers", "locks", "stats", "archive"])
      await assertSucceeds(read(uid, `games/g1/${p}`));
  });
  it("Fremde lesen nur den Spielnamen", async () => {
    await assertSucceeds(read("stranger", "games/g1/info"));
    for (const p of ["config", "state", "teams", "reports"]) await assertFails(read("stranger", `games/g1/${p}`));
  });
  it("ohne Anmeldung gar nichts", () => assertFails(read(null, "games/g1/info")));
});

describe("Lesen: Geheimes", () => {
  it.each(["team1", "admin1", "schiri1", "stranger"])("%s liest keine Passwörter", (uid) => assertFails(read(uid, "secrets/g1")));
  it("auch der Super-Admin nicht", () => assertFails(read("sa", "secrets", { superAdmin: true })));
  it("Mitgliederliste nur Admin, eigener Eintrag für jeden", async () => {
    await assertFails(read("team1", "games/g1/members"));
    await assertFails(read("team1", "games/g1/members/team2"));
    await assertSucceeds(read("team1", "games/g1/members/team1"));
    await assertSucceeds(read("admin1", "games/g1/members"));
  });
  it("Protokoll und Geräte nur Admin", async () => {
    for (const uid of ["team1", "schiri1", "screen1"]) {
      await assertFails(read(uid, "games/g1/audit"));
      await assertFails(read(uid, "games/g1/devices"));
    }
    await assertSucceeds(read("admin1", "games/g1/audit"));
  });
  it("Spieleliste nur Super-Admin", async () => {
    await assertFails(read("admin1", "gameIndex"));
    await assertSucceeds(read("sa", "gameIndex", { superAdmin: true }));
  });
  it("userGames nur der eigene Eintrag", async () => {
    await assertSucceeds(read("team1", "userGames/team1"));
    await assertFails(read("team2", "userGames/team1"));
  });
});

describe("Lesen: Chat", () => {
  it("Zuschauer sehen keinen Chat", () => assertFails(read("viewer1", "games/g1/chat")));
  it.each(["team1", "screen1", "admin1"])("%s sieht den Gruppenchat", (uid) => assertSucceeds(read(uid, "games/g1/chat")));
  it("Direktkanal: nur eigenes Team und Admin", async () => {
    await assertSucceeds(read("team1", "games/g1/dm/t1"));
    await assertFails(read("team1", "games/g1/dm/t2"));
    await assertFails(read("team1", "games/g1/dm"));
    await assertFails(read("schiri1", "games/g1/dm/t1"));
    await assertSucceeds(read("admin1", "games/g1/dm/t2"));
  });
});

describe("Schreiben: Spielzustand nur über den Server", () => {
  const PATHS = [
    "state",
    "state/mrx",
    "reports/x",
    "handovers/x",
    "locks/t1",
    "stats/t1",
    "config",
    "field",
    "teams/t1",
    "info/name",
    "audit/x",
    "archive/x",
  ];
  it.each(["team1", "schiri1", "admin1"])("%s ändert nichts direkt", async (uid) => {
    for (const p of PATHS) await assertFails(write(uid, `games/g1/${p}`, { x: 1 }));
  });
  it("Super-Admin auch nicht direkt", () => assertFails(write("sa", "games/g1/state/mrx", "t2", { superAdmin: true })));
  it("niemand macht sich selbst zum Admin", async () => {
    await assertFails(write("team1", "games/g1/members/team1/role", "admin"));
    await assertFails(write("stranger", "games/g1/members/stranger", { role: "admin", name: "x", joinedAt: 1 }));
    await assertFails(write("team1", "userGames/team1", { gameId: "g1", role: "admin" }));
  });
  it("niemand schreibt Passwörter", () => assertFails(write("admin1", "secrets/g1/teamPw", "x")));
});

describe("Schreiben: eigener Standort", () => {
  it("Team schreibt den eigenen Standort", () =>
    assertSucceeds(write("team1", "games/g1/pos/t1", pos({ heading: 90, battery: 55, uid: "team1" }))));
  it("aber nicht den eines anderen Teams", () => assertFails(write("team1", "games/g1/pos/t2", pos())));
  it("Fremde gar keinen", () => assertFails(write("stranger", "games/g1/pos/t1", pos())));
  it("Zuschauer und Großbild keinen", async () => {
    await assertFails(write("viewer1", "games/g1/pos/t1", pos()));
    await assertFails(write("screen1", "games/g1/pos/t1", pos()));
  });
  it.each([
    ["Breite außerhalb", { lat: 200 }],
    ["Zeit weit in der Vergangenheit", { t: Date.now() - 3600_000 }],
    ["Zeit in der Zukunft", { t: Date.now() + 3600_000 }],
    ["Server-Feld suspect", { suspect: true }],
    ["fremde uid", { uid: "team2" }],
    ["Text statt Zahl", { acc: "gut" }],
  ])("ungültig: %s", (_, extra) => assertFails(write("team1", "games/g1/pos/t1", pos(extra))));
  it("Pflichtfelder", () => assertFails(write("team1", "games/g1/pos/t1", { lat: 48.3, lng: 14.29 })));
  it("Schiri schreibt seinen Standort, nicht den anderer", async () => {
    await assertSucceeds(write("schiri1", "games/g1/staffPos/schiri1", pos()));
    await assertFails(write("schiri1", "games/g1/staffPos/admin1", pos()));
    await assertFails(write("team1", "games/g1/staffPos/team1", pos()));
  });
});

describe("Schreiben: Chat", () => {
  const send = (uid: string, path: string, m: unknown) => multi(uid, { [path]: m, [`games/g1/rate/${uid}`]: TS });
  it("Team schreibt eine normale Nachricht", () =>
    assertSucceeds(send("team1", "games/g1/chat/n1", msg("team1", "Urfahr", { teamId: "t1" }))));
  it("Schiri und Admin auch", async () => {
    await assertSucceeds(send("schiri1", "games/g1/chat/n2", msg("schiri1", "Anna")));
    await assertSucceeds(send("admin1", "games/g1/chat/n3", msg("admin1", "Peter")));
  });
  it.each([
    ["System-Meldung fälschen", msg("team1", "Urfahr", { teamId: "t1", kind: "sys" })],
    ["Durchsage fälschen", msg("team1", "Urfahr", { teamId: "t1", kind: "ann" })],
    ["fremder Name", msg("team1", "Spielleitung", { teamId: "t1" })],
    ["fremde uid", msg("team2", "Urfahr", { teamId: "t1" })],
    ["fremdes Team", msg("team1", "Urfahr", { teamId: "t2" })],
    ["Verweis auf Meldung", msg("team1", "Urfahr", { teamId: "t1", reportId: "r1" })],
    ["zu lang", msg("team1", "Urfahr", { teamId: "t1", text: "x".repeat(301) })],
    ["leer", msg("team1", "Urfahr", { teamId: "t1", text: "" })],
    ["falsche Zeit", msg("team1", "Urfahr", { teamId: "t1", t: 1 })],
  ])("abgelehnt: %s", (_, m) => assertFails(send("team1", "games/g1/chat/bad", m)));
  it("ohne Rate-Limit-Stempel abgelehnt", () => assertFails(write("team1", "games/g1/chat/n1", msg("team1", "Urfahr", { teamId: "t1" }))));
  it("Spam: zweite Nachricht innerhalb von 2 s abgelehnt", async () => {
    await assertSucceeds(send("team1", "games/g1/chat/n1", msg("team1", "Urfahr", { teamId: "t1" })));
    await assertFails(send("team1", "games/g1/chat/n2", msg("team1", "Urfahr", { teamId: "t1" })));
  });
  it("Zuschauer und Großbild schreiben nicht", async () => {
    await assertFails(send("viewer1", "games/g1/chat/v", msg("viewer1", "Zuschauer")));
    await assertFails(send("screen1", "games/g1/chat/s", msg("screen1", "Großbild")));
  });
  it("fremde Nachrichten nicht überschreiben oder löschen", async () => {
    await assertFails(send("team1", "games/g1/chat/c1", msg("team1", "Urfahr", { teamId: "t1" })));
    await assertFails(write("team1", "games/g1/chat/c1", null));
  });
  it("Admin löscht Nachrichten (Moderation)", () => assertSucceeds(write("admin1", "games/g1/chat/c1", null)));
  it("Direktkanal: Team nur in den eigenen, Admin in alle", async () => {
    await assertSucceeds(send("team1", "games/g1/dm/t1/n1", msg("team1", "Urfahr", { teamId: "t1" })));
    await assertFails(send("team2", "games/g1/dm/t1/n2", msg("team2", "Traun", { teamId: "t1" })));
    await assertSucceeds(send("admin1", "games/g1/dm/t2/n3", msg("admin1", "Peter")));
    await assertFails(send("schiri1", "games/g1/dm/t2/n4", msg("schiri1", "Anna")));
  });
});

describe("Schreiben: Push-Anmeldung", () => {
  const token = { token: "x".repeat(40), platform: "web", t: TS, prefs: { meldung: true } };
  it("eigenes Gerät", () => assertSucceeds(write("team1", "games/g1/push/team1", token)));
  it("nicht für andere", () => assertFails(write("team1", "games/g1/push/team2", token)));
  it("nur Mitglieder", () => assertFails(write("stranger", "games/g1/push/stranger", token)));
  it("keine fremden Felder", () => assertFails(write("team1", "games/g1/push/team1", { ...token, admin: true })));
});

it("Seed ist vollständig (Selbsttest)", async () => {
  let n = 0;
  await env.withSecurityRulesDisabled(async (ctx) => {
    n = (await ctx.database().ref("games/g1/members").get()).numChildren();
  });
  expect(n).toBe(6);
});
