// Spielfeld speichern (Zonen-Editor, Abschnitt 7.8). Nur vor dem Start oder nach dem Ende – im laufenden Spiel
// hängen Sperren und Warnungen am Spielfeld. Alles wird hier noch einmal geprüft, der Client ist nicht vertrauenswürdig.
import type { CallableRequest } from "firebase-functions/v2/https";
import { fieldProblems, type ApiResults, type Cut, type Field, type GameState, type LngLat, type Polygon } from "@mrx/shared";
import { audit, db, fail, gameId, requireRole, str, val } from "../util.ts";
import { changeState } from "../ablauf.ts";

const MAX_POINTS = 2000;
const MAX_CUTS = 12;
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

export async function setField(req: CallableRequest<Record<string, unknown>>): Promise<ApiResults["setField"]> {
  const g = gameId(req.data.gameId);
  const who = await requireRole(req, g, ["admin"]);
  const d = (req.data.field ?? {}) as Record<string, unknown>;
  const tol = d.toleranceM;
  if (typeof tol !== "number" || !Number.isInteger(tol) || tol < 0 || tol > 50) fail("invalid", "Toleranz: 0–50 m");
  const cutsIn = (d.cuts ?? {}) as Record<string, Record<string, unknown>>;
  if (typeof cutsIn !== "object" || Object.keys(cutsIn).length > MAX_CUTS) fail("invalid", `Höchstens ${MAX_CUTS} Sperrbereiche`);
  const cuts: Record<string, Cut> = {};
  for (const [id, c] of Object.entries(cutsIn)) {
    if (!CUT_ID.test(id)) fail("invalid", "Sperrbereich: ungültige Kennung");
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
  const field: Field = { name: str(d.name, [1, 60], "Name des Spielfelds"), toleranceM: tol, base: ring(d.base, "Spielfeld"), cuts };
  const p = fieldProblems(field)[0];
  if (p) fail("invalid", `${p.id === "base" ? "Spielfeld" : cuts[p.id]!.short}: ${TEXT[p.kind]}`);

  const st = await val<GameState>(`games/${g}/state`);
  if (st?.phase === "laeuft" || st?.phase === "pause") fail("wrongPhase", "Das Spielfeld kann nur vor dem Start geändert werden");
  // gesperrte Bereiche, die es nicht mehr gibt, aus dem Zustand nehmen
  if (Object.keys(st?.cuts ?? {}).some((id) => !cuts[id]))
    await changeState(g, (cur) => ({ ...cur, cuts: Object.fromEntries(Object.entries(cur.cuts ?? {}).filter(([id]) => cuts[id])) }));
  await db().ref(`games/${g}/field`).set(field);
  await audit(g, who, "Spielfeld gespeichert", `${field.base.length - 1} Punkte, ${Object.keys(cuts).length} Sperrbereiche`);
  return {};
}
