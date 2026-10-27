// Gemeinsame Helfer für Tests gegen den lokal laufenden Spiel-Server (tests/setup.ts startet ihn einmal).
// `val`/`set` lesen und ändern den Spielraum direkt (nur mit TEST_HOOKS) – wie früher die Datenbank im Emulator.
import { inject } from "vitest";
import { Live } from "@mrx/shared/client";
import type { Note, PositionIn, View } from "@mrx/shared";
import { TEST_SECRETS } from "./setup.ts";

export const SERVER = inject("server");
export const SUPER_PW = "organisator-test-123";

export interface Res {
  result?: Record<string, unknown>;
  error?: { status: number; message: string; details: { reason: string } };
}

/** POST /api wie die App; `ip` simuliert verschiedene Absender (Rate-Limit) */
export async function call(token: string | null, data: Record<string, unknown>, ip?: string): Promise<Res> {
  const r = await fetch(`${SERVER}/api`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(ip ? { "cf-connecting-ip": ip } : {}),
    },
    body: JSON.stringify(data),
  });
  const j = (await r.json()) as { ok: boolean; result?: Record<string, unknown>; reason?: string; message?: string };
  if (process.env.DEBUG_API) console.log(JSON.stringify(data).slice(0, 80), "→", JSON.stringify(j).slice(0, 200));
  return j.ok ? { result: j.result! } : { error: { status: r.status, message: j.message!, details: { reason: j.reason! } } };
}
export const reason = (r: Res) => r.error?.details.reason;

export interface Device {
  uid: string;
  token: string;
  teamId?: string;
}

/** Gerät tritt bei (wie ein Handy, das den QR-Link öffnet); wirft bei Ablehnung */
export async function join(gameId: string, role: string, name: string, secret?: string, extra: Record<string, unknown> = {}): Promise<Device> {
  const r = await call(null, { action: "join", gameId, role, name, ...(secret !== undefined ? { secret } : {}), ...extra });
  if (r.error) throw new Error(`join ${role} ${name}: ${r.error.message}`);
  const j = r.result as { status: string; token: string; uid: string; teamId?: string };
  if (j.status !== "joined") throw new Error(`join ${name}: ${j.status}`);
  return { uid: j.uid, token: j.token, ...(j.teamId ? { teamId: j.teamId } : {}) };
}

/** Organisator: Passwort mit dem Setup-Geheimnis festlegen (bzw. neu setzen) → Token */
export async function superAdminToken(): Promise<string> {
  const r = await call(null, { action: "superSetup", setupSecret: TEST_SECRETS.SETUP_SECRET, password: SUPER_PW });
  return r.result!.token as string;
}

async function hook(body: Record<string, unknown>, path = "/__test/room"): Promise<unknown> {
  const r = await fetch(`${SERVER}${path}`, { method: "POST", body: JSON.stringify(body) });
  return ((await r.json()) as { result?: unknown }).result ?? null;
}

/** `games/{g}/teil/…` oder `secrets/{g}/…` im Spielraum lesen */
function split(path: string): [string, string] {
  const [kind, g, ...rest] = path.split("/");
  return [g!, kind === "secrets" ? ["secrets", ...rest].join("/") : rest.join("/")];
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testdaten, beliebige Form
export const val = async (path: string): Promise<any> => {
  const [g, p] = split(path);
  return hook({ g, op: "get", path: p });
};
export async function set(path: string, value: unknown) {
  const [g, p] = split(path);
  await hook({ g, op: "set", path: p, value });
}
/** Alarm sofort auslösen (statt auf die Zeit zu warten); liefert, was erledigt wurde */
export const tick = async (g: string) => (await hook({ g, op: "tick" })) as string[];
/** Benachrichtigungen, die der Server verschickt hätte */
export const outbox = async (g: string) =>
  (await hook({ g, op: "outbox" })) as { kind: string; title: string; body: string; to: string[]; push: string[]; t: number }[];

/** alle Live-Verbindungen des Spiels trennen (Funkloch) */
export const drop = async (g: string) => void (await hook({ g, op: "drop" }));

export async function resetServer() {
  await hook({}, "/__test/reset");
}

/** Live-Verbindung wie die App; sammelt Sicht, Benachrichtigungen und Abschiedsgrund */
export function connect(token: string) {
  const s = {
    view: null as View | null,
    notes: [] as Note[],
    bye: null as string | null,
    msgs: 0,
    live: null as unknown as Live,
    /** warten, bis die Bedingung auf der Sicht stimmt */
    async until(pred: (v: View) => unknown, ms = 5000): Promise<View> {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        if (s.view && pred(s.view)) return s.view;
        await new Promise((r) => setTimeout(r, 25));
      }
      throw new Error("Bedingung nicht erfüllt");
    },
    sendPos: (p: PositionIn) => s.live.sendPos(p),
    close: () => s.live.close(),
  };
  s.live = new Live({
    url: `${SERVER.replace(/^http/, "ws")}/ws`,
    token,
    onView: (v) => {
      s.view = v;
      s.msgs++;
    },
    onNote: (n) => s.notes.push(n),
    onBye: (r) => (s.bye = r),
  });
  return s;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** warten, bis eine Bedingung stimmt (z. B. Alarm hat ausgelöst) */
export async function eventually<T>(fn: () => Promise<T>, ok: (v: T) => boolean, ms = 8000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (ok(v) || Date.now() > end) return v;
    await sleep(100);
  }
}
