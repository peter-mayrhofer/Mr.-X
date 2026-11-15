// Wiederholung als MP4-Video (E-72): eine unsichtbare Karte im Hoch- oder Querformat zeichnet Spielfeld, Sperren und
// Mister-X-Spur genau wie in der App; Teams, Fangorte und Kopfzeile kommen Bild für Bild darüber. Kodiert wird im
// Gerät (WebCodecs) – kein Server, keine Kosten. Ganzes Spiel = 40 Sekunden Video.
import { bounds, replayAt, replayTeams, type ArchiveData } from "@mrx/shared";
import { dauer, uhr } from "../lib/format.ts";
import { theme } from "../lib/theme.svelte.ts";
import { T } from "../texte.ts";
import { fieldOverlays, trailOverlay } from "./overlays.ts";
import { EMPTY, hatchImage, mapStyle, type Overlays } from "./style.ts";

export type Format = "hoch" | "quer";
const FPS = 30;
const SEKUNDEN = 40;
/** Karte in halber Größe mit doppelter Pixeldichte – Straßennamen so groß wie am Handy */
const DICHTE = 2;

export const kannVideo = () => typeof VideoEncoder !== "undefined";

/** H.264 läuft überall (auch WhatsApp, iPhone); VP9 nur als Ersatz */
async function codec(width: number, height: number) {
  for (const c of ["avc1.640028", "avc1.4d0028", "avc1.420028", "vp09.00.40.08"]) {
    const config: VideoEncoderConfig = { codec: c, width, height, bitrate: 5_000_000, framerate: FPS };
    if ((await VideoEncoder.isConfigSupported(config).catch(() => ({ supported: false }))).supported) return config;
  }
  return null;
}

const idle = (m: import("maplibre-gl").Map) =>
  new Promise<void>((ok) => {
    // ponytail: hängt ein Kartendienst, nach 8 s trotzdem weiter (dann fehlen eben Kacheln)
    const t = setTimeout(ok, 8000);
    m.once("idle", () => (clearTimeout(t), ok()));
  });

export async function replayVideo(data: ArchiveData, format: Format, onprogress: (f: number) => void, signal: AbortSignal): Promise<Blob> {
  const [W, H] = format === "hoch" ? [1080, 1920] : [1920, 1080];
  const config = await codec(W, H);
  if (!config) throw new Error("unsupported");
  const [ml, worker, mux] = await Promise.all([
    import("maplibre-gl"),
    import("maplibre-gl/dist/maplibre-gl-worker.mjs?url"),
    import("mp4-muxer"),
    import("maplibre-gl/dist/maplibre-gl.css"),
  ]);
  ml.setWorkerUrl(worker.default);

  const el = document.createElement("div");
  el.style.cssText = `position:fixed;left:-20000px;top:0;width:${W / DICHTE}px;height:${H / DICHTE}px`;
  document.body.append(el);
  const kopf = format === "hoch" ? 150 : 110;
  const overlays = (locked: string[], trail: ReturnType<typeof replayAt>["trail"]): Overlays => ({
    ...fieldOverlays(data.field, locked),
    trail: trailOverlay(trail),
    accuracy: EMPTY,
    edit: EMPTY,
  });
  const map = new ml.Map({
    container: el,
    style: mapStyle(theme.active, overlays([], [])),
    bounds: bounds(data.field.base),
    fitBoundsOptions: { padding: { top: kopf + 20, bottom: 30, left: 30, right: 30 } },
    interactive: false,
    attributionControl: false,
    pixelRatio: DICHTE,
    canvasContextAttributes: { preserveDrawingBuffer: true },
  });
  map.setMissingStyleImageResolver((id) => {
    if (id.startsWith("hatch-") && !map.hasImage(id)) map.addImage(id, hatchImage(id.slice(6) as typeof theme.active), { pixelRatio: 2 });
  });

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d")!;
  const css = getComputedStyle(document.documentElement);
  const schrift = css.getPropertyValue("--font-display") || "sans-serif";
  const rot = css.getPropertyValue("--mrx-rot") || "#c51a1a";
  const team = (id: string | null | undefined) => (id && data.teams[id]) || { name: "–", short: "?", color: "#888" };
  const xy = (p: { lat: number; lng: number }) => {
    const q = map.project([p.lng, p.lat]);
    return [q.x * DICHTE, q.y * DICHTE] as const;
  };
  const punkt = (x: number, y: number, r: number, fill: string, text = "") => {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fillStyle = fill;
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = "#fff";
    g.stroke();
    if (!text) return;
    g.fillStyle = "#fff";
    g.font = `800 ${Math.round(r * 0.9)}px ${schrift}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, x, y + 1);
  };

  const target = new mux.ArrayBufferTarget();
  const muxer = new mux.Muxer({
    target,
    video: { codec: config.codec.startsWith("vp09") ? "vp9" : "avc", width: W, height: H, frameRate: FPS },
    fastStart: "in-memory",
  });
  let fehler: unknown = null;
  const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => (fehler = e) });
  enc.configure(config);

  try {
    await document.fonts.load(`800 40px ${schrift}`).catch(() => {});
    await new Promise<void>((ok) => (map.loaded() ? ok() : map.once("load", () => ok())));
    await idle(map);
    const { startedAt: start, endedAt: end } = data;
    const n = FPS * SEKUNDEN;
    let stand = "";
    for (let i = 0; i < n; i++) {
      if (signal.aborted) throw new DOMException("abgebrochen", "AbortError");
      if (fehler) throw fehler;
      const t = start + ((end - start) * i) / (n - 1);
      const f = replayAt(data, t);
      // Sperren oder Spur geändert → Karte neu zeichnen lassen (nur ein paar Dutzend Mal pro Spiel)
      const neu = `${f.locked.join()}|${f.trail.map((r) => r.id).join()}`;
      if (neu !== stand) {
        stand = neu;
        const o = overlays(f.locked, f.trail);
        for (const k of ["mask", "cuts", "trail"] as const) map.getSource<import("maplibre-gl").GeoJSONSource>(k)?.setData(o[k]);
        await idle(map);
      }
      g.drawImage(map.getCanvas(), 0, 0, W, H);

      // Punkte nur unter der Kopfzeile
      g.save();
      g.beginPath();
      g.rect(0, kopf * DICHTE, W, H);
      g.clip();
      // Fangorte: kleine Raute in der Farbe des neuen Mister X
      for (const h of f.catches) {
        const [x, y] = xy(h);
        g.save();
        g.translate(x, y);
        g.rotate(Math.PI / 4);
        g.fillStyle = team(h.to).color;
        g.strokeStyle = "#fff";
        g.lineWidth = 4;
        g.fillRect(-11, -11, 22, 22);
        g.strokeRect(-11, -11, 22, 22);
        g.restore();
      }
      // alle Teams (Mister X rot mit „X“)
      for (const p of replayTeams(data, t)) {
        const [x, y] = xy(p);
        const tm = team(p.teamId);
        punkt(x, y, 26, p.teamId === f.mrx ? rot : tm.color, p.teamId === f.mrx ? "X" : tm.short);
      }
      // letzte Meldung von Mister X: roter Ring
      const last = f.trail.at(-1);
      if (last) {
        const [x, y] = xy(last);
        g.beginPath();
        g.arc(x, y, 40, 0, Math.PI * 2);
        g.lineWidth = 8;
        g.strokeStyle = rot;
        g.stroke();
      }

      g.restore();

      // Kopfzeile: Spielname, Uhrzeit und Spieldauer, Mister X (hoch: untereinander, quer: rechts daneben)
      const hoch = format === "hoch";
      g.fillStyle = "rgb(0 0 0 / 0.72)";
      g.fillRect(0, 0, W, kopf * DICHTE);
      g.fillStyle = "#fff";
      g.textAlign = "left";
      g.textBaseline = "alphabetic";
      g.font = `800 ${hoch ? 76 : 64}px ${schrift}`;
      g.fillText(data.name, 48, hoch ? 100 : 90, W - 96);
      g.font = `700 ${hoch ? 56 : 48}px ${schrift}`;
      g.fillText(`${uhr(t)}  ·  ${dauer(t - start)}`, 48, hoch ? 180 : 170);
      g.fillStyle = "#ff8a80";
      g.textAlign = hoch ? "left" : "right";
      g.fillText(`${T.status.misterX}: ${team(f.mrx).name}`, hoch ? 48 : W - 48, hoch ? 260 : 170, hoch ? W - 96 : W / 2);
      g.textAlign = "right";
      g.font = `600 22px sans-serif`;
      g.fillStyle = "rgb(0 0 0 / 0.6)";
      g.fillText("© OpenStreetMap", W - 16, H - 14);

      const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
      enc.encode(frame, { keyFrame: i % (FPS * 2) === 0 });
      frame.close();
      // nicht zu viele Bilder auf einmal (Speicher), und der Fortschrittsbalken soll sich bewegen
      while (enc.encodeQueueSize > 4) await new Promise((ok) => setTimeout(ok, 5));
      if (i % 10 === 0) {
        onprogress(i / n);
        await new Promise((ok) => setTimeout(ok));
      }
    }
    await enc.flush();
    if (fehler) throw fehler;
    muxer.finalize();
    onprogress(1);
    return new Blob([target.buffer], { type: "video/mp4" });
  } finally {
    if (enc.state !== "closed") enc.close();
    map.remove();
    el.remove();
  }
}
