// Vertrag zwischen App und Spiel-Server (POST /api, docs/API.md). Eine Quelle für beide Seiten.
import type { ChatMessage, Config, CutEvent, Field, Handover, Pause, Report, Role, Team } from "./types.ts";
import type { PositionIn } from "./protocol.ts";
import type { Results } from "./spiel.ts";
import type { PushKind } from "./push.ts";
import type { VorlageId } from "./vorlagen/index.ts";

export type JoinRole = Role;
export type SecretKind = "teamPw" | "schiriCode" | "adminPw";
export type Template = VorlageId | "leer";

/** Browser-Push-Abo (PushSubscription.toJSON()) */
export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export type ApiRequest =
  // Organisator (Super-Admin): einmal mit dem Setup-Geheimnis ein Passwort setzen, danach anmelden
  | { action: "superSetup"; setupSecret: string; password: string }
  | { action: "superLogin"; password: string }
  | { action: "listGames" }
  | { action: "createGame"; gameId: string; name: string; template: Template; adminPassword: string }
  // öffentlich: Name/Phase eines Spiels für Startseite und QR-Link
  | { action: "gameInfo"; gameId: string }
  | { action: "join"; gameId: string; role: JoinRole; name: string; secret?: string; secondDevice?: boolean; size?: number }
  | { action: "leave"; gameId: string }
  | { action: "setSecret"; gameId: string; kind: SecretKind; value: string | null }
  | { action: "screenLink"; gameId: string }
  // Druckblätter: stimmt das eingetippte Passwort/der Code? (nur Spielleitung; gespeichert sind nur Prüfsummen)
  | { action: "checkSecret"; gameId: string; kind: SecretKind; value: string }
  // Spielablauf (Meilenstein 4)
  | { action: "startGame"; gameId: string; mrx: string | "random" }
  | { action: "handover"; gameId: string; to: string; type: "fang" | "strafe"; expectedMrx: string; requestId: string }
  | { action: "undo"; gameId: string; handoverId: string }
  | { action: "pause"; gameId: string }
  | { action: "resume"; gameId: string }
  | { action: "stopGame"; gameId: string }
  | { action: "setConfig"; gameId: string; config: Partial<Config> }
  | { action: "setCut"; gameId: string; cutId: string; locked: boolean; /** Vorwarnung in Minuten (1–60); ohne = sofort */ inMin?: number }
  | { action: "setLock"; gameId: string; teamId: string; min: number }
  | { action: "instantReport"; gameId: string }
  | { action: "announce"; gameId: string; text: string }
  | { action: "revealEnd"; gameId: string }
  | { action: "follow"; gameId: string; on: boolean }
  | { action: "resetRound"; gameId: string }
  | { action: "removeMember"; gameId: string; uid: string }
  | { action: "removeTeam"; gameId: string; teamId: string }
  | { action: "renameTeam"; gameId: string; teamId: string; name: string }
  // Teamgröße (Team selbst oder Spielleitung) und Team aufteilen (Spielleitung): `uids` = Geräte, die ins neue Team wechseln
  | { action: "setTeamSize"; gameId: string; teamId: string; size: number }
  // Übergabe durch Teams freigeben (Spielleitung): diese Teams bestätigen als Mister X ihren Fang selbst
  | { action: "setTeamHandover"; gameId: string; teamIds: string[]; on: boolean }
  | { action: "splitTeam"; gameId: string; teamId: string; name: string; uids: string[]; size?: number }
  // Notfall: Team meldet (mit eigenem Standort, wenn vorhanden); erledigt/Fehlalarm durch Spielleitung, Schiri oder das Team
  | { action: "sos"; gameId: string; pos?: PositionIn }
  | { action: "sosDone"; gameId: string; id: string }
  // Sammelruf: Spielleitung startet/beendet; Ankunft meldet das Team selbst oder die Spielleitung (auch zurücknehmen)
  | { action: "gather"; gameId: string; on: boolean }
  | { action: "arrived"; gameId: string; teamId: string; on: boolean }
  // Bonus-Posten (E-75): Team löst einen gescannten Code ein; Spielleitung holt die Codes zum Drucken
  | { action: "posten"; gameId: string; code: string }
  | { action: "postenCodes"; gameId: string }
  // Vorlagen (Regeln, Spielfeld, Durchsagen) für alle Spiele des Organisators
  | { action: "templateList"; gameId: string }
  | { action: "templateSave"; gameId: string; name: string }
  | { action: "templateLoad"; gameId: string; id: string }
  | { action: "templateDelete"; gameId: string; id: string }
  // Chat (Abschnitt 7.5): Gruppenchat bzw. Direktkanal `dm` (Team-Id); Moderation durch die Spielleitung
  | { action: "chat"; gameId: string; text: string; dm?: string }
  | { action: "deleteChat"; gameId: string; id: string; dm?: string }
  // Push (Web Push, VAPID): Abo dieses Geräts und gewünschte Arten
  // sub weglassen = Abo bleibt, nur Arten ändern; null = kein Web-Push (Android-App: lokale Benachrichtigungen)
  | { action: "pushSubscribe"; gameId: string; sub?: PushSub | null; prefs: Partial<Record<PushKind, boolean>>; lang?: string }
  // Tracker (Meilenstein 11): Gerät anlegen (liefert den Schlüssel für die Geräte-Kennung), zuordnen, entfernen
  | { action: "addDevice"; gameId: string; name: string }
  | { action: "setDevice"; gameId: string; device: string; assign: string | null }
  | { action: "removeDevice"; gameId: string; device: string }
  | { action: "deviceKey"; gameId: string; device: string }
  // Archiv (Meilenstein 10)
  | { action: "archiveList"; gameId: string }
  | { action: "archiveGet"; gameId: string; run: string }
  // Spielfeld und Spiele verwalten (Meilenstein 7)
  | { action: "setField"; gameId: string; field: Field }
  | { action: "archiveGame"; gameId: string; archived: boolean }
  | { action: "deleteGame"; gameId: string };

/** Jede Anfrage darf eine Kennung `rid` tragen: dieselbe Anfrage nochmal (Netzabbruch) wird nicht doppelt ausgeführt */
export type ApiCall = ApiRequest & { rid?: string };

/** Antwort von POST /api */
export type ApiReply<R = unknown> = { ok: true; result: R } | { ok: false; reason: ApiReason; message: string };

/** Nach dem Beitritt: Sitzungs-Token für dieses Gerät (signiert, widerrufbar) */
export type JoinResult =
  { status: "joined"; role: Role; teamId?: string; token: string; uid: string } | { status: "teamExists"; teamName: string };

export interface GameListEntry {
  id: string;
  name: string;
  createdAt: number;
  archived: boolean;
  phase: GameInfo["phase"];
  teams: number;
}

export interface TemplateEntry {
  id: string;
  name: string;
  createdAt: number;
}

export interface ArchiveListEntry {
  run: string;
  name: string;
  startedAt: number;
  endedAt: number;
  /** Name des Siegerteams */
  winner: string | null;
  teams: number;
  durationMs: number;
  handovers: number;
}

/** Ein beendeter Lauf für Auswertung und Wiederholung (ohne Live-Standorte, ohne Bewegungsprofile) */
export interface ArchiveData {
  name: string;
  reason: "zufall" | "notstopp";
  startedAt: number;
  endedAt: number;
  results: Results;
  teams: Record<string, Team>;
  handovers: Record<string, Handover>;
  reports: Record<string, Report>;
  cutLog: Record<string, CutEvent>;
  pauses: Record<string, Pause>;
  field: Field;
  /** nach 30 Tagen leer (Löschfrist) */
  chat: Record<string, ChatMessage>;
  /** Spur je Team: [Sekunden seit Start, Breite·1e5, Länge·1e5] alle 20 s – nach 30 Tagen weg (E-72) */
  tracks?: Record<string, [number, number, number][]>;
}

export interface ApiResults {
  superSetup: { token: string };
  superLogin: { token: string };
  listGames: { games: GameListEntry[] };
  createGame: { gameId: string };
  gameInfo: GameInfo;
  join: JoinResult;
  leave: Record<string, never>;
  setSecret: Record<string, never>;
  screenLink: { key: string };
  checkSecret: { ok: boolean };
  startGame: { mrx: string };
  handover: { handoverId: string; locked: string[] };
  undo: Record<string, never>;
  pause: Record<string, never>;
  resume: Record<string, never>;
  stopGame: Record<string, never>;
  setConfig: Record<string, never>;
  setCut: Record<string, never>;
  setLock: Record<string, never>;
  instantReport: { reportId: string | null };
  announce: Record<string, never>;
  revealEnd: { endAt: number | null };
  follow: Record<string, never>;
  resetRound: Record<string, never>;
  removeMember: Record<string, never>;
  removeTeam: Record<string, never>;
  renameTeam: Record<string, never>;
  setTeamSize: Record<string, never>;
  setTeamHandover: Record<string, never>;
  splitTeam: { teamId: string };
  sos: { id: string };
  sosDone: Record<string, never>;
  gather: Record<string, never>;
  arrived: Record<string, never>;
  posten: PostenErgebnis;
  postenCodes: { codes: Record<string, string> };
  templateList: { templates: TemplateEntry[] };
  templateSave: { id: string };
  templateLoad: Record<string, never>;
  templateDelete: Record<string, never>;
  setField: Record<string, never>;
  archiveGame: Record<string, never>;
  deleteGame: Record<string, never>;
  chat: { id: string };
  deleteChat: Record<string, never>;
  pushSubscribe: Record<string, never>;
  addDevice: { device: string; key: string };
  setDevice: Record<string, never>;
  removeDevice: Record<string, never>;
  deviceKey: { key: string };
  archiveList: { runs: ArchiveListEntry[] };
  archiveGet: { archive: ArchiveData };
}

/** Gründe für Ablehnungen – die App übersetzt sie in Texte (texte.ts) */
export type ApiReason =
  | "unauthenticated"
  | "invalid"
  | "notFound"
  | "wrongSecret"
  | "noTeamPassword"
  | "noSpectators"
  | "tooMany"
  | "forbidden"
  | "exists"
  /** geht in diesem Spielabschnitt nicht (z. B. Übergabe vor dem Start) */
  | "wrongPhase"
  /** jemand anderer war schneller (z. B. zwei Schiris übergeben gleichzeitig) */
  | "conflict"
  /** Rückgängig nur kurz nach der Übergabe */
  | "tooLate"
  /** Spiel ist archiviert – kein Beitritt mehr */
  | "archived"
  /** Sitzung ungültig (abgelaufen, entfernt, neue Runde) – neu anmelden */
  | "session";

/** Ergebnis beim Einlösen eines Bonus-Postens – die App macht daraus den Text in ihrer Sprache */
export type PostenErgebnis =
  /** Mister X ist etwa `m` Meter (auf 50 m gerundet; 0 = unter 100 m) in Richtung `richtung` (0 = Norden … 7 = Nordwesten) */
  | { status: "hinweis"; name: string; m: number; richtung: number }
  /** dieses Team hat den Posten schon eingelöst */
  | { status: "schon"; name: string }
  /** zu weit weg (`m` Meter) – Code abfotografiert? */
  | { status: "weit"; name: string; m: number }
  /** kein frischer Standort vom Team */
  | { status: "keinStandort"; name: string }
  /** Mister X selbst kann keine Posten einlösen */
  | { status: "mrx"; name: string }
  /** von Mister X gibt es gerade keinen Standort – Posten bleibt gültig */
  | { status: "keinMrx"; name: string };

export interface Member {
  role: Role;
  name: string;
  teamId?: string;
  joinedAt: number;
  followsFlag?: boolean;
}

export interface GameInfo {
  name: string;
  phase: "vorbereitung" | "laeuft" | "pause" | "beendet";
  createdAt: number;
  spectators: boolean;
  archived?: boolean;
}
