// Druckblätter: Die App prüft ein eingetipptes Passwort, bevor es aufs Blatt kommt. Gespeichert bleibt nur die
// Prüfsumme – der Server gibt nie ein Passwort heraus, nur „stimmt“ oder „stimmt nicht“. Nur die Spielleitung,
// begrenzte Versuche.
import { beforeAll, describe, expect, it } from "vitest";
import { call, reason, resetServer, superAdminToken, join, val, type Device } from "./helpers.ts";

const G = "druck-test";
let admin: Device, schiri: Device;
const run = (d: Device, action: string, extra: Record<string, unknown> = {}) => call(d.token, { action, gameId: G, ...extra });
const check = async (d: Device, kind: string, value: string) =>
  ((await run(d, "checkSecret", { kind, value })).result as { ok: boolean }).ok;

beforeAll(async () => {
  await resetServer();
  const sa = await superAdminToken();
  await call(sa, { action: "createGame", gameId: G, name: "Druck-Test", template: "linz", adminPassword: "admin1234" });
  admin = await join(G, "admin", "Peter", "admin1234");
  await run(admin, "setSecret", { kind: "teamPw", value: "falke27" });
  await run(admin, "setSecret", { kind: "schiriCode", value: "pfeife" });
  schiri = await join(G, "schiri", "Anna", "pfeife");
}, 60_000);

describe("Passwort für die Druckblätter prüfen", () => {
  it("richtig/falsch für alle drei Zugänge – ohne das Passwort je herauszugeben", async () => {
    expect(await check(admin, "teamPw", "falke27")).toBe(true);
    expect(await check(admin, "teamPw", "falke28")).toBe(false);
    expect(await check(admin, "schiriCode", "pfeife")).toBe(true);
    expect(await check(admin, "adminPw", "admin1234")).toBe(true);
    expect(await check(admin, "adminPw", "falke27")).toBe(false);
    // nirgends im Klartext: im Spielraum steht nur die Prüfsumme
    expect(JSON.stringify(await val(`secrets/${G}`))).not.toContain("falke27");
  });
  it("nur die Spielleitung; unbekannte Art abgelehnt", async () => {
    expect(reason(await run(schiri, "checkSecret", { kind: "teamPw", value: "falke27" }))).toBe("forbidden");
    expect(reason(await run(admin, "checkSecret", { kind: "geheim", value: "x" }))).toBe("invalid");
  });
  it("kein Team-Passwort festgelegt → stimmt nie", async () => {
    await run(admin, "setSecret", { kind: "teamPw", value: null });
    expect(await check(admin, "teamPw", "")).toBe(false);
    expect(await check(admin, "teamPw", "falke27")).toBe(false);
  });
  it("Raten bremsen: höchstens 10 Versuche pro Minute", async () => {
    // die Tests oben haben schon einige Versuche gebraucht – bis zur Grenze auffüllen
    let r = await run(admin, "checkSecret", { kind: "schiriCode", value: "x" });
    while (!r.error) r = await run(admin, "checkSecret", { kind: "schiriCode", value: "x" });
    expect(reason(r)).toBe("tooMany");
  });
});
