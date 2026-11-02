// Ergänzungen nach dem ersten echten Spiel: Teamgröße, Team aufteilen, Notfall, Sammelruf und Vorlagen für Regeln und
// Spielfeld. Wie überall: alles wird hier geprüft, der Client ist nicht vertrauenswürdig.
import {
  DEFAULT_CONFIG,
  LIMITS,
  MELDUNG,
  PUSH_TITLE,
  sameName,
  teamColor,
  teamShort,
  type Alert,
  type ApiResults,
  type Config,
  type Field,
  type GameState,
  type MeetPoint,
  type Member,
  type TemplateEntry,
} from "@mrx/shared";
import { randomId } from "../auth.ts";
import { ensureSchema } from "../d1.ts";
import { fail, newKey, str } from "../util.ts";
import { validPos, type Auth, type GameRoom, type Who } from "../room.ts";

type D = Record<string, unknown>;

function intIn(v: unknown, [min, max]: readonly [number, number], what: string): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) fail("invalid", `${what}: ${min}–${max}`);
  return v;
}

/** Gerät gehört zu diesem Team → es darf für sein Team handeln; sonst nur die angegebenen Rollen */
function ownTeamOr(room: GameRoom, a: Auth, teamId: string, roles: Member["role"][]): { who: Who; own: boolean } {
  const m = a.uid ? room.d.members[a.uid] : undefined;
  if (m?.role === "team" && m.teamId === teamId) return { who: { uid: a.uid!, name: m.name, role: m.role }, own: true };
  return { who: room.who(a, roles), own: false };
}

// ---------- Teamgröße und Team aufteilen ----------

export function setTeamSize(room: GameRoom, d: D, a: Auth): ApiResults["setTeamSize"] {
  const t = String(d.teamId ?? "");
  const team = room.d.teams[t];
  if (!team) fail("invalid", "Team unbekannt");
  const { who } = ownTeamOr(room, a, t, ["admin"]);
  const size = intIn(d.size, LIMITS.teamSize, "Personen");
  room.put("teams", t, { ...team, size });
  room.audit(who, "Teamgröße", `${team.name}: ${size}`);
  return {};
}

/** Eine Gruppe teilt sich: neues Team mit den gewählten Geräten. Wer gerade wartet, wartet auch als neues Team. */
export function splitTeam(room: GameRoom, d: D, a: Auth): ApiResults["splitTeam"] {
  const who = room.who(a, ["admin"]);
  const t = String(d.teamId ?? "");
  const team = room.d.teams[t];
  if (!team) fail("invalid", "Team unbekannt");
  const name = str(d.name, LIMITS.teamName, "Teamname");
  if (Object.values(room.d.teams).some((o) => sameName(o.name, name))) fail("exists", "Diesen Teamnamen gibt es schon");
  const uids = Array.isArray(d.uids) ? [...new Set(d.uids.map(String))] : [];
  if (!uids.length) fail("invalid", "Mindestens ein Gerät muss ins neue Team");
  if (uids.some((u) => room.d.members[u]?.teamId !== t)) fail("invalid", "Gerät gehört nicht zu diesem Team");
  const size = d.size === undefined || d.size === null ? undefined : intIn(d.size, LIMITS.teamSize, "Personen");

  const id = randomId(9);
  const list = Object.values(room.d.teams);
  room.put("teams", id, {
    name,
    short: teamShort(
      name,
      list.map((x) => x.short),
    ),
    color: teamColor(list.map((x) => x.color)),
    ...(size ? { size } : {}),
  });
  if (size && team.size) room.put("teams", t, { ...team, size: Math.max(1, team.size - size) });
  const lock = room.d.locks[t];
  if (lock) room.put("locks", id, lock);
  for (const u of uids) {
    room.put("members", u, { ...room.d.members[u]!, teamId: id, name });
    // das Gerät gehört jetzt woanders hin: alles frisch (Chat-Kanal, Wartezeit, Team)
    room.afterCommit(() => room.resnap(u));
  }
  if (room.d.state.phase !== "vorbereitung") room.sys(MELDUNG.geteilt(team.name, name), Date.now());
  room.audit(who, "Team aufgeteilt", `${team.name} → ${name} (${uids.length} ${uids.length === 1 ? "Gerät" : "Geräte"})`);
  return { teamId: id };
}

// ---------- Notfall ----------

/** Notfall-Knopf: Spielleitung und Schiris bekommen sofort eine Meldung mit dem Standort (nicht abschaltbar) */
export function sos(room: GameRoom, d: D, a: Auth): ApiResults["sos"] {
  const m = a.uid ? room.d.members[a.uid] : undefined;
  if (!m || m.role !== "team" || !m.teamId) fail("forbidden");
  const open = Object.entries(room.d.alerts).find(([, x]) => x.teamId === m.teamId && !x.done);
  if (open) return { id: open[0] }; // schon gemeldet – nicht doppelt alarmieren
  const now = Date.now();
  const p = validPos(d.pos, now) ?? room.d.positions[m.teamId] ?? null;
  const id = newKey();
  const alert: Alert = { teamId: m.teamId, uid: a.uid!, t: now, ...(p ? { lat: p.lat, lng: p.lng, acc: p.acc } : {}) };
  room.put("alerts", id, alert);
  const name = room.d.teams[m.teamId]?.name ?? m.name;
  room.notify("notfall", { roles: ["admin", "schiri"] }, PUSH_TITLE.notfall, MELDUNG.notfall(name));
  room.audit({ uid: a.uid!, name: m.name, role: m.role }, "Notfall gemeldet", name);
  return { id };
}

/** erledigt (Spielleitung, Schiri) bzw. Fehlalarm (das Team selbst) */
export function sosDone(room: GameRoom, d: D, a: Auth): ApiResults["sosDone"] {
  const id = String(d.id ?? "");
  const alert = room.d.alerts[id];
  if (!alert) fail("invalid", "Notfall unbekannt");
  const { who, own } = ownTeamOr(room, a, alert.teamId, ["admin", "schiri"]);
  if (alert.done) return {};
  room.put("alerts", id, { ...alert, done: { t: Date.now(), by: who.name, ...(own ? { fehlalarm: true } : {}) } });
  const name = room.d.teams[alert.teamId]?.name ?? "";
  if (own) room.notify("notfall", { roles: ["admin", "schiri"] }, PUSH_TITLE.notfall, MELDUNG.notfallZurueck(name));
  room.audit(who, own ? "Notfall zurückgenommen" : "Notfall erledigt", name);
  return {};
}

// ---------- Sammelruf ----------

/** Treffpunkt aus dem Spielfeld, sonst die Mitte des Spielfelds */
function meetPoint(f: Field): MeetPoint | null {
  if (f.meet) return f.meet;
  const pts = f.base?.slice(0, -1) ?? [];
  if (pts.length < 3) return null;
  return {
    name: "Spielfeldmitte",
    lng: pts.reduce((s, p) => s + p[0], 0) / pts.length,
    lat: pts.reduce((s, p) => s + p[1], 0) / pts.length,
  };
}

export function gather(room: GameRoom, d: D, a: Auth): ApiResults["gather"] {
  const who = room.who(a, ["admin"]);
  const st = room.d.state;
  const now = Date.now();
  if (d.on === true) {
    if (st.phase === "vorbereitung") fail("wrongPhase", "Den Sammelruf gibt es, sobald das Spiel läuft oder vorbei ist");
    const meet = meetPoint(room.d.field);
    if (!meet) fail("invalid", "Kein Treffpunkt – im Spielfeld-Editor festlegen");
    room.setState({ ...st, gather: { name: meet.name, lat: meet.lat, lng: meet.lng, at: now } });
    room.sys(MELDUNG.sammelruf(meet.name), now);
    room.notify("durchsage", { all: true }, PUSH_TITLE.sammelruf, MELDUNG.sammelruf(meet.name));
    room.audit(who, "Sammelruf gestartet", meet.name);
  } else if (st.gather) {
    const { gather: _g, ...rest } = st;
    room.setState(rest as GameState);
    room.sys(MELDUNG.sammelrufEnde, now);
    room.audit(who, "Sammelruf beendet");
  }
  return {};
}

/** Ankunft am Treffpunkt: das Team selbst („Wir sind da“) oder die Spielleitung (auch zurücknehmen) */
export function arrived(room: GameRoom, d: D, a: Auth): ApiResults["arrived"] {
  const t = String(d.teamId ?? "");
  if (!room.d.teams[t]) fail("invalid", "Team unbekannt");
  const { own } = ownTeamOr(room, a, t, ["admin"]);
  const g = room.d.state.gather;
  if (!g) fail("wrongPhase", "Gerade gibt es keinen Sammelruf");
  const on = d.on !== false;
  if (own && !on) fail("forbidden");
  const arr = { ...g.arrived };
  if (on) arr[t] ??= Date.now();
  else delete arr[t];
  room.setState({ ...room.d.state, gather: { ...g, arrived: arr } });
  return {};
}

// ---------- Vorlagen ----------

interface TemplateData {
  config: Partial<Config>;
  field: Field;
}

export async function templateList(room: GameRoom, _d: D, a: Auth): Promise<ApiResults["templateList"]> {
  room.who(a, ["admin"]);
  await ensureSchema(room.env.DB);
  const r = await room.env.DB.prepare("SELECT id, name, createdAt FROM templates ORDER BY createdAt DESC").all<TemplateEntry>();
  return { templates: r.results };
}

/** Regeln, Regeltext, Durchsage-Vorlagen und Spielfeld (mit Essens-Orten und Treffpunkt) dieses Spiels merken */
export async function templateSave(room: GameRoom, d: D, a: Auth): Promise<ApiResults["templateSave"]> {
  const who = room.who(a, ["admin"]);
  const name = str(d.name, LIMITS.templateName, "Name der Vorlage");
  await ensureSchema(room.env.DB);
  const { trial: _t, ...config } = room.d.config;
  const data: TemplateData = { config, field: room.d.field };
  const id = randomId(12);
  await room.env.DB.prepare("INSERT INTO templates (id, name, createdAt, data) VALUES (?1, ?2, ?3, ?4)")
    .bind(id, name, Date.now(), JSON.stringify(data))
    .run();
  room.audit(who, "Vorlage gespeichert", name);
  return { id };
}

export async function templateLoad(room: GameRoom, d: D, a: Auth): Promise<ApiResults["templateLoad"]> {
  const who = room.who(a, ["admin"]);
  if (room.d.state.phase !== "vorbereitung") fail("wrongPhase", "Vorlagen nur vor dem Start laden");
  await ensureSchema(room.env.DB);
  const row = await room.env.DB.prepare("SELECT name, data FROM templates WHERE id = ?1")
    .bind(String(d.id ?? ""))
    .first<{ name: string; data: string }>();
  if (!row) fail("notFound", "Vorlage nicht gefunden");
  const data = JSON.parse(row.data) as TemplateData;
  const config: Config = { ...DEFAULT_CONFIG, ...data.config, ...(room.d.config.trial ? { trial: true } : {}) };
  room.set("config", config);
  room.set("info", { ...room.d.info!, spectators: config.spectators });
  room.set("field", data.field);
  // vorab gesperrte Bereiche, die es im neuen Spielfeld nicht gibt, aus dem Zustand nehmen
  const st = room.d.state;
  if (Object.keys(st.cuts ?? {}).some((id) => !data.field.cuts?.[id]))
    room.setState({ ...st, cuts: Object.fromEntries(Object.entries(st.cuts ?? {}).filter(([id]) => data.field.cuts?.[id])) });
  room.audit(who, "Vorlage geladen", row.name);
  return {};
}

export async function templateDelete(room: GameRoom, d: D, a: Auth): Promise<ApiResults["templateDelete"]> {
  const who = room.who(a, ["admin"]);
  await ensureSchema(room.env.DB);
  const id = String(d.id ?? "");
  const row = await room.env.DB.prepare("SELECT name FROM templates WHERE id = ?1").bind(id).first<{ name: string }>();
  if (!row) return {};
  await room.env.DB.prepare("DELETE FROM templates WHERE id = ?1").bind(id).run();
  room.audit(who, "Vorlage gelöscht", row.name);
  return {};
}
