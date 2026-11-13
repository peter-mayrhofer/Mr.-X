// Spielraum (E-32): ein Durable Object pro Spiel. Hält den ganzen Spielzustand im Speicher, ist die einzige Stelle, die ihn
// ändert (eine Aktion nach der anderen – keine Wettläufe), verteilt Änderungen nach Rolle gefiltert über WebSockets
// (Hibernation: schlafende Verbindungen kosten nichts) und weckt sich per Alarm für Meldungen, Wartezeiten und Spielende.
import { DurableObject } from "cloudflare:workers";
import {
  FRESH_MS,
  PROTOCOL_VERSION,
  SEES_POSITIONS,
  distanceM,
  WS_CLOSE,
  pushTargets,
  stepCheck,
  uebersetze,
  type ApiCall,
  type ApiReply,
  type AuditEntry,
  type ChatMessage,
  type Config,
  type CutEvent,
  type Alert,
  type Device,
  type Field,
  type GameInfo,
  type GameState,
  type HandoverRecord,
  type Lock,
  type Member,
  type Note,
  type Patch,
  type Pause,
  type Position,
  type PositionIn,
  type PushKind,
  type PushReg,
  type PushSub,
  type PushTarget,
  type Report,
  type Role,
  type ServerMsg,
  type Team,
  type TeamStats,
  type View,
} from "@mrx/shared";
import { fail, newKey, reply, type Env } from "./util.ts";
import { sameText } from "./auth.ts";
import { sendPush } from "./webpush.ts";
import { ACTIONS } from "./actions/index.ts";
import { advance, foodStep, nextDue, purgeChat, type Presence } from "./ablauf.ts";

export interface Data {
  gid: string;
  info: GameInfo | null;
  config: Config;
  field: Field;
  state: GameState;
  teams: Record<string, Team>;
  reports: Record<string, Report>;
  handovers: Record<string, HandoverRecord>;
  locks: Record<string, Lock>;
  pauses: Record<string, Pause>;
  cutLog: Record<string, CutEvent>;
  stats: Record<string, TeamStats>;
  chat: Record<string, ChatMessage>;
  /** Direktkanäle: Team-Id → Nachrichten */
  dm: Record<string, Record<string, ChatMessage>>;
  members: Record<string, Member>;
  audit: Record<string, AuditEntry & { uid: string }>;
  positions: Record<string, Position>;
  staff: Record<string, Position & { name?: string }>;
  /** Notfälle der Teams */
  alerts: Record<string, Alert>;
  /** Tracker (Meilenstein 11) mit Zuordnung und letztem Standort */
  devices: Record<string, Device>;
  /** letzter angenommener Punkt je Team (nur am Server, für Strecke und Plausibilität – kein Bewegungsprofil) */
  track: Record<string, Position>;
  push: Record<string, PushReg>;
  secrets: {
    teamPw?: string;
    schiriCode?: string;
    adminPw?: string;
    screenKey?: string;
    endAt?: number;
    /** Schlüssel der Tracker (Teil der Geräte-Kennung) */
    deviceKeys?: Record<string, string>;
    /** „Futter-Profi“: Besuche (mind. 10 Min) und Zeit an Essens-Orten je Team – nur Zählerstände, keine Standorte */
    food?: Record<string, { visits: number; ms: number }>;
  };
  /** Fehlversuche beim Beitritt je IP (gehasht) */
  rate: Record<string, { n: number; since: number }>;
  /** Löschfrist: Chat dieses Laufs wird dann geleert (Datenschutz, F3) */
  purgeAt: number | null;
}
export type Key = keyof Data;

const KEYS: Key[] = [
  "gid",
  "info",
  "config",
  "field",
  "state",
  "teams",
  "reports",
  "handovers",
  "locks",
  "pauses",
  "cutLog",
  "stats",
  "chat",
  "dm",
  "members",
  "audit",
  "positions",
  "staff",
  "alerts",
  "devices",
  "track",
  "push",
  "secrets",
  "rate",
  "purgeAt",
];
/** Teile, die jedes Mitglied sieht */
const PUBLIC = new Set<string>(["info", "config", "field", "state", "teams", "reports", "handovers", "locks", "pauses", "cutLog", "stats"]);
/** Standorte, die nur gesammelt alle 2 s verteilt und höchstens alle 30 s gespeichert werden */
const LIVE_KEYS: Key[] = ["positions", "staff", "devices", "track", "stats"];
/** Tracker senden oft – mehr als ein Punkt alle 5 s bringt nichts */
const TRACKER_MIN_GAP_MS = 5000;
const POS_BATCH_MS = 2000;
const POS_SAVE_MS = 30_000;
const POS_MIN_GAP_MS = 1000;
/** Umkreis um den Treffpunkt, in dem ein Team beim Sammelruf als angekommen zählt */
export const GATHER_M = 60;
const PUSH_PER_RUN = 40; // Gratis-Tarif: 50 Unteranfragen pro Aufruf
const FRESH_SUB_MS = 5 * 60_000;
const CHAT_IN_VIEW = 200;
const AUDIT_IN_VIEW = 500;

export interface Auth {
  uid?: string;
  superAdmin?: boolean;
  /** Token mitgeschickt, aber ungültig/abgelaufen/für ein anderes Spiel → „Sitzung abgelaufen“ statt „nicht erlaubt“ */
  badToken?: boolean;
  ip?: string;
}
export interface Who {
  uid: string;
  name: string;
  role: Role | "superadmin";
}
interface Att {
  uid: string;
  seq: number;
  vis: boolean;
}
type Job = { uid: string; sub: PushSub; payload: string; topic: string };

const empty = (): Data => ({
  gid: "",
  info: null,
  config: undefined as unknown as Config,
  field: undefined as unknown as Field,
  state: { phase: "vorbereitung", rev: 0 },
  teams: {},
  reports: {},
  handovers: {},
  locks: {},
  pauses: {},
  cutLog: {},
  stats: {},
  chat: {},
  dm: {},
  members: {},
  audit: {},
  positions: {},
  staff: {},
  alerts: {},
  devices: {},
  track: {},
  push: {},
  secrets: {},
  rate: {},
  purgeAt: null,
});

const lastN = <T>(o: Record<string, T>, n: number): Record<string, T> => {
  const keys = Object.keys(o);
  return keys.length <= n
    ? o
    : Object.fromEntries(
        keys
          .sort()
          .slice(-n)
          .map((k) => [k, o[k]!]),
      );
};

type Out = { t: "snap"; v: number; view: View; vapid?: string } | { t: "patch"; p: Patch[] } | { t: "note"; n: Note };

export class GameRoom extends DurableObject<Env> {
  /** Bindungen (D1, Secrets) auch für die Aktionen in actions/ */
  declare readonly env: Env;
  d: Data = empty();
  #dirty = new Set<Key>();
  #patches: Patch[] = [];
  #notesOut: { to: string[]; n: Note }[] = [];
  /** letzte Benachrichtigungen – die Android-App holt verpasste mit dem nächsten Standort (POST /api/pos) */
  #notes: (Note & { to: string[] })[] = [];
  #pushQ: Job[] = [];
  /** Test-Postausgang statt echtem Versand */
  outbox: { kind: PushKind; title: string; body: string; to: string[]; push: string[]; t: number }[] = [];
  /** zuletzt beantwortete Anfragen (Kennung `rid`) → dieselbe Antwort, ohne nochmal auszuführen */
  #done = new Map<string, ApiReply>();
  #posAt = new Map<string, number>();
  /** wer gerade an einem Essens-Ort ist (nur im Speicher, wird nicht gespeichert) */
  readonly food = new Map<string, Presence>();
  #livePatches = new Map<string, Patch>();
  #liveTimer: ReturnType<typeof setTimeout> | undefined;
  #liveSavedAt = 0;
  #indexed = "";
  /** Verbrauch seit dem Aufwachen, so wie Cloudflare zählt (Lasttest, docs/CLOUDFLARE-LIMITS.md §5) */
  usage = { requests: 0, wsIn: 0, alarms: 0, rows: 0, wsOut: 0, bytesOut: {} as Record<string, number> };

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Herzschlag der Handys beantwortet die Laufzeit selbst – ohne den Spielraum aufzuwecken
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    void ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get<Data[Key]>(KEYS);
      for (const [k, v] of stored) (this.d as unknown as Record<string, unknown>)[k] = v;
    });
  }

  // ---------- Daten ändern ----------

  /** Teil ganz ersetzen */
  set<K extends Key>(key: K, value: Data[K]) {
    this.d[key] = value;
    this.#dirty.add(key);
    this.#patches.push([key as Patch[0], null, value ?? null]);
  }

  /** Eintrag `id` (bei `dm`: „teamId/nachrichtId“) setzen; null/undefined = löschen */
  put(key: Key, id: string, value: unknown) {
    const parts = id.split("/");
    let node = this.d[key] as unknown as Record<string, unknown>;
    for (const p of parts.slice(0, -1)) node = (node[p] ??= {}) as Record<string, unknown>;
    const last = parts.at(-1)!;
    if (value === null || value === undefined) delete node[last];
    else node[last] = value;
    this.#dirty.add(key);
    this.#patches.push([key as Patch[0], id, value ?? null]);
  }

  /** Spielzustand ändern (zählt `rev` hoch) */
  setState(next: GameState) {
    const mrxChanged = next.mrx !== this.d.state.mrx;
    this.set("state", { ...next, rev: (this.d.state.rev ?? 0) + 1 });
    // neuer Mister X: Schiris ohne Jäger-Sicht brauchen dessen Standort (und der alte verschwindet)
    if (mrxChanged && this.d.config.refereeHunters === false) this.resendPositions();
  }

  /** Protokoll (Abschnitt 7.7): wer hat wann was ausgelöst */
  audit(who: Who, action: string, details = "") {
    this.put("audit", newKey(), { t: Date.now(), uid: who.uid, name: who.name, role: who.role, action, details });
  }

  /** System-Nachricht im Chat; liefert die Kennung */
  sys(text: string, t: number, extra: Partial<ChatMessage> = {}): string {
    const id = newKey();
    this.put("chat", id, { uid: "system", name: "System", text, t, kind: "sys", ...extra } satisfies ChatMessage);
    return id;
  }

  /** Mitglied (oder Super-Admin) mit einer dieser Rollen – sonst Ablehnung */
  who(a: Auth, roles: Role[]): Who {
    const m = a.uid ? this.d.members[a.uid] : undefined;
    if (m && roles.includes(m.role)) return { uid: a.uid!, name: m.name, role: m.role };
    if (a.superAdmin) return { uid: "super", name: "Organisator", role: "superadmin" };
    if ((a.uid && !m) || a.badToken) fail("session", "Sitzung abgelaufen – bitte neu anmelden");
    fail(a.uid ? "forbidden" : "unauthenticated");
  }

  /** Gerät aus dem Spiel nehmen; offene Verbindungen bekommen den Grund und werden geschlossen */
  removeMember(uid: string, reason: "removed" | "session" | null) {
    this.put("members", uid, null);
    if (this.d.push[uid]) this.put("push", uid, null);
    if (this.d.staff[uid]) this.put("staff", uid, null);
    for (const ws of this.ctx.getWebSockets(uid)) {
      if (reason) this.#raw(ws, { t: "bye", reason });
      ws.close(reason ? WS_CLOSE[reason] : 1000, reason ?? "abgemeldet");
    }
  }

  /**
   * Benachrichtigung (Abschnitt 7.6): an verbundene Geräte über die Verbindung (Android zeigt sie lokal an), an Geräte
   * ohne sichtbare App per Web-Push. Ein Push ist eine Zugabe – schlägt er fehl, läuft das Spiel weiter.
   */
  notify(kind: PushKind, target: PushTarget, title: string, body: string) {
    const to = pushTargets(this.d.members, this.d.push, target, kind);
    if (!to.length) return;
    const n: Note = { id: newKey(), kind, title, body, t: Date.now() };
    this.#notes.push({ ...n, to });
    if (this.#notes.length > 50) this.#notes.shift();
    this.#notesOut.push({ to, n });
    const push: string[] = [];
    for (const uid of to) {
      const sub = this.d.push[uid]?.sub;
      if (!sub || this.ctx.getWebSockets(uid).some((ws) => (ws.deserializeAttachment() as Att).vis)) continue;
      push.push(uid);
      // in der Sprache des Geräts (Android übersetzt selbst, die Note oben bleibt deutsch)
      const l = this.d.push[uid]?.lang;
      const payload = { title: uebersetze(title, l), body: uebersetze(body, l), kind, tag: kind, link: "/#/spiel" };
      this.#pushQ.push({ uid, sub, topic: kind, payload: JSON.stringify(payload) });
    }
    if (this.env.TEST_HOOKS) {
      this.outbox.push({ kind, title, body, to, push, t: n.t });
      this.#pushQ = [];
    }
  }

  /** Änderungen speichern, verteilen, nächsten Alarm stellen. Am Ende jeder Aktion. */
  commit() {
    if (this.#dirty.size) {
      const o: Record<string, unknown> = {};
      for (const k of this.#dirty) o[k] = this.d[k];
      // ohne await: die Laufzeit bündelt Schreibvorgänge und hält Antworten zurück, bis sie gespeichert sind
      void this.ctx.storage.put(o);
      this.usage.rows += this.#dirty.size;
      if (LIVE_KEYS.some((k) => this.#dirty.has(k))) this.#liveSavedAt = Date.now();
      this.#dirty.clear();
    }
    const patches = this.#patches.splice(0);
    const notes = this.#notesOut.splice(0);
    if (patches.length || notes.length) this.#broadcast(patches, notes);
    for (const fn of this.#after.splice(0)) fn();
    void this.#schedule();
    this.#syncIndex();
  }

  // ---------- Aufrufe vom Worker ----------

  async api(req: ApiCall, a: Auth): Promise<ApiReply> {
    this.usage.requests++;
    const rid = typeof req.rid === "string" && req.rid.length <= 40 ? `${a.uid ?? "-"}:${req.rid}` : null;
    const again = rid ? this.#done.get(rid) : undefined;
    if (again) return again;
    const action = ACTIONS[req.action];
    const r = await reply(async () => {
      if (!action) fail("invalid", "Unbekannte Aktion");
      if (!this.d.info && req.action !== "gameInfo" && req.action !== "createGame") fail("notFound", "Spiel nicht gefunden");
      try {
        return await action(this, req as unknown as Record<string, unknown>, a);
      } finally {
        this.commit();
      }
    });
    if (rid) {
      this.#done.set(rid, r);
      if (this.#done.size > 200) this.#done.delete(this.#done.keys().next().value!);
    }
    return r;
  }

  /** Android-App im Hintergrund: Standort per HTTP, Antwort = Benachrichtigungen seit `since` */
  nativePos(uid: string, p: PositionIn, since: number): ApiReply<{ notes: Note[] }> {
    this.usage.requests++;
    if (!this.d.members[uid]) return { ok: false, reason: "session", message: "Sitzung abgelaufen" };
    this.position(uid, p);
    const notes = this.#notes.filter((n) => n.t > since && n.to.includes(uid)).map(({ to: _, ...n }) => n);
    return { ok: true, result: { notes } };
  }

  /** Spiel komplett löschen (Super-Admin): Speicher, Alarm, Verbindungen */
  async destroy(force = false): Promise<ApiReply> {
    if (!force && (this.d.state.phase === "laeuft" || this.d.state.phase === "pause"))
      return { ok: false, reason: "wrongPhase", message: "Zuerst das Spiel beenden" };
    for (const ws of this.ctx.getWebSockets()) {
      this.#raw(ws, { t: "bye", reason: "removed" });
      ws.close(WS_CLOSE.removed, "Spiel gelöscht");
    }
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    this.d = empty();
    this.#indexed = "";
    return { ok: true, result: {} };
  }

  // ---------- Live-Verbindungen ----------

  override async fetch(req: Request): Promise<Response> {
    this.usage.requests++;
    const uid = req.headers.get("x-uid") ?? "";
    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
    const ok = !!this.d.info && !!this.d.members[uid];
    const version = new URL(req.url).searchParams.get("v");
    if (!ok || version !== String(PROTOCOL_VERSION)) {
      // Verbindung annehmen, Grund sagen, schließen – sonst versucht es das Handy endlos weiter
      server.accept();
      const reason = ok ? "version" : "session";
      server.send(JSON.stringify({ t: "bye", reason } satisfies ServerMsg));
      server.close(WS_CLOSE[reason], reason);
    } else {
      this.ctx.acceptWebSocket(server, [uid]);
      server.serializeAttachment({ uid, seq: 0, vis: true } satisfies Att);
      this.#snap(server);
    }
    return new Response(null, { status: 101, webSocket: client, headers: { "Sec-WebSocket-Protocol": "mrx" } });
  }

  override webSocketMessage(ws: WebSocket, msg: string | ArrayBuffer) {
    this.usage.wsIn++;
    if (typeof msg !== "string" || msg.length > 2000) return;
    const a = ws.deserializeAttachment() as Att;
    let m: { t?: string; p?: unknown; on?: unknown };
    try {
      m = JSON.parse(msg) as typeof m;
    } catch {
      return;
    }
    if (m.t === "pos") this.position(a.uid, m.p);
    else if (m.t === "resync") this.#snap(ws);
    else if (m.t === "vis") ws.serializeAttachment({ ...a, vis: m.on === true });
  }

  override webSocketClose(ws: WebSocket, code: number) {
    try {
      ws.close(code === 1005 ? 1000 : code);
    } catch {
      /* schon zu */
    }
  }

  /** Was dieses Gerät sehen darf (Abschnitt 6 + 9.2) – nie mehr, auch nicht „versteckt“ */
  view(uid: string): View {
    const d = this.d;
    const m = d.members[uid]!;
    const v: View = {
      info: d.info!,
      config: d.config,
      field: d.field,
      state: d.state,
      teams: d.teams,
      reports: d.reports,
      handovers: d.handovers,
      locks: d.locks,
      pauses: d.pauses,
      cutLog: d.cutLog,
      stats: d.stats,
      me: this.#me(uid)!,
    };
    if (m.role !== "viewer") v.chat = lastN(d.chat, CHAT_IN_VIEW);
    if (m.role === "admin") v.dm = Object.fromEntries(Object.entries(d.dm).map(([t, c]) => [t, lastN(c, CHAT_IN_VIEW)]));
    else if (m.role === "team" && m.teamId) v.dm = { [m.teamId]: lastN(d.dm[m.teamId] ?? {}, CHAT_IN_VIEW) };
    if (SEES_POSITIONS.includes(m.role)) {
      v.positions = this.#hidesHunters(m) ? this.#onlyMrx(d.positions) : d.positions;
      v.staff = d.staff;
      v.devices = this.#hidesHunters(m) ? this.#devicesWithoutHunters(d.devices) : d.devices;
    }
    if (m.role === "admin" || m.role === "schiri") v.alerts = d.alerts;
    else if (m.role === "team" && m.teamId)
      v.alerts = Object.fromEntries(Object.entries(d.alerts).filter(([, x]) => x.teamId === m.teamId));
    if (m.role === "admin") {
      v.members = d.members;
      v.audit = lastN(d.audit, AUDIT_IN_VIEW);
    }
    return v;
  }

  /** Spielleitung hat für Schiris die Jäger ausgeblendet (Steuerung → Schalter) */
  #hidesHunters(m: Member) {
    return m.role === "schiri" && this.d.config.refereeHunters === false;
  }
  #onlyMrx(positions: Record<string, Position> | null): Record<string, Position> {
    const mrx = this.d.state.mrx;
    return mrx && positions?.[mrx] ? { [mrx]: positions[mrx] } : {};
  }
  /** Tracker der Jäger-Teams ohne Standort; Fahne und Mister-X-Tracker bleiben */
  #hunterDevice(dev: Device | null): Device | null {
    if (!dev || !dev.assign || dev.assign === "fahne" || dev.assign === this.d.state.mrx) return dev;
    const { pos: _p, ...rest } = dev;
    return rest;
  }
  #devicesWithoutHunters(devices: Record<string, Device> | null): Record<string, Device> {
    return Object.fromEntries(Object.entries(devices ?? {}).map(([id, dev]) => [id, this.#hunterDevice(dev)!]));
  }

  #after: (() => void)[] = [];
  /** nach dem Verteilen der Änderungen ausführen (z. B. frischer Snapshot für umgezogene Geräte) */
  afterCommit(fn: () => void) {
    this.#after.push(fn);
  }
  /** Gerät bekommt einen frischen Snapshot (alle offenen Verbindungen) */
  resnap(uid: string) {
    for (const ws of this.ctx.getWebSockets(uid)) this.#snap(ws);
  }

  /** Standorte (und Tracker) noch einmal komplett verteilen – z. B. wenn Schiris die Jäger nicht mehr sehen dürfen */
  resendPositions() {
    this.#patches.push(["positions", null, this.d.positions], ["devices", null, this.d.devices]);
  }

  #me(uid: string): View["me"] | null {
    const m = this.d.members[uid];
    if (!m) return null;
    const p = this.d.push[uid];
    return { ...m, uid, push: { on: !!p?.sub, prefs: p?.prefs ?? {} } };
  }

  /** Darf dieses Mitglied diese Änderung sehen? Unbekannte Teile nie. */
  #filter(m: Member, [key, id, value]: Patch): Patch | null {
    if (PUBLIC.has(key)) return [key, id, value];
    switch (key) {
      case "chat":
        return m.role === "viewer" ? null : [key, id, value];
      case "dm":
        if (m.role === "admin") return [key, id, value];
        if (m.role !== "team" || !m.teamId) return null;
        if (id === null) return [key, null, { [m.teamId]: (value as Data["dm"] | null)?.[m.teamId] ?? {} }];
        return id.split("/")[0] === m.teamId ? [key, id, value] : null;
      case "positions":
        if (!SEES_POSITIONS.includes(m.role)) return null;
        if (!this.#hidesHunters(m)) return [key, id, value];
        if (id === null) return [key, null, this.#onlyMrx(value as Record<string, Position> | null)];
        return id === this.d.state.mrx ? [key, id, value] : null;
      case "devices":
        if (!SEES_POSITIONS.includes(m.role)) return null;
        if (!this.#hidesHunters(m)) return [key, id, value];
        if (id === null) return [key, null, this.#devicesWithoutHunters(value as Record<string, Device> | null)];
        return [key, id, this.#hunterDevice(value as Device | null)];
      case "staff":
        return SEES_POSITIONS.includes(m.role) ? [key, id, value] : null;
      case "alerts":
        if (m.role === "admin" || m.role === "schiri") return [key, id, value];
        if (m.role !== "team" || !m.teamId) return null;
        if (id === null)
          return [
            key,
            null,
            Object.fromEntries(Object.entries((value ?? {}) as Record<string, Alert>).filter(([, x]) => x.teamId === m.teamId)),
          ];
        // gelöschte Einträge (null) kennt das Team nur, wenn es seine waren – null verrät nichts
        return value === null || (value as Alert).teamId === m.teamId ? [key, id, value] : null;
      case "members":
      case "audit":
        return m.role === "admin" ? [key, id, value] : null;
      default:
        return null;
    }
  }

  #raw(ws: WebSocket, msg: ServerMsg) {
    try {
      const s = JSON.stringify(msg);
      ws.send(s);
      const role = this.d.members[(ws.deserializeAttachment() as Att | null)?.uid ?? ""]?.role ?? "-";
      this.usage.wsOut++;
      this.usage.bytesOut[role] = (this.usage.bytesOut[role] ?? 0) + s.length;
    } catch {
      /* Verbindung gerade weg */
    }
  }

  #send(ws: WebSocket, msg: Out) {
    const a = ws.deserializeAttachment() as Att;
    a.seq++;
    ws.serializeAttachment(a);
    this.#raw(ws, { ...msg, seq: a.seq, now: Date.now() } as ServerMsg);
  }

  #snap(ws: WebSocket) {
    const a = ws.deserializeAttachment() as Att;
    if (!this.d.members[a.uid]) return;
    a.seq = 0;
    ws.serializeAttachment(a);
    this.#send(ws, {
      t: "snap",
      v: PROTOCOL_VERSION,
      view: this.view(a.uid),
      ...(this.env.VAPID_PUBLIC ? { vapid: this.env.VAPID_PUBLIC } : {}),
    });
  }

  #broadcast(patches: Patch[], notes: { to: string[]; n: Note }[]) {
    // eigene Mitgliedschaft/Push-Einstellung geändert → „me“ neu
    const meChanged = new Set<string>();
    for (const [k, id] of patches)
      if (k === ("push" as string) || k === "members") {
        if (id) meChanged.add(id);
        else for (const uid of Object.keys(this.d.members)) meChanged.add(uid);
      }
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() as Att;
      const m = this.d.members[a.uid];
      if (!m) continue;
      // ein Patch ist selbst ein Array – darum [f] (flatMap würde ihn sonst auseinandernehmen)
      const p = patches.flatMap((x) => {
        const f = this.#filter(m, x);
        return f ? [f] : [];
      });
      if (meChanged.has(a.uid)) p.push(["me", null, this.#me(a.uid)]);
      if (p.length) this.#send(ws, { t: "patch", p });
      for (const { to, n } of notes) if (to.includes(a.uid)) this.#send(ws, { t: "note", n });
    }
  }

  // ---------- Standorte ----------

  /** Standort eines Geräts (WebSocket oder POST /api/pos). Ungültiges wird still verworfen. */
  position(uid: string, raw: unknown) {
    const m = this.d.members[uid];
    const now = Date.now();
    if (!m || this.d.state.phase === "beendet" || now - (this.#posAt.get(uid) ?? 0) < POS_MIN_GAP_MS) return;
    const p = validPos(raw, now);
    if (!p) return;
    this.#posAt.set(uid, now);
    if (m.role === "team" && m.teamId) {
      // Tracker des Teams hat Vorrang vor dem Handy, solange er frisch sendet
      if (Object.values(this.d.devices).some((dev) => dev.assign === m.teamId && dev.pos && now - dev.pos.t <= FRESH_MS)) return;
      this.#teamPos(m.teamId, p);
    } else if (m.role === "schiri" || m.role === "admin") {
      const s = { ...p, name: m.name };
      this.d.staff[uid] = s;
      this.#live("staff", uid, s);
    }
  }

  /** neuer Standort eines Teams (Handy oder Tracker): Plausibilität, Strecke, verteilen */
  #teamPos(t: string, p: Position) {
    if (this.d.state.phase === "laeuft") {
      // Plausibilität und Strecke (E-09): nur gegen den letzten angenommenen Punkt
      const step = stepCheck(this.d.track[t] ?? null, p);
      if (step.kind === "jump") p.suspect = true;
      else if (step.kind === "reset" || step.kind === "move") {
        this.d.track[t] = { lat: p.lat, lng: p.lng, acc: p.acc, t: p.t };
        if (step.kind === "move") {
          const s = { distM: (this.d.stats[t]?.distM ?? 0) + Math.round(step.distM) };
          this.d.stats[t] = s;
          this.#live("stats", t, s);
        }
      }
      foodStep(this, t, p);
    }
    // Sammelruf: wer im Umkreis des Treffpunkts ist, gilt als angekommen
    const g = this.d.state.gather;
    if (g && !g.arrived?.[t] && !p.suspect && p.acc <= 50 && distanceM(p, g) <= GATHER_M)
      this.setState({ ...this.d.state, gather: { ...g, arrived: { ...g.arrived, [t]: p.t } } });
    this.d.positions[t] = p;
    this.#live("positions", t, p);
  }

  #live(key: Key, id: string, value: unknown) {
    this.#livePatches.set(`${key}/${id}`, [key as Patch[0], id, value]);
    if (!this.#liveTimer) this.#liveTimer = setTimeout(() => this.#flushLive(), POS_BATCH_MS);
  }

  /**
   * Standort von einem Tracker (POST/GET /tracker, Meilenstein 11). `key` = Schlüssel aus der Geräte-Kennung.
   * Fahne → erste Quelle für Mister-X-Meldungen; Team → Standort des Teams. Liefert false bei unbekanntem Schlüssel.
   */
  trackerPos(key: string, raw: unknown): boolean {
    this.usage.requests++;
    const keys = this.d.secrets.deviceKeys ?? {};
    const id = Object.keys(keys).find((k) => sameText(key, keys[k]));
    const dev = id ? this.d.devices[id] : undefined;
    if (!id || !dev) return false;
    const now = Date.now();
    if (this.d.state.phase === "beendet" || now - (this.#posAt.get(`dev:${id}`) ?? 0) < TRACKER_MIN_GAP_MS) return true;
    const p = validPos(raw, now);
    if (!p) return true;
    this.#posAt.set(`dev:${id}`, now);
    p.tracker = true;
    const next = { ...dev, pos: p };
    this.d.devices[id] = next;
    this.#live("devices", id, next);
    if (dev.assign && dev.assign !== "fahne" && this.d.teams[dev.assign]) this.#teamPos(dev.assign, { ...p });
    return true;
  }

  /** gesammelte Standorte verteilen (höchstens alle 2 s) und gelegentlich speichern (höchstens alle 30 s) */
  #flushLive() {
    this.#liveTimer = undefined;
    const patches = [...this.#livePatches.values()];
    this.#livePatches.clear();
    if (patches.length) this.#broadcast(patches, []);
    if (Date.now() - this.#liveSavedAt >= POS_SAVE_MS) {
      this.#liveSavedAt = Date.now();
      void this.ctx.storage.put(Object.fromEntries(LIVE_KEYS.map((k) => [k, this.d[k]])));
      this.usage.rows += LIVE_KEYS.length;
    } else if (patches.length) this.#liveTimer = setTimeout(() => this.#flushLive(), POS_SAVE_MS);
  }

  // ---------- Zeitsteuerung ----------

  async #schedule() {
    const due = Math.min(nextDue(this.d) ?? Infinity, this.d.purgeAt ?? Infinity, this.#pushQ.length ? Date.now() : Infinity);
    const cur = await this.ctx.storage.getAlarm();
    if (due === Infinity) {
      if (cur !== null) await this.ctx.storage.deleteAlarm();
    } else if (cur !== due) {
      await this.ctx.storage.setAlarm(due);
      this.usage.rows++;
    }
  }

  /** Alarm: fällige Meldung, Wartezeiten, Spielende, Löschfrist; dann Pushes senden. Auch ohne ein Handy online. */
  override async alarm() {
    this.usage.alarms++;
    await this.tick();
  }

  async tick(now = Date.now()): Promise<string[]> {
    const done = this.d.info ? advance(this, now) : [];
    if (this.d.purgeAt && this.d.purgeAt <= now) {
      purgeChat(this);
      done.push("loeschfrist");
    }
    this.commit();
    await this.#drainPush();
    void this.#schedule();
    return done;
  }

  async #drainPush() {
    const batch = this.#pushQ.splice(0, PUSH_PER_RUN);
    if (!batch.length || !this.env.VAPID_PUBLIC || !this.env.VAPID_PRIVATE) return;
    const vapid = { publicKey: this.env.VAPID_PUBLIC, privateKey: this.env.VAPID_PRIVATE, subject: this.env.VAPID_SUBJECT };
    const dead = await Promise.all(
      batch.map(async (j) => {
        try {
          const status = await sendPush(j.sub, j.payload, vapid, j.topic);
          // Antwort des Push-Dienstes ins Protokoll (wrangler tail / Dashboard): 201 = angenommen
          console.log("Push", status, new URL(j.sub.endpoint).host);
          return status === 404 || status === 410 ? j : null;
        } catch (e) {
          console.warn("Push fehlgeschlagen", String(e));
          return null;
        }
      }),
    );
    // Abo gibt es nicht mehr (App deinstalliert, Erlaubnis entzogen) → vergessen. Ein eben angelegtes Abo kennt Google
    // manchmal noch nicht und antwortet trotzdem 410 (im Push-Test gesehen) – das behalten, die nächste Meldung kommt an
    for (const j of dead) {
      const reg = j && this.d.push[j.uid];
      if (j && reg?.sub?.endpoint === j.sub.endpoint && (reg.t ?? 0) < Date.now() - FRESH_SUB_MS)
        this.put("push", j.uid, { ...reg, sub: undefined });
    }
    this.commit();
  }

  /** Spieleliste der Verwaltung (D1) aktuell halten: Phase, Anzahl Teams, archiviert */
  #syncIndex() {
    const info = this.d.info;
    if (!info || !this.d.gid) return;
    const key = `${info.phase}|${Object.keys(this.d.teams).length}|${info.archived ? 1 : 0}`;
    if (key === this.#indexed) return;
    this.#indexed = key;
    void this.env.DB.prepare("UPDATE games SET phase = ?1, teams = ?2, archived = ?3 WHERE id = ?4")
      .bind(info.phase, Object.keys(this.d.teams).length, info.archived ? 1 : 0, this.d.gid)
      .run()
      .catch((e: unknown) => console.warn("Spieleliste", String(e)));
  }

  // ---------- nur Tests (TEST_HOOKS) ----------

  async test(op: "get" | "set" | "tick" | "outbox" | "drop" | "usage", path = "", value?: unknown): Promise<unknown> {
    if (!this.env.TEST_HOOKS) throw new Error("nur in Tests");
    if (op === "tick") return this.tick();
    if (op === "outbox") return this.outbox;
    if (op === "usage") return this.usage;
    // Funkloch nachstellen: alle Verbindungen ohne Abschiedsgrund trennen
    if (op === "drop") return this.ctx.getWebSockets().forEach((ws) => ws.close(1012, "Neustart"));
    const parts = path.split("/").filter(Boolean);
    if (op === "get") return parts.reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], this.d) ?? null;
    const [key, ...rest] = parts as [Key, ...string[]];
    if (!rest.length) this.set(key, (value ?? (key === "info" || key === "purgeAt" ? null : {})) as never);
    else this.put(key, rest.join("/"), value);
    this.commit();
    return null;
  }
}

/** Standort prüfen: nur erwartete Felder, gültige Bereiche, Messzeit höchstens 15 Min alt und nicht in der Zukunft */
export function validPos(raw: unknown, now: number): Position | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown, min: number, max: number) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
  if (!num(r.lat, -90, 90) || !num(r.lng, -180, 180) || !num(r.acc, 0, 100_000) || !num(r.t, now - 15 * 60_000, now + 60_000)) return null;
  const p: Position = { lat: r.lat as number, lng: r.lng as number, acc: Math.round(r.acc as number), t: r.t as number };
  if (num(r.heading, 0, 359.999)) p.heading = Math.round(r.heading as number) % 360;
  if (num(r.battery, 0, 100)) p.battery = Math.round(r.battery as number);
  return p;
}
