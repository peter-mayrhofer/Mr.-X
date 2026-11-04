// Ende-zu-Ende: QR-Codes scannen direkt in der App und die drei Druckblätter. Ein Schiri-Handy mit (simulierter)
// Kamera, die den Schiri-QR-Code zeigt: Startseite → „QR-Code scannen“ → Schiri-Anmeldung mit ausgefülltem Spiel-Code,
// Name und Schiri-Code tippt man selbst. Spielleitung druckt Team-, Schiri- und Spielleitungs-Blatt: Passwort kommt
// aufs Blatt (gerade festgelegt oder eingetippt und vom Server geprüft), aber nie in den Browser-Speicher.
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pathJoin } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { encode } from "uqr";
import { T } from "../app/src/texte.ts";
import { call, join, resetServer, startApp, superAdminToken, type Device } from "./helpers.ts";

const G = "linz-qr";
const PORT = 5190;
const URL = `http://127.0.0.1:${PORT}/`;
let vite: ViteDevServer;
let browser: Browser;
let camBrowser: Browser;
let api: Device;

/** Kamerabild für Chromium (Y4M): weißer Hintergrund mit dem QR-Code in der Mitte, ein paar gleiche Bilder */
function qrVideo(text: string): string {
  const { data, size } = encode(text, { border: 4 });
  const W = 640;
  const H = 480;
  const scale = Math.floor(420 / size);
  const y = Buffer.alloc(W * H, 235);
  const ox = Math.floor((W - size * scale) / 2);
  const oy = Math.floor((H - size * scale) / 2);
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (data[r]![c])
        for (let dy = 0; dy < scale; dy++)
          y.fill(16, (oy + r * scale + dy) * W + ox + c * scale, (oy + r * scale + dy) * W + ox + (c + 1) * scale);
  const uv = Buffer.alloc((W / 2) * (H / 2), 128);
  const frame = Buffer.concat([Buffer.from("FRAME\n"), y, uv, uv]);
  const file = pathJoin(tmpdir(), `mrx-qr-${process.pid}.y4m`);
  writeFileSync(file, Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`), ...Array(10).fill(frame)]));
  return file;
}

beforeAll(async () => {
  await resetServer();
  const sa = await superAdminToken();
  await call(sa, { action: "createGame", gameId: G, name: "QR-Test", template: "linz", adminPassword: "admin1234" });
  api = await join(G, "admin", "Vorab", "admin1234");
  await call(api.token, { action: "setSecret", gameId: G, kind: "schiriCode", value: "pfeife" });
  vite = await startApp(PORT);
  browser = await chromium.launch();
  camBrowser = await chromium.launch({
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${qrVideo(`https://mister-x.mr-x-ooe.workers.dev/#/staff/schiri?g=${G}`)}`,
    ],
  });
}, 120_000);

afterAll(async () => {
  await camBrowser?.close();
  await browser?.close();
  await vite?.close();
});

const shot = async (page: Page, name: string) => {
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}.png` });
};
/** Druckbild als A4-PDF ablegen (nur mit SHOTS, zum Anschauen) */
const pdf = async (page: Page, name: string) => {
  if (process.env.SHOTS)
    await page.pdf({
      path: `${process.env.SHOTS}/${name}.pdf`,
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
};
const phone = async (b: Browser) => {
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 },
    locale: "de-AT",
    reducedMotion: "reduce",
    permissions: ["camera"],
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("PAGEERROR", e.message));
  return page;
};

describe("QR-Codes und Druckblätter", { timeout: 60_000 }, () => {
  it("Schiri scannt den Schiri-QR-Code: Spiel-Code ist ausgefüllt, Name und Code tippt man selbst", async () => {
    const p = await phone(camBrowser);
    await p.goto(URL);
    await p.getByRole("button", { name: T.qr.knopf }).waitFor();
    await shot(p, "start");
    await p.getByRole("button", { name: T.qr.knopf }).click();
    // Scanner liest das Kamerabild und öffnet die Schiri-Anmeldung mit dem Spiel-Code
    await expect
      .poll(
        () =>
          p
            .getByLabel(T.beitritt.spielCode)
            .inputValue()
            .catch(() => ""),
        { timeout: 20_000 },
      )
      .toBe(G);
    await shot(p, "schiri-qr");
    await p.getByLabel(T.staffLogin.name).fill("Anna");
    await p.getByLabel(T.staffLogin.schiriCode).fill("pfeife");
    await p.getByRole("button", { name: T.staffLogin.los, exact: true }).click();
    await p.getByRole("heading", { name: T.lobby.angemeldet }).waitFor();
  });

  it("Spielleitung druckt die drei Blätter: Passwort drauf, aber nirgends gespeichert", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: "de-AT", reducedMotion: "reduce" });
    const a = await ctx.newPage();
    // Drucken abfangen: festhalten, was auf dem Blatt steht
    await a.addInitScript(() => {
      const w = window as unknown as { printed: string[] };
      w.printed = [];
      window.print = () => void w.printed.push(document.querySelector(".sheet")?.textContent ?? "");
    });
    const printed = () => a.evaluate(() => (window as unknown as { printed: string[] }).printed);
    await a.goto(`${URL}#/staff/admin?g=${G}`);
    await a.getByLabel(T.staffLogin.name).fill("Peter");
    await a.getByLabel(T.staffLogin.adminPasswort).fill("admin1234");
    await a.getByRole("button", { name: T.staffLogin.los, exact: true }).click();
    await a.getByText(T.admin.startMrx).waitFor();
    await a.getByRole("link", { name: T.admin.nav.teams }).click();
    await a.getByRole("tab", { name: T.admin.zugaenge }).click();
    // Team-Passwort festlegen → wird gleich mitgedruckt
    const team = a.locator(".card", { hasText: T.admin.teamPasswort }).first();
    await team.getByLabel(T.admin.passwortNeu).fill("falke27");
    await team.getByRole("button", { name: T.allgemein.speichern }).click();
    await a.getByText(T.druck.bekannt).waitFor();
    await a.getByLabel(T.druck.telefon).fill("0664 123 45 67");
    const sheetRow = (role: "team" | "schiri" | "admin") => a.locator(".sheets li", { hasText: T.druck.blatt[role] });
    await sheetRow("team").getByRole("button", { name: T.druck.drucken }).click();
    await expect.poll(async () => (await printed()).length).toBe(1);
    await pdf(a, "blatt-team");
    let txt = (await printed())[0]!;
    for (const x of ["falke27", G, "0664 123 45 67", T.druck.rolle.team, T.druck.schritte.team[2]!.titel]) expect(txt).toContain(x);
    // Schiri-Code nicht bekannt → eintippen; falscher wird abgelehnt
    await sheetRow("schiri").getByRole("button", { name: T.druck.drucken }).click();
    const dlg = a.getByRole("dialog");
    await dlg.getByLabel(T.druck.geheim.schiri).fill("pfeiffe");
    await dlg.getByRole("button", { name: T.druck.drucken, exact: true }).click();
    await dlg.getByText(T.druck.falsch).waitFor();
    await dlg.getByLabel(T.druck.geheim.schiri).fill("pfeife");
    await dlg.getByRole("button", { name: T.druck.drucken, exact: true }).click();
    await expect.poll(async () => (await printed()).length).toBe(2);
    await pdf(a, "blatt-schiri");
    txt = (await printed())[1]!;
    for (const x of ["pfeife", G, T.druck.rolle.schiri, T.druck.schritte.schiri[4]!.titel]) expect(txt).toContain(x);
    // Spielleitung: Admin-Passwort eintippen
    await sheetRow("admin").getByRole("button", { name: T.druck.drucken }).click();
    await dlg.getByLabel(T.druck.geheim.admin).fill("admin1234");
    await dlg.getByRole("button", { name: T.druck.drucken, exact: true }).click();
    await expect.poll(async () => (await printed()).length).toBe(3);
    await pdf(a, "blatt-spielleitung");
    txt = (await printed())[2]!;
    for (const x of ["admin1234", T.druck.rolle.admin, T.druck.fuss.admin]) expect(txt).toContain(x);
    await a.emulateMedia({ media: "print" });
    await shot(a, "blatt-admin");
    await a.emulateMedia({ media: "screen" });
    // nichts davon im Browser-Speicher
    const stored = await a.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    for (const x of ["falke27", "pfeife", "admin1234"]) expect(stored).not.toContain(x);
  });

  it("Team kommt über den QR-Link: Spiel ist ausgefüllt, Passwort tippt es selbst", async () => {
    const p = await phone(browser);
    await p.goto(`${URL}#/beitreten/${G}`);
    await p.getByText("QR-Test").first().waitFor();
    await p.getByLabel(T.beitritt.teamname).fill("Urfahr");
    await p.getByLabel(T.beitritt.passwort).fill("falke27");
    await p.getByRole("button", { name: T.beitritt.los, exact: true }).click();
    await p.getByRole("button", { name: T.onboarding.ueberspringen, exact: true }).click();
    await p.getByRole("heading", { name: T.lobby.angemeldet }).waitFor();
  });
});
