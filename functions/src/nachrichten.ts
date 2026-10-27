// Direktnachricht der Spielleitung an ein Team → Push an alle Geräte des Teams (Abschnitt 7.6).
// Die Nachricht selbst schreibt das Admin-Gerät direkt (Rules prüfen Absender, Länge, Tempo).
import { onValueCreated } from "firebase-functions/v2/database";
import { PUSH_TITLE, type ChatMessage } from "@mrx/shared";
import { DB_INSTANCE, REGION } from "./env.ts";
import { notify } from "./push.ts";

// Datenbank-Trigger müssen in der Region der Datenbank laufen; der Emulator löst sie nur in us-central1 aus
const region = process.env.FUNCTIONS_EMULATOR === "true" ? "us-central1" : REGION;

export const onDirectMessage = onValueCreated({ ref: "/games/{g}/dm/{t}/{id}", instance: DB_INSTANCE, region }, async (ev) => {
  const m = ev.data.val() as ChatMessage | null;
  // Nachrichten von Teams tragen ihre teamId – nur die der Spielleitung (ohne teamId) lösen einen Push aus
  if (!m || m.teamId) return;
  await notify(ev.params.g, "nachricht", { teams: [ev.params.t] }, PUSH_TITLE.nachricht, m.text);
});
