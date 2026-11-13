// Passwörter für die Druckblätter: nur im Arbeitsspeicher dieses Fensters – nie gespeichert, weg beim Neuladen.
// So kommt das Passwort aufs Papier, ohne irgendwo (Server, Browser-Speicher, QR-Code) im Klartext zu liegen.
import type { SecretKind } from "@mrx/shared";

export const druck = $state<{ pw: Record<string, Partial<Record<SecretKind, string>>>; tel: string }>({ pw: {}, tel: "" });

/**
 * Urkunden drucken: Blätter einhängen (`warten` setzt im Aufrufer `urkunden = true` und wartet auf das Einhängen),
 * <html data-druck="urkunden"> schaltet das Druckblatt (PrintSheet) aus. Aufgeräumt wird erst nach dem Druckdialog
 * („afterprint“) – ein fester Zeitablauf würde auf Geräten, deren print() nicht wartet, ein leeres Blatt drucken.
 */
export async function druckeUrkunden(warten: () => Promise<void>, fertig: () => void) {
  document.documentElement.dataset.druck = "urkunden";
  await warten();
  addEventListener(
    "afterprint",
    () => {
      delete document.documentElement.dataset.druck;
      fertig();
    },
    { once: true },
  );
  print();
}

export function merke(game: string, kind: SecretKind, value: string | null) {
  const cur = { ...druck.pw[game] };
  if (value) cur[kind] = value;
  else delete cur[kind];
  druck.pw[game] = cur;
}
