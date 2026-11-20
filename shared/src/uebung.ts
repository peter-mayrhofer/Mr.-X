// Übungsspiel (E-78): Wie laufen die Computer-Teams? Reine Funktion, damit sie testbar ist; die App der
// Spielleitung ruft sie alle paar Sekunden für jedes Computer-Team auf und schickt die Ergebnisse an den Server.
// Jäger laufen zur letzten Meldung von Mister X, Mister X läuft vom nächsten Jäger weg, sonst bummeln alle herum.
// Wer das Spielfeld (ohne Sperrgebiete) verlassen würde, dreht um zur Mitte.
import { bearingDeg, distanceM, zoneStatus } from "./geo.ts";
import type { Field, Point } from "./types.ts";

export interface BotLage {
  /** wo das Team gerade ist */
  p: Point;
  /** bisherige Laufrichtung (Grad, 0 = Norden) */
  richtung: number;
  /** ist dieses Team Mister X? */
  mrx: boolean;
  /** Jäger: letzte Meldung von Mister X (falls es eine gibt) */
  ziel?: Point | null | undefined;
  /** Mister X: Standorte der Jäger */
  jaeger?: Point[];
  field: Field;
  locked: string[];
  /** Meter pro Schritt */
  schritt: number;
  /** Zufall 0–1 (im Test fest) */
  zufall: () => number;
}

const rad = (d: number) => (d * Math.PI) / 180;

/** Punkt `m` Meter in Richtung `grad` von `p` (für kurze Strecken genau genug) */
export function versetzt(p: Point, grad: number, m: number): Point {
  const dLat = (m * Math.cos(rad(grad))) / 111_320;
  const dLng = (m * Math.sin(rad(grad))) / (111_320 * Math.cos(rad(p.lat)));
  return { lat: p.lat + dLat, lng: p.lng + dLng };
}

/** Mitte des Spielfelds (Durchschnitt der Eckpunkte) */
export function feldMitte(field: Field): Point {
  const pts = field.base.slice(0, -1);
  return {
    lat: pts.reduce((s, q) => s + q[1], 0) / Math.max(1, pts.length),
    lng: pts.reduce((s, q) => s + q[0], 0) / Math.max(1, pts.length),
  };
}

export function botSchritt(l: BotLage): { p: Point; richtung: number } {
  let richtung = l.richtung + (l.zufall() - 0.5) * 60; // bummeln: leicht schwanken
  if (!l.mrx && l.ziel && distanceM(l.p, l.ziel) > 30) richtung = bearingDeg(l.p, l.ziel) + (l.zufall() - 0.5) * 40;
  if (l.mrx && l.jaeger?.length) {
    const naechster = l.jaeger.reduce((a, b) => (distanceM(l.p, a) <= distanceM(l.p, b) ? a : b));
    if (distanceM(l.p, naechster) < 400) richtung = bearingDeg(naechster, l.p) + (l.zufall() - 0.5) * 50;
  }
  let p = versetzt(l.p, richtung, l.schritt);
  if (zoneStatus(p, l.field, l.locked, 0) === "draussen") {
    richtung = bearingDeg(l.p, feldMitte(l.field)) + (l.zufall() - 0.5) * 30;
    p = versetzt(l.p, richtung, l.schritt);
  }
  return { p, richtung: ((richtung % 360) + 360) % 360 };
}
