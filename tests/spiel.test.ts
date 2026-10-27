// Spielablauf am Server (Meilenstein 4) gegen die Emulatoren: Start, Meldungen mit Standort-Fallback, Übergabe mit
// Umkreis-Wartezeit, doppelte/gleichzeitige Anfragen, Rückgängig, Regeländerung, Verkleinerung, Pause, Sofort-Meldung,
// Strecke + GPS-Sprünge, Spielende mit Archiv und gelöschten Standorten, Notstopp, Neue Runde.
// „Zeitraffer“: Termine werden direkt in der Datenbank vorverlegt, dann stößt ein Handy mit `poke` an.
import { beforeAll, describe, expect, it } from "vitest";
import { call, db, device, reason, resetEmulators, superAdminToken, val } from "./helpers.ts";

const G = "linz-spiel";
const MIN = 60_000;
type Dev = { uid: string; token: string };
let admin: Dev, schiri: Dev, schiri2: Dev, viewer: Dev;
const team: Record<string, Dev & { id: string }> = {};

const run = (d: Dev, action: string, extra: Record<string, unknown> = {}) => call(d.token, { action, gameId: G, ...extra });
const ok = async (d: Dev, action: string, extra: Record<string, unknown> = {}) => {
  const r = await run(d, action, extra);
  if (r.error) throw new Error(`${action}: ${r.error.message}`);
  return r.result!;
};
// Hauptplatz Linz; 0,00045° Breite ≈ 50 m
const at = (dLat: number, t = Date.now()) => ({ lat: 48.3059 + dLat, lng: 14.2862, acc: 8, t });
const setPos = (k: string, dLat: number, t?: number) => db.ref(`games/${G}/pos/${team[k]!.id}`).set(at(dLat, t));
const state = () => val(`games/${G}/state`);
const list = async <T>(p: string): Promise<[string, T][]> => Object.entries(((await val(`games/${G}/${p}`)) ?? {}) as Record<string, T>);
const lastChat = async () => (await list<{ text: string; kind: string; reportId?: string }>("chat")).at(-1)![1];
const reports = () => list<{ teamId: string; src: string; kind: string; void?: boolean; posAt: number }>("reports");

beforeAll(async () => {
  await resetEmulators();
  const sa = await superAdminToken();
  await call(sa, { action: "createGame", gameId: G, name: "Spiel-Test", template: "linz", adminPassword: "admin1234" });
  admin = await device();
  await ok(admin, "join", { role: "admin", name: "Peter", secret: "admin1234" });
  await ok(admin, "setSecret", { kind: "teamPw", value: "falke27" });
  await ok(admin, "setSecret", { kind: "schiriCode", value: "pfeife" });
  for (const [k, name] of [
    ["a", "Urfahr"],
    ["b", "Traun"],
    ["c", "Leonding"],
    ["d", "Pichling"],
  ] as const) {
    const d = await device();
    const r = await ok(d, "join", { role: "team", name, secret: "falke27" });
    team[k] = { ...d, id: r.teamId as string };
  }
  schiri = await device();
  await ok(schiri, "join", { role: "schiri", name: "Anna", secret: "pfeife" });
  schiri2 = await device();
  await ok(schiri2, "join", { role: "schiri", name: "Ben", secret: "pfeife" });
  viewer = await device();
  await ok(viewer, "join", { role: "viewer", name: "" });
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
    expect(await val(`running/${G}`)).toBe(true);
    expect(await val(`games/${G}/info/phase`)).toBe("laeuft");
    expect((await lastChat()).text).toContain("Urfahr ist Mister X");
  });
  it("zweimal starten geht nicht", async () => expect(reason(await run(admin, "startGame", { mrx: "random" }))).toBe("wrongPhase"));
});

describe("Meldungen (Regel 5, Abschnitt 4.3)", () => {
  it("noch nicht fällig → nichts", async () => expect(await ok(team.b!, "poke")).toEqual({ done: [] }));
  it("fällig → genau eine Meldung, auch wenn viele Handys gleichzeitig anstoßen", async () => {
    await db.ref(`games/${G}/locks`).set(null); // Vorsprung vorbei
    await setPos("a", 0);
    const due = Date.now() - 1000;
    await db.ref(`games/${G}/state/nextReportAt`).set(due);
    const all = await Promise.all([team.a, team.b, team.c, team.d, viewer, schiri].map((d) => run(d!, "poke")));
    expect(all.filter((r) => (r.result?.done as string[])?.includes("meldung"))).toHaveLength(1);
    const rs = await reports();
    expect(rs).toHaveLength(1);
    expect(rs[0]![1]).toMatchObject({ teamId: team.a!.id, src: "handy", kind: "auto" });
    expect((await state()).nextReportAt).toBe(due + 10 * MIN);
    const c = await lastChat();
    expect(c).toMatchObject({ kind: "sys", reportId: rs[0]![0] });
  });
  it("Mister-X-Handy ohne frischen Standort → Schiri, der der Fahne folgt", async () => {
    expect(reason(await run(team.a!, "follow", { on: true }))).toBe("forbidden");
    await ok(schiri, "follow", { on: true });
    await setPos("a", 0, Date.now() - 5 * MIN);
    await db.ref(`games/${G}/staffPos/${schiri.uid}`).set(at(0.0001));
    await db.ref(`games/${G}/state/nextReportAt`).set(Date.now() - 1000);
    expect(await ok(team.c!, "poke")).toEqual({ done: ["meldung"] });
    expect((await reports()).at(-1)![1]).toMatchObject({ src: "schiri" });
    expect((await lastChat()).text).toContain("Standort vom Schiri");
  });
  it("gar nichts frisch → letzter bekannter Standort mit Uhrzeit", async () => {
    await ok(schiri, "follow", { on: false });
    await db.ref(`games/${G}/state/nextReportAt`).set(Date.now() - 1000);
    await ok(team.c!, "poke");
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
    await db.ref(`games/${G}/locks/${team.b!.id}`).set({ until: Date.now() + MIN, reason: "manuell" });
    const r = await ok(schiri, "handover", { to: team.b!.id, type: "fang", expectedMrx: team.a!.id, requestId: "fang-0001" });
    hid = r.handoverId as string;
    expect((r.locked as string[]).sort()).toEqual([team.a!.id, team.c!.id].sort());
    const s = await state();
    expect(s.mrx).toBe(team.b!.id);
    expect(s.nextReportAt - s.lastReportAt).toBe(10 * MIN);
    const locks = await val(`games/${G}/locks`);
    expect(Object.keys(locks).sort()).toEqual([team.a!.id, team.c!.id].sort());
    expect(locks[team.a!.id].until - Date.now()).toBeGreaterThan(4 * MIN);
    const rep = (await reports()).at(-1)![1];
    expect(rep).toMatchObject({ teamId: team.b!.id, kind: "uebergabe", src: "handy" });
    expect((await lastChat()).text).toBe("Traun hat Urfahr gefangen und ist jetzt Mister X! 5 Min Wartezeit in der Nähe.");
  });
  it("dieselbe Anfrage nach Netzabbruch nochmal → nichts doppelt", async () => {
    const r = await ok(schiri, "handover", { to: team.b!.id, type: "fang", expectedMrx: team.a!.id, requestId: "fang-0001" });
    expect(r.handoverId).toBe(hid);
    expect((await list("handovers")).length).toBe(2); // Start + 1
  });
  it("zweiter Schiri gleichzeitig mit veraltetem Stand → abgelehnt", async () =>
    expect(reason(await run(schiri2, "handover", { to: team.c!.id, type: "fang", expectedMrx: team.a!.id, requestId: "fang-0002" }))).toBe(
      "conflict",
    ));
  it("Rückgängig: Zustand, Wartezeiten und Meldung wie vorher", async () => {
    expect(reason(await run(team.a!, "undo", { handoverId: hid }))).toBe("forbidden");
    await ok(admin, "undo", { handoverId: hid });
    const s = await state();
    expect(s.mrx).toBe(team.a!.id);
    expect(s.lastHandover).toBeUndefined();
    expect(await val(`games/${G}/locks`)).toEqual({ [team.b!.id]: expect.objectContaining({ reason: "manuell" }) });
    expect((await reports()).at(-1)![1].void).toBe(true);
    expect(await val(`games/${G}/handovers/${hid}/undoneAt`)).toBeGreaterThan(0);
    expect((await lastChat()).text).toContain("rückgängig");
    expect(await ok(admin, "undo", { handoverId: hid })).toEqual({}); // Wiederholung harmlos
  });
  it("Strafübergabe; Rückgängig nach Ablauf der Frist geht nicht", async () => {
    await db.ref(`games/${G}/locks`).set(null);
    const r = await ok(admin, "handover", { to: team.d!.id, type: "strafe", expectedMrx: team.a!.id, requestId: "strafe-001" });
    expect((await lastChat()).text).toContain("Strafübergabe");
    await db.ref(`games/${G}/handovers/${r.handoverId}/at`).set(Date.now() - 3 * MIN);
    expect(reason(await run(schiri, "undo", { handoverId: r.handoverId }))).toBe("tooLate");
    expect((await state()).mrx).toBe(team.d!.id);
  });
  it("nur die letzte Übergabe kann rückgängig gemacht werden", async () => {
    await ok(schiri, "handover", { to: team.c!.id, type: "fang", expectedMrx: team.d!.id, requestId: "fang-0003" });
    const older = (await list<{ type: string; to: string }>("handovers")).find(([, h]) => h.to === team.d!.id)![0];
    await db.ref(`games/${G}/handovers/${older}/at`).set(Date.now() - MIN); // noch in der Frist, aber nicht die letzte
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
    const last = Date.now() - 8 * MIN;
    await db.ref(`games/${G}/state/lastReportAt`).set(last);
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
    expect(reason(await run(schiri, "handover", { to: team.a!.id, type: "fang", expectedMrx: team.c!.id, requestId: "pause-001" }))).toBe(
      "wrongPhase",
    );
    expect(reason(await run(admin, "setLock", { teamId: team.d!.id, min: 5 }))).toBe("wrongPhase");
    // 10 Min Pause simulieren
    const s = await state();
    await db.ref(`games/${G}/state/pausedAt`).set(s.pausedAt - 10 * MIN);
    await db.ref(`games/${G}/locks/${team.a!.id}`).set({ until: s.pausedAt + MIN, reason: "uebergabe" });
    const endAt = await val(`secrets/${G}/endAt`);
    await db.ref(`games/${G}/state/nextReportAt`).set(Date.now() - 1000);
    expect(await ok(team.a!, "poke")).toEqual({ done: [] }); // in der Pause wird nicht gemeldet
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

describe("Strecke und GPS-Sprünge (onPosition)", () => {
  it("plausible Bewegung zählt, Sprung wird markiert und zählt nicht", async () => {
    // Zeitstempel nach allen früheren Testschritten – verspätet zugestellte ältere Ereignisse zählen so sicher nicht
    const t0 = Date.now() + 10 * MIN;
    await db.ref(`games/${G}/track/${team.d!.id}`).set(null);
    await setPos("d", 0, t0);
    await expect.poll(() => val(`games/${G}/track/${team.d!.id}/t`), { timeout: 10_000 }).toBe(t0);
    await setPos("d", 0.001, t0 + MIN); // 111 m in 60 s
    await expect.poll(() => val(`games/${G}/stats/${team.d!.id}/distM`), { timeout: 10_000 }).toBe(111);
    await setPos("d", 0.03, t0 + MIN + 10_000); // 3 km in 10 s
    await expect.poll(() => val(`games/${G}/pos/${team.d!.id}/suspect`), { timeout: 10_000 }).toBe(true);
    await setPos("d", 0.00105, t0 + 2 * MIN); // 5 m → Rauschen
    await new Promise((r) => setTimeout(r, 1500));
    expect(await val(`games/${G}/stats/${team.d!.id}/distM`)).toBe(111);
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
  it("Gerät entfernen → freundlicher Hinweis statt Fehler", async () => {
    await ok(admin, "removeMember", { uid: schiri2.uid });
    expect(await val(`games/${G}/members/${schiri2.uid}`)).toBeNull();
    expect(await val(`userGames/${schiri2.uid}`)).toEqual({ removedFrom: G });
  });
});

describe("Spielende (Regel 12, Abschnitt 6.3)", () => {
  it("Neue Runde während des Spiels geht nicht", async () => expect(reason(await run(admin, "resetRound"))).toBe("wrongPhase"));
  it("Zufallsende: Auswertung, Archiv, Live-Standorte gelöscht", async () => {
    await db.ref(`games/${G}/staffPos/${schiri.uid}`).set(at(0));
    const endAt = Date.now() - 1000;
    await db.ref(`secrets/${G}/endAt`).set(endAt);
    expect(await ok(viewer, "poke")).toEqual({ done: ["ende"] });
    const s = await state();
    expect(s).toMatchObject({ phase: "beendet", endedAt: endAt });
    const arch = await val(`games/${G}/archive/${s.run}`);
    expect(arch.results.winner).toBe(s.mrx);
    expect(arch.reason).toBe("zufall");
    expect(arch.results.handovers).toBe(2); // Strafe + Fang; die rückgängig gemachte zählt nicht
    expect(Object.values(arch.reports as Record<string, { void?: boolean }>).some((r) => r.void)).toBe(false);
    expect(arch.handovers[Object.keys(arch.handovers)[0]!].prev).toBeUndefined();
    expect(Object.keys(arch.teams)).toHaveLength(4);
    expect(arch.results.farthest).toEqual({ teamId: team.d!.id, m: 111 });
    for (const p of ["pos", "staffPos", "trackerPos", "track", "locks"]) expect(await val(`games/${G}/${p}`)).toBeNull();
    expect(await val(`running/${G}`)).toBeNull();
    expect(await val(`secrets/${G}/endAt`)).toBeNull();
    expect(await val(`games/${G}/info/phase`)).toBe("beendet");
    expect((await lastChat()).text).toMatch(/^Spielende! .* hat gewonnen!$/);
    expect(await ok(viewer, "poke")).toEqual({ done: [] });
  });
  it("nach dem Ende keine Übergabe mehr", async () => {
    const s = await state();
    expect(reason(await run(schiri, "handover", { to: team.a!.id, type: "fang", expectedMrx: s.mrx, requestId: "danach-01" }))).toBe(
      "wrongPhase",
    );
  });
});

describe("Neue Runde", () => {
  it("Teams und Schiris abgemeldet, Team-Passwort gelöscht, Archiv bleibt", async () => {
    expect(reason(await run(team.a!, "resetRound"))).toBe("forbidden");
    await ok(admin, "resetRound");
    expect(await state()).toMatchObject({ phase: "vorbereitung" });
    for (const p of ["teams", "reports", "handovers", "chat", "pauses", "cutLog", "stats"]) expect(await val(`games/${G}/${p}`)).toBeNull();
    expect(Object.keys(await val(`games/${G}/archive`))).toHaveLength(1);
    expect(await val(`secrets/${G}/teamPw`)).toBeNull();
    expect(await val(`secrets/${G}/schiriCode`)).toMatch(/^scrypt\$/);
    expect(await val(`userGames/${team.a!.uid}`)).toEqual({ removedFrom: G });
    expect(await val(`userGames/${schiri.uid}`)).toEqual({ removedFrom: G });
    expect(await val(`games/${G}/members/${admin.uid}/role`)).toBe("admin");
    expect(await val(`games/${G}/members/${viewer.uid}/role`)).toBe("viewer");
  });
  it("zweite Runde mit Auslosen und Notstopp", async () => {
    await ok(admin, "setSecret", { kind: "teamPw", value: "runde2" });
    const ts: string[] = [];
    for (const name of ["Ebelsberg", "Auwiesen"]) {
      const d = await device();
      ts.push((await ok(d, "join", { role: "team", name, secret: "runde2" })).teamId as string);
    }
    const { mrx } = await ok(admin, "startGame", { mrx: "random" });
    expect(ts).toContain(mrx);
    expect((await list<{ details: string }>("audit")).at(-1)![1].details).toContain("ausgelost");
    await ok(admin, "stopGame");
    const s = await state();
    expect(s.phase).toBe("beendet");
    expect((await val(`games/${G}/archive/${s.run}`)).reason).toBe("notstopp");
    expect(Object.keys(await val(`games/${G}/archive`))).toHaveLength(2);
    expect(reason(await run(admin, "stopGame"))).toBe("wrongPhase");
  });
});
