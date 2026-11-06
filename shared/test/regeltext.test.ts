import { describe, expect, it } from "vitest";
import { regeltext } from "../src/regeltext.ts";

describe("Regeltext der Spielleitung", () => {
  it("Absätze, Zeilen, Aufzählung und fett", () => {
    expect(regeltext("**Treffpunkt:** Hauptplatz\nbei der Säule\n\nBitte beachten:\n- keine Fahrräder\n• Handy **laden**")).toEqual([
      { absatz: [[{ t: "Treffpunkt:", fett: true }, { t: " Hauptplatz" }], [{ t: "bei der Säule" }]] },
      { absatz: [[{ t: "Bitte beachten:" }]] },
      { liste: [[{ t: "keine Fahrräder" }], [{ t: "Handy " }, { t: "laden", fett: true }]] },
    ]);
  });
  it("HTML bleibt Text, leere Eingabe ergibt nichts", () => {
    expect(regeltext("<b>x</b>")).toEqual([{ absatz: [[{ t: "<b>x</b>" }]] }]);
    expect(regeltext("  \n\n ")).toEqual([]);
  });
  it("„**fett“ ohne Ende und „*“ am Zeilenanfang bleiben normaler Text", () => {
    expect(regeltext("**offen\n*Stern")).toEqual([{ absatz: [[{ t: "**offen" }], [{ t: "*Stern" }]] }]);
  });
});
