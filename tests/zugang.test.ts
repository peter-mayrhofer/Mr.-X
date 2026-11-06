// Spiel-Server (lokale Cloudflare-Laufzeit): Organisator-Zugang, Spiel anlegen, Beitritt aller Rollen, Passwörter nur
// gehasht, Rate-Limit, Ersatzgerät, Abmelden, Sitzungen widerrufen.
import { beforeAll, describe, expect, it } from "vitest";
import { call, join, reason, resetServer, set, SUPER_PW, superAdminToken, val, type Device } from "./helpers.ts";
import { TEST_SECRETS } from "./setup.ts";

const G = "linz-test";
let superToken = "";
let adminDev: Device;

beforeAll(async () => {
  await resetServer();
});

describe("Organisator (Super-Admin)", () => {
  it("vor der Einrichtung: Anmeldung nicht möglich", async () =>
    expect(reason(await call(null, { action: "superLogin", password: SUPER_PW }))).toBe("notFound"));
  it("Einrichtung nur mit dem Setup-Geheimnis", async () => {
    expect(reason(await call(null, { action: "superSetup", setupSecret: "falsch", password: SUPER_PW }))).toBe("wrongSecret");
    expect(reason(await call(null, { action: "superSetup", setupSecret: TEST_SECRETS.SETUP_SECRET, password: "kurz" }))).toBe("invalid");
    superToken = await superAdminToken();
    expect(superToken).toMatch(/^[\w-]+\.[\w-]+$/);
  });
  it("Anmeldung mit Passwort; falsches Passwort abgelehnt", async () => {
    expect(reason(await call(null, { action: "superLogin", password: "falsches-passwort" }))).toBe("wrongSecret");
    const r = await call(null, { action: "superLogin", password: SUPER_PW });
    expect(typeof r.result?.token).toBe("string");
  });
  it("Spieleliste nur für den Organisator", async () => {
    expect(reason(await call(null, { action: "listGames" }))).toBe("forbidden");
    expect((await call(superToken, { action: "listGames" })).result).toEqual({ games: [] });
  });
  it("Rate-Limit: 5 falsche Passwörter, dann auch das richtige gesperrt", async () => {
    const ip = "198.51.100.7";
    for (let i = 0; i < 5; i++)
      expect(reason(await call(null, { action: "superLogin", password: `falsch-${i}-xxxx` }, ip))).toBe("wrongSecret");
    expect(reason(await call(null, { action: "superLogin", password: SUPER_PW }, ip))).toBe("tooMany");
    expect(reason(await call(null, { action: "superLogin", password: SUPER_PW }, "198.51.100.8"))).toBeUndefined();
  });
  it("neues Passwort (Setup-Geheimnis) macht alte Organisator-Sitzungen ungültig", async () => {
    const old = superToken;
    superToken = await superAdminToken();
    expect(reason(await call(old, { action: "listGames" }))).toBe("session");
    expect((await call(superToken, { action: "listGames" })).result).toBeDefined();
  });
  it("gefälschtes Token wird nicht angenommen", async () => {
    const [body] = superToken.split(".");
    expect(reason(await call(`${body}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`, { action: "listGames" }))).toBe("session");
  });
});

describe("Spiel anlegen", () => {
  it("nur Super-Admin", async () => {
    expect(
      reason(await call(null, { action: "createGame", gameId: G, name: "Linz Test", template: "linz", adminPassword: "admin1234" })),
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
    expect(sec.adminPw).toMatch(/^pbkdf2\$100000\$/);
    expect(JSON.stringify(sec)).not.toContain("admin1234");
    expect((await call(superToken, { action: "listGames" })).result!.games).toMatchObject([
      { id: G, name: "Linz Test", phase: "vorbereitung" },
    ]);
  });
  it("gleicher Code nicht zweimal", async () => {
    const r = await call(superToken, { action: "createGame", gameId: G, name: "Nochmal", template: "leer", adminPassword: "admin1234" });
    expect(reason(r)).toBe("exists");
  });
  it("öffentliche Spiel-Info für Startseite und QR-Link", async () => {
    expect((await call(null, { action: "gameInfo", gameId: G })).result).toMatchObject({ name: "Linz Test", phase: "vorbereitung" });
    expect(reason(await call(null, { action: "gameInfo", gameId: "gibts-nicht" }))).toBe("notFound");
  });
});

describe("Beitritt", () => {
  it("unbekanntes Spiel", async () => {
    expect(reason(await call(null, { action: "join", gameId: "gibts-nicht", role: "team", name: "X", secret: "x" }))).toBe("notFound");
  });
  it("Spielleitung mit falschem und richtigem Passwort", async () => {
    expect(reason(await call(null, { action: "join", gameId: G, role: "admin", name: "Peter", secret: "falsch!!" }))).toBe("wrongSecret");
    const r = await call(null, { action: "join", gameId: G, role: "admin", name: "Peter", secret: "admin1234" });
    expect(r.result).toMatchObject({ status: "joined", role: "admin" });
    adminDev = { uid: r.result!.uid as string, token: r.result!.token as string };
    expect(await val(`games/${G}/members/${adminDev.uid}/role`)).toBe("admin");
  });
  it("Organisator öffnet jedes Spiel ohne Admin-Passwort", async () => {
    const r = await call(superToken, { action: "join", gameId: G, role: "admin", name: "Organisator" });
    expect(r.result).toMatchObject({ status: "joined", role: "admin" });
    await call(r.result!.token as string, { action: "leave", gameId: G });
  });
  it("Team ohne festgelegtes Team-Passwort", async () => {
    expect(reason(await call(null, { action: "join", gameId: G, role: "team", name: "Urfahr", secret: "x" }))).toBe("noTeamPassword");
  });
  it("nur die Spielleitung legt Passwörter fest", async () => {
    expect(reason(await call(null, { action: "setSecret", gameId: G, kind: "teamPw", value: "falke27" }))).toBe("unauthenticated");
    expect(reason(await call(adminDev.token, { action: "setSecret", gameId: G, kind: "teamPw", value: "abc" }))).toBe("invalid");
    expect((await call(adminDev.token, { action: "setSecret", gameId: G, kind: "teamPw", value: "falke27" })).result).toEqual({});
    expect((await call(adminDev.token, { action: "setSecret", gameId: G, kind: "schiriCode", value: "pfeife" })).result).toEqual({});
    expect(await val(`secrets/${G}/teamPw`)).toMatch(/^pbkdf2\$/);
  });
  it("Team tritt bei, Kürzel und Farbe werden vergeben; Teams dürfen keine Passwörter setzen", async () => {
    const r = await call(null, { action: "join", gameId: G, role: "team", name: "  Urfahr ", secret: "falke27" });
    expect(r.result).toMatchObject({ status: "joined", role: "team" });
    const teamId = r.result!.teamId as string;
    expect(await val(`games/${G}/teams/${teamId}`)).toMatchObject({ name: "Urfahr", short: "UR" });
    expect(await val(`games/${G}/members/${r.result!.uid as string}`)).toMatchObject({ role: "team", teamId, name: "Urfahr" });
    expect(reason(await call(r.result!.token as string, { action: "setSecret", gameId: G, kind: "teamPw", value: "geknackt" }))).toBe(
      "forbidden",
    );
  });
  it("Ersatzgerät (F14): erst Rückfrage, dann gleiches Team", async () => {
    const first = await call(null, { action: "join", gameId: G, role: "team", name: "urfahr", secret: "falke27" });
    expect(first.result).toEqual({ status: "teamExists", teamName: "Urfahr" });
    const second = await call(null, { action: "join", gameId: G, role: "team", name: "urfahr", secret: "falke27", secondDevice: true });
    expect(second.result).toMatchObject({ status: "joined" });
    expect(Object.keys(await val(`games/${G}/teams`))).toHaveLength(1);
  });
  it("Schiri mit Schiri-Code", async () => {
    expect(reason(await call(null, { action: "join", gameId: G, role: "schiri", name: "Anna", secret: "falsch" }))).toBe("wrongSecret");
    expect((await call(null, { action: "join", gameId: G, role: "schiri", name: "Anna", secret: "pfeife" })).result).toMatchObject({
      status: "joined",
      role: "schiri",
    });
  });
  it("Großbild mit Schlüssel aus dem Admin-Bereich", async () => {
    const key = (await call(adminDev.token, { action: "screenLink", gameId: G })).result!.key as string;
    expect(key.length).toBeGreaterThan(16);
    expect(reason(await call(null, { action: "join", gameId: G, role: "screen", name: "", secret: "x".repeat(key.length) }))).toBe(
      "wrongSecret",
    );
    expect((await call(null, { action: "join", gameId: G, role: "screen", name: "", secret: key })).result).toMatchObject({
      status: "joined",
      role: "screen",
    });
  });
  it("Zuschauer ohne Passwort (F6)", async () => {
    expect((await call(null, { action: "join", gameId: G, role: "viewer", name: "" })).result).toMatchObject({
      status: "joined",
      role: "viewer",
    });
  });
  it("Rate-Limit pro IP: 20 Fehlversuche, dann auch das richtige Passwort gesperrt – andere IPs nicht", async () => {
    const ip = "203.0.113.5";
    for (let i = 0; i < 20; i++)
      expect(reason(await call(null, { action: "join", gameId: G, role: "team", name: "Traun", secret: `falsch${i}` }, ip))).toBe(
        "wrongSecret",
      );
    expect(reason(await call(null, { action: "join", gameId: G, role: "team", name: "Traun", secret: "falke27" }, ip))).toBe("tooMany");
    expect(
      reason(await call(null, { action: "join", gameId: G, role: "team", name: "Traun", secret: "falke27" }, "203.0.113.6")),
    ).toBeUndefined();
    expect(JSON.stringify(await val(`games/${G}/rate`))).not.toContain("203.0.113"); // IP nur gehasht
    await set(`games/${G}/rate`, {});
  });
  it("Prüfsummen der IP-Adressen werden nach Ablauf der Sperre (10 Min) gelöscht", async () => {
    await set(`games/${G}/rate/ip_alt`, { n: 3, since: Date.now() - 11 * 60_000 });
    await set(`games/${G}/rate/ip_neu`, { n: 3, since: Date.now() - 60_000 });
    await call(null, { action: "join", gameId: G, role: "viewer", name: "" });
    expect(Object.keys(await val(`games/${G}/rate`))).toEqual(["ip_neu"]);
    await set(`games/${G}/rate`, {});
  });
  it("Protokoll enthält keine Passwörter", async () => {
    const all = JSON.stringify(await val(`games/${G}/audit`));
    expect(all).toContain("Team-Passwort festgelegt");
    expect(all).not.toContain("falke27");
    expect(all).not.toContain("pfeife");
  });
});

describe("Abmelden, Spielwechsel, Sitzungen", () => {
  it("Abmelden entfernt die Mitgliedschaft; danach ist das Token wertlos", async () => {
    const d = await join(G, "team", "Pichling", "falke27");
    expect((await call(d.token, { action: "leave", gameId: G })).result).toEqual({});
    expect(await val(`games/${G}/members/${d.uid}`)).toBeNull();
    expect(reason(await call(d.token, { action: "chat", gameId: G, text: "noch da?" }))).toBe("session");
  });
  it("Beitritt zu einem anderen Spiel beendet die alte Mitgliedschaft", async () => {
    await call(superToken, { action: "createGame", gameId: "wels-test", name: "Wels Test", template: "leer", adminPassword: "admin1234" });
    const d = await join(G, "schiri", "Martin", "pfeife");
    const r = await call(d.token, { action: "join", gameId: "wels-test", role: "admin", name: "Martin", secret: "admin1234" });
    expect(await val(`games/${G}/members/${d.uid}`)).toBeNull();
    expect(await val(`games/wels-test/members/${r.result!.uid as string}/role`)).toBe("admin");
  });
  it("Token eines Spiels gilt nicht in einem anderen", async () => {
    const d = await join(G, "schiri", "Eva", "pfeife");
    expect(reason(await call(d.token, { action: "setLock", gameId: "wels-test", teamId: "x", min: 5 }))).toBe("unauthenticated");
  });
  it("neues Admin-Passwort meldet die anderen Admin-Geräte ab", async () => {
    const other = await join(G, "admin", "Zweiter", "admin1234");
    expect((await call(adminDev.token, { action: "setSecret", gameId: G, kind: "adminPw", value: "neu-admin-99" })).result).toEqual({});
    expect(reason(await call(other.token, { action: "screenLink", gameId: G }))).toBe("session");
    expect((await call(adminDev.token, { action: "screenLink", gameId: G })).result).toBeDefined();
  });
});
