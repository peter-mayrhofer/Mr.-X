// QR-Codes scannen: welche Inhalte führen wohin in der App
import { describe, expect, it } from "vitest";
import { routeFromQr } from "../src/index.ts";

describe("gescannte QR-Codes", () => {
  it("Mister-X-Links von jeder Adresse → Seite in der App (mit Zugangs-Schlüssel)", () => {
    expect(routeFromQr("https://mister-x.mr-x-ooe.workers.dev/#/beitreten/linz-2027?k=abc123")).toBe("/beitreten/linz-2027?k=abc123");
    expect(routeFromQr("https://localhost/#/staff/schiri?g=linz-2027&k=Xy_9")).toBe("/staff/schiri?g=linz-2027&k=Xy_9");
    expect(routeFromQr("http://192.168.0.5:5173/#/staff/admin?g=linz-2027&k=q")).toBe("/staff/admin?g=linz-2027&k=q");
    expect(routeFromQr("https://example.at/#/s/linz-2027")).toBe("/s/linz-2027");
    expect(routeFromQr("https://example.at/#/g/linz-2027?k=k1")).toBe("/g/linz-2027?k=k1");
  });
  it("reiner Spiel-Code → Startseite des Spiels", () => {
    expect(routeFromQr(" Linz-2027 ")).toBe("/s/linz-2027");
  });
  it("fremde oder kaputte Codes → nichts", () => {
    expect(routeFromQr("https://evil.example/login")).toBeNull();
    expect(routeFromQr("https://x.at/#/verwaltung")).toBeNull();
    expect(routeFromQr("https://x.at/#/beitreten/linz<script>")).toBeNull();
    expect(routeFromQr("WIFI:S:Netz;T:WPA;P:geheim;;")).toBeNull();
    expect(routeFromQr("")).toBeNull();
  });
});
