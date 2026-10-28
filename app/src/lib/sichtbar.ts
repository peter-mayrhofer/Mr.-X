// Ist die App gerade zu sehen? Im Browser sagt das document.visibilityState. In der Android-App bleibt die WebView für
// den Browser „sichtbar“, auch im Hintergrund und bei ausgeschaltetem Bildschirm (Capacitor hält sie am Laufen) – dort
// melden die Capacitor-Ereignisse „pause“/„resume“ den echten Zustand (im Gerätetest im Emulator gefunden).
let paused = false;
document.addEventListener("pause", () => (paused = true));
document.addEventListener("resume", () => (paused = false));

export const appVisible = () => !paused && document.visibilityState === "visible";

const EVENTS = ["visibilitychange", "pause", "resume"];
/** `fn` bei jedem Wechsel aufrufen; liefert die Abmeldung */
export function onAppVisibility(fn: () => void): () => void {
  for (const e of EVENTS) document.addEventListener(e, fn);
  return () => EVENTS.forEach((e) => document.removeEventListener(e, fn));
}
