import { describe, expect, it } from "vitest";
import { GAME_ID, sameName, teamColor, teamShort, TEAM_COLORS } from "../src/index.ts";

describe("Team-Kürzel", () => {
  it("Anfangsbuchstaben ohne Füllwörter", () => expect(teamShort("Ortsgruppe Neue Heimat", [])).toBe("NH"));
  it("ein Wort → erste zwei Buchstaben", () => expect(teamShort("Urfahr", [])).toBe("UR"));
  it("vergeben → anderer Buchstabe", () => expect(teamShort("Urfahr", ["UR"])).toBe("UF"));
  it("Umlaute bleiben", () => expect(teamShort("Ölberg", [])).toBe("ÖL"));
  it("alles vergeben → Ziffer", () => expect(teamShort("Aa", ["AA"])).toBe("A1"));
});

describe("Namen vergleichen", () => {
  it("Groß/klein und Leerzeichen egal", () => expect(sameName("  ortsgruppe   urfahr", "Ortsgruppe Urfahr")).toBe(true));
  it("verschieden", () => expect(sameName("Urfahr", "Urfahr 2")).toBe(false));
});

describe("Teamfarben", () => {
  it("erste freie", () => expect(teamColor([TEAM_COLORS[0]!])).toBe(TEAM_COLORS[1]));
  it("alle vergeben → reihum", () => expect(TEAM_COLORS).toContain(teamColor([...TEAM_COLORS])));
});

describe("Spiel-Code", () => {
  it.each(["linz-2027", "wels", "a1b"])("%s gültig", (c) => expect(GAME_ID.test(c)).toBe(true));
  it.each(["Linz", "-linz", "linz-", "a", "linz 2027", "ä-test"])("%s ungültig", (c) => expect(GAME_ID.test(c)).toBe(false));
});
