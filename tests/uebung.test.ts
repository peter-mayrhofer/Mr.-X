// Übungsspiel (E-78) und Fehler der App im Protokoll (E-79).
import { beforeAll, describe, expect, it } from "vitest";
import { PROTOKOLL } from "../shared/src/index.ts";
import { call, eventually, join, reason, resetServer, superAdminToken, val, type Device } from "./helpers.ts";

const G = "uebung-test";
let admin: Device, team: Device;
const run = (d: Device, action: string, extra: Record<string, unknown> = {}) => call(d.token, { action, gameId: G, ...extra });
const ok = async (d: Device, action: string, extra: Record<string, unknown> = {}) => {
  const r = await run(d, action, extra);
  if (r.error) throw new Error(`${action}: ${r.error.message}`);
  return r.result!;
};
const bots = async () =>
  Object.entries((await val(`games/${G}/teams`)) as Record<string, { name: string; uebung?: boolean }>).filter(([, t]) => t.uebung);
const audit = async () =>
  Object.values((await val(`games/${G}/audit`)) as Record<string, { action: string; details: string; name: string }>);
// Hauptplatz Linz
const HP = { lat: 48.3059, lng: 14.2862 };

beforeAll(async () => {
  await resetServer();
  const sa = await superAdminToken();
  await call(sa, { action: "createGame", gameId: G, name: "Übung-Test", template: "linz", adminPassword: "admin1234" });
  admin = await join(G, "admin", "Peter", "admin1234");
  await ok(admin, "setSecret", { kind: "teamPw", value: "falke27" });
  team = await join(G, "team", "Urfahr", "falke27");
}, 60_000);

describe("Übungsspiel mit Computer-Teams", () => {
  it("nur im Probelauf und nur für die Spielleitung", async () => {
    expect(reason(await run(admin, "uebungTeams", { anzahl: 3 }))).toBe("invalid");
    await ok(admin, "setConfig", { config: { trial: true } });
    expect(reason(await run(team, "uebungTeams", { anzahl: 3 }))).toBe("forbidden");
    expect(reason(await run(admin, "uebungTeams", { anzahl: 9 }))).toBe("invalid");
  });

  it("legt Teams an, bis die Anzahl stimmt", async () => {
    expect(await ok(admin, "uebungTeams", { anzahl: 3 })).toEqual({ neu: 3 });
    expect((await bots()).map(([, t]) => t.name).sort()).toEqual(["Übung 1", "Übung 2", "Übung 3"]);
    expect(await ok(admin, "uebungTeams", { anzahl: 3 })).toEqual({ neu: 0 });
    expect(await ok(admin, "uebungTeams", { anzahl: 4 })).toEqual({ neu: 1 });
    expect((await audit()).some((e) => e.action === PROTOKOLL.uebungTeams)).toBe(true);
  });

  it("Standorte der Computer-Teams setzen – echte Teams lassen sich so nicht bewegen", async () => {
    const [[b1], [b2]] = await bots();
    await ok(admin, "uebungZug", { pos: { [b1!]: HP, [b2!]: { lat: HP.lat + 0.001, lng: HP.lng }, [team.teamId!]: HP } });
    await eventually(
      () => val(`games/${G}/positions/${b1}/lat`),
      (x) => x === HP.lat,
    );
    expect(await val(`games/${G}/positions/${b2}/lat`)).toBe(HP.lat + 0.001);
    expect(await val(`games/${G}/positions/${team.teamId}`)).toBeNull();
  });

  it("Computer-Teams können Mister X werden und das Spiel läuft normal", async () => {
    const [[b1]] = await bots();
    await ok(admin, "startGame", { mrx: b1 });
    expect(await val(`games/${G}/state/mrx`)).toBe(b1);
  });
});

describe("Fehler der App im Protokoll", () => {
  it("landet im Protokoll; gleiche Meldung nur einmal, höchstens 5 in 10 Minuten", async () => {
    await ok(team, "appFehler", { text: "TypeError: x is undefined @ map.js:1:2 – #/spiel – Browser, Android" });
    await ok(team, "appFehler", { text: "TypeError: x is undefined @ map.js:1:2 – #/spiel – Browser, Android" });
    for (let i = 0; i < 8; i++) await ok(team, "appFehler", { text: `Fehler ${i}` });
    const f = (await audit()).filter((e) => e.action === PROTOKOLL.appFehler);
    expect(f).toHaveLength(5);
    expect(f[0]).toMatchObject({ name: "Urfahr", details: "TypeError: x is undefined @ map.js:1:2 – #/spiel – Browser, Android" });
  });
  it("ohne Anmeldung nicht", async () =>
    expect(reason(await call(null, { action: "appFehler", gameId: G, text: "x" }))).toBe("unauthenticated"));
});
