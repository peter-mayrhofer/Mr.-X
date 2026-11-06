import { describe, expect, it } from "vitest";
import { appVeraltet } from "../src/version.ts";

describe("Update-Hinweis", () => {
  it("anderer Stand auf dem Server → veraltet", () => expect(appVeraltet("a1b2c3d", "e4f5a6b")).toBe(true));
  it("gleicher Stand, Server nicht erreichbar oder Entwicklungs-Build → kein Hinweis", () => {
    expect(appVeraltet("a1b2c3d", "a1b2c3d")).toBe(false);
    expect(appVeraltet("a1b2c3d", null)).toBe(false);
    expect(appVeraltet("dev", "e4f5a6b")).toBe(false);
    expect(appVeraltet("a1b2c3d", "dev")).toBe(false);
  });
});
