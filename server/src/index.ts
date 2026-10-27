// Worker (E-32): liefert die App aus und leitet weiter – Befehle (POST /api) und Live-Verbindungen (/ws) an den Spielraum
// des Spiels, Organisator-Login an die Zentrale. Prüft Tokens, sonst bewusst dünn: die Spielregeln stehen im Spielraum.
import { GAME_ID, PROTOCOL_VERSION, WS_CLOSE, type ApiCall, type ApiReason, type ApiReply, type GameListEntry, type JoinResult, type NativePosIn, type ServerMsg } from "@mrx/shared";
import { verify } from "./auth.ts";
import { ensureSchema } from "./d1.ts";
import { DAY, type Env } from "./util.ts";
import type { Auth } from "./room.ts";

export { GameRoom } from "./room.ts";
export { Zentrale } from "./zentrale.ts";

const STATUS: Record<ApiReason, number> = {
  unauthenticated: 401,
  session: 401,
  invalid: 400,
  notFound: 404,
  wrongSecret: 403,
  forbidden: 403,
  noTeamPassword: 409,
  noSpectators: 409,
  wrongPhase: 409,
  conflict: 409,
  exists: 409,
  archived: 409,
  tooLate: 409,
  tooMany: 429,
};

/** Android-App (Capacitor) läuft unter eigener Adresse und ruft die API von dort auf */
const APP_ORIGINS = ["https://localhost", "capacitor://localhost", "http://localhost"];

function cors(req: Request): Record<string, string> {
  const o = req.headers.get("Origin");
  return o && APP_ORIGINS.includes(o)
    ? {
        "Access-Control-Allow-Origin": o,
        "Access-Control-Allow-Headers": "content-type, authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Max-Age": "86400",
        Vary: "Origin",
      }
    : {};
}

function out(req: Request, r: ApiReply): Response {
  return Response.json(r, { status: r.ok ? 200 : STATUS[r.reason], headers: { "Cache-Control": "no-store", ...cors(req) } });
}
const no = (reason: ApiReason, message: string): ApiReply => ({ ok: false, reason, message });

const room = (env: Env, g: string) => env.ROOM.get(env.ROOM.idFromName(g));
const zentrale = (env: Env) => env.ZENTRALE.get(env.ZENTRALE.idFromName("zentrale"));

const bearer = (req: Request) => /^Bearer (.+)$/.exec(req.headers.get("Authorization") ?? "")?.[1];

/** Wer fragt? Gültiges Token für dieses Spiel → Gerät; Organisator-Token mit aktueller Passwort-Version → Super-Admin */
async function who(req: Request, env: Env, g?: string): Promise<Auth> {
  const ip = req.headers.get("cf-connecting-ip") ?? "lokal";
  const token = bearer(req);
  if (!token) return { ip };
  const c = await verify(env.TOKEN_SECRET, token);
  if (!c) return { ip, badToken: true };
  if ("s" in c) return (await zentrale(env).version()) === c.s ? { ip, superAdmin: true } : { ip, badToken: true };
  // Token eines anderen Spiels (z. B. Startseite eines neuen QR-Links) ist kein Fehler – nur hier kein Mitglied
  return c.g === g ? { ip, uid: c.u } : { ip };
}

async function api(req: Request, env: Env): Promise<Response> {
  if (req.method !== "POST") return new Response("Nur POST", { status: 405 });
  if (Number(req.headers.get("content-length") ?? 0) > 1_000_000) return out(req, no("invalid", "Anfrage zu groß"));
  const body = (await req.json().catch(() => null)) as (ApiCall & Record<string, unknown>) | null;
  if (!body || typeof body !== "object" || typeof body.action !== "string") return out(req, no("invalid", "Anfrage ungültig"));
  const ip = req.headers.get("cf-connecting-ip") ?? "lokal";

  if (body.action === "superSetup") return out(req, await zentrale(env).setup(body.setupSecret, body.password, ip));
  if (body.action === "superLogin") return out(req, await zentrale(env).login(body.password, ip));
  if (body.action === "listGames") {
    const a = await who(req, env);
    if (!a.superAdmin) return out(req, no(a.badToken ? "session" : "forbidden", "Nur für den Organisator"));
    await ensureSchema(env.DB);
    const r = await env.DB.prepare("SELECT id, name, createdAt, archived, phase, teams FROM games ORDER BY createdAt DESC").all<
      Omit<GameListEntry, "archived"> & { archived: number }
    >();
    return out(req, { ok: true, result: { games: r.results.map((x) => ({ ...x, archived: x.archived === 1 })) } });
  }

  const g = typeof body.gameId === "string" ? body.gameId.trim().toLowerCase() : "";
  if (!GAME_ID.test(g)) return out(req, no("invalid", "Spiel-Code ungültig"));
  const r = (await room(env, g).api({ ...body, gameId: g }, await who(req, env, g))) as ApiReply;
  // Ein Gerät ist immer nur in einem Spiel: beim neuen Beitritt die alte Mitgliedschaft beenden
  if (body.action === "join" && r.ok && (r.result as JoinResult).status === "joined") {
    const old = await verify(env.TOKEN_SECRET, bearer(req));
    if (old && "g" in old && (old.g !== g || old.u !== (r.result as { uid: string }).uid))
      await room(env, old.g).api({ action: "leave", gameId: old.g }, { uid: old.u });
  }
  return out(req, r);
}

/** Live-Verbindung: Token im Unterprotokoll („mrx“, Token) */
async function ws(req: Request, env: Env): Promise<Response> {
  if (req.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("WebSocket erwartet", { status: 426 });
  const token = (req.headers.get("Sec-WebSocket-Protocol") ?? "").split(",")[1]?.trim();
  const c = await verify(env.TOKEN_SECRET, token);
  if (c && "g" in c) {
    const headers = new Headers(req.headers);
    headers.set("x-uid", c.u);
    return room(env, c.g).fetch(new Request(req.url, { headers }));
  }
  // ungültige Sitzung: annehmen, Grund sagen, schließen – die App meldet sich dann neu an statt endlos zu versuchen
  const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
  server.accept();
  server.send(JSON.stringify({ t: "bye", reason: "session" } satisfies ServerMsg));
  server.close(WS_CLOSE.session, "session");
  return new Response(null, { status: 101, webSocket: client, headers: { "Sec-WebSocket-Protocol": "mrx" } });
}

/** Android-App im Hintergrund: Standort per nativem HTTP, Antwort = verpasste Benachrichtigungen */
async function nativePos(req: Request, env: Env): Promise<Response> {
  const c = await verify(env.TOKEN_SECRET, bearer(req));
  if (!c || !("g" in c)) return out(req, no("session", "Sitzung abgelaufen"));
  const body = (await req.json().catch(() => null)) as NativePosIn | null;
  if (!body || typeof body !== "object") return out(req, no("invalid", "Anfrage ungültig"));
  return out(req, (await room(env, c.g).nativePos(c.u, body.p, Number(body.since) || 0)) as ApiReply);
}

/** nur mit TEST_HOOKS=1 (lokale Tests): Spielraum lesen/ändern, Alarm sofort auslösen, alles zurücksetzen */
async function test(req: Request, env: Env, path: string): Promise<Response> {
  const b = (await req.json()) as { g?: string; op?: "get" | "set" | "tick" | "outbox" | "drop"; path?: string; value?: unknown };
  if (path === "/__test/reset") {
    await ensureSchema(env.DB);
    const games = await env.DB.prepare("SELECT id FROM games").all<{ id: string }>();
    await Promise.all(games.results.map((x) => room(env, x.id).destroy(true)));
    await env.DB.batch([env.DB.prepare("DELETE FROM games"), env.DB.prepare("DELETE FROM archive")]);
    await zentrale(env).reset();
    return Response.json({ ok: true });
  }
  return Response.json({ ok: true, result: await room(env, b.g!).test(b.op!, b.path, b.value) });
}

export default {
  async fetch(req, env): Promise<Response> {
    const path = new URL(req.url).pathname;
    if (path === "/api" || path === "/api/pos") {
      if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
      return path === "/api" ? api(req, env) : nativePos(req, env);
    }
    if (path === "/ws") return ws(req, env);
    if (path === "/health") return Response.json({ ok: true, protocol: PROTOCOL_VERSION });
    if (path.startsWith("/__test/") && env.TEST_HOOKS === "1") return test(req, env, path);
    return env.ASSETS.fetch(req);
  },

  /** täglich: Löschfristen im Archiv (F3) – Chat nach 30 Tagen, ganzer Lauf nach einem Jahr */
  async scheduled(_ev, env): Promise<void> {
    await ensureSchema(env.DB);
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare("UPDATE archive SET chat = NULL WHERE chat IS NOT NULL AND endedAt < ?1").bind(now - 30 * DAY),
      env.DB.prepare("DELETE FROM archive WHERE endedAt < ?1").bind(now - 365 * DAY),
    ]);
  },
} satisfies ExportedHandler<Env>;
