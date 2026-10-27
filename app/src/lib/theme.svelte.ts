// Darstellung: Automatisch (System) / Hell / Dunkel / Sonne. Wird pro Gerät gemerkt.
export type ThemeChoice = "auto" | "dunkel" | "hell" | "sonne";
export type Theme = Exclude<ThemeChoice, "auto">;

const KEY = "mrx.theme";
const dark = matchMedia("(prefers-color-scheme: dark)");

function load(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "auto" || v === "dunkel" || v === "hell" || v === "sonne") return v;
  } catch {
    /* privates Fenster */
  }
  return "auto";
}

class ThemeState {
  choice = $state<ThemeChoice>(load());
  systemDark = $state(dark.matches);
  active: Theme = $derived(this.choice === "auto" ? (this.systemDark ? "dunkel" : "hell") : this.choice);

  set(choice: ThemeChoice) {
    this.choice = choice;
    try {
      localStorage.setItem(KEY, choice);
    } catch {
      /* egal */
    }
  }

  /** Schnellumschalter auf der Karte: Sonne an/aus */
  toggleSun() {
    this.set(this.active === "sonne" ? "auto" : "sonne");
  }
}

export const theme = new ThemeState();
dark.addEventListener("change", (e) => (theme.systemDark = e.matches));

$effect.root(() => {
  $effect(() => {
    document.documentElement.dataset.theme = theme.active;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.active === "dunkel" ? "#07111a" : "#ffffff");
  });
});
