// Push-Benachrichtigungen (Abschnitt 7.6): wer bekommt was. Rein, damit es ohne Server getestet werden kann.
import type { Member, PushSub } from "./api.ts";
import type { Role } from "./types.ts";

export type PushKind = "meldung" | "uebergabe" | "wartezeit" | "durchsage" | "spielfeld" | "nachricht" | "spiel" | "notfall";
export const PUSH_KINDS: PushKind[] = ["meldung", "uebergabe", "wartezeit", "durchsage", "spielfeld", "nachricht", "spiel", "notfall"];

/** Push-Einstellung eines Geräts (Aktion pushSubscribe): Web-Push-Abo (fehlt in der Android-App) + gewünschte Arten */
export interface PushReg {
  sub?: PushSub;
  /** abgeschaltete Arten stehen auf false; fehlend = an */
  prefs?: Partial<Record<PushKind, boolean>>;
  t?: number;
}

export type PushTarget = { all: true; except?: string[] } | { teams: string[] } | { roles: Role[] };

/** Geräte (uid), die eine Benachrichtigung bekommen – egal ob per Web-Push oder über die offene Verbindung */
export function pushTargets(members: Record<string, Member>, regs: Record<string, PushReg>, target: PushTarget, kind: PushKind): string[] {
  return Object.entries(members)
    .filter(([uid, m]) => {
      // Notfälle lassen sich nicht abschalten
      if (kind !== "notfall" && regs[uid]?.prefs?.[kind] === false) return false; // abgeschaltet
      if (m.role === "screen") return false; // Großbild zeigt alles selbst an
      if ("teams" in target) return !!m.teamId && target.teams.includes(m.teamId);
      if ("roles" in target) return target.roles.includes(m.role);
      return !(m.teamId && target.except?.includes(m.teamId));
    })
    .map(([uid]) => uid);
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
  endphase: "Endphase!",
  sammelruf: "Sammelruf",
  notfall: "NOTFALL",
  pruefen: "Übergabe prüfen",
} as const;
