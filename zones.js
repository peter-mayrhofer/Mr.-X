// Spielfeld nach der Papierkarte (schwarze Linie) – Koordinaten [lat, lng], grob aus OpenStreetMap übernommen.
// ponytail: von Hand eingetragen, bei Bedarf Punkte hier nachschärfen.
export const BASE = [
  [48.3066, 14.2835], // Hofberg / Schloss
  [48.3068, 14.2875], // Rathausgasse / Zollamtstraße
  [48.3072, 14.2900],
  [48.3102, 14.2945], // Kriegerdenkmal / Untere Donaulände
  [48.3085, 14.2995], // Gruberstraße
  [48.3040, 14.3012],
  [48.2992, 14.3032], // Raiffeisenplatz
  [48.2972, 14.3010],
  [48.2963, 14.2985], // Blumauerplatz
  [48.2956, 14.2905], // Volksgarten
  [48.2903, 14.2880], // Wissensturm / Hauptbahnhof
  [48.2925, 14.2850], // Waldeggstraße
  [48.2975, 14.2815],
  [48.2995, 14.2800], // Kapuzinerstraße
  [48.3026, 14.2810],
  [48.3040, 14.2795], // Römerstraße
  [48.3060, 14.2808],
];

// Verkleinerungsstufen: Stufe n schneidet die ersten n Bereiche weg (Zickzack-Bereiche der Karte).
// ponytail: Reihenfolge geraten (Nord, Ost, West) – Spielleitung bestätigen lassen.
export const CUTS = [
  {
    name: "Norden (Altstadt, Hauptplatz)",
    poly: [[48.3028, 14.2780], [48.3028, 14.2822], [48.3033, 14.2848], [48.3041, 14.2880], [48.3051, 14.2901],
      [48.3055, 14.2904], [48.3059, 14.2922], [48.3064, 14.2953], [48.3066, 14.2982], [48.3066, 14.3050],
      [48.3150, 14.3050], [48.3150, 14.2780]],
  },
  {
    name: "Osten (hinter der Dinghoferstraße)",
    poly: [[48.3062, 14.2935], [48.3020, 14.2958], [48.2995, 14.2977], [48.2965, 14.2988], [48.2930, 14.2990],
      [48.2930, 14.3100], [48.3150, 14.3100], [48.3150, 14.2935]],
  },
  {
    name: "Westen (vor der Herrenstraße / Stockhofstraße)",
    poly: [[48.3036, 14.2862], [48.3021, 14.2867], [48.3003, 14.2874], [48.2973, 14.2876], [48.2959, 14.2870],
      [48.2930, 14.2866], [48.2880, 14.2866], [48.2880, 14.2750], [48.3036, 14.2750]],
  },
];

const inPoly = (p, poly) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i], [yj, xj] = poly[j];
    if ((yi > p.lat) !== (yj > p.lat) && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

export const inZone = (p, stage) => inPoly(p, BASE) && !CUTS.slice(0, stage).some((c) => inPoly(p, c.poly));
