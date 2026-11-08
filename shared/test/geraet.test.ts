import { describe, expect, it } from "vitest";
import { andereDownloads, erkenneSystem, passenderDownload, type Downloads } from "../src/geraet.ts";

const UA = {
  androidChrome: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  androidFirefox: "Mozilla/5.0 (Android 14; Mobile; rv:125.0) Gecko/125.0 Firefox/125.0",
  winChrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  winEdge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
  winFirefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  macSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  macChrome: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  chromeOs: "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  ubuntuFirefox: "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0",
};

describe("erkenneSystem: User-Agent", () => {
  it("Android (UA enthält auch „Linux“) → android", () => {
    expect(erkenneSystem({ ua: UA.androidChrome })).toBe("android");
    expect(erkenneSystem({ ua: UA.androidFirefox })).toBe("android");
  });
  it("Windows", () => {
    for (const ua of [UA.winChrome, UA.winEdge, UA.winFirefox]) expect(erkenneSystem({ ua })).toBe("windows");
  });
  it("macOS", () => {
    expect(erkenneSystem({ ua: UA.macSafari, touchPunkte: 0 })).toBe("mac");
    expect(erkenneSystem({ ua: UA.macChrome })).toBe("mac");
  });
  it("iPad im Desktop-Modus (Macintosh + Touch) und iPhone → ios", () => {
    expect(erkenneSystem({ ua: UA.macSafari, touchPunkte: 5 })).toBe("ios");
    expect(erkenneSystem({ ua: UA.iphone, touchPunkte: 5 })).toBe("ios");
  });
  it("ChromeOS → andere (nicht linux)", () => expect(erkenneSystem({ ua: UA.chromeOs })).toBe("andere"));
  it("Linux-Desktop → linux", () => expect(erkenneSystem({ ua: UA.ubuntuFirefox })).toBe("linux"));
  it("leer oder unbekannt → andere", () => {
    expect(erkenneSystem({ ua: "" })).toBe("andere");
    expect(erkenneSystem({ ua: "SomeBot/1.0" })).toBe("andere");
  });
});

describe("erkenneSystem: userAgentData.platform", () => {
  it.each([
    ["Windows", "windows"],
    ["macOS", "mac"],
    ["Linux", "linux"],
    ["Android", "android"],
    ["Chrome OS", "andere"],
  ] as const)("%s → %s (auch ohne aussagekräftigen UA)", (plattform, erwartet) => {
    expect(erkenneSystem({ ua: "", plattform })).toBe(erwartet);
  });
  it("Plattform gewinnt gegen irreführenden UA (Android meldet „Linux“)", () => {
    expect(erkenneSystem({ ua: UA.androidChrome, plattform: "Android" })).toBe("android");
  });
});

describe("passenderDownload / andereDownloads", () => {
  const alle: Downloads = {
    android: { datei: "mister-x.apk", groesse: 1 },
    windows: { datei: "download/Mister-X-Setup.exe", groesse: 2 },
    mac: { datei: "download/Mister-X.dmg", groesse: 3 },
    linux: { datei: "download/mister-x.deb", groesse: 4 },
  };
  it("vorhanden → Treffer", () => {
    expect(passenderDownload("windows", alle)).toEqual({ system: "windows", datei: alle.windows });
  });
  it("Datei fehlt → null", () => expect(passenderDownload("mac", { android: alle.android })).toBeNull());
  it("ios und andere → null, auch wenn Downloads da sind", () => {
    expect(passenderDownload("ios", alle)).toBeNull();
    expect(passenderDownload("andere", alle)).toBeNull();
  });
  it("andere: feste Reihenfolge, eigenes System ausgeschlossen", () => {
    expect(andereDownloads("windows", alle).map((d) => d.system)).toEqual(["android", "mac", "linux"]);
    expect(andereDownloads("ios", alle).map((d) => d.system)).toEqual(["android", "windows", "mac", "linux"]);
  });
  it("andere: nur vorhandene Dateien", () => {
    expect(andereDownloads("android", { android: alle.android, linux: alle.linux }).map((d) => d.system)).toEqual(["linux"]);
    expect(andereDownloads("mac", {})).toEqual([]);
  });
});
