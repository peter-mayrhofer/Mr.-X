// Zentrale (E-33): Organisator-Zugang. Einmal mit dem Setup-Geheimnis (Wrangler-Secret) ein Passwort festlegen – das
// Geheimnis setzt es auch zurück, falls es vergessen wird. Danach Anmeldung mit Passwort. Ein neues Passwort macht alle
// alten Organisator-Sitzungen ungültig (Version im Token).
import { DurableObject } from "cloudflare:workers";
import type { ApiReply } from "@mrx/shared";
import { hashKey, hashSecret, sameText, sign, verifySecret } from "./auth.ts";
import { DAY, fail, reply, type Env } from "./util.ts";

const SESSION_MS = 7 * DAY;
const WINDOW_MS = 10 * 60_000;
const MAX_FAILS = 5;
const MIN_PW = 10;

interface Super {
  hash: string;
  version: number;
}

export class Zentrale extends DurableObject<Env> {
  async #tooMany(ip: string): Promise<{ key: string; hit: () => Promise<void> }> {
    const key = `fail:${await hashKey(ip)}`;
    const now = Date.now();
    const cur = await this.ctx.storage.get<{ n: number; since: number }>(key);
    if (cur && now - cur.since < WINDOW_MS && cur.n >= MAX_FAILS) fail("tooMany", "Zu viele Versuche – bitte 10 Minuten warten");
    return {
      key,
      hit: () =>
        this.ctx.storage.put(key, !cur || now - cur.since >= WINDOW_MS ? { n: 1, since: now } : { n: cur.n + 1, since: cur.since }),
    };
  }

  async #token(version: number) {
    return { token: await sign(this.env.TOKEN_SECRET, { s: version, e: Date.now() + SESSION_MS }) };
  }

  /** Passwort festlegen (oder zurücksetzen) mit dem Setup-Geheimnis */
  setup(setupSecret: unknown, password: unknown, ip: string): Promise<ApiReply<{ token: string }>> {
    return reply(async () => {
      if (!this.env.SETUP_SECRET) fail("forbidden", "Setup-Geheimnis ist am Server nicht eingerichtet (docs/BETRIEB.md)");
      const limit = await this.#tooMany(ip);
      if (typeof setupSecret !== "string" || !sameText(setupSecret, this.env.SETUP_SECRET)) {
        await limit.hit();
        fail("wrongSecret", "Setup-Geheimnis falsch");
      }
      if (typeof password !== "string" || password.length < MIN_PW || password.length > 128)
        fail("invalid", `Passwort: mindestens ${MIN_PW} Zeichen`);
      const old = await this.ctx.storage.get<Super>("super");
      const s: Super = { hash: await hashSecret(password), version: (old?.version ?? 0) + 1 };
      await this.ctx.storage.put("super", s);
      await this.ctx.storage.delete(limit.key);
      return this.#token(s.version);
    });
  }

  login(password: unknown, ip: string): Promise<ApiReply<{ token: string }>> {
    return reply(async () => {
      const s = await this.ctx.storage.get<Super>("super");
      if (!s) fail("notFound", "Noch kein Organisator-Passwort – zuerst mit dem Setup-Geheimnis einrichten");
      const limit = await this.#tooMany(ip);
      if (typeof password !== "string" || !(await verifySecret(password, s.hash))) {
        await limit.hit();
        fail("wrongSecret", "Passwort falsch");
      }
      await this.ctx.storage.delete(limit.key);
      return this.#token(s.version);
    });
  }

  /** aktuelle Passwort-Version (null = noch nicht eingerichtet) – Token mit anderer Version sind ungültig */
  async version(): Promise<number | null> {
    return (await this.ctx.storage.get<Super>("super"))?.version ?? null;
  }

  /** nur Tests */
  async reset() {
    if (!this.env.TEST_HOOKS) throw new Error("nur in Tests");
    await this.ctx.storage.deleteAll();
  }
}
