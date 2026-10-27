// Spiel-Server (E-03): eine aufrufbare Function `api` für alle Aktionen, der Takt `tick` und der Trigger `onPosition`.
import "./setup.ts";
import { onCall, type CallableRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setTimeout as sleep } from "node:timers/promises";
import type { ApiRequest } from "@mrx/shared";
import { fail, val } from "./util.ts";
import { advance, nextDue } from "./ablauf.ts";
import { claimSuperAdmin, createGame } from "./actions/superadmin.ts";
import { join, leave, screenLink, setSecret } from "./actions/access.ts";
import * as spiel from "./actions/spiel.ts";
import { handover, undo } from "./actions/uebergabe.ts";
import { removeMember, removeTeam, renameTeam, resetRound } from "./actions/runde.ts";

export { onPosition } from "./position.ts";

type Req = CallableRequest<Record<string, unknown>>;
const ACTIONS: Record<ApiRequest["action"], (req: Req) => Promise<unknown>> = {
  claimSuperAdmin,
  createGame,
  join,
  leave,
  setSecret,
  screenLink,
  ...spiel,
  handover,
  undo,
  resetRound,
  removeMember,
  removeTeam,
  renameTeam,
};

export const api = onCall<Record<string, unknown>>({ concurrency: 80 }, (req) => {
  const action = ACTIONS[req.data?.action as ApiRequest["action"]];
  if (!action) fail("invalid", "Unbekannte Aktion");
  return action(req);
});

/**
 * Takt (KONZEPT Abschnitt 6.1): jede Minute, auch wenn kein Handy online ist. Ist eine Meldung oder das Spielende in der
 * nächsten Minute fällig, wartet der Takt bis zur Sekunde. Mehrere Läufe gleichzeitig sind harmlos (Transaktionen).
 */
export const tick = onSchedule({ schedule: "every 1 minutes", timeoutSeconds: 120, retryCount: 0 }, async () => {
  const start = Date.now();
  const games = Object.keys((await val<Record<string, true>>("running")) ?? {});
  await Promise.all(
    games.map(async (g) => {
      for (let i = 0; i < 5; i++) {
        const due = await nextDue(g);
        if (due === null || due - start >= 60_000) return;
        await sleep(Math.max(0, due - Date.now()));
        if (!(await advance(g)).length) return;
      }
    }),
  );
});
