// Spiel-Server gegen die Emulatoren (npm run test:emu): Super-Admin, Spiel anlegen, Beitritt aller Rollen,
// Passwörter nur gehasht, Rate-Limit, Ersatzgerät, Abmelden.
import { beforeAll, describe, expect, it } from "vitest";
import { getAuth } from "firebase-admin/auth";
import { admin as app, call, db, device, emailUser, reason, resetEmulators, val } from "./helpers.ts";

const G = "linz-test";
let superToken = "";
let adminDev: { uid: string; token: string };

beforeAll(async () => {
  await resetEmulators();
  // Function aufwärmen (erster Aufruf lädt den Code)
  await call(null, { action: "claimSuperAdmin" });
}, 60_000);

describe("Super-Admin", () => {
  it("ohne Anmeldung abgelehnt", async () => expect(reason(await call(null, { action: "claimSuperAdmin" }))).toBe("unauthenticated"));
  it("nicht freigegebene E-Mail bekommt keine Rechte", async () => {
    const u = await emailUser("fremd@test.at", true);
    expect((await call(await u.token(), { action: "claimSuperAdmin" })).result).toEqual({ superAdmin: false });
  });
  it("unbestätigte E-Mail auf der Liste bekommt keine Rechte", async () => {
    const u = await emailUser("Super@Test.at", false);
    expect((await call(await u.token(), { action: "claimSuperAdmin" })).result).toEqual({ superAdmin: false });
    await getAuth(app).deleteUser(u.uid);
  });
  it("bestätigte E-Mail auf der Liste wird Super-Admin (Custom Claim)", async () => {
    const u = await emailUser("super@test.at", true);
    expect((await call(await u.token(), { action: "claimSuperAdmin" })).result).toEqual({ superAdmin: true });
    expect((await getAuth(app).getUser(u.uid)).customClaims).toEqual({ superAdmin: true });
    superToken = await u.token(); // neues Token enthält den Claim
  });
});

describe("Spiel anlegen", () => {
  it("nur Super-Admin", async () => {
    const d = await device();
    expect(
      reason(await call(d.token, { action: "createGame", gameId: G, name: "Linz Test", template: "linz", adminPassword: "admin1234" })),
    ).toBe("forbidden");
  });
  it.each([
    ["ungültiger Code", { gameId: "Linz Test" }],
    ["Passwort zu kurz", { adminPassword: "kurz" }],
    ["Name zu kurz", { name: "x" }],
  ])("abgelehnt: %s", async (_, over) => {
    const r = await call(superToken, {
      action: "createGame",
      gameId: G,
      name: "Linz Test",
      template: "linz",
      adminPassword: "admin1234",
      ...over,
    });
    expect(reason(r)).toBe("invalid");
  });
  it("legt das Spiel mit Linz-Vorlage an, Passwort nur gehasht", async () => {
    const r = await call(superToken, { action: "createGame", gameId: G, name: "Linz Test", template: "linz", adminPassword: "admin1234" });
    expect(r.result).toEqual({ gameId: G });
    expect((await val(`games/${G}/field/base`)).length).toBeGreaterThan(200);
    expect(Object.keys(await val(`games/${G}/field/cuts`)).sort()).toEqual(["mitte-ost", "norden", "osten", "westen"]);
    expect(await val(`games/${G}/info/phase`)).toBe("vorbereitung");
    const sec = await val(`secrets/${G}`);
    expect(sec.adminPw).toMatch(/^scrypt\$/);
    expect(JSON.stringify(sec)).not.toContain("admin1234");
    expect(await val(`gameIndex/${G}/name`)).toBe("Linz Test");
  });
  it("gleicher Code nicht zweimal", async () => {
    const r = await call(superToken, { action: "createGame", gameId: G, name: "Nochmal", template: "leer", adminPassword: "admin1234" });
    expect(reason(r)).toBe("exists");
  });
});

describe("Beitritt", () => {
  it("unbekanntes Spiel", async () => {
    const d = await device();
    expect(reason(await call(d.token, { action: "join", gameId: "gibts-nicht", role: "team", name: "X", secret: "x" }))).toBe("notFound");
  });
  it("Spielleitung mit falschem und richtigem Passwort", async () => {
    adminDev = await device();
    expect(reason(await call(adminDev.token, { action: "join", gameId: G, role: "admin", name: "Peter", secret: "falsch!!" }))).toBe(
      "wrongSecret",
    );
    const r = await call(adminDev.token, { action: "join", gameId: G, role: "admin", name: "Peter", secret: "admin1234" });
    expect(r.result).toEqual({ status: "joined", role: "admin" });
    expect(await val(`games/${G}/members/${adminDev.uid}/role`)).toBe("admin");
    expect(await val(`userGames/${adminDev.uid}`)).toEqual({ gameId: G, role: "admin" });
  });
  it("Team ohne festgelegtes Team-Passwort", async () => {
    const d = await device();
    expect(reason(await call(d.token, { action: "join", gameId: G, role: "team", name: "Urfahr", secret: "x" }))).toBe("noTeamPassword");
  });
  it("nur die Spielleitung legt Passwörter fest", async () => {
    const d = await device();
    expect(reason(await call(d.token, { action: "setSecret", gameId: G, kind: "teamPw", value: "falke27" }))).toBe("forbidden");
    expect(reason(await call(adminDev.token, { action: "setSecret", gameId: G, kind: "teamPw", value: "abc" }))).toBe("invalid");
    expect((await call(adminDev.token, { action: "setSecret", gameId: G, kind: "teamPw", value: "falke27" })).result).toEqual({});
    expect((await call(adminDev.token, { action: "setSecret", gameId: G, kind: "schiriCode", value: "pfeife" })).result).toEqual({});
    expect(await val(`secrets/${G}/teamPw`)).toMatch(/^scrypt\$/);
  });
  it("Team tritt bei, Kürzel und Farbe werden vergeben", async () => {
    const d = await device();
    const r = await call(d.token, { action: "join", gameId: G, role: "team", name: "  Urfahr ", secret: "falke27" });
    expect(r.result).toMatchObject({ status: "joined", role: "team" });
    const teamId = r.result!.teamId as string;
    expect(await val(`games/${G}/teams/${teamId}`)).toMatchObject({ name: "Urfahr", short: "UR" });
    expect(await val(`games/${G}/members/${d.uid}`)).toMatchObject({ role: "team", teamId, name: "Urfahr" });
  });
  it("Ersatzgerät (F14): erst Rückfrage, dann gleiches Team", async () => {
    const d = await device();
    const first = await call(d.token, { action: "join", gameId: G, role: "team", name: "urfahr", secret: "falke27" });
    expect(first.result).toEqual({ status: "teamExists", teamName: "urfahr" });
    expect(await val(`games/${G}/members/${d.uid}`)).toBeNull();
    const second = await call(d.token, { action: "join", gameId: G, role: "team", name: "urfahr", secret: "falke27", secondDevice: true });
    expect(second.result).toMatchObject({ status: "joined" });
    expect(Object.keys(await val(`games/${G}/teams`))).toHaveLength(1);
  });
  it("Schiri mit Schiri-Code", async () => {
    const d = await device();
    expect(reason(await call(d.token, { action: "join", gameId: G, role: "schiri", name: "Anna", secret: "falsch" }))).toBe("wrongSecret");
    expect((await call(d.token, { action: "join", gameId: G, role: "schiri", name: "Anna", secret: "pfeife" })).result).toEqual({
      status: "joined",
      role: "schiri",
    });
  });
  it("Großbild mit Schlüssel aus dem Admin-Bereich", async () => {
    const key = (await call(adminDev.token, { action: "screenLink", gameId: G })).result!.key as string;
    expect(key.length).toBeGreaterThan(16);
    const d = await device();
    expect(reason(await call(d.token, { action: "join", gameId: G, role: "screen", name: "", secret: "x".repeat(key.length) }))).toBe(
      "wrongSecret",
    );
    expect((await call(d.token, { action: "join", gameId: G, role: "screen", name: "", secret: key })).result).toEqual({
      status: "joined",
      role: "screen",
    });
  });
  it("Zuschauer ohne Passwort (F6)", async () => {
    const d = await device();
    expect((await call(d.token, { action: "join", gameId: G, role: "viewer", name: "" })).result).toEqual({
      status: "joined",
      role: "viewer",
    });
  });
  it("Rate-Limit: nach 5 Fehlversuchen auch das richtige Passwort gesperrt", async () => {
    await db.ref("rate").remove(); // alle Test-Geräte teilen eine IP – nur dieses Gerät zählen
    const d = await device();
    for (let i = 0; i < 5; i++)
      expect(reason(await call(d.token, { action: "join", gameId: G, role: "team", name: "Traun", secret: `falsch${i}` }))).toBe(
        "wrongSecret",
      );
    expect(reason(await call(d.token, { action: "join", gameId: G, role: "team", name: "Traun", secret: "falke27" }))).toBe("tooMany");
    await db.ref("rate").remove(); // IP-Zähler für die übrigen Tests zurücksetzen
  });
  it("Rate-Limit pro IP: 30 Fehlversuche von verschiedenen Geräten, dann gesperrt", async () => {
    for (let i = 0; i < 30; i++) {
      const d = await device();
      expect(reason(await call(d.token, { action: "join", gameId: G, role: "team", name: "Traun", secret: `falsch${i}` }))).toBe(
        "wrongSecret",
      );
    }
    const d = await device();
    expect(reason(await call(d.token, { action: "join", gameId: G, role: "team", name: "Traun", secret: "falke27" }))).toBe("tooMany");
    await db.ref("rate").remove();
  });
  it("Protokoll enthält keine Passwörter", async () => {
    const all = JSON.stringify(await val(`games/${G}/audit`));
    expect(all).toContain("Team-Passwort festgelegt");
    expect(all).not.toContain("falke27");
    expect(all).not.toContain("pfeife");
  });
});

describe("Abmelden und Spielwechsel", () => {
  it("Abmelden entfernt die Mitgliedschaft", async () => {
    const d = await device();
    await call(d.token, { action: "join", gameId: G, role: "team", name: "Pichling", secret: "falke27" });
    expect((await call(d.token, { action: "leave", gameId: G })).result).toEqual({});
    expect(await val(`games/${G}/members/${d.uid}`)).toBeNull();
    expect(await val(`userGames/${d.uid}`)).toBeNull();
  });
  it("Beitritt zu einem anderen Spiel beendet die alte Mitgliedschaft", async () => {
    await call(superToken, { action: "createGame", gameId: "wels-test", name: "Wels Test", template: "leer", adminPassword: "admin1234" });
    const d = await device();
    await call(d.token, { action: "join", gameId: G, role: "schiri", name: "Martin", secret: "pfeife" });
    await call(d.token, { action: "join", gameId: "wels-test", role: "admin", name: "Martin", secret: "admin1234" });
    expect(await val(`games/${G}/members/${d.uid}`)).toBeNull();
    expect(await val(`games/wels-test/members/${d.uid}/role`)).toBe("admin");
  });
});
