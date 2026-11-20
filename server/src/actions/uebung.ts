// Übungsspiel (E-78) und Fehlermeldungen der App (E-79).
// Übungsspiel: nur im Probelauf. Die Spielleitung legt Computer-Teams an; ihr Browser rechnet die Schritte und
// schickt alle paar Sekunden die neuen Standorte (eine Anfrage für alle). Die Teams sind ganz normale Teams mit
// einem Mitglied ohne Gerät – Übergaben, Sperren und Bonus-Posten funktionieren damit wie im echten Spiel.
import { PROTOKOLL as P, teamColor, teamShort, type ApiResults } from "@mrx/shared";
import { randomId } from "../auth.ts";
import { fail } from "../util.ts";
import type { Auth, GameRoom } from "../room.ts";

type D = Record<string, unknown>;
const MAX_UEBUNG = 8;

export function uebungTeams(room: GameRoom, d: D, a: Auth): ApiResults["uebungTeams"] {
  const who = room.who(a, ["admin"]);
  if (!room.d.config.trial) fail("invalid", "Computer-Teams gibt es nur im Probelauf");
  if (room.d.state.phase !== "vorbereitung") fail("wrongPhase", "Computer-Teams nur vor dem Start anlegen");
  const anzahl = d.anzahl;
  if (typeof anzahl !== "number" || !Number.isInteger(anzahl) || anzahl < 1 || anzahl > MAX_UEBUNG)
    fail("invalid", `Anzahl: 1–${MAX_UEBUNG}`);
  const da = Object.values(room.d.teams).filter((t) => t.uebung).length;
  let neu = 0;
  for (let n = 1; da + neu < anzahl; n++) {
    const name = `Übung ${n}`;
    const list = Object.values(room.d.teams);
    if (list.some((t) => t.name === name)) continue;
    const teamId = randomId(9);
    room.put("teams", teamId, {
      name,
      short: teamShort(
        name,
        list.map((t) => t.short),
      ),
      color: teamColor(list.map((t) => t.color)),
      uebung: true,
    });
    room.put("members", randomId(), { role: "team", name, teamId, joinedAt: Date.now() });
    neu++;
  }
  if (neu) room.audit(who, P.uebungTeams, String(neu));
  return { neu };
}

/** neue Standorte der Computer-Teams (wie vom Handy, gleiche Prüfungen) */
export function uebungZug(room: GameRoom, d: D, a: Auth): ApiResults["uebungZug"] {
  room.who(a, ["admin"]);
  if (!room.d.config.trial) fail("invalid", "Computer-Teams gibt es nur im Probelauf");
  const pos = (d.pos ?? {}) as Record<string, { lat?: unknown; lng?: unknown }>;
  if (typeof pos !== "object" || Object.keys(pos).length > MAX_UEBUNG) fail("invalid", "Zu viele Standorte");
  const now = Date.now();
  for (const [t, p] of Object.entries(pos)) {
    if (!room.d.teams[t]?.uebung) continue;
    const uid = Object.keys(room.d.members).find((u) => room.d.members[u]!.teamId === t);
    if (uid) room.position(uid, { lat: p?.lat, lng: p?.lng, acc: 8, t: now, battery: 80 });
  }
  return {};
}

// ---------- Fehler in der App (E-79) ----------
/** pro Gerät höchstens 5 Meldungen in 10 Min, dieselbe Meldung nur einmal – sonst füllt eine Schleife das Protokoll */
const FEHLER_FENSTER = 10 * 60_000;
const FEHLER_MAX = 5;
/** höchstens so viele Fehler-Einträge im Protokoll – das Protokoll ist ein Wert im Speicher des Spielraums */
const FEHLER_GESAMT = 100;
const gemeldet = new Map<string, { t: number; text: string }[]>();

export function appFehler(room: GameRoom, d: D, a: Auth): ApiResults["appFehler"] {
  // nur wer mit Passwort beigetreten ist – Zuschauer brauchen keins und könnten sonst das Protokoll füllen
  const who = room.who(a, ["team", "schiri", "admin"]);
  const text = String(d.text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
  if (!text) return {};
  const now = Date.now();
  const key = `${room.d.gid}/${who.uid}`;
  const alt = (gemeldet.get(key) ?? []).filter((x) => now - x.t < FEHLER_FENSTER);
  if (alt.length >= FEHLER_MAX || alt.some((x) => x.text === text)) return {};
  if (Object.values(room.d.audit).filter((e) => e.action === P.appFehler).length >= FEHLER_GESAMT) return {};
  gemeldet.set(key, [...alt, { t: now, text }]);
  room.audit(who, P.appFehler, text);
  return {};
}
