// Tracker-Schnittstelle (Meilenstein 11): Geräte anlegen und zuordnen (nur Spielleitung), Empfang im OsmAnd-Format
// (Parameter wie Traccar Client/GPS-Tracker) und im JSON-Format des neuen Traccar Client, Vorrang der Quellen
// (Tracker der Fahne > Mister-X-Handy, Team-Tracker > Team-Handy), Rate-Limit, Datenschutz bei Spielende.
import { beforeAll, describe, expect, it } from "vitest";
import { call, connect, eventually, join, reason, resetServer, SERVER, set, sleep, superAdminToken, val, type Device } from "./helpers.ts";

const G = "linz-tracker";
let admin: Device;
const team: Record<string, Device> = {};
const dev: Record<string, { device: string; key: string }> = {};
const ok = async (d: Device, action: string, extra: Record<string, unknown> = {}) => {
  const r = await call(d.token, { action, gameId: G, ...extra });
  if (r.error) throw new Error(`${action}: ${r.error.message}`);
  return r.result!;
};
const LAT = 48.3059;
const LNG = 14.2862;

/** wie Traccar Client (OsmAnd): Parameter in der Adresse, Zeit in Sekunden */
const osmand = (key: string, dLat: number, extra: Record<string, string> = {}) =>
  fetch(
    `${SERVER}/tracker?${new URLSearchParams({
      id: `${G}.${key}`,
      lat: String(LAT + dLat),
      lon: String(LNG),
      timestamp: String(Math.floor(Date.now() / 1000)),
      accuracy: "6",
      batt: "77",
      ...extra,
    })}`,
    { method: "POST" },
  );
/** wie der neue Traccar Client: JSON */
const traccarJson = (key: string, dLat: number) =>
  fetch(`${SERVER}/tracker`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      device_id: `${G}.${key}`,
      location: {
        timestamp: new Date().toISOString(),
        coords: { latitude: LAT + dLat, longitude: LNG, accuracy: 8, heading: 90 },
        battery: { level: 0.42 },
      },
    }),
  });

beforeAll(async () => {
  await resetServer();
  const sa = await superAdminToken();
  await call(sa, { action: "createGame", gameId: G, name: "Tracker-Test", template: "linz", adminPassword: "admin1234" });
  admin = await join(G, "admin", "Peter", "admin1234");
  await ok(admin, "setSecret", { kind: "teamPw", value: "falke27" });
  for (const name of ["Urfahr", "Traun"]) team[name] = await join(G, "team", name, "falke27");
}, 60_000);

describe("Geräte verwalten", () => {
  it("nur die Spielleitung legt Tracker an", async () => {
    expect(reason(await call(team.Urfahr!.token, { action: "addDevice", gameId: G, name: "Fahne" }))).toBe("forbidden");
    dev.fahne = (await ok(admin, "addDevice", { name: "Tracker Fahne" })) as { device: string; key: string };
    dev.traun = (await ok(admin, "addDevice", { name: "Altes Handy Traun" })) as { device: string; key: string };
    expect(dev.fahne.key.length).toBeGreaterThanOrEqual(16);
    expect(await ok(admin, "deviceKey", { device: dev.fahne.device })).toEqual({ key: dev.fahne.key });
  });
  it("zuordnen: Fahne bzw. Team; unbekanntes Team abgelehnt", async () => {
    await ok(admin, "setDevice", { device: dev.fahne!.device, assign: "fahne" });
    await ok(admin, "setDevice", { device: dev.traun!.device, assign: team.Traun!.teamId });
    expect(reason(await call(admin.token, { action: "setDevice", gameId: G, device: dev.traun!.device, assign: "gibts-nicht" }))).toBe(
      "invalid",
    );
    expect(await val(`games/${G}/devices/${dev.fahne!.device}`)).toMatchObject({ name: "Tracker Fahne", assign: "fahne" });
  });
  it("Schlüssel stehen in keiner Sicht; Teams sehen keine Geräte", async () => {
    const c = connect(admin.token);
    const v = await c.until((x) => !!x.devices);
    c.close();
    expect(Object.keys(v.devices!)).toHaveLength(2);
    expect(JSON.stringify(v)).not.toContain(dev.fahne!.key);
    const t = connect(team.Urfahr!.token);
    const tv = await t.until(() => true);
    t.close();
    expect(tv.devices).toBeUndefined();
  });
});

describe("Empfang", () => {
  it("unbekannte Kennung → 403, kaputte Anfrage → 400", async () => {
    expect((await osmand("falscher-schluessel", 0)).status).toBe(403);
    expect((await fetch(`${SERVER}/tracker?id=ohne-punkt&lat=1&lon=2`)).status).toBe(400);
    expect((await fetch(`${SERVER}/tracker?id=${G}.${dev.fahne!.key}`)).status).toBe(400);
  });
  it("OsmAnd-Format: Standort, Akku, als Tracker markiert", async () => {
    const r = await osmand(dev.fahne!.key, 0.001);
    expect(r.status).toBe(200);
    expect(await r.text()).toBe("OK");
    expect(await val(`games/${G}/devices/${dev.fahne!.device}/pos`)).toMatchObject({
      lat: LAT + 0.001,
      acc: 6,
      battery: 77,
      tracker: true,
    });
  });
  it("JSON-Format des neuen Traccar Client; Team-Tracker wird zum Standort des Teams", async () => {
    expect((await traccarJson(dev.traun!.key, 0.002)).status).toBe(200);
    expect(await val(`games/${G}/positions/${team.Traun!.teamId}`)).toMatchObject({
      lat: LAT + 0.002,
      battery: 42,
      heading: 90,
      tracker: true,
    });
  });
  it("höchstens ein Punkt alle 5 s pro Gerät", async () => {
    await osmand(dev.fahne!.key, 0.003);
    expect((await val(`games/${G}/devices/${dev.fahne!.device}/pos`)).lat).toBeCloseTo(LAT + 0.001, 6);
  });
  it("Team-Tracker hat Vorrang vor dem Handy, solange er frisch ist", async () => {
    const phone = connect(team.Traun!.token);
    await phone.until(() => true);
    phone.sendPos({ lat: LAT + 0.009, lng: LNG, acc: 5, t: Date.now() });
    await sleep(400);
    expect((await val(`games/${G}/positions/${team.Traun!.teamId}`)).lat).toBeCloseTo(LAT + 0.002, 6);
    phone.close();
  });
});

describe("Standortquellen im Spiel", () => {
  it("Meldung: Tracker der Fahne vor dem Mister-X-Handy", async () => {
    await ok(admin, "startGame", { mrx: team.Urfahr!.teamId });
    await set(`games/${G}/positions/${team.Urfahr!.teamId}`, { lat: LAT + 0.005, lng: LNG, acc: 5, t: Date.now() });
    await sleep(5100);
    await osmand(dev.fahne!.key, 0.004);
    await set(`games/${G}/state/nextReportAt`, Date.now() - 500);
    const reports = await eventually(
      () => val(`games/${G}/reports`),
      (r) => Object.keys(r).length > 0,
    );
    const r = Object.values(reports as Record<string, { src: string; lat: number }>)[0]!;
    expect(r.src).toBe("tracker");
    expect(r.lat).toBeCloseTo(LAT + 0.004, 6);
    const chat = Object.values((await val(`games/${G}/chat`)) as Record<string, { text: string }>).map((m) => m.text);
    expect(chat.some((t) => t.includes("Standort vom Tracker"))).toBe(true);
  });
  it("Übergabe: Übergabeort = Tracker der Fahne", async () => {
    await set(`games/${G}/locks`, null);
    const h = await ok(admin, "handover", {
      to: team.Traun!.teamId,
      type: "fang",
      expectedMrx: team.Urfahr!.teamId,
      requestId: "tracker-fang-1",
    });
    const rec = await val(`games/${G}/handovers/${h.handoverId as string}`);
    expect(rec.lat).toBeCloseTo(LAT + 0.004, 6);
    const rep = await val(`games/${G}/reports/${rec.reportId as string}`);
    expect(rep.src).toBe("tracker");
  });
  it("Spielende: Tracker-Standorte gelöscht (Datenschutz), Zuordnung bleibt", async () => {
    await ok(admin, "stopGame");
    const d = await val(`games/${G}/devices/${dev.fahne!.device}`);
    expect(d.pos).toBeUndefined();
    expect(d.assign).toBe("fahne");
    expect((await osmand(dev.fahne!.key, 0)).status).toBe(200); // angenommen, aber nach dem Ende nicht gespeichert
    expect((await val(`games/${G}/devices/${dev.fahne!.device}`)).pos).toBeUndefined();
  });
  it("Gerät entfernen: Schlüssel gilt nicht mehr", async () => {
    await ok(admin, "removeDevice", { device: dev.traun!.device });
    expect((await traccarJson(dev.traun!.key, 0)).status).toBe(403);
    expect(await val(`secrets/${G}/deviceKeys/${dev.traun!.device}`)).toBeNull();
  });
});
