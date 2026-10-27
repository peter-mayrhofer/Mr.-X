// Lasttest (Abschnitt 9.3, Meilenstein 12): 30 Teams mit 36 Handys, 10 Schiris, Spielleitung und 2 Großbilder an einem
// Spielraum. Im Zeitraffer sendet jedes Handy etwa jede Sekunde seinen Standort (≈ 11× öfter als im Spiel), dazwischen
// Meldungen, Übergabe, Chat, Durchsage, Verkleinerung. Gemessen wird, was Cloudflare zählt (Anfragen, eingehende
// Nachrichten, geschriebene Zeilen, Alarme) und was an die Geräte geht – hochgerechnet auf 4 Stunden
// (Ergebnis in docs/CLOUDFLARE-LIMITS.md §5). Dauer des Zeitraffers: MRX_LAST_S (Standard 60 s).
import { beforeAll, describe, expect, it } from "vitest";
import type { View } from "@mrx/shared";
import { call, connect, join, resetServer, set, sleep, superAdminToken, usage, type Device } from "./helpers.ts";

const G = "linz-last";
const LOAD_S = Number(process.env.MRX_LAST_S ?? 60);
/** etwas über 1 s, weil der Server pro Gerät höchstens einen Standort pro Sekunde nimmt */
const EVERY_MS = 1100;
const REAL_EVERY_MS = 12_000;
const HAUPTPLATZ = { lat: 48.3059, lng: 14.2862 };

let admin: Device;
const teams: { name: string; teamId: string; phones: Device[] }[] = [];
const schiris: Device[] = [];
const screens: Device[] = [];
const ok = async (d: Device, action: string, extra: Record<string, unknown> = {}) => {
  const r = await call(d.token, { action, gameId: G, ...extra });
  if (r.error) throw new Error(`${action}: ${r.error.message}`);
  return r.result!;
};
const pct = (a: number[], q: number) => a.sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * q))] ?? NaN;

beforeAll(async () => {
  await resetServer();
  const sa = await superAdminToken();
  await call(sa, { action: "createGame", gameId: G, name: "Lasttest", template: "linz", adminPassword: "admin1234" });
  admin = await join(G, "admin", "Peter", "admin1234");
  await ok(admin, "setSecret", { kind: "teamPw", value: "falke27" });
  await ok(admin, "setSecret", { kind: "schiriCode", value: "pfeife" });
  for (let i = 1; i <= 30; i++) {
    const name = `Team ${String(i).padStart(2, "0")}`;
    const d = await join(G, "team", name, "falke27");
    teams.push({ name, teamId: d.teamId!, phones: [d] });
  }
  // 6 Teams mit zweitem Handy → 36 Team-Handys
  for (const t of teams.slice(0, 6)) t.phones.push(await join(G, "team", t.name, "falke27", { secondDevice: true }));
  for (let i = 1; i <= 10; i++) schiris.push(await join(G, "schiri", `Schiri ${i}`, "pfeife"));
  const key = (await ok(admin, "screenLink")).key as string;
  for (let i = 0; i < 2; i++) screens.push(await join(G, "screen", "", key));
}, 120_000);

describe("Lasttest: 30 Teams, 49 Geräte", () => {
  it(
    "hält den Zeitraffer durch, verteilt Standorte schnell und bleibt weit unter den Gratis-Limits",
    async () => {
      // Spielleitung misst, wie alt ein Standort ist, wenn er bei ihr ankommt
      const seen = new Map<string, number>();
      const delays: number[] = [];
      const adminLive = connect(admin.token, (v: View) => {
        for (const [id, p] of Object.entries(v.positions ?? {}))
          if (p.t > (seen.get(id) ?? 0)) {
            seen.set(id, p.t);
            delays.push(Date.now() - p.t);
          }
      });
      const teamLive = teams.flatMap((t) => t.phones.map((d) => connect(d.token)));
      const schiriLive = schiris.map((d) => connect(d.token));
      const screenLive = screens.map((d) => connect(d.token));
      const all = [adminLive, ...teamLive, ...schiriLive, ...screenLive];
      await Promise.all(all.map((c) => c.until(() => true, 15_000)));
      expect(all).toHaveLength(49);

      await ok(admin, "startGame", { mrx: teams[0]!.teamId });
      await set(`games/${G}/locks`, null);
      const before = await usage(G);
      const t0 = Date.now();

      // jedes Handy und jeder Schiri geht ein wenig herum
      const senders = [...teamLive, ...schiriLive].map((c, i) => ({
        c,
        lat: HAUPTPLATZ.lat + (i % 7) * 0.0004,
        lng: HAUPTPLATZ.lng + (i % 5) * 0.0005,
      }));
      let sent = 0;
      const timers = senders.map((s, i) =>
        setTimeout(
          () => {
            const tick = () => {
              s.lat += (Math.random() - 0.5) * 0.0002;
              s.lng += (Math.random() - 0.5) * 0.0002;
              s.c.sendPos({ lat: s.lat, lng: s.lng, acc: 6 + Math.round(Math.random() * 10), t: Date.now() });
              sent++;
            };
            tick();
            timers[i] = setInterval(tick, EVERY_MS);
          },
          Math.round((i / senders.length) * EVERY_MS),
        ),
      );

      // was im Spiel sonst noch passiert – zusammengedrängt
      const at = (s: number) => sleep(Math.max(0, t0 + s * 1000 - Date.now()));
      await at(LOAD_S * 0.1);
      await set(`games/${G}/state/nextReportAt`, Date.now());
      await at(LOAD_S * 0.25);
      await ok(schiris[0]!, "handover", {
        to: teams[1]!.teamId,
        type: "fang",
        expectedMrx: teams[0]!.teamId,
        requestId: "lasttest-fang-1",
      });
      await at(LOAD_S * 0.4);
      for (const t of teams.slice(0, 10)) await ok(t.phones[0]!, "chat", { text: `Hallo von ${t.name}` });
      await at(LOAD_S * 0.55);
      await ok(admin, "announce", { text: "Achtung: der Norden wird gleich gesperrt" });
      await ok(admin, "setCut", { cutId: "norden", locked: true });
      await at(LOAD_S * 0.8);
      await set(`games/${G}/state/nextReportAt`, Date.now());
      await at(LOAD_S);
      timers.forEach((t) => clearInterval(t));
      await sleep(2500); // letzte gesammelte Standorte gehen raus
      const after = await usage(G);
      const min = (Date.now() - t0) / 60_000;

      // alle Standorte sind angekommen, aber nur bei Spielleitung, Schiris und Großbild
      const v = adminLive.view!;
      expect(Object.keys(v.positions ?? {})).toHaveLength(30);
      expect(Object.keys(v.staff ?? {})).toHaveLength(10);
      expect(Object.keys(screenLive[0]!.view!.positions ?? {})).toHaveLength(30);
      for (const c of teamLive) expect(c.view!.positions).toBeUndefined();

      // Größe des Snapshots für eine Spielleitung, die sich mit 30 Teams neu verbindet
      const b0 = (await usage(G)).bytesOut.admin ?? 0;
      const late = connect(admin.token);
      await late.until(() => true);
      const snapBytes = ((await usage(G)).bytesOut.admin ?? 0) - b0;
      all.push(late);

      const d = (k: "requests" | "wsIn" | "alarms" | "rows" | "wsOut") => after[k] - before[k];
      const bytes = (role: string, n: number) => ((after.bytesOut[role] ?? 0) - (before.bytesOut[role] ?? 0)) / n / min;
      const speedup = REAL_EVERY_MS / EVERY_MS;
      // 4 h Spiel mit Standort alle 12 s; zeitabhängige Werte (Zeilen, Alarme) als obere Grenze aus dem Zeitraffer
      const realMsgs4h = senders.length * ((4 * 3600_000) / REAL_EVERY_MS);
      const rows4h = (d("rows") / min) * 240;
      const doReq4h = realMsgs4h / 20 + (d("requests") / min) * 240 + (d("alarms") / min) * 240;
      const r = {
        dauerMin: +min.toFixed(2),
        standorteGesendet: sent,
        eingehendeNachrichten: d("wsIn"),
        anfragen: d("requests"),
        alarme: d("alarms"),
        zeilenGeschrieben: d("rows"),
        zeilenProMinute: +(d("rows") / min).toFixed(1),
        ausgehendeNachrichten: d("wsOut"),
        verzoegerungMsP50: pct(delays, 0.5),
        verzoegerungMsP95: pct(delays, 0.95),
        snapshotKBSpielleitung: +(snapBytes / 1024).toFixed(1),
        kBproMinute: {
          spielleitung: +(bytes("admin", 1) / 1024).toFixed(1),
          schiri: +(bytes("schiri", 10) / 1024).toFixed(1),
          grossbild: +(bytes("screen", 2) / 1024).toFixed(1),
          team: +(bytes("team", 36) / 1024).toFixed(1),
        },
        hochrechnung4h: {
          doAnfragen: Math.round(doReq4h),
          zeilenGeschrieben: Math.round(rows4h),
          mbSpielleitungImSpiel: +((bytes("admin", 1) * 240) / speedup / 1024 / 1024).toFixed(1),
        },
      };
      console.log("LASTTEST", JSON.stringify(r, null, 2));

      // jede Standort-Nachricht = genau eine eingehende Nachricht (plus „sichtbar“-Meldungen beim Verbinden)
      expect(d("wsIn")).toBeGreaterThanOrEqual(sent);
      expect(d("wsIn")).toBeLessThanOrEqual(sent + all.length * 3);
      // Standorte kommen spätestens nach 3 s bei der Spielleitung an (gesammelt alle 2 s)
      expect(r.verzoegerungMsP95).toBeLessThan(3000);
      // weit unter den Tageslimits (100 000 DO-Anfragen, 100 000 geschriebene Zeilen) – auch im Zeitraffer hochgerechnet
      expect(doReq4h).toBeLessThan(20_000);
      expect(rows4h).toBeLessThan(20_000);
      // ein Snapshot passt locker in eine WebSocket-Nachricht (32 MiB) und lädt auch mit schwachem Netz schnell
      expect(snapBytes).toBeLessThan(300 * 1024);
      all.forEach((c) => c.close());
    },
    (LOAD_S + 90) * 1000,
  );
});
