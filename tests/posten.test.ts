// Bonus-Posten (E-75): Code mit Unterschrift, nur während des Spiels, nur vor Ort, einmal pro Team, nicht für Mister X.
import { beforeAll, describe, expect, it } from "vitest";
import { PROTOKOLL } from "../shared/src/index.ts";
import { call, connect, eventually, join, reason, resetServer, set, superAdminToken, val, type Device } from "./helpers.ts";

const G = "posten-test";
let admin: Device, urfahr: Device, traun: Device, leonding: Device;
let codes: Record<string, string>;

const run = (d: Device, action: string, extra: Record<string, unknown> = {}) => call(d.token, { action, gameId: G, ...extra });
const ok = async (d: Device, action: string, extra: Record<string, unknown> = {}) => {
  const r = await run(d, action, extra);
  if (r.error) throw new Error(`${action}: ${r.error.message}`);
  return r.result!;
};
// Hauptplatz Linz
const HP = { lat: 48.3059, lng: 14.2862 };
const at = (dLat: number) => ({ lat: HP.lat + dLat, lng: HP.lng, acc: 8, t: Date.now() });
/** Standort schicken und warten, bis der Spielraum ihn hat */
async function steht(d: Device, dLat: number) {
  const h = connect(d.token);
  await h.until(() => true);
  const p = at(dLat);
  h.sendPos(p);
  await eventually(
    () => val(`games/${G}/positions/${d.teamId}/lat`),
    (lat) => lat === p.lat,
  );
  h.close();
}
const einloesen = async (d: Device, code = codes.brunnen1) =>
  (await ok(d, "posten", { code })) as { status: string; m?: number; richtung?: number };

beforeAll(async () => {
  await resetServer();
  const sa = await superAdminToken();
  await call(sa, { action: "createGame", gameId: G, name: "Posten-Test", template: "linz", adminPassword: "admin1234" });
  admin = await join(G, "admin", "Peter", "admin1234");
  await ok(admin, "setSecret", { kind: "teamPw", value: "falke27" });
  urfahr = await join(G, "team", "Urfahr", "falke27");
  traun = await join(G, "team", "Traun", "falke27");
  leonding = await join(G, "team", "Leonding", "falke27");
}, 60_000);

describe("Bonus-Posten", () => {
  it("Spielfeld: Posten werden geprüft und gespeichert", async () => {
    const field = await val(`games/${G}/field`);
    const brunnen = { id: "brunnen1", name: "Brunnen", ...HP };
    expect(reason(await run(admin, "setField", { field: { ...field, posten: [{ ...brunnen, id: "X!" }] } }))).toBe("invalid");
    expect(reason(await run(admin, "setField", { field: { ...field, posten: [brunnen, brunnen] } }))).toBe("invalid");
    await ok(admin, "setField", {
      field: { ...field, posten: [brunnen, { id: "turm22", name: "Turm", lat: HP.lat + 0.003, lng: HP.lng }] },
    });
    expect((await val(`games/${G}/field/posten`)).length).toBe(2);
  });

  it("Codes zum Drucken nur für die Spielleitung", async () => {
    expect(reason(await run(traun, "postenCodes"))).toBe("forbidden");
    codes = ((await ok(admin, "postenCodes")) as { codes: Record<string, string> }).codes;
    expect(codes.brunnen1).toMatch(/^brunnen1\.[\w-]{12}$/);
    expect(codes.turm22).not.toBe(codes.brunnen1);
  });

  it("nur Teams lösen ein", async () => {
    expect(reason(await run(admin, "posten", { code: codes.brunnen1 }))).toBe("forbidden");
  });

  it("vor dem Start nicht einlösbar, falsche Unterschrift nie", async () => {
    expect(reason(await run(traun, "posten", { code: codes.brunnen1 }))).toBe("wrongPhase");
    expect(reason(await run(traun, "posten", { code: "brunnen1.AAAAAAAAAAAA" }))).toBe("invalid");
    expect(reason(await run(traun, "posten", { code: "brunnen1" }))).toBe("invalid");
  });

  it("im Spiel: ohne Standort, zu weit weg, Mister X selbst", async () => {
    await ok(admin, "startGame", { mrx: urfahr.teamId });
    expect((await einloesen(leonding)).status).toBe("keinStandort");
    await steht(leonding, 0.003); // gut 300 m nördlich vom Brunnen
    const weit = await einloesen(leonding);
    expect(weit.status).toBe("weit");
    expect(weit.m).toBeGreaterThan(300);
    expect((await einloesen(urfahr)).status).toBe("mrx");
  });

  it("ohne Standort von Mister X bleibt der Posten gültig", async () => {
    await steht(traun, 0.0002);
    expect((await einloesen(traun)).status).toBe("keinMrx");
  });

  it("am Posten: Richtung und ungefähre Entfernung zu Mister X, einmal pro Team", async () => {
    await steht(urfahr, 0.009); // Mister X gut 1 km nördlich
    expect(await einloesen(traun)).toEqual({ status: "hinweis", name: "Brunnen", m: 1000, richtung: 0 });
    expect((await einloesen(traun)).status).toBe("schon");
    // anderer Posten: nur dort einlösbar
    expect((await einloesen(traun, codes.turm22)).status).toBe("weit");
  });

  it("Protokoll nennt Team und Posten; Spielende löscht die eingelösten Posten", async () => {
    const audit = Object.values((await val(`games/${G}/audit`)) as Record<string, { action: string; details: string; name: string }>);
    expect(audit.some((e) => e.action === PROTOKOLL.postenEingeloest && e.details === "Brunnen" && e.name === "Traun")).toBe(true);
    expect(await val(`secrets/${G}/posten/${traun.teamId}`)).toEqual(["brunnen1"]);
    await set(`secrets/${G}/endAt`, Date.now() - 1000);
    await eventually(
      () => val(`games/${G}/state/phase`),
      (x) => x === "beendet",
    );
    expect(await val(`secrets/${G}/posten`)).toBeNull();
  });
});
