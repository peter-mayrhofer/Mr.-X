// Live-Daten eines Spiels für die Spiel-Ansichten (Team, Schiri, Spielleitung). Kommen über die eine Live-Verbindung des
// Geräts (session.svelte.ts); was die Rolle nicht sehen darf, schickt der Server gar nicht erst (Abschnitt 6).
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
  Member,
  Pause,
  Position,
  Report,
  Team,
  TeamStats,
  View,
  ViewKey,
} from "@mrx/shared";
import { untrack } from "svelte";
import { onView, session } from "./session.svelte.ts";
import { call } from "./api.ts";

export type Keyed<T> = T & { id: string };
export type Msg = Keyed<ChatMessage>;

/** Einträge (zeitlich sortierbare Schlüssel) → sortierte Liste */
const list = <T>(v: Record<string, T> | null | undefined): Keyed<T>[] =>
  Object.entries(v ?? {})
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([id, x]) => ({ ...x, id }));

export class GameData {
  config = $state.raw<Config | null>(null);
  field = $state.raw<Field | null>(null);
  state = $state.raw<GameState | null>(null);
  teams = $state.raw<Record<string, Team>>({});
  reports = $state.raw<Keyed<Report>[]>([]);
  handovers = $state.raw<Keyed<Handover>[]>([]);
  locks = $state.raw<Record<string, Lock>>({});
  pauses = $state.raw<Keyed<Pause>[]>([]);
  cutLog = $state.raw<Keyed<CutEvent>[]>([]);
  stats = $state.raw<Record<string, TeamStats>>({});
  chat = $state.raw<Msg[]>([]);
  /** eigener Direktkanal (Team) */
  dm = $state.raw<Msg[]>([]);
  /** nur Schiri, Spielleitung, Großbild: Live-Standorte */
  positions = $state.raw<Record<string, Position>>({});
  staff = $state.raw<Record<string, Position & { name?: string }>>({});
  /** Tracker (Spielleitung, Schiri, Großbild) */
  devices = $state.raw<Record<string, Device>>({});
  /** Notfälle: Spielleitung/Schiri alle, Team die eigenen */
  alerts = $state.raw<Keyed<Alert>[]>([]);
  /** nur Spielleitung */
  members = $state.raw<Record<string, Member>>({});
  audit = $state.raw<Keyed<AuditEntry>[]>([]);
  dmAll = $state.raw<Record<string, Msg[]>>({});
  /** Verbindung zum Server; `lastDataAt` = zuletzt Daten bekommen */
  readonly online = $derived(session.online);
  readonly lastDataAt = $derived(session.lastDataAt);
  readonly loaded = $derived(!!this.config && !!this.field && !!this.state);

  /** Live-Daten übernehmen; gibt die Abmeldung zurück (für $effect). Spiel und Rolle bestimmt die Sitzung. */
  watch(): () => void {
    // ohne Abhängigkeiten: die Daten kommen über onView, nicht über den umgebenden $effect
    return untrack(() => onView((v, changed) => this.#apply(v, changed)));
  }

  #apply(v: View, changed: ViewKey[] | "all") {
    const has = (k: ViewKey) => changed === "all" || changed.includes(k);
    if (has("config")) this.config = v.config;
    // leeres Spielfeld kommt evtl. ohne base/cuts
    if (has("field")) this.field = v.field && { ...v.field, base: v.field.base ?? [], cuts: v.field.cuts ?? {} };
    if (has("state")) this.state = { ...v.state };
    if (has("teams")) this.teams = { ...v.teams };
    if (has("reports")) this.reports = list(v.reports);
    if (has("handovers")) this.handovers = list(v.handovers);
    if (has("locks")) this.locks = { ...v.locks };
    if (has("pauses")) this.pauses = list(v.pauses);
    if (has("cutLog")) this.cutLog = list(v.cutLog);
    if (has("stats")) this.stats = { ...v.stats };
    if (has("chat")) this.chat = list(v.chat);
    if (has("dm")) {
      const all = Object.fromEntries(Object.entries(v.dm ?? {}).map(([t, c]) => [t, list(c)]));
      this.dmAll = all;
      this.dm = v.me.teamId ? (all[v.me.teamId] ?? []) : [];
    }
    if (has("positions")) this.positions = { ...v.positions };
    if (has("staff")) this.staff = { ...v.staff };
    if (has("devices")) this.devices = { ...v.devices };
    if (has("members")) this.members = { ...v.members };
    if (has("alerts")) this.alerts = list(v.alerts);
    if (has("audit")) this.audit = list(v.audit);
  }
}

/** Chat-Nachricht schreiben (Gruppenchat oder Direktkanal `dm` = Team-Id); der Server prüft Absender und Tempo */
export async function sendMessage(g: string, _me: unknown, text: string, channel: { dm?: string | undefined } = {}) {
  await call({ action: "chat", gameId: g, text, ...(channel.dm ? { dm: channel.dm } : {}) });
}
