// Zentrale (E-33): Organisator-Zugang. Einmal mit dem Setup-Geheimnis (Wrangler-Secret) ein Passwort festlegen – das
// Geheimnis setzt es auch zurück, falls es vergessen wird. Danach Anmeldung mit Passwort. Ein neues Passwort macht alle
// alten Organisator-Sitzungen ungültig (Version im Token).
// Organisator-Konten (E-84): E-Mail + Passwort, erstellt mit einem Gratis-Code des Eigentümers. Konten und Codes liegen
// hier – ein einziges Objekt, darum kann ein Code nie öfter eingelöst werden als erlaubt.
import { DurableObject } from "cloudflare:workers";
import {
  CODE_MONATE,
  type ApiReply,
  type ApiResults,
  type CodeEntry,
  type CodeMonate,
  type KontoInfo,
  type KontoListEntry,
  type KontoRolle,
} from "@mrx/shared";
import { hashKey, hashSecret, randomId, sameText, sign, verifySecret } from "./auth.ts";
import { ensureSchema } from "./d1.ts";
import type { Auth } from "./room.ts";
import { DAY, fail, reply, type Env } from "./util.ts";

const SESSION_MS = 7 * DAY;
const WINDOW_MS = 10 * 60_000;
const MAX_FAILS = 5;
const MIN_PW = 10;

interface Super {
  hash: string;
  version: number;
}

interface Konto {
  email: string;
  hash: string;
  rolle: KontoRolle;
  bisAt: number | null;
  gesperrt: boolean;
  /** steigt bei neuem Passwort, Sperre, Löschung – ältere Sitzungen sind ungültig */
  version: number;
  codes: string[];
  createdAt: number;
}

interface Code {
  max: number;
  benutzt: number;
  monate: CodeMonate;
  aktiv: boolean;
  createdAt: number;
}

/** was who() pro Anfrage über ein Konto wissen muss */
export interface KontoStand {
  version: number;
  rolle: KontoRolle;
  bisAt: number | null;
  gesperrt: boolean;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_CODE = 1000;
/** ohne 0/O/1/I – lassen sich nicht verwechseln */
const ZEICHEN = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
/** Code wie eingetippt → Schlüssel (Groß/klein, Bindestriche und Leerzeichen egal) */
const codeKey = (x: unknown) =>
  typeof x === "string"
    ? x
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 20)
    : "";
const codeText = (k: string) => `${k.slice(0, 3)}-${k.slice(3, 7)}-${k.slice(7)}`;
// 256 ist durch 32 teilbar – jedes Zeichen gleich wahrscheinlich
const neuerCode = () => "MRX" + [...crypto.getRandomValues(new Uint8Array(8))].map((b) => ZEICHEN[b % 32]).join("");

function email(x: unknown): string {
  const e = typeof x === "string" ? x.trim().toLowerCase() : "";
  if (e.length > 254 || !EMAIL.test(e)) fail("invalid", "E-Mail-Adresse ungültig");
  return e;
}
function passwort(x: unknown): string {
  if (typeof x !== "string" || x.length < MIN_PW || x.length > 128) fail("invalid", `Passwort: mindestens ${MIN_PW} Zeichen`);
  return x;
}
/** neues Ablaufdatum nach Einlösen eines Codes: ab heute bzw. ab dem bisherigen Ende, falls das später ist */
export function verlaengert(bisAt: number | null | undefined, monate: CodeMonate, now: number): number | null {
  if (monate === 0 || bisAt === null) return null;
  const d = new Date(Math.max(now, bisAt ?? now));
  d.setUTCMonth(d.getUTCMonth() + monate);
  return d.getTime();
}
const info = (id: string, k: Konto): KontoInfo => ({
  id,
  email: k.email,
  rolle: k.rolle,
  bisAt: k.bisAt,
  gesperrt: k.gesperrt,
  codes: k.codes.map(codeText),
  createdAt: k.createdAt,
});

export class Zentrale extends DurableObject<Env> {
  async #tooMany(ip: string): Promise<{ key: string; hit: () => Promise<void> }> {
    const key = `fail:${await hashKey(ip)}`;
    const now = Date.now();
    // Datensparsamkeit: Prüfsummen von IP-Adressen nur so lange aufheben wie die Sperre (10 Min)
    const old = await this.ctx.storage.list<{ since: number }>({ prefix: "fail:" });
    const gone = [...old].filter(([, v]) => now - v.since >= WINDOW_MS).map(([k]) => k);
    if (gone.length) await this.ctx.storage.delete(gone);
    const cur = gone.includes(key) ? undefined : await this.ctx.storage.get<{ n: number; since: number }>(key);
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

  // ---------- Organisator-Konten (E-84) ----------

  #kontoToken(id: string, k: Konto) {
    return sign(this.env.TOKEN_SECRET, { k: id, v: k.version, e: Date.now() + SESSION_MS });
  }

  /** für who(): Stand des Kontos (null = gibt es nicht) */
  async stand(id: string): Promise<KontoStand | null> {
    const k = await this.ctx.storage.get<Konto>(`konto:${id}`);
    return k ? { version: k.version, rolle: k.rolle, bisAt: k.bisAt, gesperrt: k.gesperrt } : null;
  }

  /** gleich lange Prüfung, auch wenn es die E-Mail nicht gibt – sonst verrät die Antwortzeit, welche Konten es gibt */
  #attrappe: Promise<string> | null = null;

  /** Konto-Aktionen (shared/api.ts) – `a` kommt aus who() im Worker */
  konto(d: Record<string, unknown>, a: Auth, ip: string): Promise<ApiReply> {
    return reply(async (): Promise<unknown> => {
      const st = this.ctx.storage;
      const now = Date.now();
      const eigentuemer = () => {
        if (!a.superAdmin) fail(a.badToken ? "session" : "forbidden", "Nur für den Eigentümer");
      };
      const meins = async () => {
        const k = a.konto ? await st.get<Konto>(`konto:${a.konto}`) : undefined;
        if (!a.konto || !k) fail(a.badToken ? "session" : "unauthenticated", "Bitte mit dem Konto anmelden");
        return [a.konto, k] as const;
      };
      const code = async () => {
        const key = codeKey(d.code);
        const c = key ? await st.get<Code>(`code:${key}`) : undefined;
        return c?.aktiv && c.benutzt < c.max ? ([key, c] as const) : null;
      };
      const anlegen = async (rolle: KontoRolle) => {
        const e = email(d.email);
        return { e, hash: await hashSecret(passwort(d.passwort)), rolle };
      };

      switch (d.action) {
        case "kontoErstellen": {
          const limit = await this.#tooMany(ip);
          const n = await anlegen("organisator");
          // ab hier nur Speicherzugriffe: der Spielraum-Lock (input gate) lässt dazwischen nichts anderes laufen
          const c = await code();
          if (!c) {
            await limit.hit();
            fail("badCode", "Code ungültig, gesperrt oder aufgebraucht");
          }
          if (await st.get(`email:${n.e}`)) fail("emailTaken", "Für diese E-Mail gibt es schon ein Konto");
          const [key, cd] = c;
          const id = randomId(9);
          const k: Konto = {
            email: n.e,
            hash: n.hash,
            rolle: n.rolle,
            bisAt: verlaengert(undefined, cd.monate, now),
            gesperrt: false,
            version: 1,
            codes: [key],
            createdAt: now,
          };
          await st.put({ [`konto:${id}`]: k, [`email:${n.e}`]: id, [`code:${key}`]: { ...cd, benutzt: cd.benutzt + 1 } });
          await st.delete(limit.key);
          return { token: await this.#kontoToken(id, k) } satisfies ApiResults["kontoErstellen"];
        }
        case "kontoLogin": {
          const limit = await this.#tooMany(ip);
          const e = typeof d.email === "string" ? d.email.trim().toLowerCase() : "";
          const id = await st.get<string>(`email:${e}`);
          const k = id ? await st.get<Konto>(`konto:${id}`) : undefined;
          const pw = typeof d.passwort === "string" ? d.passwort : "";
          const ok = await verifySecret(pw, k?.hash ?? (await (this.#attrappe ??= hashSecret(randomId()))));
          if (!id || !k || !ok) {
            await limit.hit();
            fail("wrongSecret", "E-Mail oder Passwort falsch");
          }
          await st.delete(limit.key);
          if (k.gesperrt) fail("forbidden", "Dieses Konto ist gesperrt");
          return { token: await this.#kontoToken(id, k) } satisfies ApiResults["kontoLogin"];
        }
        case "kontoInfo": {
          if (!a.konto && a.superAdmin) return { konto: null, eigentuemer: true } satisfies ApiResults["kontoInfo"];
          const [id, k] = await meins();
          return { konto: info(id, k), eigentuemer: k.rolle === "eigentuemer" } satisfies ApiResults["kontoInfo"];
        }
        case "kontoPasswort": {
          const [id, k] = await meins();
          const limit = await this.#tooMany(ip);
          if (typeof d.alt !== "string" || !(await verifySecret(d.alt, k.hash))) {
            await limit.hit();
            fail("wrongSecret", "Bisheriges Passwort falsch");
          }
          const neu: Konto = { ...k, hash: await hashSecret(passwort(d.neu)), version: k.version + 1 };
          await st.put(`konto:${id}`, neu);
          return { token: await this.#kontoToken(id, neu) } satisfies ApiResults["kontoPasswort"];
        }
        case "codeEinloesen": {
          await meins();
          const limit = await this.#tooMany(ip);
          const c = await code();
          // neu lesen: zwischen meins() und hier könnte das Konto geändert worden sein
          const k = await st.get<Konto>(`konto:${a.konto}`);
          if (!c || !k || k.codes.includes(c[0])) {
            await limit.hit();
            fail("badCode", "Code ungültig, gesperrt, aufgebraucht oder schon eingelöst");
          }
          const [key, cd] = c;
          const neu: Konto = { ...k, bisAt: verlaengert(k.bisAt, cd.monate, now), codes: [...k.codes, key] };
          await st.put({ [`konto:${a.konto}`]: neu, [`code:${key}`]: { ...cd, benutzt: cd.benutzt + 1 } });
          await st.delete(limit.key);
          return { bisAt: neu.bisAt } satisfies ApiResults["codeEinloesen"];
        }

        // ---------- nur Eigentümer ----------
        case "codeErstellen": {
          eigentuemer();
          const max = d.max;
          if (typeof max !== "number" || !Number.isInteger(max) || max < 1 || max > MAX_CODE) fail("invalid", `Anzahl: 1–${MAX_CODE}`);
          if (!CODE_MONATE.includes(d.monate as CodeMonate)) fail("invalid", "Laufzeit ungültig");
          let key = neuerCode();
          while (await st.get(`code:${key}`)) key = neuerCode();
          await st.put(`code:${key}`, { max, benutzt: 0, monate: d.monate as CodeMonate, aktiv: true, createdAt: now } satisfies Code);
          return { code: codeText(key) } satisfies ApiResults["codeErstellen"];
        }
        case "codeListe": {
          eigentuemer();
          const codes: CodeEntry[] = [...(await st.list<Code>({ prefix: "code:" }))].map(([k, c]) => ({
            code: codeText(k.slice(5)),
            ...c,
          }));
          return { codes: codes.sort((x, y) => y.createdAt - x.createdAt) } satisfies ApiResults["codeListe"];
        }
        case "codeSperren": {
          eigentuemer();
          const key = codeKey(d.code);
          const c = key ? await st.get<Code>(`code:${key}`) : undefined;
          if (!c) fail("notFound", "Code nicht gefunden");
          await st.put(`code:${key}`, { ...c, aktiv: d.aktiv === true });
          return {} satisfies ApiResults["codeSperren"];
        }
        case "kontoListe": {
          eigentuemer();
          await ensureSchema(this.env.DB);
          const n = await this.env.DB.prepare("SELECT konto, COUNT(*) AS n FROM games WHERE konto IS NOT NULL GROUP BY konto").all<{
            konto: string;
            n: number;
          }>();
          const spiele = new Map(n.results.map((r) => [r.konto, r.n]));
          const konten: KontoListEntry[] = [...(await st.list<Konto>({ prefix: "konto:" }))].map(([key, k]) => ({
            ...info(key.slice(6), k),
            spiele: spiele.get(key.slice(6)) ?? 0,
          }));
          return { konten: konten.sort((x, y) => y.createdAt - x.createdAt) } satisfies ApiResults["kontoListe"];
        }
        case "kontoSetzen": {
          eigentuemer();
          const id = String(d.id ?? "");
          const pw = d.passwort === undefined ? undefined : await hashSecret(passwort(d.passwort));
          const k = await st.get<Konto>(`konto:${id}`);
          if (!k) fail("notFound", "Konto nicht gefunden");
          const gesperrt = typeof d.gesperrt === "boolean" ? d.gesperrt : k.gesperrt;
          await st.put(`konto:${id}`, { ...k, ...(pw ? { hash: pw } : {}), gesperrt, version: k.version + 1 } satisfies Konto);
          return {} satisfies ApiResults["kontoSetzen"];
        }
        case "kontoLoeschen": {
          eigentuemer();
          const id = String(d.id ?? "");
          const k = await st.get<Konto>(`konto:${id}`);
          if (!k) return {} satisfies ApiResults["kontoLoeschen"];
          await st.delete([`konto:${id}`, `email:${k.email}`]);
          // Spiele und Vorlagen bleiben – sie gehören jetzt dem Eigentümer
          await ensureSchema(this.env.DB);
          await this.env.DB.batch([
            this.env.DB.prepare("UPDATE games SET konto = NULL WHERE konto = ?1").bind(id),
            this.env.DB.prepare("UPDATE templates SET konto = NULL WHERE konto = ?1").bind(id),
          ]);
          return {} satisfies ApiResults["kontoLoeschen"];
        }
        case "eigentuemerAnlegen": {
          eigentuemer();
          const n = await anlegen("eigentuemer");
          if (await st.get(`email:${n.e}`)) fail("emailTaken", "Für diese E-Mail gibt es schon ein Konto");
          const id = randomId(9);
          await st.put({
            [`konto:${id}`]: {
              email: n.e,
              hash: n.hash,
              rolle: n.rolle,
              bisAt: null,
              gesperrt: false,
              version: 1,
              codes: [],
              createdAt: now,
            } satisfies Konto,
            [`email:${n.e}`]: id,
          });
          return { id } satisfies ApiResults["eigentuemerAnlegen"];
        }
      }
      fail("invalid", "Unbekannte Aktion");
    });
  }

  /** nur Tests: Konto ändern (z. B. abgelaufen) → id */
  async testKonto(email: string, patch: Partial<Konto>) {
    if (!this.env.TEST_HOOKS) throw new Error("nur in Tests");
    const id = await this.ctx.storage.get<string>(`email:${email}`);
    const k = id ? await this.ctx.storage.get<Konto>(`konto:${id}`) : undefined;
    if (k) await this.ctx.storage.put(`konto:${id}`, { ...k, ...patch });
    return id ?? null;
  }

  /** nur Tests */
  async reset() {
    if (!this.env.TEST_HOOKS) throw new Error("nur in Tests");
    await this.ctx.storage.deleteAll();
  }
}
