// Regeltext der Spielleitung (Abschnitt 7.11: „vom Admin pro Spiel anpassbar, Text mit einfacher Formatierung“).
// Einfache Formatierung ohne HTML: Leerzeile = neuer Absatz, Zeilen mit „- “ oder „• “ = Aufzählung, **fett**.
// Das Ergebnis sind nur Textstücke – die App setzt sie als Text ein, Eingaben können also nie HTML werden.

export interface Teil {
  t: string;
  fett?: true;
}
/** Absatz (Zeilen, jede aus Teilen) oder Aufzählung (Punkte, jeder aus Teilen) */
export type Block = { absatz: Teil[][] } | { liste: Teil[][] };

const PUNKT = /^[-•]\s+(.*)$/;

function teile(s: string): Teil[] {
  return s
    .split(/\*\*(.+?)\*\*/g)
    .map((t, i): Teil => (i % 2 ? { t, fett: true } : { t }))
    .filter((x) => x.t);
}

export function regeltext(s: string): Block[] {
  const out: Block[] = [];
  for (const abschnitt of s.replace(/\r/g, "").split(/\n\s*\n/)) {
    let zeilen: string[] = [];
    let punkte: string[] = [];
    const weg = () => {
      if (zeilen.length) out.push({ absatz: zeilen.map(teile) });
      if (punkte.length) out.push({ liste: punkte.map(teile) });
      zeilen = [];
      punkte = [];
    };
    for (const roh of abschnitt.split("\n")) {
      const z = roh.trim();
      if (!z) continue;
      const m = PUNKT.exec(z);
      // Wechsel zwischen Absatz und Aufzählung beginnt einen neuen Block
      if (m ? zeilen.length : punkte.length) weg();
      if (m) punkte.push(m[1]!);
      else zeilen.push(z);
    }
    weg();
  }
  return out;
}
