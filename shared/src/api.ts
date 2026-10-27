// Vertrag zwischen App und Spiel-Server (Function `api`). Eine Quelle für beide Seiten.
import type { Config, Field, Role } from "./types.ts";

export type JoinRole = Role;
export type SecretKind = "teamPw" | "schiriCode" | "adminPw";
export type Template = "linz" | "leer";

export type ApiRequest =
  | { action: "claimSuperAdmin" }
  | { action: "createGame"; gameId: string; name: string; template: Template; adminPassword: string }
  | { action: "join"; gameId: string; role: JoinRole; name: string; secret?: string; secondDevice?: boolean }
  | { action: "leave"; gameId: string }
  | { action: "setSecret"; gameId: string; kind: SecretKind; value: string | null }
  | { action: "screenLink"; gameId: string }
  // Spielablauf (Meilenstein 4)
  | { action: "startGame"; gameId: string; mrx: string | "random" }
  | { action: "poke"; gameId: string }
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
  // Spielfeld und Spiele verwalten (Meilenstein 7)
  | { action: "setField"; gameId: string; field: Field }
  | { action: "archiveGame"; gameId: string; archived: boolean }
  | { action: "deleteGame"; gameId: string };

export type JoinResult = { status: "joined"; role: Role; teamId?: string } | { status: "teamExists"; teamName: string };

export interface ApiResults {
  claimSuperAdmin: { superAdmin: boolean };
  createGame: { gameId: string };
  join: JoinResult;
  leave: Record<string, never>;
  setSecret: Record<string, never>;
  screenLink: { key: string };
  startGame: { mrx: string };
  poke: { done: string[] };
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
  | "archived";

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
