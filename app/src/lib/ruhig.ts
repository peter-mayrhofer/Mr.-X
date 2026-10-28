// Ruckelt die Hintergrund-Animation (schwaches Gerät, Bildschirm ohne Grafikbeschleunigung), schaltet sie ab:
// nach dem Einstieg 2 s lang die Bildabstände messen; im Schnitt über 45 ms (unter ca. 22 Bilder/s) → <html data-ruhig>.
// Das Formular, die Karte und alles andere bleiben unberührt, nur der Schmuck steht still.
let geprueft = false;

export function pruefeFluessig(nachMs = 3500) {
  if (geprueft || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  geprueft = true;
  setTimeout(() => {
    const t: number[] = [];
    let last = performance.now();
    const ende = last + 2000;
    const f = (now: number) => {
      t.push(now - last);
      last = now;
      if (now < ende) return requestAnimationFrame(f);
      const avg = t.slice(1).reduce((a, x) => a + x, 0) / Math.max(1, t.length - 1);
      if (avg > 45) document.documentElement.setAttribute("data-ruhig", "");
    };
    requestAnimationFrame(f);
  }, nachMs);
}
