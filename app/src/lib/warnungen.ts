// Warnungen für die Spielleitung (Live-Übersicht und Hinweis bei neuen Warnungen): Mister X ohne Standort oder an der
// Grenze, Teams ohne Standort (Funkstille), fast leerer Akku, Teams im Sperrgebiet oder außerhalb.
import { distanceToBoundaryM, lockedCutAt, zoneStatus } from "@mrx/shared";
import { isOffline, type StaffView } from "./staff.ts";
import { T } from "../texte.ts";

export const AKKU_WARN = 15;

export interface Warnung {
  /** gleichbleibende Kennung (für „neu dazugekommen“) */
  key: string;
  tone: "warn" | "danger";
  text: string;
}

const minSince = (t: number, now: number) => Math.floor((now - t) / 60_000);

export function warnungen(v: StaffView, now: number): Warnung[] {
  const out: Warnung[] = [];
  const st = v.state;
  if (st.phase !== "laeuft" && st.phase !== "pause") return out;
  const locked = Object.keys(st.cuts ?? {});
  const name = (id: string) => v.teams[id]?.name ?? "?";
  const mrxPos = st.mrx ? v.positions[st.mrx] : undefined;
  if (st.mrx && (!mrxPos || isOffline(mrxPos, now)))
    out.push({ key: `mrx-off`, tone: "danger", text: T.admin.mrxOhneStandort(mrxPos ? minSince(mrxPos.t, now) : 0) });
  if (mrxPos && !isOffline(mrxPos, now)) {
    const z = zoneStatus(mrxPos, v.field, locked);
    if (z === "draussen") {
      const cut = lockedCutAt(mrxPos, v.field, locked);
      out.push({
        key: "mrx-draussen",
        tone: "danger",
        text: cut ? T.admin.mrxImSperrgebiet(v.field.cuts[cut]?.short ?? cut) : T.admin.mrxDraussen,
      });
    } else if (z === "grenze")
      out.push({ key: "mrx-grenze", tone: "warn", text: T.admin.mrxGrenze(Math.round(distanceToBoundaryM(mrxPos, v.field, locked))) });
  }
  // selbst gemeldeter Fang mit unpassenden Standorten (30 Min lang, bis rückgängig gemacht)
  for (const h of v.handovers)
    if (h.pruefen && !h.undoneAt && now - h.at < 30 * 60_000)
      out.push({ key: `pruefen-${h.id}`, tone: "danger", text: T.admin.uebergabePruefen(name(h.from ?? ""), name(h.to), h.pruefen.distM) });
  for (const id of Object.keys(v.teams)) {
    const p = v.positions[id];
    if (id !== st.mrx && isOffline(p, now))
      out.push({
        key: `off-${id}`,
        tone: "warn",
        text: p ? T.admin.teamOhneStandort(name(id), minSince(p.t, now)) : T.admin.teamNieStandort(name(id)),
      });
    if (p && p.battery !== undefined && p.battery < AKKU_WARN)
      out.push({ key: `akku-${id}`, tone: "warn", text: T.admin.akkuLeer(name(id), p.battery) });
    if (p && id !== st.mrx && !isOffline(p, now) && zoneStatus(p, v.field, locked) === "draussen") {
      const cut = lockedCutAt(p, v.field, locked);
      out.push({
        key: `zone-${id}`,
        tone: "danger",
        text: cut ? T.admin.teamImSperrgebiet(name(id), v.field.cuts[cut]?.short ?? cut) : T.admin.teamDraussen(name(id)),
      });
    }
  }
  return out;
}
