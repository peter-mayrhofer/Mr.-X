// Vertrag zwischen App und Spiel-Server (POST /api, docs/API.md). Eine Quelle für beide Seiten.
import type { Config, Field, Role } from "./types.ts";
import type { PushKind } from "./push.ts";

export type JoinRole = Role;
export type SecretKind = "teamPw" | "schiriCode" | "adminPw";
export type Template = "linz" | "leer";

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
  | { action: "join"; gameId: string; role: JoinRole; name: string; secret?: string; secondDevice?: boolean }
  | { action: "leave"; gameId: string }
  | { action: "setSecret"; gameId: string; kind: SecretKind; value: string | null }
  | { action: "screenLink"; gameId: string }
  // Spielablauf (Meilenstein 4)
  | { action: "startGame"; gameId: string; mrx: string | "random" }
  | { action: "handover"; gameId: string; to: string; type: "fang" | "strafe"; expectedMrx: string; requestId: string }
  | { action: "undo"; gameId: string; handoverId: string }
  | { action: "pause"; gameId: string }
  | { action: "resume"; gameId: string }
  | { action: "stopGame"; gameId: string }
  | { action: "setConfig"; gameId: string; config: Partial<Config> }
  | { action: "setCut"; gameId: string; cutId: string; locked: boolean }
  | { action: "setLock"; gameId: string; teamId: string; min: number }
  | { action: "instantReport"; gameId: string }
  | { action: "announce"; gameId: string; text: string }
  | { action: "revealEnd"; gameId: string }
  | { action: "follow"; gameId: string; on: boolean }
  | { action: "resetRound"; gameId: string }
  | { action: "removeMember"; gameId: string; uid: string }
  | { action: "removeTeam"; gameId: string; teamId: string }
  | { action: "renameTeam"; gameId: string; teamId: string; name: string }
  // Chat (Abschnitt 7.5): Gruppenchat bzw. Direktkanal `dm` (Team-Id); Moderation durch die Spielleitung
  | { action: "chat"; gameId: string; text: string; dm?: string }
  | { action: "deleteChat"; gameId: string; id: string; dm?: string }
  // Push (Web Push, VAPID): Abo dieses Geräts und gewünschte Arten
  // sub weglassen = Abo bleibt, nur Arten ändern; null = kein Web-Push (Android-App: lokale Benachrichtigungen)
  | { action: "pushSubscribe"; gameId: string; sub?: PushSub | null; prefs: Partial<Record<PushKind, boolean>> }
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

export interface ArchiveListEntry {
  run: string;
  name: string;
  startedAt: number;
  endedAt: number;
  winner: string | null;
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
  setField: Record<string, never>;
  archiveGame: Record<string, never>;
  deleteGame: Record<string, never>;
  chat: { id: string };
  deleteChat: Record<string, never>;
  pushSubscribe: Record<string, never>;
  archiveList: { runs: ArchiveListEntry[] };
  archiveGet: { archive: unknown };
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
