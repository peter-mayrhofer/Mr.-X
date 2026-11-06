// Eine gemeinsame Uhr für alle Countdowns: tickt auf Sekundengrenzen, rechnet mit dem Zeitversatz zum Server
// (keine Handy-Uhr-Fehler, KONZEPT Abschnitt 5).
class Clock {
  now = $state(Date.now());
  /** Server-Zeit minus Handy-Zeit in ms (später aus .info/serverTimeOffset) */
  offset = 0;
}

export const clock = new Clock();

function tick() {
  clock.now = Date.now() + clock.offset;
  setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
}
tick();
