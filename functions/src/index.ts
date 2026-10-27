// Spiel-Server (E-03): eine aufrufbare Function `api` für alle Aktionen.
import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions/v2";
import { onCall, type CallableRequest } from "firebase-functions/v2/https";
import type { ApiRequest } from "@mrx/shared";
import { REGION } from "./env.ts";
import { fail } from "./util.ts";
import { claimSuperAdmin, createGame } from "./actions/superadmin.ts";
import { join, leave, screenLink, setSecret } from "./actions/access.ts";

initializeApp();
setGlobalOptions({ region: REGION, maxInstances: 10, memory: "256MiB" });

type Req = CallableRequest<Record<string, unknown>>;
const ACTIONS: Record<ApiRequest["action"], (req: Req) => Promise<unknown>> = {
  claimSuperAdmin,
  createGame,
  join,
  leave,
  setSecret,
  screenLink,
};

export const api = onCall<Record<string, unknown>>({ concurrency: 80 }, (req) => {
  const action = ACTIONS[req.data?.action as ApiRequest["action"]];
  if (!action) fail("invalid", "Unbekannte Aktion");
  return action(req);
});
