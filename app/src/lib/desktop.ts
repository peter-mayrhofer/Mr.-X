// Brücke zur Desktop-Hülle (Tauri, docs/DESKTOP-APP.md): Version, Großbild auf dem Beamer, Benachrichtigung, Link im
// Browser öffnen. Außerhalb der Desktop-App ist alles wirkungslos (null bzw. nichts tun); Fehler werden abgefangen.
interface TauriInternals {
  invoke(befehl: string, args?: Record<string, unknown>): Promise<unknown>;
}
declare global {
  interface Window {
    /** Version der Desktop-Hülle – setzt die Hülle auf der Server-Seite (app/src-tauri/src/lib.rs) */
    __MRX_DESKTOP__?: string;
    __TAURI_INTERNALS__?: TauriInternals;
  }
}

/** Version der Desktop-App, null im Browser und in der Android-App */
export const DESKTOP_VERSION: string | null =
  typeof window !== "undefined" && typeof window.__MRX_DESKTOP__ === "string" ? window.__MRX_DESKTOP__ : null;

async function aufrufen(befehl: string, args: Record<string, unknown>): Promise<unknown> {
  const t = typeof window !== "undefined" ? window.__TAURI_INTERNALS__ : undefined;
  if (!t) return undefined;
  try {
    return await t.invoke(befehl, args);
  } catch {
    return undefined;
  }
}

export type GrossbildOrt = "beamer" | "gleicher-bildschirm";

/** Eigenes Vollbild-Fenster mit `url` (nur Adressen des eigenen Servers): auf dem zweiten Bildschirm, sonst auf demselben.
 *  null = nicht in der Desktop-App oder fehlgeschlagen */
export async function grossbildOeffnen(url: string): Promise<GrossbildOrt | null> {
  const r = await aufrufen("grossbild_oeffnen", { url });
  return r === "beamer" || r === "gleicher-bildschirm" ? r : null;
}

/** Native Benachrichtigung, Taskleiste blinkt */
export async function melden(titel: string, text: string): Promise<void> {
  await aufrufen("melden", { titel, text });
}

/** Wie `melden`, aber nur wenn das Fenster nicht im Vordergrund ist (sonst sieht die Spielleitung es ohnehin) */
export function meldenImHintergrund(titel: string, text: string): void {
  if (!document.hasFocus()) void melden(titel, text);
}

/** http(s)-Adresse im Standardbrowser öffnen (z. B. Installer herunterladen) */
export async function imBrowserOeffnen(url: string): Promise<void> {
  await aufrufen("plugin:opener|open_url", { url });
}
