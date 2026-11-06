// Sprache der Team-Oberfläche. Deutsch (texte.ts) ist die Grundlage; Englisch, Türkisch und Bosnisch/Kroatisch/Serbisch
// überschreiben die Texte, die Teams sehen. Spielleitung, Schiris und der Datenschutz-Hinweis bleiben deutsch.
// Wird in main.ts als ERSTES geladen: die Übersetzung steht in T, bevor irgendeine Seite einen Text liest.
import { T } from "../texte.ts";

export const SPRACHEN = [
  { code: "de", name: "Deutsch" },
  { code: "en", name: "English" },
  { code: "tr", name: "Türkçe" },
  { code: "bks", name: "Bosanski / Hrvatski / Srpski", kurz: "BKS" },
] as const;
export type Sprache = (typeof SPRACHEN)[number]["code"];

type Voll<X> = X extends string
  ? string
  : X extends (...a: infer A) => infer R
    ? (...a: A) => Voll<R>
    : X extends readonly (infer U)[]
      ? readonly Voll<U>[]
      : { readonly [K in keyof X]: Voll<X[K]> };
type Teil<X> = X extends string | ((...a: never[]) => unknown) | readonly unknown[] ? Voll<X> : { readonly [K in keyof X]?: Teil<X[K]> };
/** Übersetzung: beliebige Teile von T, gleiche Schlüssel und Parameter, Listen immer vollständig */
export type Uebersetzung = { readonly [K in keyof typeof T]?: Teil<(typeof T)[K]> };

const KEY = "mrx.sprache";
export const sprache: Sprache = (() => {
  try {
    const s = localStorage.getItem(KEY);
    return SPRACHEN.some((x) => x.code === s) ? (s as Sprache) : "de";
  } catch {
    return "de";
  }
})();

function merge(base: Record<string, unknown>, over: Record<string, unknown>) {
  for (const [k, v] of Object.entries(over)) {
    const b = base[k];
    if (v && typeof v === "object" && !Array.isArray(v) && b && typeof b === "object" && !Array.isArray(b))
      merge(b as Record<string, unknown>, v as Record<string, unknown>);
    else base[k] = v;
  }
}

type Paket = { default: Uebersetzung; pushTitel: Record<string, string> };
const laden: Record<Exclude<Sprache, "de">, () => Promise<Paket>> = {
  en: () => import("../texte/en.ts"),
  tr: () => import("../texte/tr.ts"),
  bks: () => import("../texte/bks.ts"),
};
/** Titel der Benachrichtigungen (kommen deutsch vom Server) in der gewählten Sprache */
export let pushTitel: Record<string, string> = {};
if (sprache !== "de") {
  const p = await laden[sprache]();
  merge(T as unknown as Record<string, unknown>, p.default as Record<string, unknown>);
  pushTitel = p.pushTitel;
}
if (typeof document !== "undefined") document.documentElement.lang = sprache === "bks" ? "bs" : sprache;

/** Sprache wechseln: merken und neu laden (alle Texte kommen dann in der neuen Sprache) */
export function setSprache(s: Sprache) {
  try {
    localStorage.setItem(KEY, s);
  } catch {
    /* ohne Speicher bleibt es beim Deutschen */
  }
  location.reload();
}
