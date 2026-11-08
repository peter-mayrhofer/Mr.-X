// Download-Knopf (docs/DESKTOP-APP.md): welche App-Dateien liegen am Server, und welches System hat dieses Gerät?
import { erkenneSystem, passenderDownload, type Downloads, type DownloadsJson, type System } from "@mrx/shared";
import { DESKTOP_VERSION } from "./desktop.ts";
import { INSTALLIERT } from "./native.ts";

let geladen: Promise<Downloads> | undefined;

/** /downloads.json einmalig laden; Fehler, Nicht-OK oder HTML-Antwort (Fallback der App-Seite) → keine Downloads. In der App immer leer. */
export function ladeDownloads(): Promise<Downloads> {
  if (INSTALLIERT) return Promise.resolve({});
  geladen ??= fetch(`${import.meta.env.BASE_URL}downloads.json`)
    .then((r) => (r.ok && !r.headers.get("content-type")?.includes("html") ? (r.json() as Promise<Downloads>) : {}))
    .catch((): Downloads => ({}));
  return geladen;
}

/** Desktop-App: gibt es am Server eine andere Version der Hülle? Dann die Adresse des Installers für dieses System, sonst null.
 *  (`ladeDownloads` liefert in installierten Apps absichtlich nichts, darum hier ein eigener Abruf.) */
export async function neueDesktopVersion(): Promise<string | null> {
  if (DESKTOP_VERSION === null) return null;
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}downloads.json`, { cache: "no-store" });
    if (!r.ok || r.headers.get("content-type")?.includes("html")) return null;
    const j = (await r.json()) as DownloadsJson;
    const d = passenderDownload(meinSystem(), j);
    if (!d || typeof j.desktopVersion !== "string" || j.desktopVersion === DESKTOP_VERSION) return null;
    return new URL(`${import.meta.env.BASE_URL}${d.datei.datei}`, location.origin).href;
  } catch {
    return null;
  }
}

type NavigatorMitPlattform = Navigator & { userAgentData?: { platform?: string } };

export function meinSystem(): System {
  const n = navigator as NavigatorMitPlattform;
  return erkenneSystem({ ua: n.userAgent, plattform: n.userAgentData?.platform, touchPunkte: n.maxTouchPoints });
}
