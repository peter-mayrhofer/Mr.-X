import type { Config } from "./types.ts";

/** Standardwerte für neue Spiele (Regelblatt + Prototyp, KONZEPT Abschnitt 4) */
export const DEFAULT_CONFIG: Config = {
  intervalMin: 10,
  headStartMin: 10,
  waitMin: 5,
  radiusM: 200,
  undoMin: 2,
  endMinH: 3,
  endMaxH: 4,
  spectators: true,
};

/** Spiel-Code: Kleinbuchstaben, Ziffern, Bindestrich – steht im QR-Link */
export const GAME_ID = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

export const LIMITS = {
  teamName: [2, 30],
  personName: [2, 30],
  gameName: [3, 60],
  teamPw: 4,
  schiriCode: 4,
  adminPw: 8,
  chat: 300,
} as const;
