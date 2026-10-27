import { describe, expect, it } from "vitest";
import { nextReportAfterIntervalChange, randomEnd } from "../src/index.ts";

const MIN = 60_000;
const now = 1_000_000_000;

describe("Intervalländerung (Regel 5)", () => {
  it("10 → 5 Min, letzte Meldung vor 2 Min → in 3 Min", () =>
    expect(nextReportAfterIntervalChange(now - 2 * MIN, 5, now)).toBe(now + 3 * MIN));
  it("10 → 5 Min, letzte Meldung vor 8 Min → nicht sofort, sondern in 1 Min", () =>
    expect(nextReportAfterIntervalChange(now - 8 * MIN, 5, now)).toBe(now + MIN));
  it("5 → 10 Min, letzte Meldung vor 2 Min → in 8 Min", () =>
    expect(nextReportAfterIntervalChange(now - 2 * MIN, 10, now)).toBe(now + 8 * MIN));
});

describe("Zufallsende (Regel 12)", () => {
  it("liegt im Fenster", () => {
    expect(randomEnd(now, 3, 4, 0)).toBe(now + 180 * MIN);
    expect(randomEnd(now, 3, 4, 0.5)).toBe(now + 210 * MIN);
    expect(randomEnd(now, 3, 4, 0.999999)).toBeLessThan(now + 240 * MIN);
  });
  it("vertauschte Grenzen werden sortiert", () => expect(randomEnd(now, 4, 3, 0)).toBe(now + 180 * MIN));
});
