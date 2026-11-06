// Hash-Router: funktioniert auf jedem Webserver und in der Capacitor-Hülle ohne Sonderkonfiguration (E-02).
const read = () => decodeURIComponent(location.hash.slice(1)) || "/";

class Router {
  path = $state(read());
}

export const router = new Router();
addEventListener("hashchange", () => (router.path = read()));

export function go(path: string) {
  location.hash = path;
}

/** "/s/:spiel" gegen "/s/linz-2027" → { spiel: "linz-2027" } */
export function match(pattern: string, path = router.path): Record<string, string> | null {
  const [p] = path.split("?");
  const a = pattern.split("/"),
    b = (p ?? "").split("/");
  if (a.length !== b.length) return null;
  const out: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i]!.startsWith(":")) out[a[i]!.slice(1)] = b[i]!;
    else if (a[i] !== b[i]) return null;
  }
  return out;
}

export function query(path = router.path): URLSearchParams {
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- einmal gelesen, Screen wird pro Route neu erzeugt
  return new URLSearchParams(path.split("?")[1] ?? "");
}
