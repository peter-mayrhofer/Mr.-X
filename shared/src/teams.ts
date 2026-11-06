// Team-Kürzel und -Farben für Marker. Rein, getestet.

/** Gut unterscheidbare Teamfarben (kein Rot – Rot gehört Mister X, kein reines Blau – Blau ist „wir“) */
export const TEAM_COLORS = [
  "#7c5cff",
  "#00a3a3",
  "#e07a00",
  "#8e44ad",
  "#16a085",
  "#d35400",
  "#c2185b",
  "#5d6d7e",
  "#27ae60",
  "#b7950b",
  "#6d4c41",
  "#2e86de",
  "#00897b",
  "#ad1457",
  "#7cb342",
  "#3949ab",
];

/** Teamnamen vergleichen: Groß-/Kleinschreibung und Leerzeichen egal */
export const normalizeName = (s: string) => s.trim().replace(/\s+/g, " ");
export const sameName = (a: string, b: string) => normalizeName(a).toLocaleLowerCase("de") === normalizeName(b).toLocaleLowerCase("de");

/**
 * Zwei Buchstaben für den Marker: Anfangsbuchstaben (ohne Füllwörter) oder die ersten zwei Buchstaben.
 * Ist das Kürzel vergeben, wird der zweite Buchstabe durch weitere Buchstaben des Namens, dann durch Ziffern ersetzt.
 */
export function teamShort(name: string, taken: string[]): string {
  const STOP = new Set(["og", "ortsgruppe", "team", "die", "der", "das", "rote", "falken"]);
  const words = normalizeName(name)
    .split(" ")
    .filter((w) => !STOP.has(w.toLocaleLowerCase("de")));
  const letters = (words.length ? words : [normalizeName(name)])
    .join("")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLocaleUpperCase("de");
  const first = letters[0] ?? "T";
  const candidates = [
    words.length >= 2 ? first + (words[1]![0] ?? "").toLocaleUpperCase("de") : first + (letters[1] ?? ""),
    ...[...letters.slice(1)].map((c) => first + c),
    ..."123456789".split("").map((d) => first + d),
  ];
  return candidates.find((c) => c.length === 2 && !taken.includes(c)) ?? `${first}${taken.length % 10}`;
}

/** erste noch freie Farbe, sonst reihum */
export function teamColor(used: string[]): string {
  return TEAM_COLORS.find((c) => !used.includes(c)) ?? TEAM_COLORS[used.length % TEAM_COLORS.length]!;
}
