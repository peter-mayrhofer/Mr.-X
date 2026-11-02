// Gemeinsame Typen für App und Spiel-Server. Pfade siehe docs/KONZEPT.md, Abschnitt 4.

/** [Länge, Breite] – GeoJSON-Reihenfolge */
export type LngLat = [lng: number, lat: number];
export type Polygon = LngLat[];

export interface Point {
  lat: number;
  lng: number;
}

export type Role = "admin" | "schiri" | "team" | "screen" | "viewer";
export type Phase = "vorbereitung" | "laeuft" | "pause" | "beendet";

export interface Cut {
  name: string;
  /** kurzer Name für Karte und Meldungen, z. B. „Norden“ */
  short: string;
  color: string;
  /** Reihenfolge-Vorschlag für die Verkleinerung */
  order: number;
  poly: Polygon;
}

/** Essens-Ort (z. B. McDonald's): Teams, die dort mindestens 10 Min bleiben, zählen für die Auszeichnung „Futter-Profi“ */
export interface Spot {
  name: string;
  lat: number;
  lng: number;
  /** Umkreis in Metern, in dem ein Team als „vor Ort“ gilt */
  radiusM: number;
}

export interface Field {
  name: string;
  /** Meter jenseits der Grenzlinie, die noch als „drinnen“ zählen (Regel 9 + GPS-Ungenauigkeit) */
  toleranceM: number;
  base: Polygon;
  cuts: Record<string, Cut>;
  /** Essens-Orte für die Auszeichnung „Futter-Profi“ (optional) */
  spots?: Spot[];
}

export interface Config {
  intervalMin: number;
  headStartMin: number;
  waitMin: number;
  radiusM: number;
  undoMin: number;
  endMinH: number;
  endMaxH: number;
  spectators: boolean;
  /** eigene Regeln/Hinweise der Spielleitung für dieses Spiel (Abschnitt 7.11), einfache Formatierung (regeltext.ts) */
  rulesText?: string;
}

export interface Team {
  name: string;
  /** zwei Buchstaben für Marker */
  short: string;
  color: string;
}

export interface Position extends Point {
  /** Genauigkeit in Metern */
  acc: number;
  /** Zeitpunkt der Messung (Server-Zeit) */
  t: number;
  heading?: number;
  battery?: number;
  suspect?: boolean;
  /** kam von einem Tracker (nicht vom Handy) */
  tracker?: boolean;
}

/**
 * Externes Gerät (GPS-Tracker oder altes Handy mit „Traccar Client“, Meilenstein 11). `assign`: „fahne“ = steckt in
 * der Fahne und ist damit immer bei Mister X; Team-Id = Standort dieses Teams (hat Vorrang vor dem Handy); null = frei.
 */
export interface Device {
  name: string;
  assign: string | null;
  createdAt: number;
  /** letzter Standort (nur Spielleitung, Schiri, Großbild sehen ihn) */
  pos?: Position;
}

export type ReportSource = "handy" | "tracker" | "schiri" | "letzter";
export type ReportKind = "auto" | "sofort" | "uebergabe";

export interface Report extends Point {
  teamId: string;
  /** Zeitpunkt der Meldung */
  t: number;
  /** Zeitpunkt, zu dem der gemeldete Standort gemessen wurde */
  posAt: number;
  src: ReportSource;
  kind: ReportKind;
  void?: boolean;
}

export type HandoverType = "start" | "fang" | "strafe";

export interface Handover {
  from?: string;
  to: string;
  at: number;
  type: HandoverType;
  byName: string;
  undoneAt?: number;
  lat?: number;
  lng?: number;
  /** Teams, die dadurch Wartezeit bekamen */
  locked?: string[];
  reportId?: string;
}

export interface Lock {
  until: number;
  reason: "start" | "uebergabe" | "manuell";
}

export interface GameState {
  phase: Phase;
  mrx?: string;
  mrxSince?: number;
  startedAt?: number;
  pausedAt?: number;
  endedAt?: number;
  lastReportAt?: number;
  nextReportAt?: number;
  /** gesperrte Bereiche: id → Zeitpunkt der Sperre (RTDB speichert keine leeren Objekte → optional) */
  cuts?: Record<string, number>;
  /** angekündigte Sperren: id → Zeitpunkt, zu dem der Bereich wirklich gesperrt wird (Vorwarnung) */
  warnCuts?: Record<string, number>;
  /** letzte Übergabe (nur sie kann rückgängig gemacht werden) */
  lastHandover?: string;
  /** Archiv-Eintrag des beendeten Laufs */
  run?: string;
  /** zählt jede Änderung hoch – Aktionen prüfen damit, ob der Zustand noch stimmt */
  rev: number;
}

/** Übergabe, wie der Server sie speichert: mit Vorzustand für „Rückgängig“ */
export interface HandoverRecord extends Handover {
  byUid: string;
  prev?: Pick<GameState, "mrx" | "mrxSince" | "lastReportAt" | "nextReportAt">;
  /** Wartezeiten vor der Übergabe (nur Teams, die schon eine hatten) */
  prevLocks?: Record<string, Lock>;
}

export interface CutEvent {
  cut: string;
  locked: boolean;
  t: number;
}

export interface Pause {
  from: number;
  to?: number;
}

export type ChatKind = "msg" | "sys" | "ann";

export interface ChatMessage {
  uid: string;
  name: string;
  text: string;
  t: number;
  kind: ChatKind;
  teamId?: string;
  /** Verweis auf eine Meldung → antippbar, springt auf der Karte hin */
  reportId?: string;
}

export interface AuditEntry {
  t: number;
  name: string;
  role: Role;
  action: string;
  details: string;
}

/** Zeit und Anzahl als Mister X rechnet `results()` aus den Übergaben – gespeichert wird nur die Strecke */
export interface TeamStats {
  distM: number;
}
