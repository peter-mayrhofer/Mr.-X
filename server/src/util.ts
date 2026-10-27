// Gemeinsames für Worker und Spielraum: Umgebung, Ablehnungen, Eingaben prüfen, Schlüssel.
import { GAME_ID, type ApiReason, type ApiReply } from "@mrx/shared";
import type { GameRoom } from "./room.ts";
import type { Zentrale } from "./zentrale.ts";

export interface Env {
  ROOM: DurableObjectNamespace<GameRoom>;
  ZENTRALE: DurableObjectNamespace<Zentrale>;
  DB: D1Database;
  ASSETS: Fetcher;
  /** Schlüssel für Sitzungs-Tokens (Secret) */
  TOKEN_SECRET: string;
  /** einmalige Einrichtung des Organisator-Passworts (Secret) */
  SETUP_SECRET?: string;
  VAPID_PUBLIC?: string;
  VAPID_PRIVATE?: string;
  VAPID_SUBJECT: string;
  /** nur in Tests: Hilfs-Schnittstelle /__test und Push-Postausgang statt Versand */
  TEST_HOOKS?: string;
}

/** Ablehnung mit Grund; die App zeigt den passenden Text aus texte.ts */
export class Fail extends Error {
  constructor(
    readonly reason: ApiReason,
    message: string,
  ) {
    super(message);
  }
}
export function fail(reason: ApiReason, message: string = reason): never {
  throw new Fail(reason, message);
}

/** Ergebnis oder Ablehnung als Antwort verpacken (unerwartete Fehler: ohne Details nach außen, mit Details ins Log) */
export async function reply<R>(fn: () => R | Promise<R>): Promise<ApiReply<R>> {
  try {
    return { ok: true, result: await fn() };
  } catch (e) {
    if (e instanceof Fail) return { ok: false, reason: e.reason, message: e.message };
    console.error("Fehler", e);
    return { ok: false, reason: "invalid", message: "Unerwarteter Fehler am Server" };
  }
}

export function str(v: unknown, [min, max]: readonly [number, number], what: string): string {
  if (typeof v !== "string") fail("invalid", `${what} fehlt`);
  const s = v.trim().replace(/\s+/g, " ");
  if (s.length < min || s.length > max) fail("invalid", `${what}: ${min}–${max} Zeichen`);
  return s;
}

export function gameId(v: unknown): string {
  const g = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (!GAME_ID.test(g)) fail("invalid", "Spiel-Code ungültig");
  return g;
}

let lastT = 0;
let ctr = 0;
/** zeitlich sortierbare Kennung (wie Firebase-Push-Schlüssel): Listen in der App sortieren danach */
export function newKey(): string {
  const t = Date.now();
  ctr = t === lastT ? ctr + 1 : 0;
  lastT = t;
  const r = crypto.getRandomValues(new Uint8Array(3));
  return t.toString(36).padStart(9, "0") + ctr.toString(36).padStart(3, "0") + [...r].map((b) => (b % 36).toString(36)).join("");
}

export const MIN = 60_000;
export const DAY = 24 * 60 * MIN;
