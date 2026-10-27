// Push senden (Abschnitt 7.6) über Firebase Cloud Messaging. Ein Push ist eine Zugabe: schlägt er fehl, läuft das Spiel
// trotzdem weiter. Im Emulator gibt es kein FCM – dort landet jede Benachrichtigung im Postausgang pushOutbox/{g}
// (nur für Tests lesbar), damit die Auswahl der Empfänger geprüft werden kann.
import { getMessaging } from "firebase-admin/messaging";
import { logger } from "firebase-functions";
import { pushTargets, type Member, type PushKind, type PushReg, type PushTarget } from "@mrx/shared";
import { APP_URL } from "./env.ts";
import { db, val } from "./util.ts";

const DEAD = /registration-token-not-registered|invalid-registration-token|invalid-argument/;

export async function notify(g: string, kind: PushKind, target: PushTarget, title: string, body: string): Promise<void> {
  try {
    const [regs, members] = await Promise.all([
      val<Record<string, PushReg>>(`games/${g}/push`),
      val<Record<string, Member>>(`games/${g}/members`),
    ]);
    const to = pushTargets(regs ?? {}, members ?? {}, target, kind);
    if (!to.length) return;
    const data = { title, body, kind, tag: kind, link: `${APP_URL.value()}#/spiel` };
    if (process.env.FUNCTIONS_EMULATOR === "true") {
      await db()
        .ref(`pushOutbox/${g}`)
        .push({ ...data, to: to.map((x) => x.uid), t: Date.now() });
      return;
    }
    // Web: nur Daten – der eigene Service Worker (app/public/sw.js) zeigt sie an. Android: mit Benachrichtigung,
    // damit sie auch bei geschlossener App erscheint. Veraltete Meldungen (> 10 Min) verfallen.
    const web = to.filter((x) => x.platform === "web");
    const android = to.filter((x) => x.platform === "android");
    const m = getMessaging();
    const sent = await Promise.all([
      web.length
        ? m.sendEachForMulticast({ tokens: web.map((x) => x.token), data, webpush: { headers: { Urgency: "high", TTL: "600" } } })
        : null,
      android.length
        ? m.sendEachForMulticast({
            tokens: android.map((x) => x.token),
            data,
            notification: { title, body },
            android: { priority: "high", ttl: 600_000, notification: { tag: kind, channelId: "spiel" } },
          })
        : null,
    ]);
    const dead = [web, android].flatMap((list, k) =>
      list.filter((_, i) => {
        const r = sent[k]?.responses[i];
        return r && !r.success && DEAD.test(r.error?.code ?? "");
      }),
    );
    if (dead.length)
      await db()
        .ref()
        .update(Object.fromEntries(dead.map((x) => [`games/${g}/push/${x.uid}`, null])));
  } catch (e) {
    logger.warn("Push fehlgeschlagen", e);
  }
}
