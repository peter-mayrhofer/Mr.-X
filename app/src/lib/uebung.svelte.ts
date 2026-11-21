// Übungsspiel (E-78): Treiber der Computer-Teams. Er hängt an der Seite der Spielleitung (StaffGamePage), nicht an
// der Karte „Übungsspiel“ – so laufen die Teams weiter, während man in „Live“ zuschaut.
// Straßennetz (E-82): aus denselben Kartenkacheln wie die Karte (OpenFreeMap), einmal pro Spielfeld geladen. Bis es da
// ist (oder ohne Netz) gehen die Teams gerade Schritte.
import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import {
  botSchritt,
  feldMitte,
  kachel,
  kachelPunkt,
  netzSchritt,
  strassenNetz,
  versetzt,
  zoneStatus,
  type Field,
  type Netz,
  type NetzBot,
  type Point,
} from "@mrx/shared";
import { trailOf, type Api, type StaffView } from "./staff.ts";

export const uebung = $state({ laeuft: false });
export const TAKT_MS = 5000;
/** Meter pro Takt (≈ 3 m/s – zügiges Gehen bis leichtes Laufen) */
const SCHRITT = 15;
// nur Rechen-Zwischenstand, nichts davon wird angezeigt
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const zustand = new Map<string, NetzBot>();

/** Straßen und Wege, auf denen man zu Fuß gehen kann (Klassen der OpenMapTiles-Ebene „transportation“) */
const GEHBAR = new Set(["primary", "secondary", "tertiary", "minor", "service", "track", "path", "busway"]);
const Z = 14;
let netz: { feld: string; netz?: Netz; gesperrt?: { key: string; set: Set<number> } } | null = null;

async function ladeNetz(field: Field): Promise<Netz> {
  const tj = (await (await fetch("https://tiles.openfreemap.org/planet")).json()) as { tiles: string[] };
  const ecken = field.base.map(([lng, lat]) => kachel({ lat, lng }, Z));
  const xs = ecken.map((k) => k.x);
  const ys = ecken.map((k) => k.y);
  const kacheln: [number, number][] = [];
  for (let x = Math.min(...xs); x <= Math.max(...xs); x++) for (let y = Math.min(...ys); y <= Math.max(...ys); y++) kacheln.push([x, y]);
  if (kacheln.length > 25) throw new Error("Spielfeld zu groß für das Straßennetz");
  const linien: Point[][] = [];
  await Promise.all(
    kacheln.map(async ([x, y]) => {
      const r = await fetch(tj.tiles[0]!.replace("{z}", String(Z)).replace("{x}", String(x)).replace("{y}", String(y)));
      if (!r.ok) throw new Error(`Kachel ${x}/${y}: ${r.status}`);
      const ebene = new VectorTile(new PbfReader(new Uint8Array(await r.arrayBuffer()))).layers.transportation;
      for (let i = 0; i < (ebene?.length ?? 0); i++) {
        const f = ebene!.feature(i);
        if (f.type !== 2 || !GEHBAR.has(String(f.properties.class))) continue;
        for (const l of f.loadGeometry()) linien.push(l.map((q) => kachelPunkt(x, y, Z, q.x, q.y, f.extent)));
      }
    }),
  );
  return strassenNetz(linien, field);
}

/** Straßennetz zum Spielfeld, sobald geladen; lädt beim ersten Aufruf im Hintergrund */
function netzFuer(field: Field, locked: string[]): { netz: Netz; gesperrt: Set<number> } | null {
  const feld = JSON.stringify(field.base);
  if (netz?.feld !== feld) {
    const n: NonNullable<typeof netz> = { feld };
    netz = n;
    zustand.clear(); // geplante Wege zeigen ins alte Netz; die Teams starten dort, wo der Server sie zuletzt hat
    ladeNetz(field)
      .then((x) => (n.netz = x.pts.length ? x : undefined))
      .catch(() => {}); // ohne Netz: gerade Schritte
  }
  if (!netz.netz) return null;
  const key = locked.join(",");
  if (netz.gesperrt?.key !== key) {
    const n = netz.netz;
    // nur Rechen-Zwischenstand, nichts davon wird angezeigt
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const set = new Set<number>();
    if (locked.length) n.pts.forEach((q, i) => zoneStatus(q, field, locked, 0) === "draussen" && set.add(i));
    netz.gesperrt = { key, set };
  }
  return { netz: netz.netz, gesperrt: netz.gesperrt.set };
}

/** ein Schritt für alle Computer-Teams, eine Anfrage an den Server */
export function uebungTakt(view: StaffView, api: Api) {
  const st = view.state;
  if (st.phase === "pause" || st.phase === "beendet") return;
  const now = Date.now();
  const locked = Object.keys(st.cuts ?? {});
  const ziel = trailOf(view).at(-1) ?? null;
  const jaeger = Object.entries(view.positions)
    .filter(([id]) => id !== st.mrx)
    .map(([, p]) => p);
  const n = netzFuer(view.field, locked);
  const pos: Record<string, { lat: number; lng: number }> = {};
  for (const id of Object.keys(view.teams).filter((t) => view.teams[t]!.uebung)) {
    // Wartezeit (Start, nach einem Fang): stehen bleiben wie echte Teams
    if ((view.locks[id]?.until ?? 0) > now) continue;
    const z = zustand.get(id) ?? {
      p: view.positions[id] ?? versetzt(view.field.meet ?? feldMitte(view.field), Math.random() * 360, 50 + Math.random() * 150),
      richtung: Math.random() * 360,
      weg: [],
      zweck: "",
      alter: 0,
    };
    const lage = { ...z, mrx: id === st.mrx, ziel, jaeger, field: view.field, locked, schritt: SCHRITT, zufall: Math.random };
    const r: NetzBot = n ? netzSchritt({ ...lage, ...n }) : { ...z, ...botSchritt(lage) };
    zustand.set(id, r);
    pos[id] = { lat: r.p.lat, lng: r.p.lng };
  }
  if (Object.keys(pos).length) api({ action: "uebungZug", gameId: view.gameId, pos }).catch(() => {});
}
