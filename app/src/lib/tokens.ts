// Sitzungs-Tokens dieses Geräts (vom Beitritt bzw. vom Organisator-Login). Eigene Datei, damit api.ts und
// session.svelte.ts sie teilen, ohne sich gegenseitig zu importieren.
export const tokens = {
  /** Gerät in einem Spiel */
  game: null as string | null,
  gameId: null as string | null,
  /** Organisator (Super-Admin) */
  super: null as string | null,
  /** Server sagt „Sitzung ungültig“ → session.svelte.ts räumt auf */
  onSession: null as ((kind: "game" | "super") => void) | null,
};
