// Download-Knopf (docs/DESKTOP-APP.md): welche App-Dateien liegen am Server, und welches System hat dieses Gerät?
import { erkenneSystem, type Downloads, type System } from "@mrx/shared";
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

type NavigatorMitPlattform = Navigator & { userAgentData?: { platform?: string } };

export function meinSystem(): System {
  const n = navigator as NavigatorMitPlattform;
  return erkenneSystem({ ua: n.userAgent, plattform: n.userAgentData?.platform, touchPunkte: n.maxTouchPoints });
}
