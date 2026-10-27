// Testdaten für den Klick-Prototyp. Zeiten relativ zum Laden der Seite, damit Countdowns echt laufen.
// Im echten Spiel kommen dieselben Strukturen aus der Datenbank (shared/types.ts).
import { LINZ_INNENSTADT, type AuditEntry, type ChatMessage, type Config, type Position, type Report, type Team } from "@mrx/shared";
import { clock } from "../lib/clock.svelte.ts";

const MIN = 60_000;
const T0 = Date.now();
const at = (min: number) => T0 + min * MIN;

export const config: Config = $state({
  intervalMin: 10,
  headStartMin: 10,
  waitMin: 5,
  radiusM: 200,
  undoMin: 2,
  endMinH: 3,
  endMaxH: 4,
  spectators: true,
});

export const field = LINZ_INNENSTADT;

export const teams: Record<string, Team> = {
  urfahr: { name: "Urfahr", short: "UR", color: "#2e86de" },
  kleinmuenchen: { name: "Kleinmünchen", short: "KM", color: "#7c5cff" },
  auwiesen: { name: "Auwiesen", short: "AU", color: "#00a3a3" },
  ebelsberg: { name: "Ebelsberg", short: "EB", color: "#e07a00" },
  pichling: { name: "Pichling", short: "PI", color: "#8e44ad" },
  spallerhof: { name: "Spallerhof", short: "SP", color: "#16a085" },
  bindermichl: { name: "Bindermichl", short: "BM", color: "#d35400" },
  neueheimat: { name: "Neue Heimat", short: "NH", color: "#c2185b" },
  leonding: { name: "Leonding", short: "LE", color: "#5d6d7e" },
  traun: { name: "Traun", short: "TR", color: "#27ae60" },
  ansfelden: { name: "Ansfelden", short: "AN", color: "#b7950b" },
  wels: { name: "Wels", short: "WE", color: "#6d4c41" },
};

export const teamIds = Object.keys(teams);
export const ME = "urfahr";
export const MRX = "kleinmuenchen";

const pos = (lat: number, lng: number, minAgo = 0.2, acc = 8): Position => ({ lat, lng, acc, t: at(-minAgo) });

export const positions: Record<string, Position> = {
  urfahr: { ...pos(48.3021, 14.2873), heading: 35 },
  kleinmuenchen: pos(48.3051, 14.2909),
  auwiesen: pos(48.3043, 14.2929),
  ebelsberg: pos(48.299, 14.2915),
  pichling: pos(48.2968, 14.2884),
  spallerhof: pos(48.3012, 14.2946),
  bindermichl: pos(48.2955, 14.2932),
  neueheimat: pos(48.3058, 14.2869),
  leonding: pos(48.2997, 14.2888, 6.5, 30),
  traun: pos(48.2949, 14.2897),
  ansfelden: pos(48.3031, 14.2951),
  wels: pos(48.2981, 14.2943, 0.4),
};

export const staff = [
  { uid: "s1", name: "Schiri Anna", pos: pos(48.30505, 14.29075), followsFlag: true },
  { uid: "s2", name: "Schiri Martin", pos: pos(48.2992, 14.2905) },
];

// Spur seit der letzten Übergabe (Spallerhof → Kleinmünchen vor 38 Min)
export const reports: (Report & { id: string })[] = $state([
  { id: "r1", teamId: MRX, lat: 48.3008, lng: 14.2948, t: at(-38.2), posAt: at(-38.2), src: "handy", kind: "uebergabe" },
  { id: "r2", teamId: MRX, lat: 48.3019, lng: 14.2931, t: at(-28.2), posAt: at(-28.3), src: "handy", kind: "auto" },
  { id: "r3", teamId: MRX, lat: 48.3031, lng: 14.2915, t: at(-18.2), posAt: at(-18.3), src: "schiri", kind: "auto" },
  { id: "r4", teamId: MRX, lat: 48.30455, lng: 14.28985, t: at(-6.2), posAt: at(-6.3), src: "handy", kind: "auto" },
]);

export const handovers = [
  { id: "h0", to: "neueheimat", at: at(-83), type: "start" as const, byName: "Peter (Admin)" },
  { id: "h1", from: "neueheimat", to: "pichling", at: at(-71), type: "fang" as const, byName: "Schiri Anna" },
  { id: "h2", from: "pichling", to: "spallerhof", at: at(-52), type: "fang" as const, byName: "Schiri Anna" },
  { id: "h3", from: "spallerhof", to: "kleinmuenchen", at: at(-38.2), type: "fang" as const, byName: "Schiri Martin" },
];

export const locks: Record<string, number> = { bindermichl: at(3.6), wels: at(3.6) };

export const game = $state({
  phase: "laeuft" as "vorbereitung" | "laeuft" | "pause" | "beendet",
  startedAt: at(-83),
  mrx: MRX,
  mrxSince: at(-38.2),
  lastReportAt: at(-6.2),
  nextReportAt: at(3.8),
  locked: ["westen"] as string[],
  endFrom: at(-83 + 180),
  endTo: at(-83 + 240),
  ping: 0,
  online: true,
});

// Countdown abgelaufen → simulierte Meldung (Mister X bewegt sich Richtung Hauptplatz), Radar-Ping
const route = [
  [48.3049, 14.2885],
  [48.3054, 14.2872],
];
$effect.root(() => {
  $effect(() => {
    if (clock.now < game.nextReportAt) return;
    const [lat, lng] = route[(reports.length - 4) % route.length]!;
    reports.push({
      id: `r${reports.length + 1}`,
      teamId: MRX,
      lat: lat!,
      lng: lng!,
      t: game.nextReportAt,
      posAt: game.nextReportAt,
      src: "handy",
      kind: "auto",
    });
    game.lastReportAt = game.nextReportAt;
    game.nextReportAt += config.intervalMin * MIN;
    game.ping++;
  });
});

export const chat: (ChatMessage & { id: string })[] = $state([
  {
    id: "c1",
    uid: "sys",
    name: "System",
    kind: "sys",
    t: at(-83),
    text: "Spiel gestartet! Neue Heimat ist Mister X und hat 10 Min Vorsprung.",
  },
  {
    id: "c2",
    uid: "u-ur",
    name: "Urfahr",
    teamId: "urfahr",
    kind: "msg",
    t: at(-60),
    text: "Wir sind bei der Landstraße, hat wer Mister X gesehen? 👀",
  },
  { id: "c3", uid: "u-tr", name: "Traun", teamId: "traun", kind: "msg", t: at(-58), text: "Beim Musiktheater war vorhin eine rote Fahne!" },
  {
    id: "c4",
    uid: "sys",
    name: "System",
    kind: "sys",
    t: at(-38.2),
    text: "Kleinmünchen hat Spallerhof gefangen und ist jetzt Mister X! 5 Min Wartezeit in der Nähe.",
    reportId: "r1",
  },
  {
    id: "c5",
    uid: "adm",
    name: "Spielleitung",
    kind: "ann",
    t: at(-30),
    text: "Treffpunkt nach dem Spiel: Hauptplatz beim Brunnen. Bitte auf die Straßenbahnen aufpassen!",
  },
  {
    id: "c6",
    uid: "sys",
    name: "System",
    kind: "sys",
    t: at(-28.2),
    text: "Standort von Mister X (Kleinmünchen) gemeldet.",
    reportId: "r2",
  },
  { id: "c7", uid: "sys", name: "System", kind: "sys", t: at(-20), text: "Das Spielfeld wird verkleinert! Gesperrt: Westen." },
  {
    id: "c8",
    uid: "sys",
    name: "System",
    kind: "sys",
    t: at(-18.2),
    text: "Standort von Mister X (Kleinmünchen) gemeldet – Standort vom Schiri.",
    reportId: "r3",
  },
  { id: "c9", uid: "u-au", name: "Auwiesen", teamId: "auwiesen", kind: "msg", t: at(-9), text: "Wir laufen Richtung Promenade 🏃" },
  {
    id: "c10",
    uid: "sys",
    name: "System",
    kind: "sys",
    t: at(-6.2),
    text: "Standort von Mister X (Kleinmünchen) gemeldet.",
    reportId: "r4",
  },
  { id: "c11", uid: "u-eb", name: "Ebelsberg", teamId: "ebelsberg", kind: "msg", t: at(-2), text: "Sind knapp dran, Herrenstraße!" },
]);

export const dm: (ChatMessage & { id: string })[] = $state([
  { id: "d1", uid: "u-ur", name: "Urfahr", teamId: "urfahr", kind: "msg", t: at(-25), text: "Unser Handy hat nur noch 18 % Akku." },
  {
    id: "d2",
    uid: "adm",
    name: "Spielleitung",
    kind: "msg",
    t: at(-24),
    text: "Powerbank anstecken – oder ein zweites Handy mit dem Team-Passwort als Ersatzgerät anmelden.",
  },
  { id: "d3", uid: "u-ur", name: "Urfahr", teamId: "urfahr", kind: "msg", t: at(-23), text: "Passt, danke! 👍" },
]);

export const inbox = [
  { teamId: "urfahr", unread: 0, last: "Passt, danke! 👍", t: at(-23) },
  { teamId: "leonding", unread: 2, last: "GPS geht nicht, was tun?", t: at(-4) },
  { teamId: "wels", unread: 1, last: "Müssen wir wirklich warten?", t: at(-1) },
];

export const audit: (AuditEntry & { id: string; cat: "uebergabe" | "regeln" | "spielfeld" | "zugang"; undone?: boolean })[] = [
  { id: "a1", t: at(-95), name: "Peter", role: "admin", action: "Team-Passwort festgelegt", details: "", cat: "zugang" },
  {
    id: "a2",
    t: at(-83),
    name: "Peter",
    role: "admin",
    action: "Spiel gestartet",
    details: "Start-Mister-X: Neue Heimat (ausgelost)",
    cat: "regeln",
  },
  {
    id: "a3",
    t: at(-71),
    name: "Schiri Anna",
    role: "schiri",
    action: "Übergabe (Fang)",
    details: "Neue Heimat → Pichling · Wartezeit: Neue Heimat, Traun",
    cat: "uebergabe",
  },
  {
    id: "a4",
    t: at(-60),
    name: "Schiri Martin",
    role: "schiri",
    action: "Übergabe (Fang)",
    details: "Pichling → Ansfelden · Wartezeit: Pichling",
    cat: "uebergabe",
    undone: true,
  },
  {
    id: "a5",
    t: at(-59),
    name: "Schiri Martin",
    role: "schiri",
    action: "Übergabe rückgängig",
    details: "falsches Team gewählt",
    cat: "uebergabe",
  },
  {
    id: "a6",
    t: at(-52),
    name: "Schiri Anna",
    role: "schiri",
    action: "Übergabe (Fang)",
    details: "Pichling → Spallerhof · Wartezeit: Pichling, Ebelsberg",
    cat: "uebergabe",
  },
  {
    id: "a7",
    t: at(-38.2),
    name: "Schiri Martin",
    role: "schiri",
    action: "Übergabe (Fang)",
    details: "Spallerhof → Kleinmünchen · Wartezeit: Spallerhof, Bindermichl",
    cat: "uebergabe",
  },
  { id: "a8", t: at(-20), name: "Peter", role: "admin", action: "Bereich gesperrt", details: "Westen", cat: "spielfeld" },
  { id: "a9", t: at(-12), name: "Peter", role: "admin", action: "Team entfernt", details: "Test-Handy", cat: "zugang" },
];

export const stats: Record<string, { distM: number; mrxMs: number; mrxCount: number }> = {
  urfahr: { distM: 8400, mrxMs: 0, mrxCount: 0 },
  kleinmuenchen: { distM: 9100, mrxMs: 38 * MIN, mrxCount: 1 },
  auwiesen: { distM: 10200, mrxMs: 0, mrxCount: 0 },
  ebelsberg: { distM: 7900, mrxMs: 0, mrxCount: 0 },
  pichling: { distM: 8800, mrxMs: 19 * MIN, mrxCount: 1 },
  spallerhof: { distM: 7600, mrxMs: 14 * MIN, mrxCount: 1 },
  bindermichl: { distM: 6900, mrxMs: 0, mrxCount: 0 },
  neueheimat: { distM: 9600, mrxMs: 12 * MIN, mrxCount: 1 },
  leonding: { distM: 5100, mrxMs: 0, mrxCount: 0 },
  traun: { distM: 8100, mrxMs: 0, mrxCount: 0 },
  ansfelden: { distM: 7400, mrxMs: 0, mrxCount: 0 },
  wels: { distM: 6600, mrxMs: 0, mrxCount: 0 },
};

/** Ergebnis eines beendeten Spiels (Screen 19 + Archiv) */
export const result = {
  winner: "auwiesen",
  durationMs: 221 * MIN,
  handovers: 17,
  totalDistM: 212_400,
  longest: { teamId: "auwiesen", ms: 72 * MIN },
  most: { teamId: "pichling", count: 4 },
  farthest: { teamId: "ansfelden", m: 14_300 },
  timeline: [
    ["neueheimat", 12],
    ["pichling", 19],
    ["spallerhof", 14],
    ["kleinmuenchen", 41],
    ["pichling", 9],
    ["traun", 22],
    ["pichling", 11],
    ["ebelsberg", 8],
    ["pichling", 13],
    ["auwiesen", 72],
  ] as [string, number][],
};

export const archive = [
  {
    id: "linz-2026",
    name: "Mister X Linz 2026",
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- feste Testdaten
    date: new Date(2026, 9, 12, 14, 0).getTime(),
    winner: "Auwiesen",
    durationMs: 221 * MIN,
    teams: 24,
  },
  {
    id: "linz-2025",
    name: "Mister X Linz 2025",
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- feste Testdaten
    date: new Date(2025, 9, 4, 14, 0).getTime(),
    winner: "Traun",
    durationMs: 198 * MIN,
    teams: 21,
  },
];

export const games = [
  { id: "linz-2027", name: "Mister X Linz 2027", phase: "laeuft", teams: 12, admins: 2 },
  { id: "wels-test", name: "Testspiel Wels", phase: "vorbereitung", teams: 0, admins: 1 },
  { id: "linz-2026", name: "Mister X Linz 2026", phase: "archiviert", teams: 24, admins: 2 },
];
