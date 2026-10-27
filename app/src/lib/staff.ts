// Gemeinsames für Schiri- und Admin-Ansichten: was sie zeigen (StaffView) und wie sie den Spiel-Server aufrufen (Api).
// Im echten Spiel kommt alles live aus der Datenbank, im Prototyp aus Testdaten – die Screens merken keinen Unterschied.
import {
  FRESH_MS,
  OFFLINE_MS,
  teamsToLock,
  type ApiRequest,
  type ApiResults,
  type AuditEntry,
  type Config,
  type Device,
  type Field,
  type GameState,
  type Handover,
  type Lock,
  type Member,
  type Pause,
  type Position,
  type Report,
  type Team,
} from "@mrx/shared";
import type { Keyed, Msg } from "./game.svelte.ts";

export interface StaffView {
  gameId: string;
  gameName: string;
  field: Field;
  config: Config;
  state: GameState;
  teams: Record<string, Team>;
  positions: Record<string, Position>;
  staff: Record<string, Position & { name?: string }>;
  devices: Record<string, Device>;
  reports: Keyed<Report>[];
  handovers: Keyed<Handover>[];
  locks: Record<string, Lock>;
  pauses: Keyed<Pause>[];
  chat: Msg[];
  /** nur Spielleitung: Direktkanäle pro Team, Mitglieder, Protokoll */
  dm: Record<string, Msg[]>;
  members: Record<string, Member>;
  audit: Keyed<AuditEntry>[];
  myUid: string;
  myName: string;
  me: Position | null;
  follows: boolean;
  online: boolean;
  lastDataAt: number;
}

export type Api = <R extends ApiRequest>(req: R) => Promise<ApiResults[R["action"]]>;

export const isOffline = (p: Position | undefined, now: number) => !p || now - p.t > OFFLINE_MS;
const fresh = (p: Position | null | undefined, now: number) => (p && !p.suspect && now - p.t <= FRESH_MS ? p : null);

/** Wer müsste warten, wenn jetzt `to` die Fahne bekommt? Gleiche Regel wie am Server (shared/teamsToLock). */
export function lockPreview(v: StaffView, to: string, now: number): string[] {
  const from = v.state.mrx;
  const at = fresh(v.positions[to], now) ?? fresh(from ? v.positions[from] : null, now) ?? fresh(v.me, now);
  return teamsToLock({ at, from, to, positions: v.positions, radiusM: v.config.radiusM, now });
}

/** Mister-X-Spur seit der letzten Übergabe, ohne rückgängig gemachte Meldungen */
export const trailOf = (v: Pick<StaffView, "reports" | "state">) =>
  v.reports.filter((r) => !r.void && r.teamId === v.state.mrx && r.t >= (v.state.mrxSince ?? 0));

/** Letzte Übergabe, solange sie rückgängig gemacht werden darf */
export function undoable(v: StaffView, now: number): Keyed<Handover> | null {
  const h = v.state.lastHandover ? v.handovers.find((x) => x.id === v.state.lastHandover) : undefined;
  return h && !h.undoneAt && h.type !== "start" && now - h.at < v.config.undoMin * 60_000 ? h : null;
}

/** zufällige Kennung pro Übergabe – dieselbe Anfrage nach Netzabbruch wird so nie doppelt ausgeführt (E-25) */
export const requestId = () => crypto.randomUUID().replaceAll("-", "").slice(0, 24);
