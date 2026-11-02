// Rechte (Abschnitt 6 + 9.2) am Spielraum: Jede Sicht und jede Änderung wird pro Rolle gefiltert – Teams bekommen nie
// fremde Positionen, auch nicht „versteckt“ im Datenverkehr. Dazu Angriffsversuche: Durchsage fälschen, übergeben,
// fremdes Team ändern, mit gefälschtem/widerrufenem Token verbinden, Spam, alte App-Version, Wiederverbinden.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PROTOCOL_VERSION, type ServerMsg, type View } from "@mrx/shared";
import { call, connect, drop, eventually, join, reason, resetServer, SERVER, sleep, superAdminToken, val, type Device } from "./helpers.ts";

const G = "rechte-test";
let admin: Device, schiri: Device, t1: Device, t2: Device, screen: Device, viewer: Device;
const ok = async (d: Device, action: string, extra: Record<string, unknown> = {}) => {
  const r = await call(d.token, { action, gameId: G, ...extra });
  if (r.error) throw new Error(`${action}: ${r.error.message}`);
  return r.result!;
};
const pos = (dLat: number) => ({ lat: 48.3059 + dLat, lng: 14.2862, acc: 8, t: Date.now() });

/** rohe Verbindung: alle Nachrichten als Text mitschreiben (was wirklich über die Leitung geht) */
function raw(token: string, v = PROTOCOL_VERSION) {
  const s = { texts: [] as string[], msgs: [] as ServerMsg[], closed: null as number | null, ws: null as unknown as WebSocket };
  s.ws = new WebSocket(`${SERVER.replace(/^http/, "ws")}/ws?v=${v}`, ["mrx", token]);
  s.ws.onmessage = (e) => {
    s.texts.push(String(e.data));
    if (e.data !== "pong") s.msgs.push(JSON.parse(String(e.data)) as ServerMsg);
  };
  s.ws.onclose = (e) => (s.closed = e.code);
  return s;
}
const snapOf = async (token: string): Promise<View> => {
  const c = connect(token);
  const v = await c.until(() => true);
  c.close();
  return v;
};

const wires: Record<string, ReturnType<typeof raw>> = {};

beforeAll(async () => {
  await resetServer();
  const sa = await superAdminToken();
  await call(sa, { action: "createGame", gameId: G, name: "Rechte", template: "linz", adminPassword: "admin1234" });
  await call(sa, { action: "createGame", gameId: "anderes-spiel", name: "Anderes", template: "linz", adminPassword: "admin1234" });
  admin = await join(G, "admin", "Peter", "admin1234");
  await ok(admin, "setSecret", { kind: "teamPw", value: "falke27" });
  await ok(admin, "setSecret", { kind: "schiriCode", value: "pfeife" });
  t1 = await join(G, "team", "Urfahr", "falke27");
  t2 = await join(G, "team", "Traun", "falke27");
  schiri = await join(G, "schiri", "Anna", "pfeife");
  screen = await join(G, "screen", "", (await ok(admin, "screenLink")).key as string);
  viewer = await join(G, "viewer", "");
  // alle mithören lassen, bevor das Spiel läuft
  for (const [k, d] of Object.entries({ admin, schiri, t1, t2, screen, viewer })) wires[k] = raw(d.token);
  await sleep(300);
  await ok(admin, "startGame", { mrx: t1.teamId });
  const p1 = connect(t1.token);
  const p2 = connect(t2.token);
  const ps = connect(schiri.token);
  await Promise.all([p1.until(() => true), p2.until(() => true), ps.until(() => true)]);
  p1.sendPos(pos(0));
  p2.sendPos(pos(0.01));
  ps.sendPos(pos(0.0001));
  await ok(t2, "chat", { text: "Hallo alle" });
  await ok(t1, "chat", { text: "Nur für die Spielleitung", dm: t1.teamId });
  await ok(admin, "chat", { text: "Traun, alles ok?", dm: t2.teamId });
  await sleep(2600); // Standorte werden gesammelt alle 2 s verteilt
  for (const p of [p1, p2, ps]) p.close();
}, 60_000);

afterAll(() => Object.values(wires).forEach((w) => w.ws.close()));

describe("Sicht beim Verbinden (Snapshot)", () => {
  it("Live-Positionen nur für Spielleitung, Schiri, Großbild", async () => {
    for (const d of [admin, schiri, screen]) {
      const v = await snapOf(d.token);
      expect(Object.keys(v.positions!)).toEqual(expect.arrayContaining([t1.teamId, t2.teamId]));
      expect(v.staff![schiri.uid]).toMatchObject({ name: "Anna" });
    }
    for (const d of [t1, t2, viewer]) {
      const v = await snapOf(d.token);
      expect(v.positions).toBeUndefined();
      expect(v.staff).toBeUndefined();
    }
  });
  it("Mitgliederliste und Protokoll nur für die Spielleitung", async () => {
    expect(Object.keys((await snapOf(admin.token)).members!)).toHaveLength(6);
    for (const d of [schiri, t1, screen, viewer]) {
      const v = await snapOf(d.token);
      expect(v.members).toBeUndefined();
      expect(v.audit).toBeUndefined();
    }
  });
  it("Chat für alle außer Zuschauer; Direktkanal nur eigenes Team und Spielleitung", async () => {
    expect((await snapOf(viewer.token)).chat).toBeUndefined();
    const v1 = await snapOf(t1.token);
    expect(Object.keys(v1.dm!)).toEqual([t1.teamId]);
    expect(Object.values(v1.chat!).some((m) => m.text === "Hallo alle")).toBe(true);
    const v2 = await snapOf(t2.token);
    expect(Object.keys(v2.dm!)).toEqual([t2.teamId]);
    expect(JSON.stringify(v2)).not.toContain("Nur für die Spielleitung");
    expect(Object.keys((await snapOf(admin.token)).dm!).sort()).toEqual([t1.teamId, t2.teamId].sort());
    expect((await snapOf(schiri.token)).dm).toBeUndefined();
  });
  it("Geheimes nie: Passwort-Hashes, geheimes Spielende, Streckenpunkte, Push-Abos anderer, Rate-Limits", async () => {
    const endAt = String(await val(`secrets/${G}/endAt`));
    for (const d of [admin, schiri, t1, screen, viewer]) {
      const s = JSON.stringify(await snapOf(d.token));
      expect(s).not.toContain("pbkdf2");
      expect(s).not.toContain(endAt);
      for (const k of ["secrets", "track", "rate", "push"]) expect(JSON.parse(s)).not.toHaveProperty(k);
    }
  });
  it("eigene Rolle und Name im Snapshot", async () =>
    expect((await snapOf(t1.token)).me).toMatchObject({ role: "team", teamId: t1.teamId, uid: t1.uid, name: "Urfahr" }));
});

describe("Datenverkehr (Änderungen): nie mehr als erlaubt", () => {
  it("Teams und Zuschauer bekommen keine einzige Position, kein Mitglied, kein Protokoll", () => {
    for (const k of ["t1", "t2", "viewer"]) {
      const w = wires[k]!;
      expect(w.msgs.length).toBeGreaterThan(1);
      for (const m of w.msgs) {
        if (m.t === "snap") expect(m.view.positions).toBeUndefined();
        if (m.t === "patch") for (const [key] of m.p) expect(["positions", "staff", "members", "audit"]).not.toContain(key);
      }
      // auch nicht versteckt: Koordinaten der anderen kommen nirgends vor
      expect(w.texts.join("\n")).not.toContain(String(48.3059 + 0.01));
    }
  });
  it("Spielleitung, Schiri und Großbild bekommen die Positionen gesammelt", () => {
    for (const k of ["admin", "schiri", "screen"]) {
      const keys = wires[k]!.msgs.flatMap((m) => (m.t === "patch" ? m.p.map((p) => p[0]) : []));
      expect(keys).toContain("positions");
    }
  });
  it("Direktnachrichten nur an das eigene Team", () => {
    expect(wires.t2!.texts.join("\n")).not.toContain("Nur für die Spielleitung");
    expect(wires.t1!.texts.join("\n")).not.toContain("Traun, alles ok?");
    expect(wires.admin!.texts.join("\n")).toContain("Nur für die Spielleitung");
  });
  it("fortlaufende Nummern und Server-Zeit in jeder Nachricht", () => {
    const seqs = wires.t1!.msgs.map((m) => ("seq" in m ? m.seq : -1));
    expect(seqs).toEqual(seqs.map((_, i) => i + 1));
    for (const m of wires.t1!.msgs) if ("now" in m) expect(Math.abs(m.now - Date.now())).toBeLessThan(60_000);
  });
});

describe("Spielleitung blendet die Jäger für Schiris aus", () => {
  const fullPositions = (w: ReturnType<typeof raw>) =>
    w.msgs.flatMap((m) => (m.t === "patch" ? m.p.filter((p) => p[0] === "positions" && p[1] === null).map((p) => p[2] as object) : []));
  it("Schiri bekommt nur noch Mister X – im Snapshot und im Datenverkehr; die Spielleitung sieht weiter alle", async () => {
    const w = raw(schiri.token);
    await sleep(300);
    await ok(admin, "setConfig", { config: { refereeHunters: false } });
    expect(Object.keys((await snapOf(schiri.token)).positions!)).toEqual([t1.teamId]); // Urfahr ist Mister X
    expect(Object.keys((await snapOf(admin.token)).positions!)).toEqual(expect.arrayContaining([t1.teamId, t2.teamId]));
    // die offene Verbindung bekommt sofort die gekürzte Liste
    await eventually(
      async () => fullPositions(w).length,
      (n) => n > 0,
    );
    expect(Object.keys(fullPositions(w).at(-1)!)).toEqual([t1.teamId]);
    // ein Jäger bewegt sich: beim Schiri kommt nichts davon an
    const p2 = connect(t2.token);
    await p2.until(() => true);
    p2.sendPos(pos(0.03));
    await sleep(2600);
    p2.close();
    expect(w.texts.join("\n")).not.toContain(String(48.3059 + 0.03));
    // neuer Mister X: der Schiri bekommt dessen Standort, der alte verschwindet
    await ok(schiri, "handover", { to: t2.teamId, type: "fang", expectedMrx: t1.teamId, requestId: "jaeger-aus-01" });
    expect(Object.keys((await snapOf(schiri.token)).positions!)).toEqual([t2.teamId]);
    expect(Object.keys(fullPositions(w).at(-1)!)).toEqual([t2.teamId]);
    await ok(schiri, "undo", { handoverId: await val(`games/${G}/state/lastHandover`) });
    expect(Object.keys((await snapOf(schiri.token)).positions!)).toEqual([t1.teamId]);
    // wieder an: alle Jäger sofort zurück
    await ok(admin, "setConfig", { config: { refereeHunters: true } });
    await eventually(
      async () => Object.keys(fullPositions(w).at(-1)!).length,
      (n) => n >= 2,
    );
    expect(Object.keys((await snapOf(schiri.token)).positions!)).toEqual(expect.arrayContaining([t1.teamId, t2.teamId]));
    w.ws.close();
  });
  it("nur die Spielleitung darf den Schalter umlegen", async () => {
    for (const d of [t1, schiri])
      expect(reason(await call(d.token, { action: "setConfig", gameId: G, config: { refereeHunters: false } }))).toBe("forbidden");
  });
});

describe("Angriffsversuche", () => {
  it("Team versucht Durchsage, Übergabe, Sperre, Spielende, Einstellungen, Protokoll", async () => {
    const st = await val(`games/${G}/state`);
    for (const [action, extra] of [
      ["announce", { text: "Spiel vorbei!" }],
      ["handover", { to: t2.teamId, type: "fang", expectedMrx: st.mrx, requestId: "angriff-01" }],
      ["undo", { handoverId: "angriff-01" }],
      ["setCut", { cutId: "norden", locked: true }],
      ["stopGame", {}],
      ["revealEnd", {}],
      ["setConfig", { config: { waitMin: 0 } }],
      ["setLock", { teamId: t1.teamId, min: 30 }],
      ["instantReport", {}],
      ["screenLink", {}],
      ["resetRound", {}],
    ] as const)
      expect([action, reason(await call(t2.token, { action, gameId: G, ...extra }))]).toEqual([action, "forbidden"]);
  });
  it("Team ändert fremdes Team nicht (umbenennen, entfernen, Geräte entfernen)", async () => {
    expect(reason(await call(t2.token, { action: "renameTeam", gameId: G, teamId: t1.teamId, name: "Verlierer" }))).toBe("forbidden");
    expect(reason(await call(t2.token, { action: "removeTeam", gameId: G, teamId: t1.teamId }))).toBe("forbidden");
    expect(reason(await call(t2.token, { action: "removeMember", gameId: G, uid: t1.uid }))).toBe("forbidden");
    expect(await val(`games/${G}/teams/${t1.teamId}/name`)).toBe("Urfahr");
  });
  it("System-Meldung oder fremden Namen im Chat fälschen geht nicht", async () => {
    const { id } = await ok(t2, "chat", { text: "Mister X ist gefangen!", kind: "sys", name: "System", uid: "system", teamId: t1.teamId });
    const m = await val(`games/${G}/chat/${id as string}`);
    expect(m).toMatchObject({ kind: "msg", name: "Traun", uid: t2.uid, teamId: t2.teamId });
  });
  it("Direktkanal eines anderen Teams: weder schreiben noch löschen", async () => {
    await sleep(2100);
    expect(reason(await call(t2.token, { action: "chat", gameId: G, text: "Hallo", dm: t1.teamId }))).toBe("forbidden");
    const id = Object.keys(await val(`games/${G}/dm/${t1.teamId}`))[0];
    expect(reason(await call(t2.token, { action: "deleteChat", gameId: G, id, dm: t1.teamId }))).toBe("forbidden");
  });
  it("Zuschauer und Großbild schreiben nicht in den Chat", async () => {
    expect(reason(await call(viewer.token, { action: "chat", gameId: G, text: "Hi" }))).toBe("forbidden");
    expect(reason(await call(screen.token, { action: "chat", gameId: G, text: "Hi" }))).toBe("forbidden");
  });
  it("Spam: zweite Nachricht innerhalb von 2 s abgelehnt", async () => {
    await sleep(2100);
    await ok(t1, "chat", { text: "Eins" });
    expect(reason(await call(t1.token, { action: "chat", gameId: G, text: "Zwei" }))).toBe("tooMany");
  });
  it("Moderation: nur die Spielleitung löscht Nachrichten", async () => {
    const [id] = Object.entries(await val(`games/${G}/chat`)).find(([, m]) => (m as { text: string }).text === "Eins")!;
    expect(reason(await call(t2.token, { action: "deleteChat", gameId: G, id }))).toBe("forbidden");
    await ok(admin, "deleteChat", { id });
    expect(await val(`games/${G}/chat/${id}`)).toBeNull();
  });
  it("Standort nur für das eigene Team, egal was mitgeschickt wird", async () => {
    const before = await val(`games/${G}/positions/${t1.teamId}`);
    const p2 = connect(t2.token);
    await p2.until(() => true);
    await sleep(1100);
    p2.sendPos({ ...pos(0.02), teamId: t1.teamId, uid: t1.uid } as never);
    await sleep(300);
    expect(await val(`games/${G}/positions/${t1.teamId}`)).toEqual(before);
    expect((await val(`games/${G}/positions/${t2.teamId}`)).lat).toBeCloseTo(48.3259, 4);
    p2.close();
  });
  it("Zuschauer und Großbild senden keinen Standort", async () => {
    const v = connect(viewer.token);
    await v.until(() => true);
    v.sendPos(pos(0.05));
    await sleep(300);
    expect(JSON.stringify(await val(`games/${G}/positions`))).not.toContain(String(48.3059 + 0.05));
    expect(JSON.stringify(await val(`games/${G}/staff`))).not.toContain(String(48.3059 + 0.05));
    v.close();
  });
  it("Admin eines anderen Spiels hat hier keine Rechte", async () => {
    const other = await join("anderes-spiel", "admin", "Fremd", "admin1234");
    expect(reason(await call(other.token, { action: "announce", gameId: G, text: "Hallo" }))).toBe("unauthenticated");
    const w = raw(other.token);
    await eventually(
      async () => w.msgs.length,
      (n) => n > 0,
    );
    expect(w.msgs[0]!.t === "snap" && w.msgs[0].view.info.name).toBe("Anderes"); // verbunden mit dem eigenen Spiel
    w.ws.close();
  });
});

describe("Verbindung: Token, Version, Wiederverbinden", () => {
  it("gefälschtes Token → Hinweis „Sitzung“ und Ende", async () => {
    const [body] = t1.token.split(".");
    const w = raw(`${body}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`);
    await eventually(
      async () => w.closed,
      (c) => c !== null,
    );
    expect(w.msgs).toEqual([{ t: "bye", reason: "session" }]);
    expect(w.closed).toBe(4002);
  });
  it("Token eines entfernten Geräts → „Sitzung“", async () => {
    const d = await join(G, "team", "Urfahr", "falke27", { secondDevice: true });
    await ok(admin, "removeMember", { uid: d.uid });
    const w = raw(d.token);
    await eventually(
      async () => w.closed,
      (c) => c !== null,
    );
    expect(w.msgs).toEqual([{ t: "bye", reason: "session" }]);
  });
  it("alte App-Version → freundlich zum Neuladen auffordern", async () => {
    const w = raw(t1.token, 0);
    await eventually(
      async () => w.closed,
      (c) => c !== null,
    );
    expect(w.msgs).toEqual([{ t: "bye", reason: "version" }]);
    expect(w.closed).toBe(4003);
  });
  it("Herzschlag ping → pong (ohne den Spielraum aufzuwecken)", async () => {
    const w = raw(t1.token);
    await eventually(
      async () => w.msgs.length,
      (n) => n > 0,
    );
    w.ws.send("ping");
    await eventually(
      async () => w.texts.includes("pong"),
      (x) => x,
    );
    w.ws.close();
  });
  it("Lücke/Neustart: „resync“ liefert einen frischen Snapshot mit neuer Zählung", async () => {
    const w = raw(t1.token);
    await eventually(
      async () => w.msgs.length,
      (n) => n > 0,
    );
    await ok(admin, "announce", { text: "Test" });
    await eventually(
      async () => w.msgs.length,
      (n) => n > 1,
    );
    w.ws.send(JSON.stringify({ t: "resync" }));
    await eventually(
      async () => w.msgs.at(-1)!.t,
      (t) => t === "snap",
    );
    expect(w.msgs.at(-1)).toMatchObject({ t: "snap", seq: 1 });
    w.ws.close();
  });
  it("Client-Bibliothek: nach Verbindungsabbruch automatisch wieder verbunden, wartender Standort wird nachgesendet", async () => {
    const c = connect(t2.token);
    await c.until(() => true);
    const snaps = () => wires.t2!.msgs.filter((m) => m.t === "snap").length;
    expect(snaps()).toBe(1);
    await drop(G);
    await eventually(
      async () => c.live.online,
      (on) => !on,
      3000,
    );
    c.sendPos(pos(0.004)); // offline → wartet
    // wieder online (1 s Pause), frischer Snapshot, Standort angekommen
    await eventually(
      async () => c.live.online,
      (on) => on,
      5000,
    );
    await eventually(
      () => val(`games/${G}/positions/${t2.teamId}/lat`),
      (lat) => Math.abs(lat - 48.3099) < 1e-6,
      5000,
    );
    expect(c.bye).toBeNull();
    c.close();
  });
});
