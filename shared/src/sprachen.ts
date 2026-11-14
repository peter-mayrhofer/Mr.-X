// Server-Texte in den Sprachen der Oberfläche (E-67, E-68): Chat-Meldungen (meldungen.ts), Push-Titel (push.ts) und
// das Protokoll der Spielleitung (protokoll.ts). Der Server schreibt sie deutsch. Beim Anzeigen (App: Chat, Protokoll,
// Android-Benachrichtigung; Server: Web-Push je nach Sprache des Geräts) wird ein deutscher Text über sein Muster
// erkannt und mit seinen Teilen (Teamnamen, Minuten …) in der anderen Sprache neu zusammengesetzt.
// Unbekannter Text (Durchsagen, Nachrichten) bleibt, wie er ist.
import { M, QUELLE } from "./meldungen.ts";
import { P } from "./protokoll.ts";
import { PUSH_TITLE } from "./push.ts";
import en from "./sprachen/en.ts";
import es from "./sprachen/es.ts";
import it from "./sprachen/it.ts";
import tr from "./sprachen/tr.ts";

export const SPRACH_CODES = ["de", "en", "es", "it", "tr"] as const;
export type SprachCode = (typeof SPRACH_CODES)[number];
export const istSprache = (s: unknown): s is SprachCode => SPRACH_CODES.includes(s as SprachCode);

/** gleiche Schlüssel und Parameter wie die deutschen Vorlagen; Teile kommen als Text */
type Uebersetzt<X> = {
  readonly [K in keyof X]: X[K] extends (...a: infer A) => string ? (...a: { [I in keyof A]: string }) => string : string;
};
export interface ServerTexte {
  titel: Record<keyof typeof PUSH_TITLE, string>;
  m: Uebersetzt<typeof M>;
  p: Uebersetzt<typeof P>;
}
const TEXTE: Record<Exclude<SprachCode, "de">, ServerTexte> = { en, es, it, tr };

// ---- Muster: jede deutsche Vorlage mit Platzhaltern aufrufen, Platzhalter werden zu Fanggruppen ----
type Vorlagen = Record<string, string | ((...a: never[]) => string)>;
type Wert = string | number | null;
interface Muster {
  k: string;
  re: RegExp;
  /** feste Werte der Variante; null = Platzhalter */
  args: Wert[];
  /** Fanggruppe j gehört zu Parameter idx[j] */
  idx: number[];
}
const PL = (i: number) => `${i}`;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function muster(vorlagen: Vorlagen, varianten: Record<string, Wert[][]> = {}): Muster[] {
  return (
    Object.entries(vorlagen)
      .flatMap(([k, f]) => {
        if (typeof f === "string") return [{ k, re: new RegExp(`^${esc(f)}$`), args: [], idx: [] }];
        return (varianten[k] ?? [Array<null>(f.length).fill(null)]).map((args) => {
          const text = (f as (...a: unknown[]) => string)(...args.map((a, i) => a ?? PL(i)));
          const idx: number[] = [];
          const re = text
            .split(/(\d+)/)
            .map((teil, j) => (j % 2 ? (idx.push(Number(teil)), "(.*?)") : esc(teil)))
            .join("");
          return { k, re: new RegExp(`^${re}$`, "s"), args, idx };
        });
      })
      // längere feste Texte zuerst, damit z. B. „… gemeldet – Standort vom Tracker.“ nicht als „… gemeldet.“ gilt
      .sort((a, b) => b.re.source.replace(/\(\.\*\?\)/g, "").length - a.re.source.replace(/\(\.\*\?\)/g, "").length)
  );
}

const MUSTER_M = muster(M, {
  meldung: Object.keys(QUELLE).map((q) => [null, q, null]),
  pruefen: [
    [null, null],
    [null, null, null],
  ],
});
const MUSTER_P = muster(P, {
  aufgeteilt: [
    [null, null, 1],
    [null, null, null],
  ],
});
const TITEL_KEY = new Map(Object.entries(PUSH_TITLE).map(([k, v]) => [v as string, k as keyof typeof PUSH_TITLE]));

function finde(text: string, liste: Muster[], ziel: Record<string, unknown>, teil: (s: string) => string): string | undefined {
  for (const m of liste) {
    const r = m.re.exec(text);
    if (!r) continue;
    const args = [...m.args];
    m.idx.forEach((i, j) => (args[i] = r[j + 1] ?? ""));
    const f = ziel[m.k] as string | ((...a: (string | undefined)[]) => string);
    // Teile, die selbst feste Wörter sind („niemand“, „Schiri“, „Fahne“), werden mit übersetzt
    return typeof f === "string" ? f : f(...args.map((a) => (a === null ? "" : teil(String(a)))));
  }
}

/** Push-Titel oder Chat-Meldung in die Sprache übersetzen; Deutsch und unbekannter Text bleiben unverändert */
export function uebersetze(text: string, sprache: string | undefined): string {
  if (!istSprache(sprache) || sprache === "de") return text;
  const t = TEXTE[sprache];
  const titel = TITEL_KEY.get(text);
  if (titel) return t.titel[titel];
  return finde(text, MUSTER_M, t.m, (s) => s) ?? text;
}

/** Aktion oder Details aus dem Protokoll übersetzen (eigene Muster, damit freier Text nicht wie eine Meldung aussieht) */
export function uebersetzeProtokoll(text: string, sprache: string | undefined): string {
  if (!istSprache(sprache) || sprache === "de") return text;
  const t = TEXTE[sprache].p as unknown as Record<string, unknown>;
  const fest = (s: string) => {
    const k = MUSTER_P.find((m) => !m.idx.length && m.re.test(s))?.k;
    return k ? (t[k] as string) : s;
  };
  return finde(text, MUSTER_P, t, fest) ?? text;
}
