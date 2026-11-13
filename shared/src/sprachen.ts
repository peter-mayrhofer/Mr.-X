// Server-Texte in den Sprachen der Team-Oberfläche (E-67): Chat-Meldungen (meldungen.ts) und Push-Titel (push.ts).
// Der Server schreibt sie deutsch. Beim Anzeigen (App: Chat und Android-Benachrichtigung, Server: Web-Push je nach
// Sprache des Geräts) wird eine deutsche Meldung über ihr Muster erkannt und mit ihren Teilen (Teamnamen, Minuten …)
// in der anderen Sprache neu zusammengesetzt. Unbekannter Text (Durchsagen, Nachrichten) bleibt, wie er ist.
import { M, QUELLE } from "./meldungen.ts";
import { PUSH_TITLE } from "./push.ts";
import en from "./sprachen/en.ts";
import es from "./sprachen/es.ts";
import it from "./sprachen/it.ts";
import tr from "./sprachen/tr.ts";

export const SPRACH_CODES = ["de", "en", "es", "it", "tr"] as const;
export type SprachCode = (typeof SPRACH_CODES)[number];
export const istSprache = (s: unknown): s is SprachCode => SPRACH_CODES.includes(s as SprachCode);

type Meldungen = typeof M;
/** gleiche Schlüssel und Parameter wie die deutschen Meldungen; Teile kommen als Text */
export type MeldungenUebersetzt = {
  readonly [K in keyof Meldungen]: Meldungen[K] extends (...a: infer P) => string ? (...a: { [I in keyof P]: string }) => string : string;
};
export interface ServerTexte {
  titel: Record<keyof typeof PUSH_TITLE, string>;
  m: MeldungenUebersetzt;
}
const TEXTE: Record<Exclude<SprachCode, "de">, ServerTexte> = { en, es, it, tr };

// ---- Muster: jede deutsche Meldung mit Platzhaltern aufrufen, Platzhalter werden zu Fanggruppen ----
const P = (i: number) => `\uE000${i}\uE001`;
/** Aufrufe mit festen Werten (null = Platzhalter); ohne Eintrag: alle Parameter sind Platzhalter */
const VARIANTEN: { [K in keyof Meldungen]?: (string | null)[][] } = {
  meldung: Object.keys(QUELLE).map((q) => [null, q, null]),
  pruefen: [
    [null, null],
    [null, null, null],
  ],
};
interface Muster {
  k: keyof Meldungen;
  re: RegExp;
  args: (string | null)[];
  /** Fanggruppe j gehört zu Parameter idx[j] */
  idx: number[];
}
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MUSTER: Muster[] = (Object.keys(M) as (keyof Meldungen)[])
  .flatMap((k) => {
    const f = M[k];
    if (typeof f === "string") return [{ k, re: new RegExp(`^${esc(f)}$`), args: [], idx: [] }];
    const varianten = VARIANTEN[k] ?? [Array<null>(f.length).fill(null)];
    return varianten.map((args) => {
      const text = (f as (...a: string[]) => string)(...args.map((a, i) => a ?? P(i)));
      const idx: number[] = [];
      const re = text
        .split(/\uE000(\d+)\uE001/)
        .map((teil, j) => (j % 2 ? (idx.push(Number(teil)), "(.*?)") : esc(teil)))
        .join("");
      return { k, re: new RegExp(`^${re}$`, "s"), args, idx };
    });
  })
  // längere feste Texte zuerst, damit z. B. „… gemeldet – Standort vom Tracker.“ nicht als „… gemeldet.“ gilt
  .sort((a, b) => b.re.source.replace(/\(\.\*\?\)/g, "").length - a.re.source.replace(/\(\.\*\?\)/g, "").length);

const TITEL_KEY = new Map(Object.entries(PUSH_TITLE).map(([k, v]) => [v as string, k as keyof typeof PUSH_TITLE]));

/** Push-Titel oder Chat-Meldung in die Sprache übersetzen; Deutsch und unbekannter Text bleiben unverändert */
export function uebersetze(text: string, sprache: string | undefined): string {
  if (!istSprache(sprache) || sprache === "de") return text;
  const t = TEXTE[sprache];
  const titel = TITEL_KEY.get(text);
  if (titel) return t.titel[titel];
  for (const m of MUSTER) {
    const r = m.re.exec(text);
    if (!r) continue;
    const args = m.args.length ? [...m.args] : [];
    m.idx.forEach((i, j) => (args[i] = r[j + 1] ?? ""));
    const f = t.m[m.k];
    return typeof f === "string" ? f : (f as (...a: (string | null)[]) => string)(...args.map((a) => a ?? ""));
  }
  return text;
}
