// Gerätegerechter Download-Knopf (docs/DESKTOP-APP.md): welches System hat der Browser, und gibt es dafür eine App-Datei?

export type System = "android" | "windows" | "mac" | "linux" | "ios" | "andere";
/** Systeme, für die es eine installierbare App gibt */
export type DownloadSystem = "android" | "windows" | "mac" | "linux";

export interface GeraetInfo {
  /** navigator.userAgent */
  ua: string;
  /** navigator.userAgentData?.platform (nur Chromium-Browser) */
  plattform?: string | undefined;
  /** navigator.maxTouchPoints – unterscheidet iPad (meldet sich als Mac) vom echten Mac */
  touchPunkte?: number | undefined;
}

export function erkenneSystem({ ua, plattform, touchPunkte = 0 }: GeraetInfo): System {
  const p = (plattform ?? "").toLowerCase();
  // Reihenfolge zählt: Android-UA enthält „Linux“, ChromeOS („CrOS“) ebenfalls; iPad-Safari meldet sich als „Macintosh“
  if (p === "android" || /Android/i.test(ua)) return "android";
  if (p === "ios" || /iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (p === "chrome os" || p === "chromeos" || /CrOS/.test(ua)) return "andere";
  if (p === "windows" || /Windows/i.test(ua)) return "windows";
  if (p === "macos" || /Macintosh|Mac OS X/i.test(ua)) return touchPunkte > 1 ? "ios" : "mac";
  if (p === "linux" || /Linux|X11/i.test(ua)) return "linux";
  return "andere";
}

/** Feste Dateinamen ohne Versionsnummer, relativ zur Wurzel der Website – Links auf Flyern bleiben gültig */
export const DOWNLOAD_DATEIEN: Record<DownloadSystem, string> = {
  android: "mister-x.apk",
  windows: "download/Mister-X-Setup.exe",
  mac: "download/Mister-X.dmg",
  linux: "download/mister-x.deb",
};

export const DOWNLOAD_SYSTEME = Object.keys(DOWNLOAD_DATEIEN) as DownloadSystem[];

export interface DownloadDatei {
  /** Pfad relativ zur Wurzel, z. B. „download/Mister-X-Setup.exe“ */
  datei: string;
  /** Größe in Bytes */
  groesse: number;
}

/** Inhalt von /downloads.json (erzeugt beim Bauen aus den Dateien in app/public) – nur vorhandene Dateien */
export type Downloads = Partial<Record<DownloadSystem, DownloadDatei>>;

/** Die Datei für dieses System, sonst null (iPhone, ChromeOS, unbekannt oder Datei nicht am Server) */
export function passenderDownload(system: System, downloads: Downloads): { system: DownloadSystem; datei: DownloadDatei } | null {
  if (!(system in DOWNLOAD_DATEIEN)) return null;
  const datei = downloads[system as DownloadSystem];
  return datei ? { system: system as DownloadSystem, datei } : null;
}

/** Alle anderen vorhandenen Downloads (für „Andere Systeme“) in fester Reihenfolge */
export function andereDownloads(system: System, downloads: Downloads): { system: DownloadSystem; datei: DownloadDatei }[] {
  return DOWNLOAD_SYSTEME.filter((s) => s !== system && downloads[s]).map((s) => ({ system: s, datei: downloads[s]! }));
}
