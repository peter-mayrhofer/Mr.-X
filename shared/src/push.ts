// Push-Benachrichtigungen (Abschnitt 7.6): wer bekommt was. Rein, damit es ohne Firebase getestet werden kann.
import type { Member } from "./api.ts";
import type { Role } from "./types.ts";

export type PushKind = "meldung" | "uebergabe" | "wartezeit" | "durchsage" | "spielfeld" | "nachricht" | "spiel";
export const PUSH_KINDS: PushKind[] = ["meldung", "uebergabe", "wartezeit", "durchsage", "spielfeld", "nachricht", "spiel"];

/** games/{g}/push/{uid} – vom Gerät selbst geschrieben */
export interface PushReg {
  token: string;
  platform: "web" | "android";
  /** abgeschaltete Arten stehen auf false; fehlend = an */
  prefs?: Partial<Record<PushKind, boolean>>;
  t?: number;
}

export type PushTarget = { all: true; except?: string[] } | { teams: string[] } | { roles: Role[] };

export function pushTargets(
  regs: Record<string, PushReg>,
  members: Record<string, Member>,
  target: PushTarget,
  kind: PushKind,
): { uid: string; token: string; platform: PushReg["platform"] }[] {
  return Object.entries(regs)
    .filter(([uid, r]) => {
      const m = members[uid];
      if (!m || r.prefs?.[kind] === false) return false; // nicht mehr im Spiel bzw. abgeschaltet
      if (m.role === "screen") return false; // Großbild zeigt alles selbst an
      if ("teams" in target) return !!m.teamId && target.teams.includes(m.teamId);
      if ("roles" in target) return target.roles.includes(m.role);
      return !(m.teamId && target.except?.includes(m.teamId));
    })
    .map(([uid, r]) => ({ uid, token: r.token, platform: r.platform }));
}

/** Überschriften der Benachrichtigungen; der Text ist meist die System-Meldung aus dem Chat */
export const PUSH_TITLE = {
  meldung: "Mister X gemeldet",
  uebergabe: "Übergabe!",
  neuerMrx: "Ihr seid Mister X!",
  warten: "Bitte stehen bleiben",
  weiter: "Ihr dürft weiter!",
  durchsage: "Durchsage",
  spielfeld: "Spielfeld wird kleiner",
  regeln: "Regeländerung",
  nachricht: "Nachricht der Spielleitung",
  start: "Das Spiel beginnt!",
  pause: "Pause",
  fortsetzung: "Weiter geht's!",
  rueckgaengig: "Übergabe rückgängig",
  ende: "Spielende!",
} as const;
