// Spielablauf am Server (Meilenstein 4, jetzt im Spielraum auf Cloudflare): Start, Meldungen per Alarm mit
// Standort-Fallback, Übergabe mit Umkreis-Wartezeit, doppelte/gleichzeitige Anfragen, Rückgängig, Regeländerung,
// Verkleinerung, Pause, Sofort-Meldung, Strecke + GPS-Sprünge, Spielende mit Archiv und gelöschten Standorten,
// Notstopp, Neue Runde. „Zeitraffer“: Termine werden im Spielraum vorverlegt – dann löst der echte Alarm aus.
import { beforeAll, describe, expect, it } from "vitest";
import { call, connect, eventually, join, reason, resetServer, set, sleep, superAdminToken, tick, val, type Device } from "./helpers.ts";

const G = "linz-spiel";
const MIN = 60_000;
let admin: Device, schiri: Device, schiri2: Device, viewer: Device;
const team: Record<string, Device & { id: string }> = {};

const run = (d: Device, action: string, extra: Record<string, unknown> = {}) => call(d.token, { action, gameId: G, ...extra });
const ok = async (d: Device, action: string, extra: Record<string, unknown> = {}) => {
  const r = await run(d, action, extra);
  if (r.error) throw new Error(`${action}: ${r.error.message}`);
  return r.result!;
};
// Hauptplatz Linz; 0,00045° Breite ≈ 50 m
const at = (dLat: number, t = Date.now()) => ({ lat: 48.3059 + dLat, lng: 14.2862, acc: 8, t });
const setPos = (k: string, dLat: number, t?: number) => set(`games/${G}/positions/${team[k]!.id}`, at(dLat, t));
const state = () => val(`games/${G}/state`);
const list = async <T>(p: string): Promise<[string, T][]> => Object.entries(((await val(`games/${G}/${p}`)) ?? {}) as Record<string, T>);
const lastChat = async () => (await list<{ text: string; kind: string; reportId?: string }>("chat")).at(-1)![1];
const reports = () => list<{ teamId: string; src: string; kind: string; void?: boolean; posAt: number }>("reports");

beforeAll(async () => {
  await resetServer();
  const sa = await superAdminToken();
  await call(sa, { action: "createGame", gameId: G, name: "Spiel-Test", template: "linz", adminPassword: "admin1234" });
  admin = await join(G, "admin", "Peter", "admin1234");
  await ok(admin, "setSecret", { kind: "teamPw", value: "falke27" });
  await ok(admin, "setSecret", { kind: "schiriCode", value: "pfeife" });
  for (const [k, name] of [
    ["a", "Urfahr"],
    ["b", "Traun"],
    ["c", "Leonding"],
    ["d", "Pichling"],
  ] as const) {
    const d = await join(G, "team", name, "falke27");
    team[k] = { ...d, id: d.teamId! };
  }
  schiri = await join(G, "schiri", "Anna", "pfeife");
  schiri2 = await join(G, "schiri", "Ben", "pfeife");
  viewer = await join(G, "viewer", "");
}, 60_000);

describe("Start (Regel 1, 2, 12)", () => {
  it("nur die Spielleitung startet", async () => {
    expect(reason(await run(team.a!, "startGame", { mrx: "random" }))).toBe("forbidden");
    expect(reason(await run(schiri, "startGame", { mrx: "random" }))).toBe("forbidden");
    expect(reason(await run(admin, "startGame", { mrx: "gibts-nicht" }))).toBe("invalid");
  });
  it("Übergabe vor dem Start geht nicht", async () =>
    expect(reason(await run(schiri, "handover", { to: team.b!.id, type: "fang", expectedMrx: team.a!.id, requestId: "vorstart1" }))).toBe(
      "wrongPhase",
    ));
  it("Start mit gewähltem Mister X: Startsperre für alle anderen, geheimes Ende im Fenster", async () => {
    const before = Date.now();
    expect(await ok(admin, "startGame", { mrx: team.a!.id })).toEqual({ mrx: team.a!.id });
    const s = await state();
    expect(s).toMatchObject({ phase: "laeuft", mrx: team.a!.id });
    expect(s.nextReportAt - s.startedAt).toBe(10 * MIN);
    const locks = await val(`games/${G}/locks`);
    expect(Object.keys(locks).sort()).toEqual([team.b!.id, team.c!.id, team.d!.id].sort());
    expect(locks[team.b!.id]).toEqual({ until: s.nextReportAt, reason: "start" });
    const endAt = await val(`secrets/${G}/endAt`);
    expect(endAt).toBeGreaterThanOrEqual(before + 180 * MIN);
    expect(endAt).toBeLessThanOrEqual(Date.now() + 240 * MIN);
    expect(await val(`games/${G}/info/phase`)).toBe("laeuft");
    expect((await lastChat()).text).toContain("Urfahr ist Mister X");
  });
  it("zweimal starten geht nicht", async () => expect(reason(await run(admin, "startGame", { mrx: "random" }))).toBe("wrongPhase"));
});

describe("Meldungen per Alarm (Regel 5, Abschnitt 4.3)", () => {
  it("noch nicht fällig → nichts", async () => expect(await tick(G)).toEqual([]));
  it("fällig → der Alarm meldet genau einmal, auch wenn gleichzeitig mehrfach angestoßen wird", async () => {
    await set(`games/${G}/locks`, null); // Vorsprung vorbei
    await setPos("a", 0);
    const due = Date.now() - 1000;
    await set(`games/${G}/state/nextReportAt`, due);
    await Promise.all(Array.from({ length: 6 }, () => tick(G)));
    const rs = await eventually(reports, (r) => r.length > 0);
    await sleep(300);
    expect(await reports()).toHaveLength(1);
    expect(rs[0]![1]).toMatchObject({ teamId: team.a!.id, src: "handy", kind: "auto" });
    expect((await state()).nextReportAt).toBe(due + 10 * MIN);
    expect(await lastChat()).toMatchObject({ kind: "sys", reportId: rs[0]![0] });
  });
  it("Mister-X-Handy ohne frischen Standort → Schiri, der der Fahne folgt (ohne dass ein Handy anstößt)", async () => {
    expect(reason(await run(team.a!, "follow", { on: true }))).toBe("forbidden");
    await ok(schiri, "follow", { on: true });
    await setPos("a", 0, Date.now() - 5 * MIN);
    await set(`games/${G}/staff/${schiri.uid}`, at(0.0001));
    await set(`games/${G}/state/nextReportAt`, Date.now() - 1000);
    await eventually(reports, (r) => r.length === 2);
    expect((await reports()).at(-1)![1]).toMatchObject({ src: "schiri" });
    expect((await lastChat()).text).toContain("Standort vom Schiri");
  });
  it("gar nichts frisch → letzter bekannter Standort mit Uhrzeit", async () => {
    await ok(schiri, "follow", { on: false });
    await set(`games/${G}/state/nextReportAt`, Date.now() - 1000);
    await eventually(reports, (r) => r.length === 3);
    const r = (await reports()).at(-1)![1];
    expect(r.src).toBe("letzter");
    expect(Date.now() - r.posAt).toBeGreaterThan(4 * MIN);
    expect((await lastChat()).text).toMatch(/letzter bekannter Standort von \d\d:\d\d/);
  });
});

describe("Übergabe (Regel 3, 4) und Rückgängig", () => {
  let hid = "";
  it("Teams dürfen nicht übergeben", async () =>
    expect(
      reason(await run(team.b!, "handover", { to: team.b!.id, type: "fang", expectedMrx: team.a!.id, requestId: "teamversuch" })),
    ).toBe("forbidden"));
  it("Fang: altes Team + Teams im Umkreis warten, der neue Mister X und weit entfernte nicht, sofort eine Meldung", async () => {
    await Promise.all([setPos("a", 0), setPos("b", 0.00045), setPos("c", 0.0009), setPos("d", 0.01)]);
    await set(`games/${G}/locks/${team.b!.id}`, { until: Date.now() + MIN, reason: "manuell" });
    const r = await ok(schiri, "handover", { to: team.b!.id, type: "fang", expectedMrx: team.a!.id, requestId: "fang-0001" });
    hid = r.handoverId as string;
    expect((r.locked as string[]).sort()).toEqual([team.a!.id, team.c!.id].sort());
    const s = await state();
    expect(s.mrx).toBe(team.b!.id);
    expect(s.nextReportAt - s.lastReportAt).toBe(10 * MIN);
    const locks = await val(`games/${G}/locks`);
    expect(Object.keys(locks).sort()).toEqual([team.a!.id, team.c!.id].sort());
    expect(locks[team.a!.id].until - Date.now()).toBeGreaterThan(4 * MIN);
    expect((await reports()).at(-1)![1]).toMatchObject({ teamId: team.b!.id, kind: "uebergabe", src: "handy" });
    expect((await lastChat()).text).toBe("Traun hat Urfahr gefangen und ist jetzt Mister X! 5 Min Wartezeit in der Nähe.");
  });
  it("dieselbe Anfrage nach Netzabbruch nochmal → nichts doppelt", async () => {
    const r = await ok(schiri, "handover", { to: team.b!.id, type: "fang", expectedMrx: team.a!.id, requestId: "fang-0001" });
    expect(r.handoverId).toBe(hid);
    expect((await list("handovers")).length).toBe(2); // Start + 1
  });
  it("zwei Schiris gleichzeitig: nur einer zählt", async () => {
    const [x, y] = await Promise.all([
      run(schiri, "handover", { to: team.c!.id, type: "fang", expectedMrx: team.b!.id, requestId: "gleich-001" }),
      run(schiri2, "handover", { to: team.d!.id, type: "fang", expectedMrx: team.b!.id, requestId: "gleich-002" }),
    ]);
    expect([x, y].filter((r) => r.result)).toHaveLength(1);
    expect([x, y].map(reason)).toContain("conflict");
    // wieder zurück zum Stand von vorhin
    const won = (x.result ?? y.result)!.handoverId as string;
    await ok(admin, "undo", { handoverId: won });
    expect((await state()).mrx).toBe(team.b!.id);
  });
  it("veralteter Stand → abgelehnt", async () =>
    expect(reason(await run(schiri2, "handover", { to: team.c!.id, type: "fang", expectedMrx: team.a!.id, requestId: "fang-0002" }))).toBe(
      "conflict",
    ));
  it("Rückgängig nur für die letzte: die erste Übergabe ist nach einem Rückgängig nicht mehr die letzte", async () =>
    expect(reason(await run(admin, "undo", { handoverId: hid }))).toBe("conflict"));
});

describe("Rückgängig (sauber)", () => {
  it("Zustand, Wartezeiten und Meldung wie vorher", async () => {
    await set(`games/${G}/locks`, null);
    await set(`games/${G}/locks/${team.c!.id}`, { until: Date.now() + MIN, reason: "manuell" });
    await Promise.all([setPos("b", 0), setPos("a", 0.00045), setPos("c", 0.0009), setPos("d", 0.01)]);
    const r = await ok(schiri, "handover", { to: team.a!.id, type: "fang", expectedMrx: team.b!.id, requestId: "fang-0003" });
    const id = r.handoverId as string;
    expect(reason(await run(team.a!, "undo", { handoverId: id }))).toBe("forbidden");
    await ok(admin, "undo", { handoverId: id });
    const s = await state();
    expect(s.mrx).toBe(team.b!.id);
    expect(s.lastHandover).toBeUndefined();
    expect(await val(`games/${G}/locks`)).toEqual({ [team.c!.id]: expect.objectContaining({ reason: "manuell" }) });
    expect((await reports()).at(-1)![1].void).toBe(true);
    expect(await val(`games/${G}/handovers/${id}/undoneAt`)).toBeGreaterThan(0);
    expect((await lastChat()).text).toContain("rückgängig");
    expect(await ok(admin, "undo", { handoverId: id })).toEqual({}); // Wiederholung harmlos
  });
  it("Strafübergabe; Rückgängig nach Ablauf der Frist geht nicht", async () => {
    await set(`games/${G}/locks`, null);
    const r = await ok(admin, "handover", { to: team.d!.id, type: "strafe", expectedMrx: team.b!.id, requestId: "strafe-001" });
    expect((await lastChat()).text).toContain("Strafübergabe");
    await set(`games/${G}/handovers/${r.handoverId as string}/at`, Date.now() - 3 * MIN);
    expect(reason(await run(schiri, "undo", { handoverId: r.handoverId }))).toBe("tooLate");
    expect((await state()).mrx).toBe(team.d!.id);
  });
  it("nur die letzte Übergabe kann rückgängig gemacht werden", async () => {
    await ok(schiri, "handover", { to: team.c!.id, type: "fang", expectedMrx: team.d!.id, requestId: "fang-0004" });
    const older = (await list<{ type: string; to: string; undoneAt?: number }>("handovers")).find(
      ([, h]) => h.to === team.d!.id && !h.undoneAt,
    )![0];
    await set(`games/${G}/handovers/${older}/at`, Date.now() - MIN); // noch in der Frist, aber nicht die letzte
    expect(reason(await run(schiri, "undo", { handoverId: older }))).toBe("conflict");
  });
});

describe("Regeln live ändern, Verkleinerung, Wartezeit von Hand", () => {
  it("nur Spielleitung, nur gültige Werte", async () => {
    expect(reason(await run(schiri, "setConfig", { config: { intervalMin: 5 } }))).toBe("forbidden");
    expect(reason(await run(admin, "setConfig", { config: { intervalMin: 0 } }))).toBe("invalid");
    expect(reason(await run(admin, "setConfig", { config: { hacker: 1 } }))).toBe("invalid");
    expect(reason(await run(admin, "setConfig", { config: { endMinH: 5, endMaxH: 4 } }))).toBe("invalid");
  });
  it("Intervall 10 → 5 Min: nächste Meldung frühestens in 1 Min, Meldung an alle", async () => {
    await set(`games/${G}/state/lastReportAt`, Date.now() - 8 * MIN);
    await ok(admin, "setConfig", { config: { intervalMin: 5 } });
    const s = await state();
    expect(s.nextReportAt - Date.now()).toBeGreaterThan(55_000);
    expect(s.nextReportAt - Date.now()).toBeLessThanOrEqual(MIN);
    expect((await lastChat()).text).toContain("alle 5 Min");
    expect(await val(`games/${G}/config/intervalMin`)).toBe(5);
  });
  it("Spielende-Fenster ändern → neuer geheimer Zeitpunkt im neuen Fenster", async () => {
    const s = await state();
    await ok(admin, "setConfig", { config: { endMinH: 1, endMaxH: 2 } });
    const endAt = await val(`secrets/${G}/endAt`);
    expect(endAt).toBeGreaterThanOrEqual(s.startedAt + 60 * MIN);
    expect(endAt).toBeLessThanOrEqual(s.startedAt + 120 * MIN);
  });
  it("Bereich sperren und freigeben", async () => {
    await ok(admin, "setCut", { cutId: "norden", locked: true });
    expect((await state()).cuts.norden).toBeGreaterThan(0);
    expect((await lastChat()).text).toBe("Das Spielfeld wird verkleinert! Gesperrt: Norden.");
    expect(reason(await run(admin, "setCut", { cutId: "norden", locked: true }))).toBe("conflict");
    expect(reason(await run(admin, "setCut", { cutId: "gibts-nicht", locked: true }))).toBe("invalid");
    await ok(admin, "setCut", { cutId: "osten", locked: true });
    await ok(admin, "setCut", { cutId: "osten", locked: false });
    expect(Object.keys((await state()).cuts)).toEqual(["norden"]);
    expect((await list("cutLog")).map(([, e]) => e)).toMatchObject([
      { cut: "norden", locked: true },
      { cut: "osten", locked: true },
      { cut: "osten", locked: false },
    ]);
  });
  it("Wartezeit von Hand geben und aufheben", async () => {
    await ok(admin, "setLock", { teamId: team.a!.id, min: 3 });
    expect(await val(`games/${G}/locks/${team.a!.id}/reason`)).toBe("manuell");
    await ok(admin, "setLock", { teamId: team.a!.id, min: 0 });
    expect(await val(`games/${G}/locks/${team.a!.id}`)).toBeNull();
    expect(reason(await run(admin, "setLock", { teamId: team.a!.id, min: 99 }))).toBe("invalid");
  });
  it("abgelaufene Wartezeit endet per Alarm", async () => {
    await set(`games/${G}/locks/${team.a!.id}`, { until: Date.now() - 500, reason: "manuell" });
    expect(
      await eventually(
        () => val(`games/${G}/locks/${team.a!.id}`),
        (v) => v === null,
      ),
    ).toBeNull();
  });
});

describe("Sofort-Meldung, Durchsage, Spielende aufdecken", () => {
  it("Sofort-Meldung ändert den Meldeplan nicht", async () => {
    await setPos("c", 0.0009);
    const before = (await state()).nextReportAt;
    const r = await ok(admin, "instantReport");
    expect(r.reportId).toBeTruthy();
    expect((await reports()).at(-1)![1]).toMatchObject({ kind: "sofort", teamId: team.c!.id });
    expect((await state()).nextReportAt).toBe(before);
    expect(reason(await run(schiri, "instantReport"))).toBe("forbidden");
  });
  it("Durchsage nur von der Spielleitung", async () => {
    expect(reason(await run(team.a!, "announce", { text: "Fake" }))).toBe("forbidden");
    await ok(admin, "announce", { text: "Treffpunkt Hauptplatz um 17 Uhr" });
    expect(await lastChat()).toMatchObject({ kind: "ann", text: "Treffpunkt Hauptplatz um 17 Uhr" });
  });
  it("Spielende aufdecken wird protokolliert", async () => {
    expect((await ok(admin, "revealEnd")).endAt).toBe(await val(`secrets/${G}/endAt`));
    const audit = (await list<{ action: string }>("audit")).map(([, a]) => a.action);
    expect(audit).toContain("Spielende aufgedeckt");
    expect(reason(await run(schiri, "revealEnd"))).toBe("forbidden");
  });
});

describe("Pause (F2)", () => {
  it("friert alles ein und verschiebt beim Fortsetzen um die Pausendauer", async () => {
    await ok(admin, "pause");
    expect(await val(`games/${G}/info/phase`)).toBe("pause");
    const mrx = (await state()).mrx;
    expect(reason(await run(schiri, "handover", { to: team.a!.id, type: "fang", expectedMrx: mrx, requestId: "pause-001" }))).toBe(
      "wrongPhase",
    );
    expect(reason(await run(admin, "setLock", { teamId: team.d!.id, min: 5 }))).toBe("wrongPhase");
    // 10 Min Pause simulieren
    const s = await state();
    await set(`games/${G}/state/pausedAt`, s.pausedAt - 10 * MIN);
    await set(`games/${G}/locks/${team.a!.id}`, { until: s.pausedAt + MIN, reason: "uebergabe" });
    const endAt = await val(`secrets/${G}/endAt`);
    const count = (await reports()).length;
    await set(`games/${G}/state/nextReportAt`, Date.now() - 1000);
    expect(await tick(G)).toEqual([]); // in der Pause wird nicht gemeldet
    expect(await reports()).toHaveLength(count);
    await ok(admin, "resume");
    const after = await state();
    expect(after.phase).toBe("laeuft");
    expect(after.pausedAt).toBeUndefined();
    expect(after.nextReportAt - Date.now()).toBeGreaterThan(9 * MIN - 2000);
    expect((await val(`secrets/${G}/endAt`)) - endAt).toBeGreaterThanOrEqual(10 * MIN);
    expect((await val(`games/${G}/locks/${team.a!.id}/until`)) - s.pausedAt).toBeGreaterThanOrEqual(11 * MIN);
    const pauses = await list<{ from: number; to?: number }>("pauses");
    expect(pauses).toHaveLength(1);
    expect(pauses[0]![1].to).toBeGreaterThan(0);
  });
});

describe("Strecke und GPS-Sprünge (Standorte über die Live-Verbindung)", () => {
  it("plausible Bewegung zählt, Sprung wird markiert und zählt nicht", async () => {
    await set(`games/${G}/track/${team.d!.id}`, null);
    const phone = connect(team.d!.token);
    await phone.until(() => true);
    const t0 = Date.now() - 3 * MIN;
    const send = async (dLat: number, t: number) => {
      phone.sendPos(at(dLat, t));
      await sleep(1100); // der Server nimmt höchstens einen Punkt pro Sekunde und Gerät
    };
    await send(0, t0);
    expect(await val(`games/${G}/track/${team.d!.id}/t`)).toBe(t0);
    await send(0.001, t0 + MIN); // 111 m in 60 s
    expect(await val(`games/${G}/stats/${team.d!.id}/distM`)).toBe(111);
    await send(0.03, t0 + MIN + 10_000); // 3 km in 10 s
    expect(await val(`games/${G}/positions/${team.d!.id}/suspect`)).toBe(true);
    await send(0.00105, t0 + 2 * MIN); // 5 m → Rauschen
    expect(await val(`games/${G}/stats/${team.d!.id}/distM`)).toBe(111);
    phone.close();
  });
  it("ungültige Standorte werden verworfen", async () => {
    const phone = connect(team.c!.token);
    await phone.until(() => true);
    const before = await val(`games/${G}/positions/${team.c!.id}`);
    phone.sendPos({ lat: 200, lng: 14, acc: 5, t: Date.now() });
    await sleep(1100);
    phone.sendPos({ lat: 48.3, lng: 14.28, acc: 5, t: Date.now() + 10 * MIN }); // Zukunft
    await sleep(500);
    expect(await val(`games/${G}/positions/${team.c!.id}`)).toEqual(before);
    phone.close();
  });
});

describe("Teams verwalten", () => {
  it("umbenennen (eindeutig), Mister X nicht entfernen", async () => {
    expect(reason(await run(admin, "renameTeam", { teamId: team.d!.id, name: "urfahr" }))).toBe("exists");
    await ok(admin, "renameTeam", { teamId: team.d!.id, name: "Pichling Süd" });
    expect(await val(`games/${G}/teams/${team.d!.id}/name`)).toBe("Pichling Süd");
    expect(await val(`games/${G}/members/${team.d!.uid}/name`)).toBe("Pichling Süd");
    const mrx = (await state()).mrx;
    expect(reason(await run(admin, "removeTeam", { teamId: mrx }))).toBe("conflict");
  });
  it("Gerät entfernen → freundlicher Hinweis über die Verbindung statt Fehler", async () => {
    const phone = connect(schiri2.token);
    await phone.until(() => true);
    await ok(admin, "removeMember", { uid: schiri2.uid });
    expect(await val(`games/${G}/members/${schiri2.uid}`)).toBeNull();
    await eventually(
      async () => phone.bye,
      (b) => b !== null,
    );
    expect(phone.bye).toBe("removed");
    expect(reason(await run(schiri2, "follow", { on: true }))).toBe("session");
  });
});

describe("Spielende (Regel 12, Abschnitt 6.3)", () => {
  it("Neue Runde während des Spiels geht nicht", async () => expect(reason(await run(admin, "resetRound"))).toBe("wrongPhase"));
  it("Zufallsende per Alarm: Auswertung, Archiv, Live-Standorte gelöscht", async () => {
    await set(`games/${G}/staff/${schiri.uid}`, at(0));
    const endAt = Date.now() - 1000;
    await set(`secrets/${G}/endAt`, endAt);
    const s = await eventually(state, (x) => x.phase === "beendet");
    expect(s).toMatchObject({ phase: "beendet", endedAt: endAt });
    const runs = (await ok(admin, "archiveList")).runs as { run: string; winner: string }[];
    expect(runs).toHaveLength(1);
    const teams = await val(`games/${G}/teams`);
    expect(runs[0]).toMatchObject({ run: s.run, winner: teams[s.mrx].name, teams: 4, handovers: 3 });
    const arch = (await ok(admin, "archiveGet", { run: s.run })).archive as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(arch.results.winner).toBe(s.mrx);
    expect(arch.reason).toBe("zufall");
    expect(arch.results.handovers).toBe(3); // Fang + Strafe + Fang; rückgängig gemachte zählen nicht
    expect(Object.values(arch.reports as Record<string, { void?: boolean }>).some((r) => r.void)).toBe(false);
    expect(arch.handovers[Object.keys(arch.handovers)[0]!].prev).toBeUndefined();
    expect(Object.keys(arch.teams)).toHaveLength(4);
    expect(arch.results.farthest).toEqual({ teamId: team.d!.id, m: 111 });
    expect(Object.values(arch.chat as Record<string, { text: string }>).at(-1)!.text).toMatch(/^Spielende!/);
    for (const p of ["positions", "staff", "track", "locks"]) expect(await val(`games/${G}/${p}`)).toEqual({});
    expect(await val(`secrets/${G}/endAt`)).toBeNull();
    expect(await val(`games/${G}/info/phase`)).toBe("beendet");
    expect((await lastChat()).text).toMatch(/^Spielende! .* hat gewonnen!$/);
    expect(await val(`games/${G}/purgeAt`)).toBe(endAt + 30 * 24 * 60 * MIN); // Chat-Löschfrist (F3)
    expect(await tick(G)).toEqual([]);
  });
  it("Zuschauer sehen das Archiv nicht", async () => expect(reason(await run(viewer, "archiveList"))).toBe("forbidden"));
  it("nach dem Ende keine Übergabe und keine Standorte mehr", async () => {
    const s = await state();
    expect(reason(await run(schiri, "handover", { to: team.a!.id, type: "fang", expectedMrx: s.mrx, requestId: "danach-01" }))).toBe(
      "wrongPhase",
    );
    const phone = connect(team.a!.token);
    await phone.until(() => true);
    phone.sendPos(at(0));
    await sleep(500);
    expect(await val(`games/${G}/positions`)).toEqual({});
    phone.close();
  });
  it("Löschfrist: Chat wird geleert", async () => {
    await set(`games/${G}/purgeAt`, Date.now() - 1000);
    await eventually(
      () => val(`games/${G}/chat`),
      (c) => Object.keys(c).length === 0,
    );
    expect(await val(`games/${G}/purgeAt`)).toBeNull();
  });
});

describe("Neue Runde", () => {
  it("Teams und Schiris abgemeldet (mit Hinweis), Team-Passwort gelöscht, Archiv bleibt", async () => {
    expect(reason(await run(team.a!, "resetRound"))).toBe("forbidden");
    const phone = connect(team.a!.token);
    await phone.until(() => true);
    await ok(admin, "resetRound");
    expect(await state()).toMatchObject({ phase: "vorbereitung" });
    for (const p of ["teams", "reports", "handovers", "chat", "pauses", "cutLog", "stats"])
      expect(await val(`games/${G}/${p}`)).toEqual({});
    expect((await ok(admin, "archiveList")).runs).toHaveLength(1);
    expect(await val(`secrets/${G}/teamPw`)).toBeNull();
    expect(await val(`secrets/${G}/schiriCode`)).toMatch(/^pbkdf2\$/);
    await eventually(
      async () => phone.bye,
      (b) => b !== null,
    );
    expect(phone.bye).toBe("removed");
    expect(await val(`games/${G}/members/${schiri.uid}`)).toBeNull();
    expect(await val(`games/${G}/members/${admin.uid}/role`)).toBe("admin");
    expect(await val(`games/${G}/members/${viewer.uid}/role`)).toBe("viewer");
  });
  it("zweite Runde mit Auslosen und Notstopp", async () => {
    await ok(admin, "setSecret", { kind: "teamPw", value: "runde2" });
    const ts: string[] = [];
    for (const name of ["Ebelsberg", "Auwiesen"]) ts.push((await join(G, "team", name, "runde2")).teamId!);
    const { mrx } = await ok(admin, "startGame", { mrx: "random" });
    expect(ts).toContain(mrx);
    expect((await list<{ details: string }>("audit")).at(-1)![1].details).toContain("ausgelost");
    await ok(admin, "stopGame");
    const s = await state();
    expect(s.phase).toBe("beendet");
    const runs = (await ok(admin, "archiveList")).runs as { run: string }[];
    expect(runs).toHaveLength(2);
    expect(((await ok(admin, "archiveGet", { run: s.run })).archive as { reason: string }).reason).toBe("notstopp");
    expect(reason(await run(admin, "stopGame"))).toBe("wrongPhase");
  });
});
