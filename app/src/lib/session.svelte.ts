// Wer bin ich, in welchem Spiel, mit welcher Rolle? Die Sitzung (Token vom Beitritt) bleibt im Gerät gespeichert; dazu
// eine Live-Verbindung zum Spielraum (Snapshot + Änderungen, shared/client.ts). Wird ein Gerät entfernt (Admin, neue
// Runde) oder ist die Sitzung abgelaufen, sagt der Server den Grund – die App erklärt es freundlich (Screen 23).
import { Live, type ByeReason } from "@mrx/shared/client";
import type { GameInfo, JoinResult, Note, PositionIn, Role, View, ViewKey } from "@mrx/shared";
import { WS_URL } from "./server.ts";
import { tokens } from "./tokens.ts";
import { call } from "./api.ts";
import { clock } from "./clock.svelte.ts";

interface Saved {
  gameId: string;
  token: string;
  uid: string;
  role: Role;
}
const KEY = "mrx.sitzung";
const SUPER_KEY = "mrx.organisator";

class Session {
  /** gespeicherte Sitzung gelesen (sofort – localStorage ist synchron) */
  ready = $state(true);
  gameId = $state<string | null>(null);
  uid = $state<string | null>(null);
  role = $state<Role | null>(null);
  member = $state.raw<View["me"] | null>(null);
  info = $state.raw<GameInfo | null>(null);
  /** ganze Sicht dieses Geräts (nach Rolle gefiltert vom Server) */
  view = $state.raw<View | null>(null);
  online = $state(false);
  lastDataAt = $state(Date.now());
  /** Gerät wurde aus dem Spiel entfernt (neue Runde, Spiel gelöscht), Sitzung abgelaufen oder App veraltet */
  removed = $state<ByeReason | false>(false);
  superAdmin = $state(false);
  /** öffentlicher Web-Push-Schlüssel des Servers */
  vapid = $state<string | null>(null);
}

export const session = new Session();

type ViewListener = (v: View, changed: ViewKey[] | "all") => void;
// eslint-disable-next-line svelte/prefer-svelte-reactivity -- Abonnenten-Liste, kein Zustand für die Oberfläche
const viewListeners = new Set<ViewListener>();
// eslint-disable-next-line svelte/prefer-svelte-reactivity -- dito
const noteListeners = new Set<(n: Note) => void>();

/** Sicht beobachten (für GameData); ruft sofort mit dem aktuellen Stand auf */
export function onView(fn: ViewListener): () => void {
  viewListeners.add(fn);
  if (session.view) fn(session.view, "all");
  return () => viewListeners.delete(fn);
}
/** Benachrichtigungen des Servers für dieses Gerät (Android: lokal anzeigen) */
export function onNote(fn: (n: Note) => void): () => void {
  noteListeners.add(fn);
  return () => noteListeners.delete(fn);
}

function read<T>(k: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(k) ?? "null") as T | null;
  } catch {
    return null;
  }
}
function write(k: string, v: unknown) {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* privater Modus: Sitzung gilt dann nur bis zum Schließen */
  }
}

let live: Live | null = null;
const visible = () => document.visibilityState === "visible";

function connect(s: Saved) {
  live?.close();
  Object.assign(session, { gameId: s.gameId, uid: s.uid, role: s.role, removed: false, view: null, member: null, info: null });
  tokens.game = s.token;
  tokens.gameId = s.gameId;
  const l: Live = new Live({
    url: WS_URL,
    token: s.token,
    onView: (v, changed) => {
      session.view = v;
      session.member = v.me;
      session.info = v.info;
      session.role = v.me.role;
      session.lastDataAt = Date.now();
      clock.offset = l.offset;
      for (const fn of viewListeners) fn(v, changed);
    },
    onNote: (n) => noteListeners.forEach((fn) => fn(n)),
    onBye: (r) => (session.removed = r),
    onStatus: (on) => {
      session.online = on;
      if (on) session.lastDataAt = Date.now();
    },
    onVapid: (k) => (session.vapid = k),
  });
  live = l;
  l.setVisible(visible());
}
document.addEventListener("visibilitychange", () => live?.setVisible(visible()));

/** nach erfolgreichem Beitritt: Sitzung merken und verbinden */
export function startSession(gameId: string, r: JoinResult) {
  if (r.status !== "joined") return;
  const s: Saved = { gameId, token: r.token, uid: r.uid, role: r.role };
  write(KEY, s);
  connect(s);
}

/** eigenen Standort über die Live-Verbindung senden (offline: der neueste wartet) */
export const sendPos = (p: PositionIn) => live?.sendPos(p);

function endSession() {
  live?.close();
  live = null;
  write(KEY, null);
  tokens.game = tokens.gameId = null;
  Object.assign(session, { gameId: null, uid: null, role: null, member: null, info: null, view: null, removed: false, online: false });
}

/** Abmelden (oder nach einer Entfernung den Hinweis quittieren) */
export async function leaveGame() {
  if (session.gameId && !session.removed) await call({ action: "leave", gameId: session.gameId }).catch(() => {});
  endSession();
}

function setSuper(t: string | null) {
  tokens.super = t;
  write(SUPER_KEY, t);
  session.superAdmin = !!t;
}
/** Organisator: Anmeldung mit Passwort */
export async function superLogin(password: string) {
  setSuper((await call({ action: "superLogin", password })).token);
}
/** Organisator: Passwort einmalig (oder neu) mit dem Setup-Geheimnis festlegen */
export async function superSetup(setupSecret: string, password: string) {
  setSuper((await call({ action: "superSetup", setupSecret, password })).token);
}
export const superLogout = () => setSuper(null);

tokens.onSession = (kind) => {
  if (kind === "super") setSuper(null);
  else session.removed = "session";
};

// beim Start: gespeicherte Sitzungen übernehmen
const saved = read<Saved>(KEY);
if (saved?.token) connect(saved);
setSuper(read<string>(SUPER_KEY));
