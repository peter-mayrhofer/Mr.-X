// Prototyp: Schiri- und Admin-Screens mit Testdaten. `staffView()` baut dieselbe Struktur wie das echte Spiel,
// `fakeApi` spielt den Spiel-Server nach (ändert die Testdaten, damit sich der Prototyp echt anfühlt).
import { MELDUNG, type ApiRequest, type Handover, type Lock, type Member } from "@mrx/shared";
import type { Keyed } from "../lib/game.svelte.ts";
import { lockPreview, type Api, type StaffView } from "../lib/staff.ts";
import { clock } from "../lib/clock.svelte.ts";
import { toast } from "../ui/toast.svelte.ts";
import { go } from "../lib/router.svelte.ts";
import { T } from "../texte.ts";
import * as M from "./mock.svelte.ts";

const MIN = 60_000;

export const sim = $state({
  handovers: M.handovers.map((h) => ({ ...h })) as Keyed<Handover>[],
  lastHandover: undefined as string | undefined,
  follows: true,
  locks: Object.fromEntries(Object.entries(M.locks).map(([t, until]) => [t, { until, reason: "uebergabe" } as Lock])),
  endAt: M.game.endFrom + 37 * MIN,
});

const members: Record<string, Member> = {
  adm: { role: "admin", name: "Peter", joinedAt: M.game.startedAt - 60 * MIN },
  ...Object.fromEntries(M.staff.map((s) => [s.uid, { role: "schiri", name: s.name, joinedAt: M.game.startedAt - 30 * MIN } as Member])),
  ...Object.fromEntries(
    M.teamIds.map((id) => [
      `u-${id}`,
      { role: "team", name: M.teams[id]!.name, teamId: id, joinedAt: M.game.startedAt - 20 * MIN } as Member,
    ]),
  ),
};

/** Testdaten als StaffView; `as` = Blickwinkel (Schiri s1 oder Spielleitung) */
export function staffView(as: "schiri" | "admin", phase: StaffView["state"]["phase"] = M.game.phase): StaffView {
  const me = as === "schiri" ? M.staff[0]! : null;
  return {
    gameId: "linz-2027",
    gameName: "Mister X Linz 2027",
    field: M.field,
    config: M.config,
    state: {
      phase,
      mrx: phase === "vorbereitung" ? undefined : M.game.mrx,
      mrxSince: M.game.mrxSince,
      startedAt: M.game.startedAt,
      lastReportAt: M.game.lastReportAt,
      nextReportAt: M.game.nextReportAt,
      cuts: Object.fromEntries(M.game.locked.map((c) => [c, M.game.startedAt])),
      lastHandover: sim.lastHandover,
      rev: 1,
    },
    teams: M.teams,
    positions: M.positions,
    staff: Object.fromEntries(M.staff.map((s) => [s.uid, { ...s.pos, name: s.name }])),
    devices: {
      d1: {
        name: "Tracker Fahne",
        assign: "fahne",
        createdAt: 1,
        pos: { ...M.positions[M.MRX]!, t: Date.now() - 20_000, battery: 64, tracker: true },
      },
      d2: { name: "Altes Handy Wels", assign: "wels", createdAt: 2 },
    },
    reports: M.reports,
    handovers: sim.handovers,
    locks: sim.locks,
    pauses: [],
    chat: M.chat,
    dm: { urfahr: M.dm, leonding: [], wels: [] },
    members: as === "admin" ? members : {},
    audit: M.audit,
    myUid: me ? me.uid : "adm",
    myName: me ? me.name : "Peter",
    me: me ? me.pos : null,
    follows: sim.follows,
    online: true,
    lastDataAt: clock.now,
  };
}

const ok = <R>(r: R) => Promise.resolve(r);

export const fakeApi: Api = ((req: ApiRequest): Promise<unknown> => {
  const now = clock.now;
  switch (req.action) {
    case "handover": {
      const v = staffView("schiri");
      const locked = lockPreview(v, req.to, now);
      sim.handovers.push({ id: req.requestId, from: M.game.mrx, to: req.to, at: now, type: req.type, byName: "Schiri Anna" });
      sim.lastHandover = req.requestId;
      for (const t of locked) sim.locks[t] = { until: now + M.config.waitMin * MIN, reason: "uebergabe" };
      M.game.mrx = req.to;
      M.game.mrxSince = now;
      return ok({ handoverId: req.requestId, locked });
    }
    case "undo": {
      const h = sim.handovers.find((x) => x.id === req.handoverId);
      if (h?.from) {
        h.undoneAt = now;
        M.game.mrx = h.from;
        sim.lastHandover = undefined;
      }
      return ok({});
    }
    case "follow":
      sim.follows = req.on;
      return ok({});
    case "startGame":
      M.game.phase = "laeuft";
      return ok({ mrx: req.mrx === "random" ? M.MRX : req.mrx });
    case "pause":
      M.game.phase = "pause";
      return ok({});
    case "resume":
      M.game.phase = "laeuft";
      return ok({});
    case "stopGame":
      go("/prototyp/19");
      return ok({});
    case "setConfig":
      Object.assign(M.config, req.config);
      return ok({});
    case "setCut":
      M.game.locked = req.locked ? [...M.game.locked, req.cutId] : M.game.locked.filter((c) => c !== req.cutId);
      return ok({});
    case "setLock":
      if (req.min) sim.locks[req.teamId] = { until: now + req.min * MIN, reason: "manuell" };
      else delete sim.locks[req.teamId];
      return ok({});
    case "announce":
      M.chat.push({ id: `ann${now}`, uid: "adm", name: "Peter", kind: "ann", t: now, text: req.text });
      return ok({});
    case "instantReport":
      M.chat.push({ id: `so${now}`, uid: "sys", name: "System", kind: "sys", t: now, text: MELDUNG.sofort(M.teams[M.game.mrx]!.name) });
      return ok({ reportId: null });
    case "revealEnd":
      return ok({ endAt: sim.endAt });
    case "screenLink":
      return ok({ key: "7f3a9c0b2e" });
    default:
      toast(T.allgemein.prototyp(req.action), "info");
      return ok({});
  }
}) as Api;

/** Prototyp-Zustand „Rückgängig“: eine Übergabe von vor 12 Sekunden */
export function recentHandover() {
  if (sim.lastHandover) return;
  const id = "proto-uebergabe";
  sim.handovers.push({ id, from: "spallerhof", to: M.game.mrx, at: clock.now - 12_000, type: "fang", byName: "Schiri Anna" });
  sim.lastHandover = id;
}
