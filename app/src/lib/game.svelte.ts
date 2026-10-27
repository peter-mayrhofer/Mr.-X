// Live-Daten eines Spiels für die Spiel-Ansichten (Team, Schiri, Spielleitung). Jede Ansicht liest nur, was ihre Rolle
// lesen darf (Rules) – darum sagt `watch`, welche Teile abonniert werden.
import { limitToLast, onValue, push, query, ref, serverTimestamp, update, type Unsubscribe } from "firebase/database";
import type { ChatMessage, Config, CutEvent, Field, GameState, Handover, Lock, Pause, Report, Team, TeamStats } from "@mrx/shared";
import { db } from "./firebase.ts";
import { clock } from "./clock.svelte.ts";

export type Keyed<T> = T & { id: string };
export type Msg = Keyed<ChatMessage>;

/** RTDB-Liste (Push-Schlüssel = zeitlich sortiert) → Array */
const list = <T>(v: Record<string, T> | null): Keyed<T>[] =>
  Object.entries(v ?? {})
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([id, x]) => ({ ...x, id }));

export class GameData {
  config = $state<Config | null>(null);
  field = $state<Field | null>(null);
  state = $state<GameState | null>(null);
  teams = $state<Record<string, Team>>({});
  reports = $state<Keyed<Report>[]>([]);
  handovers = $state<Keyed<Handover>[]>([]);
  locks = $state<Record<string, Lock>>({});
  pauses = $state<Keyed<Pause>[]>([]);
  cutLog = $state<Keyed<CutEvent>[]>([]);
  stats = $state<Record<string, TeamStats>>({});
  chat = $state<Msg[]>([]);
  dm = $state<Msg[]>([]);
  /** Verbindung zur Datenbank; `lastDataAt` = zuletzt verbunden */
  online = $state(true);
  lastDataAt = $state(Date.now());
  readonly loaded = $derived(!!this.config && !!this.field && !!this.state);

  /** Abonnieren; gibt die Abmeldung zurück (für $effect) */
  watch(g: string, o: { chat?: boolean; dmTeam?: string | undefined }): () => void {
    const p = `games/${g}`;
    const on = <T>(path: string, set: (v: T | null) => void, limit?: number): Unsubscribe =>
      onValue(
        limit ? query(ref(db, path), limitToLast(limit)) : ref(db, path),
        (s) => set(s.val() as T | null),
        () => set(null),
      );
    const subs: Unsubscribe[] = [
      on<Config>(`${p}/config`, (v) => (this.config = v)),
      on<Field>(`${p}/field`, (v) => (this.field = v)),
      on<GameState>(`${p}/state`, (v) => (this.state = v)),
      on<Record<string, Team>>(`${p}/teams`, (v) => (this.teams = v ?? {})),
      on<Record<string, Report>>(`${p}/reports`, (v) => (this.reports = list(v))),
      on<Record<string, Handover>>(`${p}/handovers`, (v) => (this.handovers = list(v))),
      on<Record<string, Lock>>(`${p}/locks`, (v) => (this.locks = v ?? {})),
      on<Record<string, Pause>>(`${p}/pauses`, (v) => (this.pauses = list(v))),
      on<Record<string, CutEvent>>(`${p}/cutLog`, (v) => (this.cutLog = list(v))),
      on<Record<string, TeamStats>>(`${p}/stats`, (v) => (this.stats = v ?? {})),
      on<boolean>(".info/connected", (v) => {
        this.online = v === true;
        if (v) this.lastDataAt = Date.now();
      }),
      // Server-Zeit für alle Countdowns (KONZEPT Abschnitt 5)
      on<number>(".info/serverTimeOffset", (v) => (clock.offset = v ?? 0)),
    ];
    if (o.chat) subs.push(on<Record<string, ChatMessage>>(`${p}/chat`, (v) => (this.chat = list(v)), 200));
    if (o.dmTeam) subs.push(on<Record<string, ChatMessage>>(`${p}/dm/${o.dmTeam}`, (v) => (this.dm = list(v)), 200));
    return () => subs.forEach((u) => u());
  }
}

/**
 * Chat-Nachricht schreiben. Die Rules verlangen Zeitstempel = Server-Zeit und denselben Stempel unter rate/{uid}
 * (max. 1 Nachricht pro 2 s) – darum beides in einem Schreibvorgang.
 */
export async function sendMessage(
  g: string,
  me: { uid: string; name: string; teamId?: string | undefined },
  text: string,
  channel: { dm?: string | undefined } = {},
) {
  const path = channel.dm ? `games/${g}/dm/${channel.dm}` : `games/${g}/chat`;
  const id = push(ref(db, path)).key!;
  await update(ref(db), {
    [`${path}/${id}`]: { uid: me.uid, name: me.name, text, t: serverTimestamp(), kind: "msg", ...(me.teamId ? { teamId: me.teamId } : {}) },
    [`games/${g}/rate/${me.uid}`]: serverTimestamp(),
  });
}
