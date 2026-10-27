// Texte der automatischen System-Meldungen im Chat (vom Server geschrieben) – zentral wie texte.ts der App.
const quelle: Record<string, string> = {
  handy: "",
  tracker: " – Standort vom Tracker",
  schiri: " – Standort vom Schiri",
  letzter: " – letzter bekannter Standort",
};

/** Uhrzeit für Meldungen, immer österreichische Zeit (auch auf dem Server) */
export const uhr = (t: number) =>
  new Date(t).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vienna" });

export const M = {
  start: (mrx: string, min: number) => `Spiel gestartet! ${mrx} ist Mister X und hat ${min} Min Vorsprung.`,
  meldung: (mrx: string, src: string, uhr: string) =>
    `Standort von Mister X (${mrx}) gemeldet${quelle[src] ?? ""}${src === "letzter" ? ` von ${uhr}` : ""}.`,
  sofort: (mrx: string) => `Sofort-Meldung: Standort von Mister X (${mrx}) auf Anweisung der Spielleitung.`,
  keinStandort: (mrx: string) => `Mister X (${mrx}) konnte nicht gemeldet werden – kein Standort vorhanden.`,
  fang: (neu: string, alt: string, min: number) => `${neu} hat ${alt} gefangen und ist jetzt Mister X! ${min} Min Wartezeit in der Nähe.`,
  strafe: (neu: string, alt: string, min: number) =>
    `Strafübergabe: Die Fahne geht von ${alt} an ${neu}. ${min} Min Wartezeit in der Nähe.`,
  rueckgaengig: (neu: string, alt: string) => `Die Übergabe an ${neu} wurde rückgängig gemacht. ${alt} ist wieder Mister X.`,
  gesperrt: (bereich: string) => `Das Spielfeld wird verkleinert! Gesperrt: ${bereich}.`,
  freigegeben: (bereich: string) => `Bereich wieder freigegeben: ${bereich}.`,
  intervall: (min: number) => `Regeländerung: Mister X wird jetzt alle ${min} Min gemeldet.`,
  wartezeit: (min: number) => `Regeländerung: Wartezeit nach einer Übergabe jetzt ${min} Min.`,
  pause: "Das Spiel ist pausiert. Bitte stehen bleiben – es geht gleich weiter.",
  weiter: "Weiter geht's! Das Spiel läuft wieder.",
  ende: (sieger: string) => `Spielende! ${sieger} ist der letzte Mister X und hat gewonnen!`,
};
