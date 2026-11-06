// Adresse des Spiel-Servers (Cloudflare Worker, docs/BETRIEB.md). Im Browser ist es dieselbe Adresse wie die App.
// Die Android-App hat ihre Dateien eingebaut und braucht die Adresse fest: VITE_API_URL beim Bauen (docs/ANDROID-APK.md).
export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";
export const WS_URL = API_URL
  ? `${API_URL.replace(/^http/, "ws")}/ws`
  : `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
/** Ende-zu-Ende-Tests: Browser ohne Push-Dienst → Platzhalter-Abo statt echtem (Vite-Modus „e2e“) */
export const E2E = import.meta.env.MODE === "e2e";
