// Aufrufe an den Spiel-Server (POST /api, shared/api.ts); Ablehnungen als ApiError mit Grund. Bei Netzfehlern wird
// dieselbe Anfrage mit derselben Kennung (`rid`) wiederholt – der Server führt sie trotzdem nur einmal aus.
import type { ApiReason, ApiReply, ApiRequest, ApiResults } from "@mrx/shared";
import { API_URL } from "./server.ts";
import { tokens } from "./tokens.ts";

export class ApiError extends Error {
  constructor(
    readonly reason: ApiReason | "network",
    message: string,
  ) {
    super(message);
  }
}

const SUPER_ONLY = new Set<ApiRequest["action"]>(["superSetup", "superLogin", "listGames", "createGame", "archiveGame", "deleteGame"]);

/** Gerät im eigenen Spiel mit seinem Token; Organisator-Aktionen (und fremde Spiele in der Verwaltung) mit dessen Token */
function tokenFor(req: ApiRequest): string | null {
  if (SUPER_ONLY.has(req.action)) return tokens.super;
  const g = "gameId" in req ? req.gameId : null;
  // Organisator öffnet ein Spiel ohne Admin-Passwort
  if (req.action === "join" && req.role === "admin" && !req.secret && tokens.super) return tokens.super;
  if (tokens.game && (g === tokens.gameId || req.action === "join")) return tokens.game;
  return tokens.super ?? tokens.game;
}

const rid = () => Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function call<R extends ApiRequest>(req: R): Promise<ApiResults[R["action"]]> {
  const token = tokenFor(req);
  const body = JSON.stringify({ ...req, rid: rid() });
  for (let i = 0; ; i++) {
    let res: Response;
    try {
      res = await fetch(`${API_URL}/api`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body,
      });
    } catch {
      if (i < 2) {
        await sleep(1000 * (i + 1));
        continue;
      }
      throw new ApiError("network", "Keine Verbindung");
    }
    const j = (await res.json().catch(() => null)) as ApiReply<ApiResults[R["action"]]> | null;
    if (!j) throw new ApiError("network", `HTTP ${res.status}`);
    if (j.ok) return j.result;
    if (j.reason === "session" && token) tokens.onSession?.(token === tokens.super ? "super" : "game");
    throw new ApiError(j.reason, j.message);
  }
}
