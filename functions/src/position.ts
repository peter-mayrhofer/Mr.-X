// Plausibilität und Strecke (KONZEPT Abschnitt 4 + 5, E-09): bei jedem neuen Team-Standort den letzten angenommenen Punkt
// (nur am Server, games/{g}/track/{t}) vergleichen. Gespeichert wird nur dieser eine Punkt – kein Bewegungsprofil.
import { ServerValue } from "firebase-admin/database";
import { onValueWritten } from "firebase-functions/v2/database";
import { stepCheck, type Position } from "@mrx/shared";
import { DB_INSTANCE, REGION } from "./env.ts";
import { db, val } from "./util.ts";

// Datenbank-Trigger müssen in der Region der Datenbank laufen (europe-west1); der Emulator löst sie nur in us-central1 aus
const region = process.env.FUNCTIONS_EMULATOR === "true" ? "us-central1" : REGION;

export const onPosition = onValueWritten({ ref: "/games/{g}/pos/{t}", instance: DB_INSTANCE, region }, async (ev) => {
  const next = ev.data.after.val() as Position | null;
  if (!next || next.suspect) return; // gelöscht oder unsere eigene Markierung
  const { g, t } = ev.params;
  if ((await val<string>(`games/${g}/state/phase`)) !== "laeuft") return;
  // ponytail: zwei Punkte desselben Teams fast gleichzeitig können sich hier überholen – bei 10–15 s Abstand egal
  const last = await val<Position>(`games/${g}/track/${t}`);
  const step = stepCheck(last, next);
  if (step.kind === "jump") {
    // GPS-Sprung: markieren (zählt weder für Strecke noch für Umkreis), aber nur, wenn inzwischen kein neuerer Punkt da ist
    await db()
      .ref(`games/${g}/pos/${t}`)
      .transaction((cur: Position | null) => (cur && cur.t === next.t ? { ...cur, suspect: true } : cur));
    return;
  }
  if (step.kind === "ignore" || step.kind === "noise") return;
  await db()
    .ref()
    .update({
      [`games/${g}/track/${t}`]: { lat: next.lat, lng: next.lng, acc: next.acc, t: next.t },
      ...(step.kind === "move" ? { [`games/${g}/stats/${t}/distM`]: ServerValue.increment(Math.round(step.distM)) } : {}),
    });
});
