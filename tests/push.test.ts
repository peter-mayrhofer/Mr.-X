// Benachrichtigungen (Meilenstein 8) gegen die Emulatoren: Im Emulator schickt der Server nichts an Google, sondern legt
// jede Benachrichtigung in pushOutbox/{g} ab – so lässt sich prüfen, wer bei welchem Ereignis was bekommt.
import { beforeAll, describe, expect, it } from "vitest";
import { MELDUNG, PUSH_TITLE } from "@mrx/shared";
import { call, db, device, resetEmulators, superAdminToken, val } from "./helpers.ts";

const G = "push-test";
type Dev = { uid: string; token: string };
let admin: Dev;
const team: Record<string, Dev & { id: string }> = {};
const api = async (action: string, extra: Record<string, unknown> = {}) => {
  const r = await call(admin.token, { action, gameId: G, ...extra });
  if (r.error) throw new Error(`${action}: ${r.error.message}`);
  return r.result!;
};
type Out = { title: string; body: string; kind: string; to: string[] };
let seen = 0;
/** neue Einträge im Postausgang seit dem letzten Aufruf */
async function outbox(): Promise<Out[]> {
  const all = Object.values(((await val(`pushOutbox/${G}`)) ?? {}) as Record<string, Out>);
  const fresh = all.slice(seen);
  seen = all.length;
  return fresh;
}
const to = (o: Out[], title: string) =>
  o
    .filter((x) => x.title === title)
    .flatMap((x) => x.to)
    .sort();
const at = (dLat: number) => ({ lat: 48.3059 + dLat, lng: 14.2862, acc: 8, t: Date.now() });

beforeAll(async () => {
  await resetEmulators();
  const sa = await superAdminToken();
  await call(sa, { action: "createGame", gameId: G, name: "Push-Test", template: "linz", adminPassword: "admin1234" });
  admin = await device();
  await call(admin.token, { action: "join", gameId: G, role: "admin", name: "Peter", secret: "admin1234" });
  await api("setSecret", { kind: "teamPw", value: "falke27" });
  for (const name of ["A", "B", "C"]) {
    const d = await device();
    const r = await call(d.token, { action: "join", gameId: G, role: "team", name: `Team ${name}`, secret: "falke27" });
    team[name] = { ...d, id: r.result!.teamId as string };
    // wie die App: Token + Push-Arten; C will keine Meldungen
    await db
      .ref(`games/${G}/push/${d.uid}`)
      .set({ token: `emulator-${d.uid}`, platform: "web", prefs: name === "C" ? { meldung: false } : {} });
  }
}, 60_000);

describe("Wer bekommt welche Benachrichtigung?", () => {
  it("Start: Mister X bekommt „Ihr seid Mister X!“, alle anderen „Das Spiel beginnt!“", async () => {
    await api("startGame", { mrx: team.A!.id });
    const o = await outbox();
    expect(to(o, PUSH_TITLE.neuerMrx)).toEqual([team.A!.uid]);
    expect(to(o, PUSH_TITLE.start)).toEqual([team.B!.uid, team.C!.uid].sort());
  });

  it("Meldung an alle, außer wer Meldungen abgeschaltet hat", async () => {
    await db.ref(`games/${G}/locks`).set(null);
    await db.ref(`games/${G}/pos/${team.A!.id}`).set(at(0));
    await db.ref(`games/${G}/state/nextReportAt`).set(Date.now() - 1000);
    await api("poke");
    const o = await outbox();
    expect(to(o, PUSH_TITLE.meldung)).toEqual([team.A!.uid, team.B!.uid].sort());
  });

  it("Übergabe: neuer Mister X, gefangenes Team, Teams im Umkreis, alle übrigen", async () => {
    await Promise.all([
      db.ref(`games/${G}/pos/${team.A!.id}`).set(at(0)),
      db.ref(`games/${G}/pos/${team.B!.id}`).set(at(0.0005)),
      db.ref(`games/${G}/pos/${team.C!.id}`).set(at(0.0009)),
    ]);
    await api("handover", { to: team.B!.id, type: "fang", expectedMrx: team.A!.id, requestId: "push-fang-1" });
    const o = await outbox();
    expect(to(o, PUSH_TITLE.neuerMrx)).toEqual([team.B!.uid]);
    const wait = o.filter((x) => x.title === PUSH_TITLE.warten);
    expect(wait.find((x) => x.to.includes(team.A!.uid))?.body).toBe(MELDUNG.gefangen(5));
    expect(wait.find((x) => x.to.includes(team.C!.uid))?.body).toBe(MELDUNG.warten(5));
    expect(to(o, PUSH_TITLE.uebergabe)).toEqual([]); // alle Teams sind betroffen, nur die Spielleitung hätte keinen Token
  });

  it("Ende der Wartezeit: genau einmal, auch wenn mehrfach angestoßen wird", async () => {
    const locks = (await val(`games/${G}/locks`)) as Record<string, { until: number }>;
    for (const t of Object.keys(locks)) await db.ref(`games/${G}/locks/${t}/until`).set(Date.now() - 1000);
    const r = await Promise.all([api("poke"), api("poke"), api("poke")]);
    expect(r.filter((x) => (x.done as string[]).includes("wartezeit")).length).toBeGreaterThanOrEqual(1);
    const o = await outbox();
    expect(to(o, PUSH_TITLE.weiter)).toEqual([team.A!.uid, team.C!.uid].sort());
    expect(await val(`games/${G}/locks`)).toBeNull();
  });

  it("Durchsage, Verkleinerung und Regeländerung an alle", async () => {
    await api("announce", { text: "Treffpunkt um 17 Uhr" });
    await api("setCut", { cutId: "norden", locked: true });
    await api("setConfig", { config: { intervalMin: 5 } });
    const o = await outbox();
    expect(o.find((x) => x.title === PUSH_TITLE.durchsage)?.body).toBe("Treffpunkt um 17 Uhr");
    expect(to(o, PUSH_TITLE.spielfeld)).toHaveLength(3);
    expect(o.find((x) => x.title === PUSH_TITLE.regeln)?.body).toBe(MELDUNG.intervall(5));
  });

  it("Direktnachricht der Spielleitung nur an das Team; Nachrichten von Teams lösen nichts aus", async () => {
    await db.ref(`games/${G}/dm/${team.C!.id}/x1`).set({ uid: admin.uid, name: "Peter", kind: "msg", t: Date.now(), text: "Akku?" });
    await db
      .ref(`games/${G}/dm/${team.C!.id}/x2`)
      .set({ uid: team.C!.uid, name: "Team C", teamId: team.C!.id, kind: "msg", t: Date.now(), text: "Passt" });
    await expect.poll(async () => to(await outbox(), PUSH_TITLE.nachricht), { timeout: 10_000 }).toEqual([team.C!.uid]);
    await new Promise((r) => setTimeout(r, 1500));
    expect(await outbox()).toEqual([]);
  });

  it("Spielende an alle; abgemeldete Geräte bekommen nichts mehr", async () => {
    await call(team.C!.token, { action: "leave", gameId: G });
    await api("stopGame");
    const o = await outbox();
    expect(to(o, PUSH_TITLE.ende)).toEqual([team.A!.uid, team.B!.uid].sort());
  });
});
