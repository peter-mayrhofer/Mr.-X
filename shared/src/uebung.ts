// Übungsspiel (E-78): Wie laufen die Computer-Teams? Reine Funktion, damit sie testbar ist; die App der
// Spielleitung ruft sie alle paar Sekunden für jedes Computer-Team auf und schickt die Ergebnisse an den Server.
// Jäger laufen zur letzten Meldung von Mister X, Mister X läuft vom nächsten Jäger weg, sonst bummeln alle herum.
// Mit Straßennetz (E-82) gehen sie auf Straßen und Wegen und planen ihren Weg darüber; ohne (Karte noch nicht
// geladen, kein Netz) gerade Schritte, die mindestens RAND_M innerhalb der Grenzlinie bleiben.
import { bearingDeg, distanceM, distanceToEdgeM, inPolygon, zoneStatus } from "./geo.ts";
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

const RAND_M = 15;
/** erst geradeaus, dann immer weiter abdrehen – so gleitet ein Team an der Grenze entlang statt hin und her */
const DREH = [0, 30, -30, 60, -60, 90, -90, 120, -120, 150, -150, 180];
const norm = (g: number) => ((g % 360) + 360) % 360;

export function botSchritt(l: BotLage): { p: Point; richtung: number } {
  let richtung = l.richtung + (l.zufall() - 0.5) * 60; // bummeln: leicht schwanken
  if (!l.mrx && l.ziel && distanceM(l.p, l.ziel) > 30) richtung = bearingDeg(l.p, l.ziel) + (l.zufall() - 0.5) * 40;
  if (l.mrx && l.jaeger?.length) {
    const naechster = l.jaeger.reduce((a, b) => (distanceM(l.p, a) <= distanceM(l.p, b) ? a : b));
    if (distanceM(l.p, naechster) < 400) richtung = bearingDeg(naechster, l.p) + (l.zufall() - 0.5) * 50;
  }
  // streng: ohne die Toleranz jenseits der Linie, und Abstand zu Grenze und Sperrgebieten
  const streng = { ...l.field, toleranceM: 0 };
  for (const d of DREH) {
    const p = versetzt(l.p, richtung + d, l.schritt);
    if (zoneStatus(p, streng, l.locked, RAND_M) === "drinnen") return { p, richtung: norm(richtung + d) };
  }
  // eingeklemmt (etwa Start direkt am Rand): zur Mitte
  richtung = bearingDeg(l.p, feldMitte(l.field));
  return { p: versetzt(l.p, richtung, l.schritt), richtung: norm(richtung) };
}

// ---------- Straßennetz (E-82) ----------

/** Knoten (Kreuzungen und Wegpunkte) und ihre Nachbarn */
export interface Netz {
  pts: Point[];
  nb: number[][];
}

/** Kachel-Nummer (Web-Mercator) für einen Punkt */
export function kachel(p: Point, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const y = (1 - Math.log(Math.tan(rad(p.lat)) + 1 / Math.cos(rad(p.lat))) / Math.PI) / 2;
  return { x: Math.floor(((p.lng + 180) / 360) * n), y: Math.floor(y * n) };
}

/** Punkt in einer Kachel (px, py von 0 bis extent) → Länge/Breite */
export function kachelPunkt(x: number, y: number, z: number, px: number, py: number, extent: number): Point {
  const n = 2 ** z;
  const gy = (y + py / extent) / n;
  return { lng: ((x + px / extent) / n) * 360 - 180, lat: (Math.atan(Math.sinh(Math.PI * (1 - 2 * gy))) * 180) / Math.PI };
}

/**
 * Straßennetz aus Linien: gleiche Punkte sind dieselbe Kreuzung. Nur Stücke im Spielfeld (mit Toleranz – Grenzstraßen
 * gehören dazu, Regel 9), und nur das größte zusammenhängende Netz, damit jeder Knoten jeden erreicht.
 */
export function strassenNetz(linien: Point[][], field: Field): Netz {
  const lngs = field.base.map((q) => q[0]);
  const lats = field.base.map((q) => q[1]);
  const pad = (field.toleranceM + 5) / 70_000; // grob in Grad, nur Vorfilter
  const [s, n, w, o] = [Math.min(...lats) - pad, Math.max(...lats) + pad, Math.min(...lngs) - pad, Math.max(...lngs) + pad];
  const imRahmen = (p: Point) => p.lat > s && p.lat < n && p.lng > w && p.lng < o;
  const idx = new Map<string, number>();
  const pts: Point[] = [];
  const nb: Set<number>[] = [];
  const drin: boolean[] = [];
  const knoten = (p: Point) => {
    const k = `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
    let i = idx.get(k);
    if (i === undefined) {
      i = pts.push(p) - 1;
      idx.set(k, i);
      nb.push(new Set());
      // wie inField, aber mit genauem Abstand statt 32 Prüfpunkten – sonst dauert das Netz über eine Sekunde
      drin.push(imRahmen(p) && (inPolygon(p, field.base) || distanceToEdgeM(p, field.base) <= field.toleranceM));
    }
    return i;
  };
  for (const l of linien)
    for (let k = 1; k < l.length; k++) {
      const a = knoten(l[k - 1]!);
      const b = knoten(l[k]!);
      if (a !== b && drin[a] && drin[b]) {
        nb[a]!.add(b);
        nb[b]!.add(a);
      }
    }
  // größtes zusammenhängendes Stück
  const teil = new Int32Array(pts.length).fill(-1);
  let best = -1;
  let bestN = 0;
  for (let a = 0; a < pts.length; a++) {
    if (teil[a] !== -1 || !nb[a]!.size) continue;
    const stapel = [a];
    teil[a] = a;
    let anz = 0;
    while (stapel.length) {
      const i = stapel.pop()!;
      anz++;
      for (const j of nb[i]!)
        if (teil[j] === -1) {
          teil[j] = a;
          stapel.push(j);
        }
    }
    if (anz > bestN) {
      best = a;
      bestN = anz;
    }
  }
  const neu = new Map<number, number>();
  const out: Netz = { pts: [], nb: [] };
  for (let i = 0; i < pts.length; i++) if (teil[i] === best) neu.set(i, out.pts.push(pts[i]!) - 1);
  for (const [alt] of neu) out.nb.push([...nb[alt]!].map((j) => neu.get(j)!));
  return out;
}

/** nächster freier Knoten (ponytail: alle durchgehen – ein paar tausend Knoten, alle 5 s) */
export function naechsterKnoten(n: Netz, p: Point, gesperrt: Set<number>): number {
  let best = -1;
  let bestD = Infinity;
  const cos = Math.cos(rad(p.lat));
  n.pts.forEach((q, i) => {
    const d = (q.lat - p.lat) ** 2 + ((q.lng - p.lng) * cos) ** 2;
    if (d < bestD && !gesperrt.has(i)) {
      best = i;
      bestD = d;
    }
  });
  return best;
}

/** kürzester Weg (Dijkstra) von Knoten zu Knoten, an gesperrten vorbei; [] wenn es keinen gibt */
export function netzWeg(n: Netz, von: number, nach: number, gesperrt: Set<number>): number[] {
  if (von < 0 || nach < 0) return [];
  const dist = new Float64Array(n.pts.length).fill(Infinity);
  const vor = new Int32Array(n.pts.length).fill(-1);
  const heap: [number, number][] = [];
  const rein = (e: [number, number]) => {
    let i = heap.push(e) - 1;
    while (i > 0 && heap[(i - 1) >> 1]![0] > e[0]) {
      const o = (i - 1) >> 1;
      [heap[i], heap[o]] = [heap[o]!, heap[i]!];
      i = o;
    }
  };
  const raus = () => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) {
        let m = i;
        for (const c of [2 * i + 1, 2 * i + 2]) if (c < heap.length && heap[c]![0] < heap[m]![0]) m = c;
        if (m === i) break;
        [heap[i], heap[m]] = [heap[m]!, heap[i]!];
        i = m;
      }
    }
    return top;
  };
  dist[von] = 0;
  rein([0, von]);
  while (heap.length) {
    const [d, i] = raus();
    if (i === nach) break;
    if (d > dist[i]!) continue;
    for (const j of n.nb[i]!) {
      if (gesperrt.has(j)) continue;
      const dj = d + distanceM(n.pts[i]!, n.pts[j]!);
      if (dj < dist[j]!) {
        dist[j] = dj;
        vor[j] = i;
        rein([dj, j]);
      }
    }
  }
  if (von !== nach && vor[nach] === -1) return [];
  const weg = [nach];
  while (weg[0] !== von) weg.unshift(vor[weg[0]!]!);
  return weg;
}

export interface NetzBot {
  p: Point;
  richtung: number;
  /** geplanter Weg (Knoten), der erste ist der nächste */
  weg: number[];
  /** wofür der Weg geplant ist – ändert sich das, wird neu geplant */
  zweck: string;
  /** Schritte seit der Planung */
  alter: number;
}

/** ein Schritt auf dem Straßennetz; plant neu, wenn nötig (Ziel erreicht, neue Meldung, Gefahr, Sperrgebiet) */
export function netzSchritt(l: BotLage & NetzBot & { netz: Netz; gesperrt: Set<number> }): NetzBot {
  const { netz, gesperrt, zufall } = l;
  const knoten = (i: number) => netz.pts[i]!;
  const zufaellig = (um: Point, min: number, max: number) => {
    for (let k = 0; k < 30; k++) {
      const i = Math.floor(zufall() * netz.pts.length);
      const d = distanceM(um, knoten(i));
      if (d >= min && d <= max && !gesperrt.has(i)) return i;
    }
    return Math.floor(zufall() * netz.pts.length);
  };
  const jagd = !l.mrx && l.ziel ? `jagd:${l.ziel.lat.toFixed(5)},${l.ziel.lng.toFixed(5)}` : "";
  const jaeger = l.mrx ? (l.jaeger ?? []) : [];
  const abstand = (q: Point) => Math.min(Infinity, ...jaeger.map((j) => distanceM(q, j)));
  const gefahr = abstand(l.p) < 400;
  let { weg, zweck, alter } = l;
  if (!weg.length || weg.some((i) => gesperrt.has(i)) || (jagd && zweck !== jagd) || (gefahr && (zweck !== "flucht" || alter >= 6))) {
    let nach: number;
    if (jagd) {
      // erst zur Meldung, dort angekommen in der Umgebung suchen
      nach = zweck === jagd && !weg.length ? zufaellig(l.ziel!, 50, 300) : naechsterKnoten(netz, l.ziel!, gesperrt);
      zweck = jagd;
    } else if (gefahr) {
      // weit weg von den Jägern, aber nicht ans andere Ende der Stadt
      const wahl = Array.from({ length: 30 }, () => zufaellig(l.p, 200, 900));
      nach = wahl.reduce((a, b) => (abstand(knoten(b)) > abstand(knoten(a)) ? b : a));
      zweck = "flucht";
    } else {
      nach = zufaellig(l.p, 150, 700);
      zweck = "bummeln";
    }
    // vom nächsten Knoten vorne aus planen – der nächstgelegene kann hinter einem liegen (dann ginge es hin und her)
    const von = weg.length && !gesperrt.has(weg[0]!) ? weg[0]! : naechsterKnoten(netz, l.p, gesperrt);
    weg = netzWeg(netz, von, nach, gesperrt);
    alter = 0;
    if (!weg.length) return { ...botSchritt(l), weg: [], zweck: "", alter: 0 };
  }
  // den Weg entlang gehen, über Knoten hinweg
  let p = l.p;
  let rest = l.schritt;
  weg = [...weg];
  let richtung = l.richtung;
  while (rest > 0 && weg.length) {
    const q = knoten(weg[0]!);
    const d = distanceM(p, q);
    if (d > 0.5) richtung = bearingDeg(p, q);
    if (d <= rest) {
      p = q;
      rest -= d;
      weg.shift();
    } else {
      p = { lat: p.lat + ((q.lat - p.lat) * rest) / d, lng: p.lng + ((q.lng - p.lng) * rest) / d };
      rest = 0;
    }
  }
  return { p, richtung, weg, zweck, alter: alter + 1 };
}
