// Spielfeld-Vorlagen: Kennung → Spielfeld + Anzeigename. Server (Spiel anlegen), Verwaltung und Zonen-Editor lesen nur diese Liste.
import type { Field } from "../types.ts";
import { LINZ_INNENSTADT } from "./linz.ts";
import { STEYR } from "./steyr.ts";
import { WELS } from "./wels.ts";

export const VORLAGEN = {
  linz: { label: "Linz Innenstadt", field: LINZ_INNENSTADT },
  steyr: { label: "Steyr", field: STEYR },
  wels: { label: "Wels", field: WELS },
} as const satisfies Record<string, { label: string; field: Field }>;

export type VorlageId = keyof typeof VORLAGEN;
export const VORLAGEN_IDS = Object.keys(VORLAGEN) as VorlageId[];
export const isVorlage = (v: unknown): v is VorlageId => typeof v === "string" && Object.hasOwn(VORLAGEN, v);
