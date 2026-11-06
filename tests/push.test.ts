// Benachrichtigungen (Meilenstein 8, jetzt Web Push mit VAPID + Verbindung): In Tests verschickt der Server nichts,
// sondern sammelt jede Benachrichtigung im Postausgang – so lässt sich prüfen, wer bei welchem Ereignis was bekommt.
// `to` = alle Empfänger (über die Verbindung, Android-App), `push` = davon per Web-Push (Abo, App nicht sichtbar).
import { beforeAll, describe, expect, it } from "vitest";
import { MELDUNG, PUSH_TITLE } from "@mrx/shared";
import {
  call,
  connect,
  eventually,
  join,
  outbox as readOutbox,
  resetServer,
  set,
  SERVER,
  sleep,
  superAdminToken,
  val,
  type Device,
} from "./helpers.ts";

const G = "push-test";
let admin: Device;
const team: Record<string, Device & { id: string }> = {};
const api = async (action: string, extra: Record<string, unknown> = {}) => {
  const r = await call(admin.token, { action, gameId: G, ...extra });
  if (r.error) throw new Error(`${action}: ${r.error.message}`);
  return r.result!;
};
type Out = Awaited<ReturnType<typeof readOutbox>>[number];
let seen = 0;
/** neue Einträge im Postausgang seit dem letzten Aufruf */
async function outbox(): Promise<Out[]> {
  const all = await readOutbox(G);
  const fresh = all.slice(seen);
  seen = all.length;
  return fresh;
}
const pushed = (o: Out[], title: string) =>
  o
    .filter((x) => x.title === title)
    .flatMap((x) => x.push)
    .sort();
const at = (dLat: number) => ({ lat: 48.3059 + dLat, lng: 14.2862, acc: 8, t: Date.now() });
const sub = (n: string) => ({
  endpoint: `https://push.example.net/${n}`,
  keys: { p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6", auth: "BTBZMqHH6r4Tts7J_aSIgg" },
});

beforeAll(async () => {
  await resetServer();
  const sa = await superAdminToken();
  await call(sa, { action: "createGame", gameId: G, name: "Push-Test", template: "linz", adminPassword: "admin1234" });
  admin = await join(G, "admin", "Peter", "admin1234");
  await api("setSecret", { kind: "teamPw", value: "falke27" });
  for (const name of ["A", "B", "C"]) {
    const d = await join(G, "team", `Team ${name}`, "falke27");
    team[name] = { ...d, id: d.teamId! };
    // wie die App: Web-Push-Abo + Arten; C will keine Meldungen
    const r = await call(d.token, { action: "pushSubscribe", gameId: G, sub: sub(name), prefs: name === "C" ? { meldung: false } : {} });
    expect(r.result).toEqual({});
  }
}, 60_000);

describe("Wer bekommt welche Benachrichtigung?", () => {
  it("Push-Abo: nur gültige Abos, nur eigene Einstellung, nicht als Großbild", async () => {
    expect(
      (await call(team.A!.token, { action: "pushSubscribe", gameId: G, sub: { endpoint: "http://unsicher", keys: {} }, prefs: {} })).error
        ?.details.reason,
    ).toBe("invalid");
    expect(await val(`games/${G}/push/${team.A!.uid}/sub/endpoint`)).toBe("https://push.example.net/A");
  });

  it("Start: Mister X bekommt „Ihr seid Mister X!“, alle anderen „Das Spiel beginnt!“", async () => {
    await api("startGame", { mrx: team.A!.id });
    const o = await outbox();
    expect(pushed(o, PUSH_TITLE.neuerMrx)).toEqual([team.A!.uid]);
    expect(pushed(o, PUSH_TITLE.start)).toEqual([team.B!.uid, team.C!.uid].sort());
    // die Spielleitung hat kein Web-Push-Abo – bekommt es nur über die Verbindung
    expect(o.find((x) => x.title === PUSH_TITLE.start)!.to).toContain(admin.uid);
  });

  it("Meldung (Alarm) an alle, außer wer Meldungen abgeschaltet hat", async () => {
    await set(`games/${G}/locks`, null);
    await set(`games/${G}/positions/${team.A!.id}`, at(0));
    await set(`games/${G}/state/nextReportAt`, Date.now() - 1000);
    await eventually(
      () => val(`games/${G}/reports`),
      (r) => Object.keys(r).length > 0,
    );
    const o = await outbox();
    expect(pushed(o, PUSH_TITLE.meldung)).toEqual([team.A!.uid, team.B!.uid].sort());
  });

  it("Übergabe: neuer Mister X, gefangenes Team, Teams im Umkreis, alle übrigen", async () => {
    await Promise.all([
      set(`games/${G}/positions/${team.A!.id}`, at(0)),
      set(`games/${G}/positions/${team.B!.id}`, at(0.0005)),
      set(`games/${G}/positions/${team.C!.id}`, at(0.0009)),
    ]);
    await api("handover", { to: team.B!.id, type: "fang", expectedMrx: team.A!.id, requestId: "push-fang-1" });
    const o = await outbox();
    expect(pushed(o, PUSH_TITLE.neuerMrx)).toEqual([team.B!.uid]);
    const wait = o.filter((x) => x.title === PUSH_TITLE.warten);
    expect(wait.find((x) => x.push.includes(team.A!.uid))?.body).toBe(MELDUNG.gefangen(5));
    expect(wait.find((x) => x.push.includes(team.C!.uid))?.body).toBe(MELDUNG.warten(5));
    expect(pushed(o, PUSH_TITLE.uebergabe)).toEqual([]); // alle Teams sind betroffen, die Spielleitung hat kein Abo
  });

  it("Ende der Wartezeit per Alarm: genau einmal je Team", async () => {
    const locks = (await val(`games/${G}/locks`)) as Record<string, { until: number }>;
    for (const t of Object.keys(locks)) await set(`games/${G}/locks/${t}/until`, Date.now() - 1000);
    await eventually(
      () => val(`games/${G}/locks`),
      (l) => Object.keys(l).length === 0,
    );
    await sleep(200);
    const o = await outbox();
    expect(pushed(o, PUSH_TITLE.weiter)).toEqual([team.A!.uid, team.C!.uid].sort());
  });

  it("Durchsage, Verkleinerung und Regeländerung an alle", async () => {
    await api("announce", { text: "Treffpunkt um 17 Uhr" });
    await api("setCut", { cutId: "norden", locked: true });
    await api("setConfig", { config: { intervalMin: 5 } });
    const o = await outbox();
    expect(o.find((x) => x.title === PUSH_TITLE.durchsage)?.body).toBe("Treffpunkt um 17 Uhr");
    expect(pushed(o, PUSH_TITLE.spielfeld)).toHaveLength(3);
    expect(o.find((x) => x.title === PUSH_TITLE.regeln)?.body).toBe(MELDUNG.intervall(5));
  });

  it("Direktnachricht der Spielleitung nur an das Team; Nachrichten von Teams lösen nichts aus", async () => {
    await api("chat", { text: "Akku?", dm: team.C!.id });
    await call(team.C!.token, { action: "chat", gameId: G, text: "Passt", dm: team.C!.id });
    const o = await outbox();
    expect(o.map((x) => x.title)).toEqual([PUSH_TITLE.nachricht]);
    expect(o[0]!.to).toEqual([team.C!.uid]);
  });

  it("App sichtbar → kein Web-Push, sondern über die Verbindung", async () => {
    const phone = connect(team.B!.token);
    await phone.until(() => true);
    await api("announce", { text: "Alle zum Hauptplatz" });
    const o = await outbox();
    expect(o[0]!.to).toContain(team.B!.uid);
    expect(o[0]!.push).not.toContain(team.B!.uid);
    await eventually(
      async () => phone.notes.length,
      (n) => n > 0,
    );
    expect(phone.notes[0]).toMatchObject({ kind: "durchsage", title: PUSH_TITLE.durchsage, body: "Alle zum Hauptplatz" });
    // im Hintergrund (Tab nicht sichtbar) wieder per Web-Push
    phone.live.setVisible(false);
    await sleep(200);
    await api("announce", { text: "Noch 10 Minuten" });
    expect((await outbox())[0]!.push).toContain(team.B!.uid);
    phone.close();
  });

  it("Android-App im Hintergrund: verpasste Benachrichtigungen kommen mit dem nächsten Standort", async () => {
    await sleep(50);
    const since = Date.now();
    await sleep(50);
    await api("announce", { text: "Handy-Test" });
    const r = await fetch(`${SERVER}/api/pos`, {
      method: "POST",
      headers: { authorization: `Bearer ${team.C!.token}`, "content-type": "application/json" },
      body: JSON.stringify({ p: at(0.0009), since }),
    });
    const j = (await r.json()) as { ok: boolean; result: { notes: { body: string }[] } };
    expect(j.result.notes.map((n) => n.body)).toEqual(["Handy-Test"]);
    expect(await val(`games/${G}/positions/${team.C!.id}/lat`)).toBeCloseTo(48.3068, 4);
    await outbox();
  });

  it("Spielende an alle; abgemeldete Geräte bekommen nichts mehr", async () => {
    await call(team.C!.token, { action: "leave", gameId: G });
    await api("stopGame");
    const o = await outbox();
    expect(pushed(o, PUSH_TITLE.ende)).toEqual([team.A!.uid, team.B!.uid].sort());
  });
});
