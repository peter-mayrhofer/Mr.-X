import { describe, expect, it } from "vitest";
import { pushTargets, type Member, type PushReg } from "../src/index.ts";

const m = (role: Member["role"], teamId?: string): Member => ({ role, name: "x", joinedAt: 1, ...(teamId ? { teamId } : {}) });
const members: Record<string, Member> = {
  a1: m("team", "A"),
  a2: m("team", "A"),
  b1: m("team", "B"),
  s1: m("schiri"),
  adm: m("admin"),
  scr: m("screen"),
  v1: m("viewer"),
};
const reg = (prefs: PushReg["prefs"] = {}): PushReg => ({ sub: { endpoint: "https://push.example/" + Math.random(), keys: { p256dh: "", auth: "" } }, prefs });
const regs: Record<string, PushReg> = {
  a1: reg(),
  a2: reg({ meldung: false }),
  b1: {}, // Android-App: kein Web-Push-Abo, bekommt es über die Verbindung
  s1: reg(),
  adm: reg(),
  scr: reg(),
  weg: reg(), // hat das Spiel verlassen
};
const uids = (r: string[]) => [...r].sort();

describe("Wer bekommt eine Benachrichtigung?", () => {
  it("alle Mitglieder, nie Großbild, nie ehemalige Geräte", () =>
    expect(uids(pushTargets(members, regs, { all: true }, "spiel"))).toEqual(["a1", "a2", "adm", "b1", "s1", "v1"]));
  it("abgeschaltete Arten werden respektiert", () =>
    expect(uids(pushTargets(members, regs, { all: true }, "meldung"))).toEqual(["a1", "adm", "b1", "s1", "v1"]));
  it("nur bestimmte Teams (alle Geräte des Teams)", () =>
    expect(uids(pushTargets(members, regs, { teams: ["A"] }, "wartezeit"))).toEqual(["a1", "a2"]));
  it("alle außer bestimmten Teams", () =>
    expect(uids(pushTargets(members, regs, { all: true, except: ["A"] }, "uebergabe"))).toEqual(["adm", "b1", "s1", "v1"]));
  it("nach Rolle", () => expect(uids(pushTargets(members, regs, { roles: ["admin", "schiri"] }, "nachricht"))).toEqual(["adm", "s1"]));
});
