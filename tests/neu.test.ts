// Ergänzungen nach dem ersten echten Spiel: Teamgröße, Team aufteilen, Notfall, Sammelruf, Endphase, Vorlagen,
// Durchsage-Vorlagen und Probelauf – jeweils mit den Rechten (wer darf was, wer sieht was).
import { beforeAll, describe, expect, it } from "vitest";
import { call, connect, eventually, join, outbox, reason, resetServer, set, sleep, superAdminToken, val, type Device } from "./helpers.ts";

const G = "neu-test";
const MIN = 60_000;
let admin: Device, schiri: Device, a: Device, a2: Device, b: Device;

const run = (d: Device, action: string, extra: Record<string, unknown> = {}) => call(d.token, { action, gameId: G, ...extra });
const ok = async (d: Device, action: string, extra: Record<string, unknown> = {}) => {
  const r = await run(d, action, extra);
  if (r.error) throw new Error(`${action}: ${r.error.message}`);
  return r.result!;
};
const state = () => val(`games/${G}/state`);
const lastChat = async () => Object.values(((await val(`games/${G}/chat`)) ?? {}) as Record<string, { text: string }>).at(-1)!.text;
// Hauptplatz Linz
const at = (dLat: number, dLng = 0) => ({ lat: 48.3059 + dLat, lng: 14.2862 + dLng, acc: 8, t: Date.now() });

beforeAll(async () => {
  await resetServer();
  const sa = await superAdminToken();
  await call(sa, { action: "createGame", gameId: G, name: "Neu-Test", template: "linz", adminPassword: "admin1234" });
  admin = await join(G, "admin", "Peter", "admin1234");
  await ok(admin, "setSecret", { kind: "teamPw", value: "falke27" });
  await ok(admin, "setSecret", { kind: "schiriCode", value: "pfeife" });
  a = await join(G, "team", "OG Bulgariplatz", "falke27", { size: 12 });
  a2 = await join(G, "team", "OG Bulgariplatz", "falke27", { secondDevice: true });
  b = await join(G, "team", "Traun", "falke27", { size: 500 }); // unsinnige Größe wird ignoriert
  schiri = await join(G, "schiri", "Anna", "pfeife");
}, 60_000);

describe("Teamgröße", () => {
  it("beim Beitritt angegeben; unsinnige Angaben weggelassen", async () => {
    expect(await val(`games/${G}/teams/${a.teamId}/size`)).toBe(12);
    expect(await val(`games/${G}/teams/${b.teamId}/size`)).toBeNull();
  });
  it("das Team selbst und die Spielleitung ändern sie, andere nicht", async () => {
    await ok(b, "setTeamSize", { teamId: b.teamId, size: 7 });
    expect(await val(`games/${G}/teams/${b.teamId}/size`)).toBe(7);
    await ok(admin, "setTeamSize", { teamId: b.teamId, size: 8 });
    expect(reason(await run(a, "setTeamSize", { teamId: b.teamId, size: 3 }))).toBe("forbidden");
    expect(reason(await run(schiri, "setTeamSize", { teamId: b.teamId, size: 3 }))).toBe("forbidden");
    expect(reason(await run(b, "setTeamSize", { teamId: b.teamId, size: 0 }))).toBe("invalid");
    expect(await val(`games/${G}/teams/${b.teamId}/size`)).toBe(8);
  });
});

describe("Vorlagen und Probelauf (vor dem Start)", () => {
  it("Durchsage-Vorlagen: eigene Liste, geprüft", async () => {
    await ok(admin, "setConfig", { config: { announceTemplates: ["Bitte Gruppennamen nachtragen", " Gebt alles! ", "Gebt alles!"] } });
    expect(await val(`games/${G}/config/announceTemplates`)).toEqual(["Bitte Gruppennamen nachtragen", "Gebt alles!"]);
    expect(reason(await run(admin, "setConfig", { config: { announceTemplates: ["x".repeat(301)] } }))).toBe("invalid");
    expect(reason(await run(a, "setConfig", { config: { announceTemplates: [] } }))).toBe("forbidden");
  });
  it("Vorlage speichern, auflisten, nach Änderungen wieder laden, löschen", async () => {
    await ok(admin, "setConfig", { config: { intervalMin: 7, rulesText: "**Treffpunkt** Hauptplatz" } });
    const { id } = await ok(admin, "templateSave", { name: "Mister X Herbst" });
    const { templates } = (await ok(admin, "templateList")) as { templates: { id: string; name: string }[] };
    expect(templates).toMatchObject([{ id, name: "Mister X Herbst" }]);
    // ändern …
    await ok(admin, "setConfig", { config: { intervalMin: 12, rulesText: "" } });
    const field = await val(`games/${G}/field`);
    await ok(admin, "setField", { field: { ...field, name: "Anderes Feld", cuts: {} } });
    // … und die Vorlage zurückholen
    await ok(admin, "templateLoad", { id });
    expect(await val(`games/${G}/config/intervalMin`)).toBe(7);
    expect(await val(`games/${G}/config/rulesText`)).toBe("**Treffpunkt** Hauptplatz");
    expect(await val(`games/${G}/config/announceTemplates`)).toEqual(["Bitte Gruppennamen nachtragen", "Gebt alles!"]);
    expect(await val(`games/${G}/field/name`)).toBe("Linz Innenstadt");
    expect(Object.keys(await val(`games/${G}/field/cuts`))).toHaveLength(4);
    expect(reason(await run(schiri, "templateList"))).toBe("forbidden");
    expect(reason(await run(admin, "templateLoad", { id: "gibts-nicht" }))).toBe("notFound");
    const { id: id2 } = await ok(admin, "templateSave", { name: "Wegwerf" });
    await ok(admin, "templateDelete", { id: id2 });
    expect(((await ok(admin, "templateList")) as { templates: unknown[] }).templates).toHaveLength(1);
  });
  it("Probelauf an – geht nur vor dem Start", async () => {
    await ok(admin, "setConfig", { config: { trial: true } });
    expect(await val(`games/${G}/config/trial`)).toBe(true);
    expect(reason(await run(admin, "setConfig", { config: { trial: "ja" } }))).toBe("invalid");
  });
});

describe("Im Spiel", () => {
  it("Start; Vorlage laden und Probelauf umschalten gehen jetzt nicht mehr", async () => {
    await ok(admin, "startGame", { mrx: b.teamId });
    const { templates } = (await ok(admin, "templateList")) as { templates: { id: string }[] };
    expect(reason(await run(admin, "templateLoad", { id: templates[0]!.id }))).toBe("wrongPhase");
    expect(reason(await run(admin, "setConfig", { config: { trial: false } }))).toBe("wrongPhase");
  });

  it("Team aufteilen: neues Team mit den gewählten Geräten, Wartezeit und Größe werden mitgenommen", async () => {
    const phone = connect(a2.token);
    await phone.until(() => true);
    expect(reason(await run(admin, "splitTeam", { teamId: a.teamId, name: "Traun", uids: [a2.uid] }))).toBe("exists");
    expect(reason(await run(admin, "splitTeam", { teamId: a.teamId, name: "Minis", uids: [b.uid] }))).toBe("invalid");
    expect(reason(await run(admin, "splitTeam", { teamId: a.teamId, name: "Minis", uids: [] }))).toBe("invalid");
    expect(reason(await run(a, "splitTeam", { teamId: a.teamId, name: "Minis", uids: [a2.uid] }))).toBe("forbidden");
    const lock = await val(`games/${G}/locks/${a.teamId}`); // Startsperre
    const { teamId } = (await ok(admin, "splitTeam", { teamId: a.teamId, name: "OG Bulgariplatz Minis", uids: [a2.uid], size: 5 })) as {
      teamId: string;
    };
    expect(await val(`games/${G}/teams/${teamId}`)).toMatchObject({ name: "OG Bulgariplatz Minis", size: 5 });
    expect(await val(`games/${G}/teams/${a.teamId}/size`)).toBe(7);
    expect(await val(`games/${G}/members/${a2.uid}`)).toMatchObject({ teamId, name: "OG Bulgariplatz Minis" });
    expect(await val(`games/${G}/members/${a.uid}/teamId`)).toBe(a.teamId);
    expect(await val(`games/${G}/locks/${teamId}`)).toEqual(lock);
    // das umgezogene Handy erfährt es sofort
    await phone.until((v) => v.me.teamId === teamId);
    expect(await lastChat()).toBe("OG Bulgariplatz hat sich aufgeteilt: OG Bulgariplatz und OG Bulgariplatz Minis spielen jetzt getrennt.");
    phone.close();
    a2 = { ...a2, teamId };
  });

  it("Notfall: Spielleitung und Schiris bekommen ihn (nicht abschaltbar), andere Teams sehen nichts", async () => {
    await ok(admin, "pushSubscribe", { prefs: { notfall: false } }); // abschalten wirkt bei Notfällen nicht
    const before = (await outbox(G)).length;
    expect(reason(await run(schiri, "sos"))).toBe("forbidden");
    const { id } = (await ok(a, "sos", { pos: at(0.001) })) as { id: string };
    expect((await ok(a, "sos")).id).toBe(id); // nochmal drücken: kein zweiter Alarm
    const sent = (await outbox(G)).slice(before);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ kind: "notfall", title: "NOTFALL", body: "OG Bulgariplatz hat einen Notfall gemeldet!" });
    expect(sent[0]!.to.sort()).toEqual([admin.uid, schiri.uid].sort());
    expect(await val(`games/${G}/alerts/${id}`)).toMatchObject({ teamId: a.teamId, uid: a.uid, lat: 48.3069 });
    // Sicht: Spielleitung/Schiri alles, das eigene Team seins, andere Teams nichts
    const sees = async (d: Device) => {
      const c = connect(d.token);
      const v = await c.until(() => true);
      c.close();
      return Object.keys(v.alerts ?? {});
    };
    expect(await sees(admin)).toEqual([id]);
    expect(await sees(schiri)).toEqual([id]);
    expect(await sees(a)).toEqual([id]);
    expect(await sees(b)).toEqual([]);
    expect(await sees(a2)).toEqual([]);
  });
  it("Notfall erledigen: Schiri/Spielleitung; das Team selbst nur als Fehlalarm; fremde Teams nicht", async () => {
    const { id } = (await ok(a2, "sos")) as { id: string };
    expect(reason(await run(b, "sosDone", { id }))).toBe("forbidden");
    await ok(a2, "sosDone", { id });
    expect(await val(`games/${G}/alerts/${id}/done`)).toMatchObject({ by: "OG Bulgariplatz Minis", fehlalarm: true });
    expect((await outbox(G)).at(-1)!.body).toMatch(/^Entwarnung: OG Bulgariplatz Minis/);
    const open = Object.entries((await val(`games/${G}/alerts`)) as Record<string, { done?: object }>).find(([, x]) => !x.done)![0];
    await ok(schiri, "sosDone", { id: open });
    expect(await val(`games/${G}/alerts/${open}/done/by`)).toBe("Anna");
  });

  it("Endphase: zu Beginn des Spielende-Fensters automatisch angekündigt – einmal", async () => {
    await set(`secrets/${G}/endAt`, Date.now() + 60 * MIN);
    await set(`games/${G}/state`, { ...(await state()), startedAt: Date.now() - 31 * MIN });
    await ok(admin, "setConfig", { config: { endMinH: 0.5, endMaxH: 2 } }); // neues Fenster, Alarm wird neu gestellt
    await set(`secrets/${G}/endAt`, Date.now() + 60 * MIN);
    const s = await eventually(state, (x) => !!x.endPhase);
    expect(s.endPhase).toBeGreaterThan(0);
    const chat = Object.values((await val(`games/${G}/chat`)) as Record<string, { text: string }>).map((m) => m.text);
    expect(chat.filter((t) => t.startsWith("Endphase!"))).toHaveLength(1);
    expect(chat.find((t) => t.startsWith("Endphase!"))).toMatch(/spätestens um \d\d:\d\d/);
    await sleep(500);
    expect(
      Object.values((await val(`games/${G}/chat`)) as Record<string, { text: string }>).filter((m) => m.text.startsWith("Endphase!")),
    ).toHaveLength(1);
  });

  it("Sammelruf: Treffpunkt aus dem Spielfeld, Ankunft automatisch in der Nähe oder per Knopf", async () => {
    expect(reason(await run(schiri, "gather", { on: true }))).toBe("forbidden");
    // Treffpunkt im Spielfeld setzen (Hauptplatz)
    const field = await val(`games/${G}/field`);
    expect(reason(await run(admin, "setField", { field: { ...field, meet: { name: "Hauptplatz", lat: 48.3059, lng: 14.2862 } } }))).toBe(
      "wrongPhase",
    ); // im Spiel nicht – darum direkt im Spielraum
    await set(`games/${G}/field/meet`, { name: "Hauptplatz", lat: 48.3059, lng: 14.2862 });
    await ok(admin, "gather", { on: true });
    expect(await state()).toMatchObject({ gather: { name: "Hauptplatz", lat: 48.3059 } });
    expect(await lastChat()).toBe("Sammelruf: Alle bitte jetzt zum Treffpunkt Hauptplatz.");
    // Traun kommt in die Nähe (30 m) → angekommen
    const lead = connect(admin.token);
    await lead.until(() => true);
    const phone = connect(b.token);
    await phone.until(() => true);
    phone.sendPos(at(0.0003));
    const s = await eventually(state, (x) => !!x.gather?.arrived?.[b.teamId!]);
    expect(s.gather.arrived[b.teamId!]).toBeGreaterThan(0);
    // die Spielleitung sieht die Ankunft sofort (früher erst mit der nächsten Aktion oder dem nächsten Alarm)
    await lead.until((v) => !!v.state.gather?.arrived?.[b.teamId!], 3000);
    lead.close();
    phone.close();
    // „Wir sind da“ – nur fürs eigene Team; zurücknehmen nur die Spielleitung
    expect(reason(await run(a, "arrived", { teamId: a2.teamId, on: true }))).toBe("forbidden");
    await ok(a, "arrived", { teamId: a.teamId, on: true });
    expect(reason(await run(a, "arrived", { teamId: a.teamId, on: false }))).toBe("forbidden");
    await ok(admin, "arrived", { teamId: a2.teamId, on: true });
    await ok(admin, "arrived", { teamId: a2.teamId, on: false });
    expect(Object.keys((await state()).gather.arrived).sort()).toEqual([a.teamId, b.teamId].sort());
  });

  it("Probelauf-Ende: Auswertung da, aber nicht im Archiv; Sammelruf läuft nach dem Ende weiter", async () => {
    await ok(admin, "stopGame");
    const s = await state();
    expect(s.phase).toBe("beendet");
    expect(s.run).toMatch(/^probe-/);
    expect(s.gather.name).toBe("Hauptplatz");
    expect(((await ok(admin, "archiveList")) as { runs: unknown[] }).runs).toHaveLength(0);
    expect(((await ok(a, "archiveGet", { run: s.run })) as { archive: { results: object } }).archive.results).toBeTruthy();
    await ok(a2, "arrived", { teamId: a2.teamId, on: true }); // nach dem Ende per Knopf
    expect(Object.keys((await state()).gather.arrived)).toHaveLength(3);
    await ok(admin, "gather", { on: false });
    expect((await state()).gather).toBeUndefined();
  });

  it("Neue Runde: Probelauf weg, Notfälle weg", async () => {
    const probe = (await state()).run as string;
    await ok(admin, "resetRound");
    await sleep(300);
    expect(reason(await run(admin, "archiveGet", { run: probe }))).toBe("notFound");
    expect(await val(`games/${G}/alerts`)).toEqual({});
  });
});
