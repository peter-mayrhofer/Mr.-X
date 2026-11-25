// Organisator-Konten (E-84): mit Gratis-Code erstellen, Anmeldung mit E-Mail + Passwort, nur eigene Spiele und Vorlagen,
// Ablauf und Verlängern, Verwaltung durch den Eigentümer (Codes, Konten, Eigentümer-Konto).
import { beforeAll, describe, expect, it } from "vitest";
import { call, join, kontoAendern, reason, resetServer, superAdminToken } from "./helpers.ts";

let eig = ""; // Eigentümer (Organisator-Passwort)
let codeA = "";
let a = ""; // Konto Verein A
let b = ""; // Konto Verein B
const PW = "vereinsheim-2026";
const MONAT = 30 * 24 * 3600_000;

const ok = async (token: string | null, data: Record<string, unknown>, ip?: string) => {
  const r = await call(token, data, ip);
  if (r.error) throw new Error(`${String(data.action)}: ${r.error.message}`);
  return r.result!;
};
const code = async (max: number, monate: number) => (await ok(eig, { action: "codeErstellen", max, monate })).code as string;
const erstellen = (email: string, c: string, ip?: string, passwort = PW) =>
  call(null, { action: "kontoErstellen", email, passwort, code: c }, ip);
const spiel = (token: string, gameId: string) =>
  call(token, { action: "createGame", gameId, name: gameId, template: "leer", adminPassword: "admin1234" });
const spiele = async (token: string) => ((await ok(token, { action: "listGames" })).games as { id: string }[]).map((g) => g.id).sort();

beforeAll(async () => {
  await resetServer();
  eig = await superAdminToken();
}, 60_000);

describe("Gratis-Codes", () => {
  it("nur der Eigentümer erstellt Codes – Anzahl und Laufzeit werden geprüft", async () => {
    expect(reason(await call(null, { action: "codeErstellen", max: 1, monate: 3 }))).toBe("forbidden");
    expect(reason(await call(eig, { action: "codeErstellen", max: 0, monate: 3 }))).toBe("invalid");
    expect(reason(await call(eig, { action: "codeErstellen", max: 1, monate: 2 }))).toBe("invalid");
    codeA = await code(2, 3);
    expect(codeA).toMatch(/^MRX-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
  });

  it("Konto erstellen: gilt so lange wie der Code sagt, Code wird mitgezählt", async () => {
    // Groß/klein und Bindestriche egal
    a = (
      await ok(null, {
        action: "kontoErstellen",
        email: "Verein-A@Beispiel.at",
        passwort: PW,
        code: codeA.toLowerCase().replaceAll("-", " "),
      })
    ).token as string;
    const i = (await ok(a, { action: "kontoInfo" })) as {
      konto: { email: string; rolle: string; bisAt: number; codes: string[] };
      eigentuemer: boolean;
    };
    expect(i.eigentuemer).toBe(false);
    expect(i.konto).toMatchObject({ email: "verein-a@beispiel.at", rolle: "organisator", codes: [codeA] });
    expect(i.konto.bisAt).toBeGreaterThan(Date.now() + 2.9 * MONAT);
    expect(i.konto.bisAt).toBeLessThan(Date.now() + 3.2 * MONAT);
    const liste = (await ok(eig, { action: "codeListe" })).codes as { code: string; benutzt: number; max: number }[];
    expect(liste.find((c) => c.code === codeA)).toMatchObject({ benutzt: 1, max: 2 });
  });

  it("gleiche E-Mail nur einmal; E-Mail und Passwort werden geprüft", async () => {
    expect(reason(await erstellen("verein-a@BEISPIEL.at", codeA))).toBe("emailTaken");
    expect(reason(await erstellen("keine-mail", codeA))).toBe("invalid");
    expect(reason(await erstellen("kurz@beispiel.at", codeA, undefined, "kurz"))).toBe("invalid");
  });

  it("Code aufgebraucht, falsch oder gesperrt", async () => {
    b = (await ok(null, { action: "kontoErstellen", email: "verein-b@beispiel.at", passwort: PW, code: codeA })).token as string;
    expect(reason(await erstellen("verein-c@beispiel.at", codeA))).toBe("badCode"); // 2 von 2 benutzt
    expect(reason(await erstellen("verein-c@beispiel.at", "MRX-AAAA-AAAA"))).toBe("badCode");
    const gesperrt = await code(5, 1);
    await ok(eig, { action: "codeSperren", code: gesperrt, aktiv: false });
    expect(reason(await erstellen("verein-c@beispiel.at", gesperrt))).toBe("badCode");
    await ok(eig, { action: "codeSperren", code: gesperrt, aktiv: true });
    expect(reason(await erstellen("verein-c@beispiel.at", gesperrt))).toBeUndefined();
  });

  it("Rate-Limit: 5 falsche Codes, dann auch der richtige gesperrt", async () => {
    const ip = "198.51.100.41";
    const gut = await code(1, 1);
    for (let i = 0; i < 5; i++) expect(reason(await erstellen(`rate${i}@beispiel.at`, `MRX-ZZZZ-ZZZ${i + 2}`, ip))).toBe("badCode");
    expect(reason(await erstellen("rate@beispiel.at", gut, ip))).toBe("tooMany");
  });
});

describe("Anmeldung", () => {
  it("richtig; falsches Passwort und unbekannte E-Mail sehen gleich aus", async () => {
    expect(typeof (await ok(null, { action: "kontoLogin", email: " VEREIN-A@beispiel.at ", passwort: PW })).token).toBe("string");
    expect(reason(await call(null, { action: "kontoLogin", email: "verein-a@beispiel.at", passwort: "falsch-falsch" }))).toBe(
      "wrongSecret",
    );
    expect(reason(await call(null, { action: "kontoLogin", email: "niemand@beispiel.at", passwort: PW }))).toBe("wrongSecret");
  });
});

describe("Spiele und Vorlagen eines Kontos", () => {
  it("jedes Konto sieht nur seine Spiele, der Eigentümer alle", async () => {
    expect((await spiel(a, "verein-a-1")).error).toBeUndefined();
    expect((await spiel(b, "verein-b-1")).error).toBeUndefined();
    expect((await spiel(eig, "eigentuemer-1")).error).toBeUndefined();
    expect(await spiele(a)).toEqual(["verein-a-1"]);
    expect(await spiele(b)).toEqual(["verein-b-1"]);
    expect(await spiele(eig)).toEqual(["eigentuemer-1", "verein-a-1", "verein-b-1"]);
  });

  it("fremdes Konto: kein Archivieren, Löschen, Ändern, Betreten ohne Passwort", async () => {
    const g = { gameId: "verein-a-1" };
    expect(reason(await call(b, { action: "archiveGame", ...g }))).toBe("forbidden");
    expect(reason(await call(b, { action: "deleteGame", ...g }))).toBe("forbidden");
    expect(reason(await call(b, { action: "setSecret", ...g, kind: "teamPw", value: "falke27" }))).toBe("forbidden");
    expect(reason(await call(b, { action: "join", ...g, role: "admin", name: "Fremd" }))).toBe("wrongSecret");
    // eigenes Konto und Eigentümer dürfen
    expect((await call(a, { action: "join", ...g, role: "admin", name: "Anna" })).error).toBeUndefined();
    expect((await call(eig, { action: "join", ...g, role: "admin", name: "Peter" })).error).toBeUndefined();
    expect((await call(a, { action: "setSecret", ...g, kind: "teamPw", value: "falke27" })).error).toBeUndefined();
  });

  it("Vorlagen sind pro Konto getrennt", async () => {
    const anna = await join("verein-a-1", "admin", "Anna", "admin1234");
    const peter = await join("eigentuemer-1", "admin", "Peter", "admin1234");
    const bert = await join("verein-b-1", "admin", "Bert", "admin1234");
    const id = (await ok(anna.token, { action: "templateSave", gameId: "verein-a-1", name: "Verein A" })).id as string;
    await ok(peter.token, { action: "templateSave", gameId: "eigentuemer-1", name: "Eigentümer" });
    const namen = async (d: { token: string }, gameId: string) =>
      ((await ok(d.token, { action: "templateList", gameId })).templates as { name: string }[]).map((t) => t.name);
    expect(await namen(anna, "verein-a-1")).toEqual(["Verein A"]);
    expect(await namen(peter, "eigentuemer-1")).toEqual(["Eigentümer"]);
    expect(await namen(bert, "verein-b-1")).toEqual([]);
    expect(reason(await call(bert.token, { action: "templateLoad", gameId: "verein-b-1", id }))).toBe("notFound");
    await ok(bert.token, { action: "templateDelete", gameId: "verein-b-1", id });
    expect(await namen(anna, "verein-a-1")).toEqual(["Verein A"]);
  });
});

describe("Ablauf und Verlängern", () => {
  it("abgelaufen: kein neues Spiel, bestehende Spiele gehen weiter", async () => {
    await kontoAendern("verein-a@beispiel.at", { bisAt: Date.now() - 1000 });
    expect(reason(await spiel(a, "verein-a-2"))).toBe("expired");
    expect(await spiele(a)).toEqual(["verein-a-1"]);
    expect((await call(a, { action: "join", gameId: "verein-a-1", role: "admin", name: "Anna" })).error).toBeUndefined();
  });

  it("neuen Code einlösen verlängert; denselben Code nicht zweimal", async () => {
    const neu = await code(10, 1);
    const bis = (await ok(a, { action: "codeEinloesen", code: neu })).bisAt as number;
    expect(bis).toBeGreaterThan(Date.now() + 0.9 * MONAT);
    expect((await spiel(a, "verein-a-2")).error).toBeUndefined();
    expect(reason(await call(a, { action: "codeEinloesen", code: neu }))).toBe("badCode");
    expect(reason(await call(null, { action: "codeEinloesen", code: neu }))).toBe("unauthenticated");
  });

  it("unbegrenzter Code: gilt für immer, auch nach weiterem Einlösen", async () => {
    await ok(a, { action: "codeEinloesen", code: await code(1, 0) });
    expect(((await ok(a, { action: "kontoInfo" })).konto as { bisAt: number | null }).bisAt).toBeNull();
    await ok(a, { action: "codeEinloesen", code: await code(1, 3) });
    expect(((await ok(a, { action: "kontoInfo" })).konto as { bisAt: number | null }).bisAt).toBeNull();
  });
});

describe("Verwaltung durch den Eigentümer", () => {
  it("Organisator-Passwort: kein Konto, aber Eigentümer", async () =>
    expect(await ok(eig, { action: "kontoInfo" })).toEqual({ konto: null, eigentuemer: true }));

  it("Eigentümer-Konto: nur der Eigentümer legt es an, dann gleiche Rechte wie das Organisator-Passwort", async () => {
    expect(reason(await call(a, { action: "eigentuemerAnlegen", email: "peter@beispiel.at", passwort: PW }))).toBe("forbidden");
    await ok(eig, { action: "eigentuemerAnlegen", email: "peter@beispiel.at", passwort: PW });
    const p = (await ok(null, { action: "kontoLogin", email: "peter@beispiel.at", passwort: PW })).token as string;
    expect(await ok(p, { action: "kontoInfo" })).toMatchObject({ eigentuemer: true, konto: { rolle: "eigentuemer", bisAt: null } });
    expect(await spiele(p)).toEqual(["eigentuemer-1", "verein-a-1", "verein-a-2", "verein-b-1"]);
    expect(typeof (await code(1, 12))).toBe("string");
    expect((await call(p, { action: "archiveGame", gameId: "verein-b-1" })).error).toBeUndefined();
  });

  it("Konten-Liste mit Anzahl Spiele – nur für den Eigentümer", async () => {
    expect(reason(await call(a, { action: "kontoListe" }))).toBe("forbidden");
    const k = (await ok(eig, { action: "kontoListe" })).konten as { email: string; spiele: number }[];
    expect(k.find((x) => x.email === "verein-a@beispiel.at")?.spiele).toBe(2);
    expect(k.find((x) => x.email === "peter@beispiel.at")?.spiele).toBe(0);
  });

  it("Passwort selbst ändern: altes nötig, alte Sitzungen ungültig", async () => {
    expect(reason(await call(a, { action: "kontoPasswort", alt: "falsch-falsch", neu: "neues-passwort-1" }))).toBe("wrongSecret");
    const neu = (await ok(a, { action: "kontoPasswort", alt: PW, neu: "neues-passwort-1" })).token as string;
    expect(reason(await call(a, { action: "listGames" }))).toBe("session");
    a = neu;
    expect(await spiele(a)).toEqual(["verein-a-1", "verein-a-2"]);
  });

  it("Eigentümer setzt ein neues Passwort; sperren beendet Sitzungen und Anmeldung", async () => {
    const id = await kontoAendern("verein-a@beispiel.at", {});
    await ok(eig, { action: "kontoSetzen", id, passwort: "vom-eigentuemer-1" });
    expect(reason(await call(a, { action: "listGames" }))).toBe("session");
    a = (await ok(null, { action: "kontoLogin", email: "verein-a@beispiel.at", passwort: "vom-eigentuemer-1" })).token as string;
    await ok(eig, { action: "kontoSetzen", id, gesperrt: true });
    expect(reason(await call(a, { action: "listGames" }))).toBe("session");
    expect(reason(await call(null, { action: "kontoLogin", email: "verein-a@beispiel.at", passwort: "vom-eigentuemer-1" }))).toBe(
      "forbidden",
    );
    await ok(eig, { action: "kontoSetzen", id, gesperrt: false });
    expect(
      reason(await call(null, { action: "kontoLogin", email: "verein-a@beispiel.at", passwort: "vom-eigentuemer-1" })),
    ).toBeUndefined();
  });

  it("Konto löschen: Anmeldung weg, seine Spiele bleiben beim Eigentümer", async () => {
    const id = await kontoAendern("verein-b@beispiel.at", {});
    await ok(eig, { action: "kontoLoeschen", id });
    expect(reason(await call(null, { action: "kontoLogin", email: "verein-b@beispiel.at", passwort: PW }))).toBe("wrongSecret");
    expect(reason(await call(b, { action: "listGames" }))).toBe("session");
    expect(await spiele(eig)).toContain("verein-b-1");
    const k = (await ok(eig, { action: "kontoListe" })).konten as { email: string }[];
    expect(k.map((x) => x.email)).not.toContain("verein-b@beispiel.at");
    // die E-Mail ist wieder frei
    expect((await erstellen("verein-b@beispiel.at", await code(1, 1))).error).toBeUndefined();
  });
});
