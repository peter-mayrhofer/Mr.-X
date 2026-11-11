// Spray-Logo der Startseite: Mister X sprüht „MISTER X“ an die Wand (Vorlage aus Claude Design, E-61).
// Reine Rechnung: zu jeder Zeit t (Sekunden) liefert bild(t) Pose, Kamera und Sprühfortschritt.
// Die Zeichnung macht SprayLogo.svelte. Koordinaten in der Fläche W × H.

export const W = 1568,
  H = 698,
  RED = "#ee2b2b";
const G = 610;
type P = [number, number];

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1);
const easeOutCubic = (t: number) => (t - 1) ** 3 + 1;
const easeOutBack = (t: number) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;
const tw = (T: number, a: number, b: number, e = easeInOut) => e(clamp((T - a) / (b - a), 0, 1));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpP = (p: P, q: P, t: number): P => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];
const add = (p: P, q: P): P => [p[0] + q[0], p[1] + q[1]];
const at = (p: P, a: number, l: number): P => [p[0] + Math.sin((a * Math.PI) / 180) * l, p[1] + Math.cos((a * Math.PI) / 180) * l];
export const rnd = (i: number, j: number) => {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// ---- Zeitachse: Abschnitte mit gespielter Länge und Länge der Choreografie ----
// Intro 1 s, Dose holen 2,4 s, Sprühen 7,9 s, Zurückgehen 2,2 s, Siegerpose 1,5 s
const ABSCHNITTE = [
  [1, 2],
  [2.4, 2.4],
  [7.9, 7.9],
  [2.2, 2.2],
  [1.5, 3],
];
export const DAUER = ABSCHNITTE.reduce((s, [d]) => s + d!, 0);
/** gespielte Sekunden → Zeit der Choreografie */
function choreo(t: number): number {
  let real = 0,
    soll = 0;
  for (const [d, n] of ABSCHNITTE as [number, number][]) {
    if (t <= real + d) return soll + (Math.max(0, t - real) * n) / d;
    real += d;
    soll += n;
  }
  return soll;
}
const g = 2,
  sp = 4.4,
  r = 12.3,
  ps = 14.5;

// ---- Sprühweg: die Düse fährt jeden Buchstaben nach ----
const LETTERS: P[] = [
  [599, 736],
  [761, 809],
  [827, 948],
  [959, 1077],
  [1095, 1201],
  [1222, 1341],
  [1374, 1508],
];
const TOP = 282,
  BOT = 392;
const STROKES: P[][][] = [
  [
    [
      [624, 392],
      [624, 282],
      [667, 352],
      [711, 282],
      [711, 392],
    ],
  ],
  [
    [
      [785, 282],
      [785, 392],
    ],
  ],
  [
    [
      [928, 298],
      [888, 283],
      [850, 298],
      [849, 325],
      [888, 337],
      [926, 350],
      [927, 377],
      [887, 392],
      [846, 378],
    ],
  ],
  [
    [
      [965, 292],
      [1071, 292],
    ],
    [
      [1018, 292],
      [1018, 392],
    ],
  ],
  [
    [
      [1195, 293],
      [1118, 293],
      [1118, 383],
      [1195, 383],
    ],
    [
      [1118, 340],
      [1190, 340],
    ],
  ],
  [
    [
      [1245, 392],
      [1245, 282],
      [1300, 284],
      [1324, 306],
      [1321, 331],
      [1290, 342],
      [1248, 342],
    ],
    [
      [1282, 342],
      [1330, 392],
    ],
  ],
  [
    [
      [1402, 276],
      [1482, 398],
    ],
    [
      [1478, 276],
      [1398, 398],
    ],
  ],
];
function band(a: P, b: P, hw: number): P[] {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    l = Math.hypot(dx, dy),
    nx = (-dy / l) * hw,
    ny = (dx / l) * hw,
    ex = (dx / l) * 30,
    ey = (dy / l) * 30;
  return [
    [a[0] - ex + nx, a[1] - ey + ny],
    [b[0] + ex + nx, b[1] + ey + ny],
    [b[0] + ex - nx, b[1] + ey - ny],
    [a[0] - ex - nx, a[1] - ey - ny],
  ];
}
const CLIPS: Record<string, P[]> = {
  "4-0": [
    [1092, 262],
    [1206, 262],
    [1206, 317],
    [1146, 317],
    [1146, 363],
    [1206, 363],
    [1206, 400],
    [1092, 400],
  ],
  "4-1": [
    [1140, 317],
    [1206, 317],
    [1206, 363],
    [1140, 363],
  ],
  "6-0": band([1402, 276], [1482, 398], 25),
  "6-1": band([1478, 276], [1398, 398], 25),
};
const plen = (pts: P[]) => pts.slice(1).reduce((l, p, i) => l + Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]), 0);

interface Seg {
  draw: boolean;
  pts: P[];
  letter: number;
  from: number;
  d: string;
  clip: string;
  len: number;
  w: number;
  f0: number;
  f1: number;
}
export const SEGS: Seg[] = [];
{
  let last: P | null = null;
  STROKES.forEach((ls, li) =>
    ls.forEach((pts, si) => {
      if (last) SEGS.push({ draw: false, pts: [last, pts[0]!], letter: li, from: SEGS.at(-1)!.letter } as Seg);
      const [la, lb] = LETTERS[li]!;
      const cp = CLIPS[`${li}-${si}`] ?? [
        [la - 3, 262],
        [lb + 3, 262],
        [lb + 3, 400],
        [la - 3, 400],
      ];
      SEGS.push({
        draw: true,
        pts,
        letter: li,
        from: li,
        d: "M" + pts.map((p) => p.join(" ")).join("L"),
        clip: cp.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" "),
      } as Seg);
      last = pts.at(-1)!;
    }),
  );
  let acc = 0;
  for (const sg of SEGS) {
    sg.len = plen(sg.pts);
    sg.w = sg.draw ? sg.len * 0.4 : sg.len * 0.6 + 20;
    sg.f0 = acc;
    acc += sg.w;
  }
  for (const sg of SEGS) {
    sg.f0 /= acc;
    sg.f1 = sg.f0 + sg.w / acc;
  }
}
const DRIPS = (
  [
    [603, 606, 439],
    [610, 622, 412],
    [623, 626, 414],
    [627, 640, 419],
    [698, 718, 426],
    [722, 724, 405],
    [726, 729, 404],
    [730, 733, 412],
    [766, 768, 406],
    [771, 800, 443],
    [802, 804, 405],
    [886, 888, 404],
    [890, 919, 420],
    [925, 927, 428],
    [1002, 1012, 437],
    [1018, 1023, 416],
    [1026, 1028, 404],
    [1099, 1115, 424],
    [1120, 1165, 440],
    [1166, 1195, 440],
    [1251, 1263, 431],
    [1295, 1300, 413],
    [1302, 1320, 428],
    [1321, 1323, 407],
    [1324, 1328, 405],
    [1329, 1337, 414],
    [1396, 1406, 409],
    [1408, 1419, 409],
    [1462, 1470, 415],
    [1471, 1472, 406],
    [1474, 1496, 429],
    [1497, 1505, 419],
  ] as [number, number, number][]
).map(([a, b, y], i) => ({
  a,
  b,
  y,
  letter: LETTERS.findIndex(([l0, l1]) => a >= l0 - 4 && a <= l1 + 4),
  delay: 0.05 + rnd(i, 3) * 0.55,
  dur: (0.7 + ((y - 398) / 45) * 1.8) * (0.8 + 0.4 * rnd(i, 7)),
}));
const FE = LETTERS.map((_, k) => Math.max(...SEGS.filter((sg) => sg.draw && sg.letter === k).map((sg) => sg.f1)));
const F_SPLIT = SEGS.find((sg) => !sg.draw && sg.letter === 6)!.f0;

function segAt(f: number) {
  f = clamp(f, 0, 1);
  let i = 0;
  while (i < SEGS.length - 1 && SEGS[i]!.f1 < f) i++;
  const sg = SEGS[i]!;
  return { sg, t: clamp((f - sg.f0) / (sg.f1 - sg.f0), 0, 1) };
}
function alongPts(pts: P[], t: number): P {
  const L = plen(pts) * t;
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
    if (acc + l >= L) return lerpP(pts[i - 1]!, pts[i]!, l ? (L - acc) / l : 0);
    acc += l;
  }
  return pts.at(-1)!;
}
function pointAt(f: number): P {
  const { sg, t } = segAt(f);
  return alongPts(sg.pts, sg.draw ? t : easeInOut(t));
}
const ANCH = LETTERS.map(([a, b]) => (a + b) / 2 - 240);
function bodyAtF(f: number) {
  const { sg, t } = segAt(f);
  if (sg.draw || sg.from === sg.letter) return ANCH[sg.letter]!;
  return lerp(ANCH[sg.from]!, ANCH[sg.letter]!, easeInOut(t));
}
function sprayOnAt(f: number) {
  const { sg, t } = segAt(f);
  return sg.draw ? 1 : clamp(1 - (Math.min(t, 1 - t) * sg.len) / 10, 0, 1);
}

// ---- Zeitpunkte des Sprühens ----
const S0 = sp + 0.15,
  S1 = r - 0.45,
  SW = 1.4,
  Sa = S0 + (S1 - S0 - SW) * F_SPLIT,
  Sb = Sa + SW;
const sprayP = (T: number) =>
  T < Sa ? F_SPLIT * clamp((T - S0) / (Sa - S0), 0, 1) : T < Sb ? F_SPLIT : lerp(F_SPLIT, 1, clamp((T - Sb) / (S1 - Sb), 0, 1));
const tOfF = (f: number) => (f <= F_SPLIT ? S0 + (f / F_SPLIT) * (Sa - S0) : Sb + ((f - F_SPLIT) / (1 - F_SPLIT)) * (S1 - Sb));

// ---- Skelett ----
const TORSO = 150,
  NECK = 88,
  UA = 92,
  FA = 88,
  TH = 115,
  SH = 115;
function ik(A: P, B: P, l1: number, l2: number, sign: number) {
  const dx = B[0] - A[0],
    dy = B[1] - A[1];
  const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 1, l1 + l2 - 0.5);
  const ang = Math.atan2(dy, dx);
  const off = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const a = ang + sign * off;
  return {
    J: [A[0] + l1 * Math.cos(a), A[1] + l1 * Math.sin(a)] as P,
    E: [A[0] + d * Math.cos(ang), A[1] + d * Math.sin(ang)] as P,
  };
}
function bodyXAt(T: number) {
  if (T < g + 1.9) return 330;
  if (T < sp) return lerp(330, ANCH[0]!, tw(T, g + 1.9, sp));
  if (T < r + 0.15) return bodyAtF(sprayP(T));
  return lerp(ANCH[6]!, 330, tw(T, r + 0.15, ps - 0.15));
}
const facingAt = (T: number) => lerp(lerp(1, -1, tw(T, r - 0.05, r + 0.3)), 1, tw(T, ps - 0.3, ps + 0.05));
const nozzleFor = (tg: P): P => [tg[0] - 110, lerp(255, 290, clamp((tg[1] - TOP) / (BOT - TOP), 0, 1))];

function rig(T: number) {
  const xw = bodyXAt(T),
    face = facingAt(T),
    x = xw * (face >= 0 ? 1 : -1);
  const v = (bodyXAt(T + 0.04) - bodyXAt(T - 0.04)) / 0.08;
  const walkW = clamp(Math.abs(v) / 70, 0, 1);
  const lungeW = T < ps ? 1 - tw(T, g, g + 0.6) : tw(T, ps, ps + 0.5);
  const sprayW = tw(T, sp - 0.5, sp + 0.1) * (1 - tw(T, r - 0.1, r + 0.4));
  const L = 200,
    phi = x / L;
  const gait = [0, 1].map((i): P => {
    const s = phi + i / 2,
      kk = Math.floor(s),
      u = s - kk,
      plant = L * (kk - i / 2 + 0.25);
    if (u < 0.5) return [plant, G];
    const q = (u - 0.5) * 2;
    return [lerp(plant, plant + L, easeInOut(q)), G - Math.sin(Math.PI * q) * 34];
  });
  const rest: P[] = [
    [x - 28, G],
    [x + 38, G],
  ];
  const lungeF: P[] = [
    [x - 180, G],
    [x + 69, G],
  ];
  const feet = [0, 1].map((i) => lerpP(lerpP(rest[i]!, gait[i]!, walkW), lungeF[i]!, lungeW));
  const bob = walkW * 6 * Math.abs(Math.sin(2 * Math.PI * phi));
  const dip = 16 * Math.sin(Math.PI * clamp((T - ps - 0.3) / 0.45, 0, 1));
  const hip: P = [x, lerp(390 - 30 * sprayW + bob, 463, lungeW) + dip];
  const torso = lerp(lerp(177, 155, sprayW), 165, lungeW) + Math.sin(T * 2.6) * 1.2 - walkW * 4;
  const S = at(hip, torso, TORSO);
  const headA = lerp(lerp(172, 160, sprayW), 155, lungeW);
  const head = at(S, headA, NECK);
  const lE = at(S, lerp(-40, -135, lungeW) + walkW * 6 * Math.sin(4 * Math.PI * phi), UA);
  const lH = at(lE, lerp(-150, -188, lungeW), FA);
  const pole = lerp(-25 - walkW * 8, 0, lungeW) + Math.sin(T * 3) * 2;
  const p = sprayP(T),
    tg = pointAt(p),
    noz = nozzleFor(tg);
  const sprayHand: P = [noz[0] - 6, noz[1] + 50];
  const rel = (q: P) => add(S, q);
  const LUNGE: P = [94, -8],
    BACK: P = [-50, 120],
    CHEST: P = [60, 75],
    DOWN: P = [30, 125],
    VICT: P = [150, -55];
  let hand: P,
    canRot = 0;
  const shakeT = clamp((T - g - 1.0) / 0.9, 0, 1);
  const shake = Math.sin(2 * Math.PI * 4.5 * shakeT) * Math.sin(Math.PI * shakeT);
  if (T < g) hand = rel(LUNGE);
  else if (T < g + 0.6) hand = lerpP(rel(LUNGE), rel(BACK), tw(T, g, g + 0.6));
  else if (T < g + 1.0) hand = lerpP(rel(BACK), rel(CHEST), tw(T, g + 0.6, g + 1.0));
  else if (T < g + 1.9) {
    hand = add(rel(CHEST), [0, 26 * shake]);
    canRot = 16 * shake;
  } else if (T < Sa) hand = lerpP(rel(CHEST), sprayHand, tw(T, g + 1.9, S0));
  else if (T < Sb) {
    const u = T - Sa,
      q = clamp((u - 0.85) / 0.3, 0, 1),
      sh = Math.sin(2 * Math.PI * 2 * q) * Math.sin(Math.PI * q);
    hand = lerpP(sprayHand, add(sprayHand, [-10, 30]), tw(u, 0, 0.2));
    hand = lerpP(hand, rel(BACK), tw(u, 0.25, 0.6));
    hand = lerpP(hand, rel(CHEST), tw(u, 0.6, 0.85));
    hand = add(hand, [0, 22 * sh]);
    canRot = 14 * sh;
    hand = lerpP(hand, sprayHand, tw(u, 1.15, 1.4));
  } else if (T < S1) hand = sprayHand;
  else if (T < r) hand = lerpP(sprayHand, rel(DOWN), tw(T, S1, r - 0.05));
  else if (T < ps) hand = rel(DOWN);
  else {
    hand = lerpP(rel(DOWN), rel(VICT), tw(T, ps + 0.05, ps + 0.55, easeOutBack));
    canRot = 18 * tw(T, ps + 0.05, ps + 0.55);
  }
  const rArm = ik(S, hand, UA, FA, 1);
  const legs = feet.map((f) => ik(hip, f, TH, SH, -1));
  const swapped = T >= Sa + 0.4;
  const canS = swapped ? tw(T, Sa + 0.6, Sa + 0.85, easeOutBack) : T < Sa + 0.2 ? tw(T, g + 0.6, g + 0.85, easeOutBack) : 0;
  if (T > S0 && T < r && (T < Sa || T > Sb)) canRot += clamp((tg[1] - noz[1]) * 0.25, -12, 18);
  // die weiße Dose fällt zu Boden, rollt aus und verschwindet, wenn er zurückgeht (das fertige Logo zeigt keine Dose)
  let drop: { pos: P; rot: number; o: number } | null = null;
  if (T >= Sa + 0.2) {
    const rp = add(add(sprayHand, [-10, 30]), [4, -8]);
    const t = T - (Sa + 0.2),
      gy = 2800,
      land = Math.sqrt((2 * Math.max(1, G - rp[1])) / gy);
    const tf = Math.min(t, land),
      roll = Math.max(0, t - land);
    drop = {
      pos: [rp[0] - 70 * tf - 45 * (1 - Math.exp(-roll * 3)), Math.min(G, rp[1] + 0.5 * gy * tf * tf)],
      rot: -95 * clamp(t / land, 0, 1) - 20 * Math.sin(Math.min(roll, 0.5) * Math.PI * 2) * Math.exp(-roll * 4),
      o: 1 - tw(T, r + 0.3, r + 1.2),
    };
  }
  const sprayOn = (T > S0 && T < S1 && (T < Sa || T > Sb) ? 1 : 0) * sprayOnAt(p);
  return {
    swapped,
    drop,
    x,
    xw,
    face,
    letter: segAt(p).sg.letter,
    walkW,
    hip,
    S,
    head,
    headA,
    lE,
    lH,
    pole,
    rArm,
    legs,
    canS,
    canRot,
    tg,
    noz: add(rArm.E, [6, -50]),
    sprayOn,
    p,
  };
}
export type Rig = ReturnType<typeof rig>;

function dripE(dr: (typeof DRIPS)[number], T: number) {
  const t0 = tOfF(FE[dr.letter]!) + dr.delay,
    q = clamp((T - t0) / dr.dur, 0, 1);
  if (q <= 0) return 0;
  return q < 0.18 ? (q / 0.18) * 0.12 : 0.12 + 0.88 * easeOutCubic((q - 0.18) / 0.82);
}

/** Alles, was zur gespielten Zeit t (0 … DAUER Sekunden) zu sehen ist. */
export function bild(t: number) {
  const T = choreo(t);
  const R = rig(T);
  const fr = Math.floor(T * 30);
  // Sprühnebel: 30 Tröpfchen zwischen Düse und Wand
  const dx = R.tg[0] - R.noz[0],
    dy = R.tg[1] - R.noz[1],
    len = Math.hypot(dx, dy) || 1;
  const nebel =
    R.sprayOn > 0.01
      ? Array.from({ length: 30 }, (_, i) => {
          const u = rnd(i, fr) ** 0.7 * 1.08,
            s = (rnd(i + 99, fr) - 0.5) * 64 * u;
          return {
            x: R.noz[0] + dx * u + (-dy / len) * s,
            y: R.noz[1] + dy * u + (dx / len) * s,
            r: 1 + rnd(i + 7, fr) * 3.2,
            o: (0.25 + 0.6 * rnd(i + 3, fr)) * R.sprayOn,
          };
        })
      : [];
  return {
    T,
    R,
    /** Fortschritt je Sprühstrich 0…1 */
    striche: SEGS.map((sg) => (sg.draw ? clamp((R.p - sg.f0) / (sg.f1 - sg.f0), 0, 1) : 0)),
    /** Buchstabe fertig gesprüht → ganz zeigen */
    fertig: LETTERS.map((_, i) => T >= tOfF(FE[i]!)),
    tropfen: DRIPS.map((dr) => ({ ...dr, e: dripE(dr, T) })),
    nebel,
    flaggeSchwung: 3.5 * Math.sin(T * 7) + R.walkW * 7,
    flaggeDehnung: 1 + 0.035 * Math.sin(T * 7 + 1.2),
  };
}
export { LETTERS };
