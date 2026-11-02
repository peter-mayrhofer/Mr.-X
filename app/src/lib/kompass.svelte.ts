// Himmelsrichtung, in die das Handy zeigt (0 = Norden, im Uhrzeigersinn) – für die Kompass-Ansicht.
// Android/Chrome: „deviceorientationabsolute“ (alpha zählt gegen den Uhrzeigersinn). iPhone: webkitCompassHeading,
// aber erst nach einer ausdrücklichen Erlaubnis, die nur auf einen Tipp hin gefragt werden darf.
type IosOrientation = DeviceOrientationEvent & { webkitCompassHeading?: number };
type IosDOE = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<"granted" | "denied"> };

export class Heading {
  /** Grad oder null, solange (noch) kein Kompass liefert */
  deg = $state<number | null>(null);
  /** iPhone: Erlaubnis muss erst per Tipp geholt werden */
  needsTap = $state(false);
  #off: (() => void) | null = null;

  start() {
    const DOE = (globalThis as { DeviceOrientationEvent?: IosDOE }).DeviceOrientationEvent;
    if (!DOE) return;
    if (typeof DOE.requestPermission === "function") this.needsTap = true;
    else this.#listen();
  }

  /** auf Tipp: Erlaubnis holen (iPhone) */
  async request() {
    const DOE = DeviceOrientationEvent as IosDOE;
    try {
      if ((await DOE.requestPermission?.()) === "granted") {
        this.needsTap = false;
        this.#listen();
      }
    } catch {
      /* abgelehnt – dann bleibt der Pfeil nach Norden ausgerichtet */
    }
  }

  #listen() {
    if (this.#off) return;
    const onEvent = (e: IosOrientation) => {
      let h: number | null = null;
      if (typeof e.webkitCompassHeading === "number") h = e.webkitCompassHeading;
      else if (e.absolute && e.alpha !== null) h = 360 - e.alpha;
      if (h === null) return;
      // Querformat: der Bildschirm ist gedreht
      const turn = typeof screen !== "undefined" ? (screen.orientation?.angle ?? 0) : 0;
      this.deg = (((h + turn) % 360) + 360) % 360;
    };
    const name = "ondeviceorientationabsolute" in window ? "deviceorientationabsolute" : "deviceorientation";
    addEventListener(name, onEvent as EventListener, true);
    this.#off = () => removeEventListener(name, onEvent as EventListener, true);
  }

  stop() {
    this.#off?.();
    this.#off = null;
  }
}

/** Drehwinkel ohne Sprung bei 359° → 1°: nimmt immer den kurzen Weg vom vorherigen Wert */
export function unwrap(prev: number, next: number): number {
  const d = ((((next - prev) % 360) + 540) % 360) - 180;
  return prev + d;
}
