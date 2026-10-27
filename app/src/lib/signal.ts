// Ton + Vibration je Ereignis (Abschnitt 7.6): unterschiedliche Muster nach Wichtigkeit, stummschaltbar.
// Browser erlauben Ton erst nach einer Berührung – der erste Tipp irgendwo schaltet ihn frei.

export type Signal = "meldung" | "uebergabe" | "mrx" | "wartezeit" | "durchsage" | "verkleinerung" | "nachricht" | "warnung" | "ende";

const MUSTER: Record<Signal, { vib: number[]; tones: [hz: number, at: number, len: number][] }> = {
  meldung: {
    vib: [200, 100, 200],
    tones: [
      [880, 0, 0.12],
      [1175, 0.15, 0.18],
    ],
  },
  uebergabe: {
    vib: [400, 150, 400, 150, 400],
    tones: [
      [660, 0, 0.15],
      [880, 0.18, 0.15],
      [1320, 0.36, 0.3],
    ],
  },
  mrx: {
    vib: [600, 200, 600, 200, 600],
    tones: [
      [523, 0, 0.15],
      [659, 0.15, 0.15],
      [784, 0.3, 0.15],
      [1047, 0.45, 0.4],
    ],
  },
  wartezeit: {
    vib: [800, 200, 800],
    tones: [
      [440, 0, 0.4],
      [440, 0.5, 0.4],
    ],
  },
  durchsage: {
    vib: [300, 100, 300, 100, 300],
    tones: [
      [988, 0, 0.12],
      [988, 0.18, 0.12],
      [988, 0.36, 0.25],
    ],
  },
  verkleinerung: {
    vib: [500, 150, 500],
    tones: [
      [784, 0, 0.2],
      [587, 0.22, 0.35],
    ],
  },
  nachricht: { vib: [120], tones: [[1046, 0, 0.08]] },
  warnung: {
    vib: [250, 80, 250, 80, 250, 80, 250],
    tones: [
      [330, 0, 0.18],
      [330, 0.25, 0.18],
      [330, 0.5, 0.18],
    ],
  },
  ende: {
    vib: [300, 100, 300, 100, 900],
    tones: [
      [523, 0, 0.2],
      [659, 0.2, 0.2],
      [784, 0.4, 0.2],
      [1047, 0.6, 0.6],
    ],
  },
};

let audio: AudioContext | undefined;
let muted = false;

addEventListener("pointerdown", () => {
  audio ??= new AudioContext();
  void audio.resume();
});

export function setMuted(m: boolean) {
  muted = m;
}

export function signal(kind: Signal) {
  if (muted) return;
  const m = MUSTER[kind];
  navigator.vibrate?.(m.vib);
  if (!audio) return;
  for (const [hz, at, len] of m.tones) {
    const o = audio.createOscillator(),
      v = audio.createGain(),
      t = audio.currentTime + at;
    o.frequency.value = hz;
    v.gain.setValueAtTime(0.0001, t);
    v.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    v.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(v).connect(audio.destination);
    o.start(t);
    o.stop(t + len + 0.02);
  }
}
