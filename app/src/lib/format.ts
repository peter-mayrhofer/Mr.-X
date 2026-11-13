// Zeit- und Zahlenformate in der Sprache der Oberfläche (Deutsch: de-AT)
import { T } from "../texte.ts";

/** erst beim Aufruf lesen – lib/sprache.ts setzt die Sprache beim Start */
const loc = () => {
  const l = typeof document === "undefined" ? "" : document.documentElement.lang;
  return !l || l === "de" ? "de-AT" : l;
};
const MIN = 60_000;

export const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export const uhr = (t: number) => new Date(t).toLocaleTimeString(loc(), { hour: "2-digit", minute: "2-digit" });

export const datum = (t: number) => new Date(t).toLocaleDateString(loc(), { day: "numeric", month: "long", year: "numeric" });

export function vor(t: number, now: number) {
  const m = Math.floor((now - t) / MIN);
  if (m < 1) return T.allgemein.geradeEben;
  return T.allgemein.vor(m < 60 ? `${m} ${T.allgemein.min}` : `${Math.floor(m / 60)} h ${m % 60} ${T.allgemein.min}`);
}

/** 1:23 h bzw. 45 Min */
export function dauer(ms: number) {
  const m = Math.floor(ms / MIN);
  return m < 60 ? `${m} ${T.allgemein.min}` : `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")} h`;
}

export const km = (m: number) => `${(m / 1000).toLocaleString(loc(), { maximumFractionDigits: 1 })} km`;

export const meter = (m: number) => (m < 1000 ? `${Math.round(m / 5) * 5} m` : km(m));

/** Dateigröße in MB, in der Sprache der Oberfläche (z. B. „8,1 MB“) */
export const mb = (bytes: number, sprache = loc()) => `${(bytes / 1e6).toLocaleString(sprache, { maximumFractionDigits: 1 })} MB`;
