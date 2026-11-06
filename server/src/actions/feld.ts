// Spielfeld speichern (Zonen-Editor, Abschnitt 7.8) und Spiele archivieren/löschen (Super-Admin). Spielfeld nur vor dem
// Start oder nach dem Ende – im laufenden Spiel hängen Sperren und Warnungen daran. Alles wird hier noch einmal geprüft,
// der Client ist nicht vertrauenswürdig.
import { fieldProblems, type ApiResults, type Cut, type Field, type LngLat, type MeetPoint, type Polygon, type Spot } from "@mrx/shared";
import { fail, str } from "../util.ts";
import type { Auth, GameRoom } from "../room.ts";

type D = Record<string, unknown>;
const MAX_POINTS = 2000;
const MAX_CUTS = 12;
const MAX_SPOTS = 30;
const HEX = /^#[0-9a-fA-F]{6}$/;
const CUT_ID = /^[a-z0-9-]{1,30}$/;

function ring(v: unknown, what: string): Polygon {
  if (!Array.isArray(v) || v.length > MAX_POINTS) fail("invalid", `${what}: ungültige Punkte`);
  const pts = v.map((p): LngLat => {
    if (!Array.isArray(p) || p.length !== 2) fail("invalid", `${what}: ungültiger Punkt`);
    const [lng, lat] = p as unknown[];
    if (typeof lng !== "number" || typeof lat !== "number" || Math.abs(lat) > 90 || Math.abs(lng) > 180)
      fail("invalid", `${what}: ungültiger Punkt`);
    return [lng, lat];
  });
  const [a, z] = [pts[0], pts.at(-1)];
  if (a && z && (a[0] !== z[0] || a[1] !== z[1])) pts.push([a[0], a[1]]); // Ring schließen
  return pts;
}

const TEXT: Record<string, string> = {
  leer: "braucht mindestens 3 Punkte",
  kreuz: "die Linie kreuzt sich selbst",
  aussen: "liegt nicht im Spielfeld",
};

export function setField(room: GameRoom, d: D, a: Auth): ApiResults["setField"] {
  const who = room.who(a, ["admin"]);
  const f = (d.field ?? {}) as Record<string, unknown>;
  const tol = f.toleranceM;
  if (typeof tol !== "number" || !Number.isInteger(tol) || tol < 0 || tol > 50) fail("invalid", "Toleranz: 0–50 m");
  const cutsIn = (f.cuts ?? {}) as Record<string, Record<string, unknown>>;
  if (typeof cutsIn !== "object" || Object.keys(cutsIn).length > MAX_CUTS) fail("invalid", `Höchstens ${MAX_CUTS} Sperrbereiche`);
  const cuts: Record<string, Cut> = {};
  for (const [id, c] of Object.entries(cutsIn)) {
    if (!CUT_ID.test(id) || !c || typeof c !== "object") fail("invalid", "Sperrbereich: ungültige Kennung");
    const order = c.order;
    if (typeof order !== "number" || !Number.isInteger(order) || order < 1 || order > 20) fail("invalid", "Reihenfolge: 1–20");
    if (typeof c.color !== "string" || !HEX.test(c.color)) fail("invalid", "Farbe ungültig");
    cuts[id] = {
      name: str(c.name, [1, 80], "Name des Sperrbereichs"),
      short: str(c.short, [1, 20], "Kurzname"),
      color: c.color,
      order,
      poly: ring(c.poly, "Sperrbereich"),
    };
  }
  const spotsIn = f.spots ?? [];
  if (!Array.isArray(spotsIn) || spotsIn.length > MAX_SPOTS) fail("invalid", `Höchstens ${MAX_SPOTS} Essens-Orte`);
  const spots: Spot[] = spotsIn.map((s: Record<string, unknown>) => {
    const { lat, lng, radiusM } = s ?? {};
    if (typeof lat !== "number" || typeof lng !== "number" || Math.abs(lat) > 90 || Math.abs(lng) > 180)
      fail("invalid", "Essens-Ort: ungültiger Punkt");
    if (typeof radiusM !== "number" || !Number.isInteger(radiusM) || radiusM < 15 || radiusM > 100)
      fail("invalid", "Essens-Ort: Umkreis 15–100 m");
    return { name: str(s.name, [1, 60], "Name des Essens-Orts"), lat, lng, radiusM };
  });
  let meet: MeetPoint | undefined;
  if (f.meet !== undefined && f.meet !== null) {
    const m = f.meet as Record<string, unknown>;
    if (typeof m.lat !== "number" || typeof m.lng !== "number" || Math.abs(m.lat) > 90 || Math.abs(m.lng) > 180)
      fail("invalid", "Treffpunkt: ungültiger Punkt");
    meet = { name: str(m.name, [1, 60], "Name des Treffpunkts"), lat: m.lat, lng: m.lng };
  }
  const field: Field = {
    name: str(f.name, [1, 60], "Name des Spielfelds"),
    toleranceM: tol,
    base: ring(f.base, "Spielfeld"),
    cuts,
    ...(spots.length ? { spots } : {}),
    ...(meet ? { meet } : {}),
  };
  const p = fieldProblems(field)[0];
  if (p) fail("invalid", `${p.id === "base" ? "Spielfeld" : cuts[p.id]!.short}: ${TEXT[p.kind]}`);

  const st = room.d.state;
  if (st.phase === "laeuft" || st.phase === "pause") fail("wrongPhase", "Das Spielfeld kann nur vor dem Start geändert werden");
  // gesperrte Bereiche, die es nicht mehr gibt, aus dem Zustand nehmen
  if (Object.keys(st.cuts ?? {}).some((id) => !cuts[id]))
    room.setState({ ...st, cuts: Object.fromEntries(Object.entries(st.cuts ?? {}).filter(([id]) => cuts[id])) });
  room.set("field", field);
  room.audit(who, "Spielfeld gespeichert", `${field.base.length - 1} Punkte, ${Object.keys(cuts).length} Sperrbereiche`);
  return {};
}

const running = (room: GameRoom) => room.d.state.phase === "laeuft" || room.d.state.phase === "pause";

/** Archivieren (Abschnitt 5): Spiel bleibt lesbar (Archiv, Auswertung), aber niemand kann mehr beitreten */
export function archiveGame(room: GameRoom, d: D, a: Auth): ApiResults["archiveGame"] {
  if (!a.superAdmin) fail("forbidden");
  if (running(room)) fail("wrongPhase", "Zuerst das Spiel beenden");
  const on = d.archived !== false;
  const { archived: _, ...info } = room.d.info!;
  room.set("info", on ? { ...info, archived: true } : info);
  room.audit({ uid: "super", name: "Organisator", role: "superadmin" }, on ? "Spiel archiviert" : "Spiel reaktiviert");
  return {};
}

/** Endgültig löschen – mit allen Daten inkl. Archiv. Geräte im Spiel bekommen den Hinweis „entfernt“. */
export async function deleteGame(room: GameRoom, _d: D, a: Auth): Promise<ApiResults["deleteGame"]> {
  if (!a.superAdmin) fail("forbidden");
  if (running(room)) fail("wrongPhase", "Zuerst das Spiel beenden");
  const g = room.d.gid;
  await room.env.DB.batch([
    room.env.DB.prepare("DELETE FROM archive WHERE game = ?1").bind(g),
    room.env.DB.prepare("DELETE FROM games WHERE id = ?1").bind(g),
  ]);
  await room.destroy(true);
  return {};
}
