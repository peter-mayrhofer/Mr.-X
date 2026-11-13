// Sprache der Team-Oberfläche (E-67). Deutsch (texte.ts) ist die Grundlage; Englisch, Spanisch, Italienisch und Türkisch
// überschreiben die Texte, die Teams sehen. Spielleitung und Schiris bleiben deutsch. Chat-Meldungen und Push-Titel
// vom Server übersetzt @mrx/shared (sprachen.ts).
// Wird in main.ts als ERSTES geladen: die Übersetzung steht in T, bevor irgendeine Seite einen Text liest.
import { T } from "../texte.ts";

export const SPRACHEN = [
  { code: "de", name: "Deutsch" },
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "it", name: "Italiano" },
  { code: "tr", name: "Türkçe" },
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

const laden: Record<Exclude<Sprache, "de">, () => Promise<{ default: Uebersetzung }>> = {
  en: () => import("../texte/en.ts"),
  es: () => import("../texte/es.ts"),
  it: () => import("../texte/it.ts"),
  tr: () => import("../texte/tr.ts"),
};
if (sprache !== "de") merge(T as unknown as Record<string, unknown>, (await laden[sprache]()).default as Record<string, unknown>);
if (typeof document !== "undefined") document.documentElement.lang = sprache;

/** Sprache wechseln: merken und neu laden (alle Texte kommen dann in der neuen Sprache) */
export function setSprache(s: Sprache) {
  try {
    localStorage.setItem(KEY, s);
  } catch {
    /* ohne Speicher bleibt es beim Deutschen */
  }
  location.reload();
}
