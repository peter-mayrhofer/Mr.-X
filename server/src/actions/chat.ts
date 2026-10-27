// Chat (Abschnitt 7.5): Gruppenchat und Direktkanal Team ↔ Spielleitung, Moderation; Push-Einstellungen des Geräts;
// Archiv (Meilenstein 10) aus D1.
import { LIMITS, PUSH_KINDS, PUSH_TITLE, type ApiResults, type ChatMessage, type PushKind, type PushReg, type PushSub } from "@mrx/shared";
import { fail, newKey, str } from "../util.ts";
import type { Auth, GameRoom } from "../room.ts";

type D = Record<string, unknown>;
/** höchstens eine Nachricht alle 2 s pro Gerät */
const CHAT_GAP_MS = 2000;
const chatAt = new WeakMap<GameRoom, Map<string, number>>();

export function chat(room: GameRoom, d: D, a: Auth): ApiResults["chat"] {
  const who = room.who(a, ["team", "schiri", "admin"]);
  if (who.role === "superadmin") fail("forbidden", "Bitte zuerst als Spielleitung beitreten");
  const m = room.d.members[who.uid]!;
  const text = str(d.text, [1, LIMITS.chat], "Nachricht");
  const dm = typeof d.dm === "string" ? d.dm : undefined;
  if (dm !== undefined) {
    if (!room.d.teams[dm]) fail("invalid", "Team unbekannt");
    // Direktkanal: nur die Spielleitung und das Team selbst
    if (m.role !== "admin" && !(m.role === "team" && m.teamId === dm)) fail("forbidden");
  }
  const now = Date.now();
  const last = chatAt.get(room) ?? new Map<string, number>();
  chatAt.set(room, last);
  if (now - (last.get(who.uid) ?? 0) < CHAT_GAP_MS) fail("tooMany", "Bitte kurz warten");
  last.set(who.uid, now);
  const id = newKey();
  const msg: ChatMessage = { uid: who.uid, name: m.name, text, t: now, kind: "msg", ...(m.teamId ? { teamId: m.teamId } : {}) };
  room.put(dm ? "dm" : "chat", dm ? `${dm}/${id}` : id, msg);
  // Direktnachricht der Spielleitung → Benachrichtigung an alle Geräte des Teams
  if (dm && m.role === "admin") room.notify("nachricht", { teams: [dm] }, PUSH_TITLE.nachricht, text);
  return { id };
}

/** Moderation: nur die Spielleitung löscht */
export function deleteChat(room: GameRoom, d: D, a: Auth): ApiResults["deleteChat"] {
  const who = room.who(a, ["admin"]);
  const id = String(d.id ?? "");
  const dm = typeof d.dm === "string" ? d.dm : undefined;
  const msg = dm ? room.d.dm[dm]?.[id] : room.d.chat[id];
  if (!msg) return {}; // schon weg
  room.put(dm ? "dm" : "chat", dm ? `${dm}/${id}` : id, null);
  room.audit(who, "Nachricht gelöscht", `${msg.name}: ${msg.text.slice(0, 60)}`);
  return {};
}

function sub(v: unknown): PushSub | undefined {
  if (v === null || v === undefined) return undefined;
  const s = v as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  const ok =
    typeof s.endpoint === "string" &&
    s.endpoint.startsWith("https://") &&
    s.endpoint.length < 1000 &&
    typeof s.keys?.p256dh === "string" &&
    s.keys.p256dh.length < 200 &&
    typeof s.keys.auth === "string" &&
    s.keys.auth.length < 100;
  if (!ok) fail("invalid", "Push-Abo ungültig");
  return { endpoint: s.endpoint as string, keys: { p256dh: s.keys!.p256dh as string, auth: s.keys!.auth as string } };
}

/** Web-Push-Abo dieses Geräts (oder null = keins, z. B. Android-App) und gewünschte Arten */
export function pushSubscribe(room: GameRoom, d: D, a: Auth): ApiResults["pushSubscribe"] {
  const who = room.who(a, ["team", "schiri", "admin", "viewer"]);
  if (who.role === "superadmin") fail("forbidden");
  const prefsIn = (d.prefs ?? {}) as Record<string, unknown>;
  const prefs: Partial<Record<PushKind, boolean>> = {};
  for (const k of PUSH_KINDS) if (typeof prefsIn[k] === "boolean") prefs[k] = prefsIn[k];
  const s = d.sub === undefined ? room.d.push[who.uid]?.sub : sub(d.sub);
  room.put("push", who.uid, { ...(s ? { sub: s } : {}), prefs, t: Date.now() } satisfies PushReg);
  return {};
}

export async function archiveList(room: GameRoom, _d: D, a: Auth): Promise<ApiResults["archiveList"]> {
  room.who(a, ["team", "schiri", "admin", "screen"]);
  const r = await room.env.DB.prepare("SELECT run, name, startedAt, endedAt, winner FROM archive WHERE game = ?1 ORDER BY endedAt DESC")
    .bind(room.d.gid)
    .all<{ run: string; name: string; startedAt: number; endedAt: number; winner: string | null }>();
  return { runs: r.results };
}

export async function archiveGet(room: GameRoom, d: D, a: Auth): Promise<ApiResults["archiveGet"]> {
  room.who(a, ["team", "schiri", "admin", "screen"]);
  const row = await room.env.DB.prepare("SELECT data, chat FROM archive WHERE game = ?1 AND run = ?2")
    .bind(room.d.gid, String(d.run ?? ""))
    .first<{ data: string; chat: string | null }>();
  if (!row) fail("notFound", "Kein Archiv-Eintrag");
  return { archive: { ...(JSON.parse(row.data) as object), chat: row.chat ? (JSON.parse(row.chat) as unknown) : {} } };
}
