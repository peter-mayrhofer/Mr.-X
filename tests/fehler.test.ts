// Fehlersuche November 2026 (E-69): Live-Standorte im 2-s-Takt, Pause hält angekündigte Sperren an, Kennungen wie
// „constructor“ werden abgelehnt, Übergabe-Kennung nicht doppelt, Rückgängig nicht auf ein entferntes Team.
import { beforeAll, describe, expect, it } from "vitest";
import { call, connect, join, reason, resetServer, set, sleep, superAdminToken, val, type Device } from "./helpers.ts";

const G = "fehler-test";
const MIN = 60_000;
let admin: Device, schiri: Device, a: Device, b: Device, c: Device;

const run = (d: Device, action: string, extra: Record<string, unknown> = {}) => call(d.token, { action, gameId: G, ...extra });
const ok = async (d: Device, action: string, extra: Record<string, unknown> = {}) => {
  const r = await run(d, action, extra);
  if (r.error) throw new Error(`${action}: ${r.error.message}`);
  return r.result!;
};
const state = () => val(`games/${G}/state`);
// Hauptplatz Linz
const at = (dLat: number) => ({ lat: 48.3059 + dLat, lng: 14.2862, acc: 8, t: Date.now() });

beforeAll(async () => {
  await resetServer();
  const sa = await superAdminToken();
  await call(sa, { action: "createGame", gameId: G, name: "Fehler-Test", template: "linz", adminPassword: "admin1234" });
  admin = await join(G, "admin", "Peter", "admin1234");
  await ok(admin, "setSecret", { kind: "teamPw", value: "falke27" });
  await ok(admin, "setSecret", { kind: "schiriCode", value: "pfeife" });
  a = await join(G, "team", "Urfahr", "falke27");
  b = await join(G, "team", "Traun", "falke27");
  c = await join(G, "team", "Leonding", "falke27");
  schiri = await join(G, "schiri", "Anna", "pfeife");
  await ok(admin, "startGame", { mrx: a.teamId });
}, 60_000);

describe("Fehler aus der Durchsicht", () => {
  it("Live-Standorte kommen bei der Spielleitung im 2-s-Takt an, nicht erst nach 30 s", async () => {
    const lead = connect(admin.token);
    await lead.until(() => true);
    const phone = connect(b.token);
    await phone.until(() => true);
    phone.sendPos(at(0.001));
    await lead.until((v) => (v.positions?.[b.teamId!]?.lat ?? 0) > 48.3065, 6000);
    // weitere Standorte: früher wartete ab dem zweiten der 30-s-Speichertakt den 2-s-Takt aus
    for (const d of [0.002, 0.003, 0.004]) {
      await sleep(2500);
      phone.sendPos(at(d));
      await lead.until((v) => (v.positions?.[b.teamId!]?.lat ?? 0) > 48.3059 + d - 0.0005, 6000);
    }
    phone.close();
    lead.close();
  });

  it("Pause hält eine angekündigte Sperre und den Bezug fürs Meldeintervall an", async () => {
    await ok(admin, "setCut", { cutId: "norden", locked: true, inMin: 5 });
    const vorher = (await state()).warnCuts.norden as number;
    // eine Meldung vor der Pause (gleich nach dem Start gibt es noch keine)
    const letzte = Date.now() - MIN;
    await set(`games/${G}/state/lastReportAt`, letzte);
    await ok(admin, "pause");
    await sleep(1500);
    await ok(admin, "resume");
    const s = await state();
    expect(s.warnCuts.norden - vorher).toBeGreaterThanOrEqual(1400);
    expect(s.warnCuts.norden - vorher).toBeLessThan(MIN);
    expect(s.lastReportAt - letzte).toBeGreaterThanOrEqual(1400);
    await ok(admin, "setCut", { cutId: "norden", locked: false });
  });

  it("Kennungen aus Object.prototype werden abgelehnt (Übergabe, Notfall, Nachricht, Einstellungen, Aktion)", async () => {
    const mrx = (await state()).mrx as string;
    expect(reason(await run(schiri, "handover", { to: "constructor", type: "fang", expectedMrx: mrx, requestId: "proto-0001" }))).toBe(
      "invalid",
    );
    expect(reason(await run(schiri, "sosDone", { id: "constructor" }))).toBe("invalid");
    expect(reason(await run(admin, "chat", { text: "Hallo", dm: "__proto__" }))).toBe("invalid");
    expect(reason(await run(admin, "setConfig", { config: { toString: 5 } }))).toBe("invalid");
    expect(reason(await run(admin, "toString"))).toBe("invalid");
    expect((await state()).mrx).toBe(mrx);
    // ein Chat-Text, der zufällig so heißt, geht weiter
    await ok(admin, "chat", { text: "constructor" });
  });

  it("eine ältere Übergabe-Kennung wird nicht wiederverwendet", async () => {
    await ok(schiri, "handover", { to: b.teamId, type: "fang", expectedMrx: a.teamId, requestId: "fang-0001" });
    await ok(schiri, "handover", { to: c.teamId, type: "fang", expectedMrx: b.teamId, requestId: "fang-0002" });
    expect(reason(await run(schiri, "handover", { to: a.teamId, type: "fang", expectedMrx: c.teamId, requestId: "fang-0001" }))).toBe(
      "conflict",
    );
    expect(await val(`games/${G}/handovers/fang-0001/to`)).toBe(b.teamId);
  });

  it("Rückgängig geht nicht, wenn das vorige Team inzwischen entfernt wurde", async () => {
    // b → c war die letzte Übergabe; Team b wird entfernt
    await ok(admin, "removeTeam", { teamId: b.teamId });
    expect(reason(await run(schiri, "undo", { handoverId: "fang-0002" }))).toBe("conflict");
    expect((await state()).mrx).toBe(c.teamId);
  });
});
