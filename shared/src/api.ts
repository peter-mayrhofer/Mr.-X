// Vertrag zwischen App und Spiel-Server (Function `api`). Eine Quelle für beide Seiten.
import type { Role } from "./types.ts";

export type JoinRole = Role;
export type SecretKind = "teamPw" | "schiriCode" | "adminPw";
export type Template = "linz" | "leer";

export type ApiRequest =
  | { action: "claimSuperAdmin" }
  | { action: "createGame"; gameId: string; name: string; template: Template; adminPassword: string }
  | { action: "join"; gameId: string; role: JoinRole; name: string; secret?: string; secondDevice?: boolean }
  | { action: "leave"; gameId: string }
  | { action: "setSecret"; gameId: string; kind: SecretKind; value: string | null }
  | { action: "screenLink"; gameId: string };

export type JoinResult = { status: "joined"; role: Role; teamId?: string } | { status: "teamExists"; teamName: string };

export interface ApiResults {
  claimSuperAdmin: { superAdmin: boolean };
  createGame: { gameId: string };
  join: JoinResult;
  leave: Record<string, never>;
  setSecret: Record<string, never>;
  screenLink: { key: string };
}

/** Gründe für Ablehnungen – die App übersetzt sie in Texte (texte.ts) */
export type ApiReason =
  "unauthenticated" | "invalid" | "notFound" | "wrongSecret" | "noTeamPassword" | "noSpectators" | "tooMany" | "forbidden" | "exists";

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
}
