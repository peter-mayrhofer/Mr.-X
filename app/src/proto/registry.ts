// Die 23 Screens aus PROMPT-NEUBAU.md Abschnitt 8.7 mit ihren Zuständen (Varianten).
export interface ScreenDef {
  n: number;
  title: string;
  who: string;
  desc: string;
  group: string;
  variants?: { id: string; label: string }[];
  wide?: boolean;
}

export const SCREENS: ScreenDef[] = [
  {
    n: 1,
    group: "Einstieg",
    title: "Startseite",
    who: "Alle",
    desc: "Logo, App-Name, „Team beitreten“, dezent Schiri und Spielleitung",
    variants: [
      { id: "", label: "Ohne Spiel" },
      { id: "spiel", label: "Aus QR-Link" },
    ],
  },
  {
    n: 2,
    group: "Einstieg",
    title: "Team beitreten",
    who: "Team",
    desc: "Spiel-Code/QR, Teamname, Team-Passwort",
    variants: [
      { id: "", label: "Normal" },
      { id: "fehler", label: "Passwort falsch" },
      { id: "zweit", label: "Ersatzgerät" },
    ],
  },
  {
    n: 3,
    group: "Einstieg",
    title: "Schiri- & Admin-Login",
    who: "Schiri, Spielleitung",
    desc: "Spiel-Code, Name, Schiri-Code bzw. Admin-Passwort",
    variants: [
      { id: "schiri", label: "Schiri" },
      { id: "admin", label: "Spielleitung" },
    ],
  },
  {
    n: 4,
    group: "Einstieg",
    title: "Onboarding",
    who: "Team",
    desc: "So läuft's, Standort, Benachrichtigungen, Akku",
    variants: [
      { id: "1", label: "1" },
      { id: "2", label: "2" },
      { id: "3", label: "3" },
      { id: "4", label: "4" },
    ],
  },
  { n: 5, group: "Einstieg", title: "Warteraum", who: "Team", desc: "Vor dem Start: Teamliste, Checks, wichtigste Regeln" },
  {
    n: 6,
    group: "Im Spiel – Teams",
    title: "Jäger-Karte",
    who: "Team",
    desc: "Hauptscreen: Mister-X-Spur, Countdown, Status",
    variants: [
      { id: "", label: "Normal" },
      { id: "durchsage", label: "Durchsage" },
      { id: "verkleinerung", label: "Verkleinerung" },
      { id: "offline", label: "Offline" },
    ],
  },
  {
    n: 7,
    group: "Im Spiel – Teams",
    title: "Mister-X-Karte",
    who: "Mister X",
    desc: "Roter Modus, eigener Countdown, Spielfeld-Warnung",
    variants: [
      { id: "", label: "Normal" },
      { id: "grenze", label: "Nahe Grenze" },
      { id: "draussen", label: "Draußen" },
    ],
  },
  { n: 8, group: "Im Spiel – Teams", title: "Wartezeit", who: "Team", desc: "Bildschirmfüllend: Bitte stehen bleiben" },
  {
    n: 9,
    group: "Im Spiel – Teams",
    title: "Übergabe",
    who: "Alle",
    desc: "Gefangen! / Ihr seid jetzt Mister X! / Erwischt!",
    variants: [
      { id: "alle", label: "Alle" },
      { id: "neu", label: "Neuer Mister X" },
      { id: "erwischt", label: "Alter Mister X" },
    ],
  },
  {
    n: 10,
    group: "Im Spiel – Teams",
    title: "Chat",
    who: "Team",
    desc: "Gruppenchat, Direktkanal, System-Meldungen, Durchsagen",
    variants: [
      { id: "alle", label: "Alle" },
      { id: "dm", label: "Spielleitung" },
    ],
  },
  {
    n: 11,
    group: "Im Spiel – Teams",
    title: "Regeln & Hilfe",
    who: "Alle",
    desc: "Regeln mit Icons und aktuellen Werten, durchsuchbar, FAQ",
  },
  {
    n: 12,
    group: "Schiri",
    title: "Schiri-Ansicht",
    who: "Schiri",
    desc: "Alle Teams live, Übergabe-Ablauf, Rückgängig",
    variants: [
      { id: "", label: "Karte" },
      { id: "uebergabe", label: "Übergabe" },
      { id: "rueckgaengig", label: "Nach Übergabe" },
    ],
  },
  {
    n: 13,
    group: "Spielleitung",
    title: "Admin: Live-Übersicht",
    who: "Spielleitung",
    desc: "Karte mit allen Teams, Warnungen, Schnellaktionen",
    wide: true,
  },
  {
    n: 14,
    group: "Spielleitung",
    title: "Admin: Steuerung & Regeln",
    who: "Spielleitung",
    desc: "Start/Auslosen, Zufallsende, Pause, Notstopp, Regeln live",
    wide: true,
    variants: [
      { id: "", label: "Im Spiel" },
      { id: "vorStart", label: "Vor dem Start" },
    ],
  },
  {
    n: 15,
    group: "Spielleitung",
    title: "Admin: Teams & Zugänge",
    who: "Spielleitung",
    desc: "Teams, Schiris, Passwörter, QR-Codes, Neue Runde",
    wide: true,
    variants: [
      { id: "teams", label: "Teams" },
      { id: "schiris", label: "Schiris" },
      { id: "zugaenge", label: "Zugänge" },
    ],
  },
  {
    n: 16,
    group: "Spielleitung",
    title: "Admin: Spielfeld-Editor",
    who: "Spielleitung",
    desc: "Spielfeld und Sperrbereiche bearbeiten, GeoJSON",
    wide: true,
    variants: [
      { id: "", label: "Normal" },
      { id: "fehler", label: "Fehler" },
    ],
  },
  { n: 17, group: "Spielleitung", title: "Admin: Protokoll", who: "Spielleitung", desc: "Wer hat wann was ausgelöst", wide: true },
  {
    n: 18,
    group: "Großbild, Ende & Archiv",
    title: "Großbild",
    who: "Zentrale, Beamer",
    desc: "Für 3–5 m lesbar: Karte, Countdown, Rangliste, Ticker",
    wide: true,
    variants: [
      { id: "", label: "Normal" },
      { id: "durchsage", label: "Durchsage" },
      { id: "zuschauer", label: "Zuschauer" },
    ],
  },
  { n: 19, group: "Großbild, Ende & Archiv", title: "Spielende & Auswertung", who: "Alle", desc: "Feier, Sieger, Statistiken, Zeitstrahl" },
  {
    n: 20,
    group: "Großbild, Ende & Archiv",
    title: "Archiv & Replay",
    who: "Spielleitung, Teams",
    desc: "Vergangene Spiele, Wiederholung auf der Karte",
    variants: [
      { id: "liste", label: "Liste" },
      { id: "replay", label: "Replay" },
    ],
  },
  {
    n: 21,
    group: "Verwaltung & Sonstiges",
    title: "Super-Admin: Spiele",
    who: "Organisator",
    desc: "Spiele anlegen, Admins vergeben, archivieren",
    wide: true,
  },
  { n: 22, group: "Verwaltung & Sonstiges", title: "Einstellungen", who: "Alle", desc: "Darstellung, Ton, Push, Standort, Abmelden" },
  {
    n: 23,
    group: "Verwaltung & Sonstiges",
    title: "Fehler & Offline",
    who: "Alle",
    desc: "Kein Netz, kein GPS, Standort verweigert, Spiel nicht gefunden, abgemeldet",
    variants: [
      { id: "offline", label: "Kein Netz" },
      { id: "keinGps", label: "Kein GPS" },
      { id: "verweigert", label: "Verweigert" },
      { id: "nichtGefunden", label: "Nicht gefunden" },
      { id: "entfernt", label: "Abgemeldet" },
    ],
  },
];
