// Fehler in der App (E-79): Was auf einem Handy schiefgeht, landet im Protokoll der Spielleitung – so sieht man beim
// Feldtest, welches Gerät Probleme hat. Nur angemeldete Geräte, höchstens 3 Meldungen pro Seitenaufruf; der Server
// begrenzt zusätzlich. Gemeldet wird nur die Fehlermeldung mit Ort, Gerät und App-Stand – keine Standorte, keine Texte.
import { ApiError, call } from "./api.ts";
import { session } from "./session.svelte.ts";
import { DESKTOP, NATIVE } from "./native.ts";

/** harmlose Meldungen der Browser, die nichts kaputt machen */
const HARMLOS = /ResizeObserver loop|Script error|AbortError|The play\(\) request was interrupted/i;
let gesendet = 0;

function geraet(): string {
  const ua = navigator.userAgent;
  const system = /iPhone|iPad/.test(ua)
    ? "iPhone/iPad"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac/.test(ua)
          ? "Mac"
          : "anderes";
  return `${NATIVE ? "Android-App" : DESKTOP ? "Desktop-App" : "Browser"}, ${system}, ${__APP_VERSION__} (${__BUILD__})`;
}

export function fehlerText(e: unknown, ort: string): string {
  const err = e instanceof Error ? e : null;
  const msg = err ? `${err.name}: ${err.message}` : String(e);
  // erste Zeile des Stacks mit Datei:Zeile (ohne Adresse davor)
  const stelle =
    err?.stack
      ?.split("\n")
      .find((z) => /:\d+:\d+/.test(z) && !z.includes(msg))
      ?.replace(/^.*\/([^/]+:\d+:\d+).*$/, "$1") ?? "";
  return `${msg}${stelle ? ` @ ${stelle}` : ""} – ${ort} – ${geraet()}`;
}

function melden(e: unknown) {
  const g = session.gameId;
  // ohne Netz kann ohnehin nichts ankommen – das ist kein Fehler der App
  if (e instanceof ApiError && e.reason === "network") return;
  // nur der erste Teil der Seite (z. B. „#/spiel“), keine Codes aus der Adresse
  const text = fehlerText(e, `#/${location.hash.split(/[?/]/)[1] ?? ""}`);
  if (!g || !session.role || gesendet >= 3 || HARMLOS.test(text)) return;
  gesendet++;
  void call({ action: "appFehler", gameId: g, text }).catch(() => {});
}

export function fehlerMeldenEinschalten() {
  addEventListener("error", (ev) => melden(ev.error ?? ev.message));
  addEventListener("unhandledrejection", (ev) => melden(ev.reason));
}
