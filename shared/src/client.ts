// Live-Verbindung zum Spielraum für App und Tests (docs/API.md): verbinden, bei Abbruch mit wachsender Pause neu
// verbinden, Snapshot + Änderungen zu einer lokalen Sicht zusammenführen, eigenen Standort senden (offline: nur der
// neueste wartet). Ohne Framework – die App hängt ihre Svelte-Zustände an `onView`.
import { applyPatch, PROTOCOL_VERSION, type ClientMsg, type Note, type PositionIn, type ServerMsg, type View, type ViewKey } from "./protocol.ts";

export type ByeReason = "removed" | "session" | "version";

export interface LiveOptions {
  /** z. B. wss://mister-x.example.workers.dev/ws */
  url: string;
  token: string;
  onView(view: View, changed: ViewKey[] | "all"): void;
  onNote?(n: Note): void;
  /** Gerät entfernt, Sitzung ungültig, neue App-Version → nicht mehr verbinden */
  onBye?(reason: ByeReason): void;
  onStatus?(online: boolean): void;
  /** öffentlicher Web-Push-Schlüssel (kommt mit dem Snapshot) */
  onVapid?(key: string): void;
}

const HEARTBEAT_MS = 25_000;
const PONG_WAIT_MS = 10_000;

export class Live {
  view: View | null = null;
  /** Server-Zeit minus Handy-Zeit (Countdowns rechnen mit Server-Zeit) */
  offset = 0;
  online = false;
  #ws: WebSocket | null = null;
  #seq = 0;
  #tries = 0;
  #closed = false;
  #pending: PositionIn | null = null;
  #visible = true;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #beat: ReturnType<typeof setInterval> | undefined;
  #pong: ReturnType<typeof setTimeout> | undefined;

  constructor(readonly o: LiveOptions) {
    this.#connect();
  }

  #connect() {
    if (this.#closed) return;
    const url = `${this.o.url}${this.o.url.includes("?") ? "&" : "?"}v=${PROTOCOL_VERSION}`;
    // Token im Unterprotokoll statt in der Adresse – landet so nicht in Logs
    const ws = new WebSocket(url, ["mrx", this.o.token]);
    this.#ws = ws;
    ws.onopen = () => {
      this.#tries = 0;
      this.#send({ t: "vis", on: this.#visible });
      if (this.#pending) this.sendPos(this.#pending);
      clearInterval(this.#beat);
      this.#beat = setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN) return;
        ws.send("ping");
        clearTimeout(this.#pong);
        this.#pong = setTimeout(() => ws.close(), PONG_WAIT_MS); // keine Antwort → Verbindung ist tot
      }, HEARTBEAT_MS);
    };
    ws.onmessage = (e) => {
      if (e.data === "pong") return clearTimeout(this.#pong);
      this.#onMessage(JSON.parse(String(e.data)) as ServerMsg);
    };
    ws.onclose = () => {
      if (this.#ws !== ws) return;
      clearInterval(this.#beat);
      clearTimeout(this.#pong);
      this.#setOnline(false);
      if (this.#closed) return;
      // 1, 2, 4, 8, 15 s (+ Zufall, damit nicht alle Handys gleichzeitig kommen)
      const wait = Math.min(15_000, 1000 * 2 ** this.#tries++) * (0.75 + Math.random() / 2);
      this.#timer = setTimeout(() => this.#connect(), wait);
    };
    ws.onerror = () => ws.close();
  }

  #onMessage(m: ServerMsg) {
    if (m.t === "bye") {
      this.close();
      this.o.onBye?.(m.reason);
      return;
    }
    this.offset = m.now - Date.now();
    if (m.t === "snap") {
      this.#seq = m.seq;
      this.view = m.view;
      if (m.vapid) this.o.onVapid?.(m.vapid);
      this.#setOnline(true);
      this.o.onView(m.view, "all");
      return;
    }
    // Lücke (sollte auf einer Verbindung nie passieren) → ganz neu holen
    if (m.seq !== this.#seq + 1 || !this.view) return this.#send({ t: "resync" });
    this.#seq = m.seq;
    if (m.t === "note") return this.o.onNote?.(m.n);
    const changed = new Set<ViewKey>();
    for (const p of m.p) {
      applyPatch(this.view as unknown as Record<string, unknown>, p);
      changed.add(p[0]);
    }
    this.o.onView(this.view, [...changed]);
  }

  #setOnline(on: boolean) {
    if (this.online === on) return;
    this.online = on;
    this.o.onStatus?.(on);
  }

  #send(m: ClientMsg): boolean {
    if (this.#ws?.readyState !== WebSocket.OPEN) return false;
    this.#ws.send(JSON.stringify(m));
    return true;
  }

  /** eigenen Standort senden; ohne Verbindung wartet nur der neueste und geht beim Wiederverbinden raus */
  sendPos(p: PositionIn) {
    this.#pending = this.#send({ t: "pos", p }) ? null : p;
  }

  /** App sichtbar/unsichtbar → Server schickt nur unsichtbaren Geräten einen Push */
  setVisible(on: boolean) {
    this.#visible = on;
    this.#send({ t: "vis", on });
  }

  close() {
    this.#closed = true;
    clearTimeout(this.#timer);
    clearInterval(this.#beat);
    clearTimeout(this.#pong);
    this.#ws?.close();
    this.#setOnline(false);
  }
}
