import { describe, expect, it } from "vitest";
import { MELDUNG, PUSH_TITLE, SPRACH_CODES, uebersetze } from "../src/index.ts";

describe("Server-Texte übersetzen", () => {
  it("erkennt Meldungen mit Teamnamen und Minuten", () => {
    expect(uebersetze(MELDUNG.fang("Urfahr (Süd)", "Traun", 5), "en")).toBe(
      "Urfahr (Süd) caught Traun and is now Mister X! 5 min waiting time nearby.",
    );
    expect(uebersetze(MELDUNG.meldung("Traun", "handy", "14:05"), "it")).toBe("Posizione di Mister X (Traun) segnalata.");
    expect(uebersetze(MELDUNG.meldung("Traun", "tracker", "14:05"), "en")).toBe(
      "Location of Mister X (Traun) reported – location from the tracker.",
    );
    expect(uebersetze(MELDUNG.meldung("Traun", "letzter", "14:05"), "es")).toContain("de las 14:05");
    expect(uebersetze(MELDUNG.pruefen("A", "B"), "en")).toContain("without current locations");
    expect(uebersetze(MELDUNG.pruefen("A", "B", 120), "en")).toContain("120 m apart");
    expect(uebersetze(MELDUNG.pause, "tr")).toBe("Oyun durduruldu. Lütfen olduğunuz yerde durun – birazdan devam ediyor.");
    expect(uebersetze(PUSH_TITLE.uebergabe, "es")).toBe("¡Relevo!");
  });

  it("jede Meldung in jeder Sprache: erkannt, übersetzt, ohne Platzhalter", () => {
    const beispiele = Object.entries(MELDUNG).flatMap(([k, f]) =>
      typeof f === "string"
        ? [[k, f]]
        : k === "meldung"
          ? ["handy", "tracker", "schiri", "letzter"].map((q) => [k, (f as (...a: string[]) => string)("Team 1", q, "12:00")])
          : [[k, (f as (...a: (string | number)[]) => string)("Team 1", "Team 2", 7)]],
    );
    for (const l of SPRACH_CODES.filter((s) => s !== "de"))
      for (const [k, de] of beispiele) {
        const x = uebersetze(de!, l);
        expect(x, `${k} ${l}`).not.toBe(de);
        expect(x, `${k} ${l}`).not.toMatch(/undefined|\uE000/);
      }
  });

  it("Deutsch und unbekannter Text bleiben", () => {
    expect(uebersetze(MELDUNG.pause, "de")).toBe(MELDUNG.pause);
    expect(uebersetze("Treffpunkt beim Brunnen!", "en")).toBe("Treffpunkt beim Brunnen!");
    expect(uebersetze(MELDUNG.pause, "xx")).toBe(MELDUNG.pause);
  });
});
