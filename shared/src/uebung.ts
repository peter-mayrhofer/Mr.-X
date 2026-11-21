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
  /** Jäger: letzte Meldung von Mister X (falls es eine gibt), mit Zeitpunkt */
  ziel?: (Point & { t?: number }) | null | undefined;
  /** Jäger: wo Mister X gerade wirklich ist – sichtbar erst unter SICHT_M (Straßennetz) */
  mrxJetzt?: Point | null | undefined;
  /** jetzt (ms), für das Alter von Meldung und Sichtung */
  jetzt?: number;
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
      // wie inField, aber mit genauem Abstand statt 32 Prüfpunkten (sonst dauert das Netz über eine Sekunde) und mit
      // Sicherheitsabstand: inField zählt knapp unter der Toleranz schon als draußen
      drin.push(imRahmen(p) && (inPolygon(p, field.base) || distanceToEdgeM(p, field.base) <= field.toleranceM * 0.8));
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
  /** Jäger: wo Mister X zuletzt gesehen wurde */
  gesehen?: (Point & { t: number }) | undefined;
}

/** so nah sehen sich Jäger und Mister X (Straßenecken, Häuser dazwischen) */
export const SICHT_M = 150;
/** Mister X schaut sich um und merkt Jäger etwas früher */
const MRX_SICHT_M = 250;
/** wer jemanden sieht, rennt: Jäger etwas schneller als Mister X, sonst fängt nie jemand */
const SPRINT_JAEGER = 1.4;
const SPRINT_MRX = 1.2;
/** unter diesem Abstand läuft ein Jäger direkt auf Mister X zu */
const NAH_M = 60;
/** so schnell kann Mister X seit der Meldung weg sein (m/s) – so weit wächst der Suchkreis */
const SUCH_MS = 1.5;

const zweck0 = (z: string) => z.startsWith("jagd");

/**
 * ein Schritt auf dem Straßennetz; plant neu, wenn nötig (Ziel erreicht, neue Meldung, Sichtung, Gefahr, Sperrgebiet).
 * Jäger: Mister X in Sicht → hinterher rennen; sonst zum Neuesten, was sie wissen (Meldung oder letzte Sichtung), und
 * dort suchen – je älter das Wissen, desto größer der Suchkreis. Mister X: flieht vor Jägern in Sicht, sonst bummeln.
 */
export function netzSchritt(l: BotLage & NetzBot & { netz: Netz; gesperrt: Set<number> }): NetzBot {
  const { netz, gesperrt, zufall } = l;
  const jetzt = l.jetzt ?? 0;
  const knoten = (i: number) => netz.pts[i]!;
  /** zufälliger Knoten im Ring min–max um `um`; findet sich keiner, der am nächsten dran (nie irgendwo in der Stadt) */
  const zufaellig = (um: Point, min: number, max: number) => {
    let best = -1;
    let bestF = Infinity;
    for (let k = 0; k < 60; k++) {
      const i = Math.floor(zufall() * netz.pts.length);
      if (gesperrt.has(i)) continue;
      const d = distanceM(um, knoten(i));
      const f = d < min ? min - d : d > max ? d - max : 0;
      if (!f) return i;
      if (f < bestF) {
        best = i;
        bestF = f;
      }
    }
    return best;
  };
  const sicht = !l.mrx && l.mrxJetzt && distanceM(l.p, l.mrxJetzt) < SICHT_M ? l.mrxJetzt : null;
  let gesehen = l.mrx ? undefined : sicht ? { lat: sicht.lat, lng: sicht.lng, t: jetzt } : l.gesehen;
  // Meldung oder Sichtung – was neuer ist
  const wissen = !l.mrx ? (gesehen && gesehen.t >= (l.ziel?.t ?? 0) ? gesehen : l.ziel) : null;
  if (wissen !== gesehen) gesehen = undefined;
  const jagd = wissen ? `jagd:${wissen.lat.toFixed(5)},${wissen.lng.toFixed(5)}` : "";
  const jaeger = l.mrx ? (l.jaeger ?? []) : [];
  const abstand = (q: Point) => Math.min(Infinity, ...jaeger.map((j) => distanceM(q, j)));
  // eben noch Jäger, jetzt Mister X: den Vorsprung nutzen und gleich weg
  const neuMrx = l.mrx && zweck0(l.zweck);
  const gefahr = neuMrx || abstand(l.p) < MRX_SICHT_M;
  let { weg, zweck, alter } = l;
  if (!weg.length || weg.some((i) => gesperrt.has(i)) || (jagd && zweck !== jagd) || (gefahr && (zweck !== "flucht" || alter >= 6))) {
    let nach: number;
    if (wissen) {
      // erst dorthin, dann im Umkreis suchen; der Kreis wächst, solange es nichts Neues gibt
      const alterS = Math.max(0, (jetzt - (wissen.t ?? jetzt)) / 1000);
      nach =
        zweck === jagd && !weg.length
          ? zufaellig(wissen, 30, Math.min(1000, 150 + SUCH_MS * alterS))
          : naechsterKnoten(netz, wissen, gesperrt);
      zweck = jagd;
    } else if (gefahr) {
      // weit weg von den Jägern, aber nicht ans andere Ende der Stadt
      // (-1: nichts Freies gefunden, etwa fast alles gesperrt – dann gibt es keinen Weg und es geht gerade weiter)
      const wahl = Array.from({ length: 30 }, () => zufaellig(l.p, 200, 900)).filter((i) => i >= 0);
      nach = wahl.reduce((a, b) => (a < 0 || abstand(knoten(b)) > abstand(knoten(a)) ? b : a), -1);
      zweck = "flucht";
    } else {
      nach = zufaellig(l.p, 150, 700);
      zweck = "bummeln";
    }
    // vom nächsten Knoten vorne aus planen – der nächstgelegene kann hinter einem liegen (dann ginge es hin und her)
    const von = weg.length && !gesperrt.has(weg[0]!) ? weg[0]! : naechsterKnoten(netz, l.p, gesperrt);
    weg = netzWeg(netz, von, nach, gesperrt);
    alter = 0;
    if (!weg.length) return { ...botSchritt(l), weg: [], zweck: "", alter: 0, gesehen };
  }
  // ganz nah dran: direkt hin – über das Netz ginge es sonst evtl. erst zurück zur letzten Kreuzung
  if (sicht && distanceM(l.p, sicht) < NAH_M) weg = [];
  // den Weg entlang gehen, über Knoten hinweg; wer jemanden sieht, rennt
  let p = l.p;
  let rest = l.schritt * (sicht ? SPRINT_JAEGER : gefahr ? SPRINT_MRX : 1);
  weg = [...weg];
  let richtung = l.richtung;
  const gehe = (q: Point) => {
    const d = distanceM(p, q);
    if (d > 0.5) richtung = bearingDeg(p, q);
    if (d <= rest) {
      p = q;
      rest -= d;
      return true;
    }
    p = { lat: p.lat + ((q.lat - p.lat) * rest) / d, lng: p.lng + ((q.lng - p.lng) * rest) / d };
    rest = 0;
    return false;
  };
  while (rest > 0 && weg.length) if (gehe(knoten(weg[0]!))) weg.shift();
  // die letzten Meter zu Mister X direkt (er steht selten genau auf einem Knoten)
  if (sicht && rest > 0 && !weg.length) gehe(sicht);
  return { p, richtung, weg, zweck, alter: alter + 1, gesehen };
}

/** Fang (Übungsspiel): welches Computer-Team ist Mister X nah genug? Das nächste unter `fangM`, sonst keins. */
export function werFaengt(mrx: Point | null | undefined, jaeger: Record<string, Point>, fangM: number): string | null {
  if (!mrx) return null;
  let best: string | null = null;
  let bestD = fangM;
  for (const [id, p] of Object.entries(jaeger)) {
    const d = distanceM(p, mrx);
    if (d <= bestD) {
      best = id;
      bestD = d;
    }
  }
  return best;
}
