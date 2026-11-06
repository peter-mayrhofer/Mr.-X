// Spielregeln als reine Funktionen – dieselben Werte rechnen App (Vorschau, Countdown) und Server.
const MIN = 60_000;

/**
 * Regel 5 (Meldeintervall) bei Änderung während des Spiels: nächste Meldung = letzte + neues Intervall,
 * aber nie früher als 1 Min ab jetzt (Mister X bekommt immer eine Vorwarnung). KONZEPT Abschnitt 5.
 */
export function nextReportAfterIntervalChange(lastReportAt: number, intervalMin: number, now: number): number {
  return Math.max(lastReportAt + intervalMin * MIN, now + MIN);
}

/**
 * Regel 12: geheimer Zufallszeitpunkt im Fenster [Start + minH, Start + maxH] (rand ∈ [0,1)).
 * `notBefore`: bei Änderung des Fensters im laufenden Spiel nur noch aus dem Rest des Fensters ziehen.
 */
export function randomEnd(startedAt: number, minH: number, maxH: number, rand: number, notBefore = 0): number {
  const lo = Math.max(startedAt + Math.min(minH, maxH) * 60 * MIN, notBefore),
    hi = Math.max(startedAt + Math.max(minH, maxH) * 60 * MIN, lo);
  return lo + rand * (hi - lo);
}
