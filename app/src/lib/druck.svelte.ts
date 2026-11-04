// Passwörter für die Druckblätter: nur im Arbeitsspeicher dieses Fensters – nie gespeichert, weg beim Neuladen.
// So kommt das Passwort aufs Papier, ohne irgendwo (Server, Browser-Speicher, QR-Code) im Klartext zu liegen.
import type { SecretKind } from "@mrx/shared";

export const druck = $state<{ pw: Record<string, Partial<Record<SecretKind, string>>>; tel: string }>({ pw: {}, tel: "" });

export function merke(game: string, kind: SecretKind, value: string | null) {
  const cur = { ...druck.pw[game] };
  if (value) cur[kind] = value;
  else delete cur[kind];
  druck.pw[game] = cur;
}
