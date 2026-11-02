// Live-Verbindung App ↔ Spielraum (WebSocket, docs/API.md). Der Server schickt beim Verbinden eine vollständige,
// nach Rolle gefilterte Sicht (`snap`) und danach nur noch Änderungen (`patch`) – jede Nachricht mit fortlaufender
// Nummer pro Verbindung (Lücke → `resync`) und Server-Zeit (Countdowns rechnen nie mit der Handy-Uhr).
import type { GameInfo, Member } from "./api.ts";
import type { PushKind } from "./push.ts";
import type {
  Alert,
  AuditEntry,
  ChatMessage,
  Config,
  CutEvent,
  Device,
  Field,
  GameState,
  Handover,
  Lock,
  Pause,
  Position,
  Report,
  Role,
  Team,
  TeamStats,
} from "./types.ts";

export const PROTOCOL_VERSION = 1;

/** Was ein Gerät vom Spiel sehen darf. Felder fehlen, wenn die Rolle sie nicht sehen darf (z. B. `positions` für Teams). */
export interface View {
  info: GameInfo;
  config: Config;
  field: Field;
  state: GameState;
  teams: Record<string, Team>;
  reports: Record<string, Report>;
  handovers: Record<string, Handover>;
  locks: Record<string, Lock>;
  pauses: Record<string, Pause>;
  cutLog: Record<string, CutEvent>;
  stats: Record<string, TeamStats>;
  /** alle außer Zuschauer */
  chat?: Record<string, ChatMessage>;
  /** Team: eigener Direktkanal unter seiner Team-Id; Spielleitung: alle */
  dm?: Record<string, Record<string, ChatMessage>>;
  /** nur Spielleitung, Schiri, Großbild */
  positions?: Record<string, Position>;
  staff?: Record<string, Position & { name?: string }>;
  /** Tracker mit Zuordnung und letztem Standort (nur Spielleitung, Schiri, Großbild) */
  devices?: Record<string, Device>;
  /** Notfälle: Spielleitung und Schiris alle, ein Team nur die eigenen */
  alerts?: Record<string, Alert>;
  /** nur Spielleitung */
  members?: Record<string, Member>;
  audit?: Record<string, AuditEntry>;
  /** dieses Gerät */
  me: Member & { uid: string; push?: { on: boolean; prefs: Partial<Record<PushKind, boolean>> } };
}

export type ViewKey = Exclude<keyof View, "me"> | "me";

/**
 * Eine Änderung: `[key, id, wert]` setzt view[key][id] = wert (null = löschen);
 * `[key, null, wert]` ersetzt view[key] ganz. Bei `dm` ist id = Team-Id und wert der ganze Kanal oder
 * `[ "dm", "teamId/nachrichtId", msg ]` für eine einzelne Nachricht.
 */
export type Patch = [key: ViewKey, id: string | null, value: unknown];

/** Benachrichtigung für dieses Gerät (dieselbe wie der Web-Push). Die Android-App zeigt sie als lokale Benachrichtigung. */
export interface Note {
  id: string;
  kind: PushKind;
  title: string;
  body: string;
  t: number;
}

export type ServerMsg =
  /** `vapid`: öffentlicher Schlüssel für Web-Push-Abos */
  | { t: "snap"; seq: number; now: number; v: number; view: View; vapid?: string }
  | { t: "patch"; seq: number; now: number; p: Patch[] }
  | { t: "note"; seq: number; now: number; n: Note }
  /** vor dem Schließen: warum (entfernt, Sitzung ungültig, neue Version) */
  | { t: "bye"; reason: "removed" | "session" | "version" };

/** eigener Standort; `t` = Messzeit (Server-Zeit) */
export type PositionIn = Omit<Position, "suspect"> & { battery?: number };

/** `vis`: App ist sichtbar → kein Push nötig (die App zeigt es selbst an). Herzschlag: Text „ping“ → „pong“. */
export type ClientMsg = { t: "pos"; p: PositionIn } | { t: "resync" } | { t: "vis"; on: boolean };

/** POST /api/pos (Android-App im Hintergrund): Standort per nativem HTTP, Antwort = verpasste Benachrichtigungen */
export interface NativePosIn {
  p: PositionIn;
  /** Benachrichtigungen ab diesem Zeitpunkt (Server-Zeit) */
  since: number;
}

/** Rollen, die Live-Positionen sehen (Abschnitt 6: nur Spielleitung und Schiris; Großbild in der Zentrale) */
export const SEES_POSITIONS: Role[] = ["admin", "schiri", "screen"];

/** WebSocket-Schließ-Codes (4000–4999 sind für Anwendungen frei) */
export const WS_CLOSE = { removed: 4001, session: 4002, version: 4003 } as const;

/** Patch auf eine Sicht anwenden (Client und Tests) */
export function applyPatch(view: Record<string, unknown>, [key, id, value]: Patch): void {
  if (id === null) {
    if (value === null) delete view[key];
    else view[key] = value;
    return;
  }
  const parts = id.split("/");
  let node = (view[key] ??= {}) as Record<string, unknown>;
  for (const part of parts.slice(0, -1)) node = (node[part] ??= {}) as Record<string, unknown>;
  const last = parts.at(-1)!;
  if (value === null) delete node[last];
  else node[last] = value;
}
