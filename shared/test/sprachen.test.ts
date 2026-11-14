import { describe, expect, it } from "vitest";
import { MELDUNG, PROTOKOLL as P, PUSH_TITLE, SPRACH_CODES, uebersetze, uebersetzeProtokoll } from "../src/index.ts";

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

  it("Protokoll: Aktionen und Details, feste Wörter in den Teilen mit übersetzt", () => {
    expect(uebersetzeProtokoll(P.uebergabe, "en")).toBe("Handover");
    expect(uebersetzeProtokoll(P.fang("Traun", "Urfahr", P.niemand), "en")).toBe("Traun → Urfahr; waiting: nobody");
    expect(uebersetzeProtokoll(P.fangPruefenM("A", "B", "C, D", 300), "it")).toBe(
      "A → B; in attesa: C, D; da controllare: 300 m di distanza",
    );
    expect(uebersetzeProtokoll(P.geraetMit("Peter", P.schiri), "es")).toBe("Peter (Árbitro)");
    expect(uebersetzeProtokoll(P.aufgeteilt("A", "B", 1), "en")).toBe("A → B (1 device)");
    expect(uebersetzeProtokoll(P.aufgeteilt("A", "B", 3), "en")).toBe("A → B (3 devices)");
    expect(uebersetzeProtokoll(P.organisator, "tr")).toBe("Organizatör");
    expect(uebersetzeProtokoll(P.istMrxGelost("Traun"), "es")).toBe("Traun es Mister X (por sorteo)");
    for (const l of SPRACH_CODES.filter((s) => s !== "de"))
      for (const [k, f] of Object.entries(P)) {
        const de = typeof f === "string" ? f : (f as (...a: (string | number)[]) => string)("Team 1", "Team 2", "Team 3", 7);
        const x = uebersetzeProtokoll(de, l);
        if (!["geraetMit", "teamMin", "pause"].includes(k) && !(l === "en" && ["team", "durchsage"].includes(k)))
          expect(x, `${k} ${l}`).not.toBe(de);
        expect(x, `${k} ${l}`).not.toMatch(/undefined|\uE000/);
      }
  });
});
