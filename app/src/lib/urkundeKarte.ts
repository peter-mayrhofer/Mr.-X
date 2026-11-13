// Hintergrund der Urkunde: ein ausgedachter Stadtplan (Straßen, Fluss, rotes Spielfeld, Jagd-Route).
// Immer gleich (feste Zufallszahlen), damit alle Blätter gleich aussehen. Maße in mm, Fläche 210 × 205.
const rnd = (i: number) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const f = (n: number) => n.toFixed(1);

/** dünne Nebenstraßen: leicht schräge Linien in beide Richtungen */
export const strassen = (() => {
  const d: string[] = [];
  for (let i = 0; i < 17; i++) {
    const x = -6 + i * 13.5 + rnd(i) * 6;
    d.push(`M${f(x)} -5L${f(x + (rnd(i + 40) - 0.5) * 26)} 210`);
  }
  for (let i = 0; i < 18; i++) {
    const y = -4 + i * 12.5 + rnd(i + 90) * 5;
    d.push(`M-5 ${f(y)}L215 ${f(y + (rnd(i + 130) - 0.5) * 22)}`);
  }
  return d.join("");
})();

/** Hauptstraßen: kräftiger, quer durchs Blatt */
export const hauptstrassen =
  "M-5 150L80 118L140 128L215 96M40 -5L62 70L58 140L74 210M150 -5L138 60L170 130L196 210M-5 70L60 72L120 92L215 70";

/** Fluss (wie die Donau durch Linz) */
export const fluss = "M-10 22C35 6 70 44 112 30S182 6 222 26";

/** Spielfeld: rote Grenze, dazu ein gesperrter (schraffierter) Zipfel */
export const feld = "M28 58L62 40L110 46L150 38L184 66L178 120L190 160L150 186L96 178L52 190L24 150L36 104Z";
export const gesperrt = "M24 150L36 104L60 112L66 168L52 190Z";

/** Jagd-Route am rechten Rand (weg vom Text) mit Mister X (rot) und drei Jägern */
export const route = "M180 34L196 70L182 96L198 126L184 150L196 182";
export const punkte = [
  { x: 198, y: 126, c: "#c51a1a", r: 2.6, mrx: true },
  { x: 182, y: 96, c: "#3b9cff", r: 1.9 },
  { x: 184, y: 150, c: "#ffc531", r: 1.9 },
  { x: 14, y: 128, c: "#2fbf71", r: 1.9 },
];
