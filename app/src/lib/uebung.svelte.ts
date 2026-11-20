// Übungsspiel (E-78): Treiber der Computer-Teams. Er hängt an der Seite der Spielleitung (StaffGamePage), nicht an
// der Karte „Übungsspiel“ – so laufen die Teams weiter, während man in „Live“ zuschaut.
import { botSchritt, feldMitte, versetzt, type Point } from "@mrx/shared";
import { trailOf, type Api, type StaffView } from "./staff.ts";

export const uebung = $state({ laeuft: false });
export const TAKT_MS = 5000;
/** Meter pro Takt (≈ 3 m/s – zügiges Gehen bis leichtes Laufen) */
const SCHRITT = 15;
// nur Rechen-Zwischenstand, nichts davon wird angezeigt
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const zustand = new Map<string, { p: Point; richtung: number }>();

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
  const pos: Record<string, { lat: number; lng: number }> = {};
  for (const id of Object.keys(view.teams).filter((t) => view.teams[t]!.uebung)) {
    // Wartezeit (Start, nach einem Fang): stehen bleiben wie echte Teams
    if ((view.locks[id]?.until ?? 0) > now) continue;
    const z = zustand.get(id) ?? {
      p: view.positions[id] ?? versetzt(view.field.meet ?? feldMitte(view.field), Math.random() * 360, 50 + Math.random() * 150),
      richtung: Math.random() * 360,
    };
    const r = botSchritt({ ...z, mrx: id === st.mrx, ziel, jaeger, field: view.field, locked, schritt: SCHRITT, zufall: Math.random });
    zustand.set(id, r);
    pos[id] = { lat: r.p.lat, lng: r.p.lng };
  }
  if (Object.keys(pos).length) api({ action: "uebungZug", gameId: view.gameId, pos }).catch(() => {});
}
