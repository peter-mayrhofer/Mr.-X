// Spielübergreifende Daten in D1 (E-32): Spieleliste der Verwaltung und Archiv. Die Tabellen legt der Server beim ersten
// Zugriff selbst an – der Organisator muss keine Datenbank-Befehle ausführen.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, name TEXT NOT NULL, createdAt INTEGER NOT NULL,
     archived INTEGER NOT NULL DEFAULT 0, phase TEXT NOT NULL DEFAULT 'vorbereitung', teams INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS archive (game TEXT NOT NULL, run TEXT NOT NULL, name TEXT, startedAt INTEGER, endedAt INTEGER NOT NULL,
     winner TEXT, data TEXT NOT NULL, chat TEXT, PRIMARY KEY (game, run))`,
  // Spuren der Teams fürs Nachspielen (E-72): getrennt vom Archiv, weil sie schon nach 30 Tagen gelöscht werden.
  // Wird ein Archiv-Eintrag gelöscht (Spiel gelöscht, Probelauf weg), gehen seine Spuren mit.
  `CREATE TABLE IF NOT EXISTS archive_tracks (game TEXT NOT NULL, run TEXT NOT NULL, endedAt INTEGER NOT NULL, tracks TEXT NOT NULL,
     PRIMARY KEY (game, run))`,
  `CREATE TRIGGER IF NOT EXISTS archive_tracks_mit AFTER DELETE ON archive
     BEGIN DELETE FROM archive_tracks WHERE game = OLD.game AND run = OLD.run; END`,
  // Vorlagen (Regeln + Spielfeld) für alle Spiele des Organisators
  `CREATE TABLE IF NOT EXISTS templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, createdAt INTEGER NOT NULL, data TEXT NOT NULL)`,
];

let ready: Promise<unknown> | null = null;
export function ensureSchema(db: D1Database): Promise<unknown> {
  return (ready ??= db.batch(SCHEMA.map((s) => db.prepare(s))).catch((e: unknown) => {
    ready = null;
    throw e;
  }));
}
