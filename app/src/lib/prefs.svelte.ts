// Einstellungen pro Gerät (Ton, Bildschirm wach, Onboarding gesehen). Wird im Browser gemerkt.
import { setMuted } from "./signal.ts";

const KEY = "mrx.prefs";
interface Stored {
  sound: boolean;
  wake: boolean;
  onboarded: boolean;
  /** Android-App: Standort auch bei ausgeschaltetem Bildschirm senden */
  background: boolean;
}

function load(): Partial<Stored> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Stored>;
  } catch {
    return {};
  }
}

class Prefs {
  sound = $state(true);
  wake = $state(true);
  onboarded = $state(false);
  background = $state(true);
  constructor() {
    Object.assign(this, load());
    $effect.root(() => {
      $effect(() => {
        const v: Stored = { sound: this.sound, wake: this.wake, onboarded: this.onboarded, background: this.background };
        setMuted(!v.sound);
        try {
          localStorage.setItem(KEY, JSON.stringify(v));
        } catch {
          /* privates Fenster: gilt nur bis zum Schließen */
        }
      });
    });
  }
}

export const prefs = new Prefs();
