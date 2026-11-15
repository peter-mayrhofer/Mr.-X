// Bonus-Posten (E-75): Die Spielleitung hängt QR-Codes auf; ein Jäger-Team scannt vor Ort und bekommt Richtung und
// ungefähre Entfernung zu Mister X – nur für sich, einmal pro Posten und Lauf. Geprüft wird alles hier: Unterschrift
// im Code, Spiel läuft, Team steht wirklich dort (eigener Standort), Posten noch nicht eingelöst.
import { bearingDeg, distanceM, FRESH_MS, PROTOKOLL as P, type ApiResults, type Point } from "@mrx/shared";
import { postenSig, sameText } from "../auth.ts";
import { fail } from "../util.ts";
import type { Auth, GameRoom } from "../room.ts";

type D = Record<string, unknown>;
/** so nah muss das Team am Posten sein – plus GPS-Ungenauigkeit (höchstens 40 m) */
export const POSTEN_M = 60;

/** Codes für die Druckblätter (nur Spielleitung): Kennung + Unterschrift */
export async function postenCodes(room: GameRoom, _d: D, a: Auth): Promise<ApiResults["postenCodes"]> {
  room.who(a, ["admin"]);
  const codes: Record<string, string> = {};
  for (const x of room.d.field.posten ?? []) codes[x.id] = `${x.id}.${await postenSig(room.env.TOKEN_SECRET, room.d.gid, x.id)}`;
  return { codes };
}

/** Wo ist Mister X jetzt? Frischer Standort, sonst die letzte Meldung seit der Übergabe */
function mrxAt(room: GameRoom): Point | null {
  const st = room.d.state;
  if (!st.mrx) return null;
  const p = room.d.positions[st.mrx];
  if (p && !p.suspect && Date.now() - p.t <= FRESH_MS) return p;
  const reports = Object.values(room.d.reports).filter((r) => !r.void && r.teamId === st.mrx && r.t >= (st.mrxSince ?? 0));
  return reports.sort((x, y) => y.t - x.t)[0] ?? null;
}

export async function posten(room: GameRoom, d: D, a: Auth): Promise<ApiResults["posten"]> {
  const who = room.who(a, ["team"]);
  // der Organisator darf alles der Spielleitung – ein Team ist er nie
  const t = room.d.members[who.uid]?.teamId;
  if (!t) fail("forbidden");
  const [id, sig] = String(d.code ?? "").split(".");
  const x = room.d.field.posten?.find((p) => p.id === id);
  if (!x || !sameText(await postenSig(room.env.TOKEN_SECRET, room.d.gid, x.id), sig)) fail("invalid", "Unbekannter Bonus-Posten");
  const st = room.d.state;
  if (st.phase !== "laeuft") fail("wrongPhase", "Bonus-Posten gibt es nur, während das Spiel läuft");
  const name = x.name;
  if (t === st.mrx) return { status: "mrx", name };
  const used = room.d.secrets.posten?.[t] ?? [];
  if (used.includes(x.id)) return { status: "schon", name };
  const p = room.d.positions[t];
  if (!p || p.suspect || Date.now() - p.t > FRESH_MS) return { status: "keinStandort", name };
  const weg = Math.round(distanceM(p, x));
  if (weg > POSTEN_M + Math.min(p.acc, 40)) return { status: "weit", name, m: weg };
  const z = mrxAt(room);
  // ohne Standort von Mister X bleibt der Posten gültig – später nochmal scannen
  if (!z) return { status: "keinMrx", name };
  room.set("secrets", { ...room.d.secrets, posten: { ...room.d.secrets.posten, [t]: [...used, x.id] } });
  room.audit(who, P.postenEingeloest, name);
  const m = distanceM(x, z);
  // grob: auf 50 m gerundet, unter 100 m nur „ganz nah“ (0); Richtung in Achteln (0 = Norden)
  return { status: "hinweis", name, m: m < 100 ? 0 : Math.round(m / 50) * 50, richtung: Math.round(bearingDeg(x, z) / 45) % 8 };
}
