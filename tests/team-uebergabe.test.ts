// Übergabe durch Teams: Die Spielleitung gibt einzelne Teams frei; ist so ein Team Mister X, bestätigt es seinen Fang
// selbst („Wir wurden gefangen“ → Fänger wählen). Nicht freigegeben, nicht Mister X, Strafübergabe, Rückgängig → nein.
import { beforeAll, describe, expect, it } from "vitest";
import { call, join, outbox, reason, resetServer, set, superAdminToken, val, type Device } from "./helpers.ts";

const G = "team-uebergabe";
let admin: Device, a: Device, b: Device, c: Device;
const run = (d: Device, action: string, extra: Record<string, unknown> = {}) => call(d.token, { action, gameId: G, ...extra });
const caught = (d: Device, to: string, expectedMrx: string, requestId: string, type = "fang") =>
  run(d, "handover", { to, type, expectedMrx, requestId });
/** Standort eines Teams setzen (Linz, Hauptplatz + Versatz nach Norden in Metern) */
const at = (d: Device, nordM: number) =>
  set(`games/${G}/positions/${d.teamId}`, { lat: 48.3061 + nordM / 111_320, lng: 14.2862, acc: 10, t: Date.now() });

beforeAll(async () => {
  await resetServer();
  const sa = await superAdminToken();
  await call(sa, { action: "createGame", gameId: G, name: "Team-Übergabe", template: "linz", adminPassword: "admin1234" });
  admin = await join(G, "admin", "Peter", "admin1234");
  await run(admin, "setSecret", { kind: "teamPw", value: "falke27" });
  a = await join(G, "team", "Urfahr", "falke27");
  b = await join(G, "team", "Traun", "falke27");
  c = await join(G, "team", "Leonding", "falke27");
  await run(admin, "startGame", { mrx: a.teamId });
}, 60_000);

describe("Übergabe durch Teams", () => {
  it("ohne Freigabe: kein Team darf übergeben", async () => {
    expect(reason(await caught(a, b.teamId!, a.teamId!, "team-uebergabe-01"))).toBe("forbidden");
  });
  it("nur die Spielleitung gibt frei, pro Team", async () => {
    expect(reason(await run(a, "setTeamHandover", { teamIds: [a.teamId], on: true }))).toBe("forbidden");
    expect(reason(await run(admin, "setTeamHandover", { teamIds: ["gibts-nicht"], on: true }))).toBe("invalid");
    await run(admin, "setTeamHandover", { teamIds: [a.teamId, b.teamId], on: true });
    expect(await val(`games/${G}/teams/${a.teamId}/handover`)).toBe(true);
    expect(await val(`games/${G}/teams/${c.teamId}/handover`)).toBeNull();
  });
  it("freigegeben, aber nicht Mister X → nein; Strafübergabe → nein", async () => {
    expect(reason(await caught(b, b.teamId!, a.teamId!, "team-uebergabe-02"))).toBe("conflict");
    expect(reason(await caught(a, b.teamId!, a.teamId!, "team-uebergabe-03", "strafe"))).toBe("forbidden");
  });
  it("Mister X bestätigt den eigenen Fang: Fahne geht an den Fänger, Wiederholung zählt nicht doppelt", async () => {
    await at(a, 0);
    await at(b, 20); // 20 m – passt
    const r = await caught(a, b.teamId!, a.teamId!, "team-uebergabe-04");
    expect(r.result).toMatchObject({ handoverId: "team-uebergabe-04" });
    expect(await val(`games/${G}/state/mrx`)).toBe(b.teamId);
    expect(await val(`games/${G}/handovers/team-uebergabe-04`)).toMatchObject({
      from: a.teamId,
      to: b.teamId,
      byName: "Urfahr (Mister X)",
    });
    expect((await val(`games/${G}/handovers/team-uebergabe-04`)) as { pruefen?: unknown }).not.toHaveProperty("pruefen");
    expect((await caught(a, b.teamId!, a.teamId!, "team-uebergabe-04")).result).toMatchObject({ handoverId: "team-uebergabe-04" });
    // jetzt ist Urfahr nicht mehr Mister X
    expect(reason(await caught(a, c.teamId!, a.teamId!, "team-uebergabe-05"))).toBe("conflict");
  });
  it("Rückgängig bleibt bei Schiri und Spielleitung", async () => {
    expect(reason(await run(a, "undo", { handoverId: "team-uebergabe-04" }))).toBe("forbidden");
  });
  it("Standorte passen nicht (1 km auseinander): Übergabe gilt, aber Spielleitung und Schiris sollen prüfen", async () => {
    await at(b, 0);
    await at(c, 1000);
    const before = (await outbox(G)).length;
    expect((await caught(b, c.teamId!, b.teamId!, "team-uebergabe-07")).result).toMatchObject({ handoverId: "team-uebergabe-07" });
    expect(await val(`games/${G}/state/mrx`)).toBe(c.teamId);
    const h = (await val(`games/${G}/handovers/team-uebergabe-07`)) as { pruefen?: { distM?: number } };
    expect(h.pruefen?.distM).toBeGreaterThan(950);
    const note = (await outbox(G)).slice(before).find((n) => n.title === "Übergabe prüfen");
    expect(note?.body).toContain("m auseinander");
    expect(note?.to).toContain(admin.uid);
    expect(note?.to).not.toContain(b.uid);
  });
  it("wieder sperren", async () => {
    await run(admin, "setTeamHandover", { teamIds: [b.teamId], on: false });
    expect(await val(`games/${G}/teams/${b.teamId}/handover`)).toBeNull();
    expect(reason(await caught(b, c.teamId!, b.teamId!, "team-uebergabe-06"))).toBe("forbidden");
  });
});
