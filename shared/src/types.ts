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

export interface Field {
  name: string;
  /** Meter jenseits der Grenzlinie, die noch als „drinnen“ zählen (Regel 9 + GPS-Ungenauigkeit) */
  toleranceM: number;
  base: Polygon;
  cuts: Record<string, Cut>;
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
  /** gesperrte Bereiche: id → Zeitpunkt der Sperre */
  cuts: Record<string, number>;
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

export interface TeamStats {
  distM: number;
  mrxMs: number;
  mrxCount: number;
}
