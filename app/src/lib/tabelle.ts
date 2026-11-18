// Tabelle pro Team zum Herunterladen (E-76, nur Spielleitung): CSV mit Strichpunkt und BOM – öffnet sich so direkt in
// Excel (auch mit Umlauten). Ganze Zahlen (Meter, Minuten), damit Komma oder Punkt als Dezimalzeichen egal ist.
import { teamTabelle, type ArchiveData } from "@mrx/shared";
import { herunterladen } from "./native.ts";
import { T } from "../texte.ts";

export function teamTabelleCsv(a: Pick<ArchiveData, "teams" | "results" | "handovers">): string {
  const S = T.tabelle;
  const min = (ms: number) => Math.round(ms / 60_000);
  const rows: (string | number)[][] = [
    [S.team, S.groesse, S.strecke, S.wieOft, S.zeit, S.amStueck, S.faenge, S.gefangen, S.strafen, S.sieger],
    ...teamTabelle({ teams: a.teams, results: a.results, handovers: Object.values(a.handovers) }).map((z) => [
      z.name,
      z.size ?? "",
      z.distM ?? "",
      z.mrxCount,
      min(z.mrxMs),
      min(z.mrxLaengsteMs),
      z.faenge,
      z.gefangen,
      z.strafen,
      z.sieger ? S.ja : "",
    ]),
  ];
  return rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(";")).join("\r\n");
}

export function tabelleHerunterladen(a: Pick<ArchiveData, "teams" | "results" | "handovers" | "name" | "startedAt">) {
  const datei = `${a.name.replace(/[^\wäöüÄÖÜß-]+/g, "-")}-${new Date(a.startedAt).toISOString().slice(0, 10)}-teams.csv`;
  void herunterladen(new Blob(["﻿" + teamTabelleCsv(a)], { type: "text/csv" }), datei);
}
