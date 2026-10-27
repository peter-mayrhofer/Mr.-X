// Live-Wert aus der Datenbank für eine Komponente: Pfad als Funktion (reaktiv), null = nicht abonnieren.
import { onValue, ref } from "firebase/database";
import { db } from "./firebase.ts";

export function live<T>(path: () => string | null): { readonly value: T | null; readonly loaded: boolean } {
  const s = $state({ value: null as T | null, loaded: false });
  $effect(() => {
    const p = path();
    s.value = null;
    s.loaded = false;
    if (!p) return;
    return onValue(
      ref(db, p),
      (snap) => {
        s.value = snap.val() as T | null;
        s.loaded = true;
      },
      () => (s.loaded = true),
    );
  });
  return s;
}
