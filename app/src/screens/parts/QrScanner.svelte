<!--
  QR-Code mit der Handy-Kamera direkt in der App lesen (ohne Kamera-App): Vollbild mit Kamerabild und Rahmen.
  Erkennt den Code mit dem eingebauten BarcodeDetector (Android/Chrome) bzw. jsQR (iPhone, Laptop, ältere Handys).
  Mister-X-Links führen gleich auf die richtige Seite; fremde Codes werden freundlich abgelehnt.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { X } from "@lucide/svelte";
  import jsQR from "jsqr";
  import { routeFromQr } from "@mrx/shared";
  import IconButton from "../../ui/IconButton.svelte";
  import { T } from "../../texte.ts";

  interface Props {
    /** Seite in der App, zu der der Code führt */
    onroute: (route: string) => void;
    onclose: () => void;
  }
  let { onroute, onclose }: Props = $props();

  let video = $state<HTMLVideoElement>();
  let error = $state<string | null>(null);
  let hint = $state<string | null>(null);

  /** ans Ende von <body> hängen: sonst sperrt ein animiertes Eltern-Element (transform) das Vollbild in seine Box */
  function vollbild(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }

  type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
  type DetectorCtor = new (o: { formats: string[] }) => Detector;

  onMount(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    let raf = 0;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    async function detector(): Promise<Detector | null> {
      const BD = (globalThis as { BarcodeDetector?: DetectorCtor & { getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
      if (!BD) return null;
      try {
        if (BD.getSupportedFormats && !(await BD.getSupportedFormats()).includes("qr_code")) return null;
        return new BD({ formats: ["qr_code"] });
      } catch {
        return null;
      }
    }

    function found(text: string) {
      const route = routeFromQr(text);
      if (!route) {
        hint = T.qr.fremd;
        return false;
      }
      stopped = true;
      onroute(route);
      return true;
    }

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch (e) {
        error = e instanceof DOMException && e.name === "NotAllowedError" ? T.qr.nichtErlaubt : T.qr.keineKamera;
        return;
      }
      if (stopped || !video) return stream.getTracks().forEach((t) => t.stop());
      video.srcObject = stream;
      await video.play().catch(() => {});
      const bd = await detector();
      let busy = false;
      const tick = async () => {
        if (stopped) return;
        raf = requestAnimationFrame(tick);
        if (busy || !video || video.readyState < 2 || !video.videoWidth) return;
        busy = true;
        try {
          if (bd) {
            const r = await bd.detect(video);
            if (r[0] && found(r[0].rawValue)) return;
          } else if (ctx) {
            // verkleinert lesen: schneller, und QR-Codes bleiben gut erkennbar
            const s = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
            canvas.width = Math.round(video.videoWidth * s);
            canvas.height = Math.round(video.videoHeight * s);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
            if (code?.data && found(code.data)) return;
          }
        } finally {
          busy = false;
        }
      };
      raf = requestAnimationFrame(tick);
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  });
</script>

<div class="scan" role="dialog" aria-modal="true" aria-label={T.qr.titel} use:vollbild>
  <video bind:this={video} playsinline muted></video>
  <div class="frame" aria-hidden="true"></div>
  <header>
    <strong class="caps">{T.qr.titel}</strong>
    <IconButton icon={X} label={T.allgemein.schliessen} onclick={onclose} />
  </header>
  <p class="msg" role="status">{error ?? hint ?? T.qr.hinweis}</p>
</div>

<style>
  .scan {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal, 50);
    background: #000;
    color: #fff;
  }
  video {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .frame {
    position: absolute;
    left: 50%;
    top: 46%;
    width: min(70vw, 300px);
    aspect-ratio: 1;
    translate: -50% -50%;
    border: 4px solid #fff;
    border-radius: 24px;
    box-shadow: 0 0 0 100vmax rgb(0 0 0 / 0.45);
  }
  header {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: calc(var(--safe-top) + var(--sp-3)) var(--gutter) var(--sp-3);
  }
  header strong {
    font-size: var(--fs-l);
  }
  .msg {
    position: absolute;
    left: var(--gutter);
    right: var(--gutter);
    bottom: calc(var(--safe-bottom) + var(--sp-8));
    margin: 0 auto;
    max-width: 420px;
    padding: var(--sp-3) var(--sp-4);
    border-radius: var(--r-m);
    background: rgb(0 0 0 / 0.65);
    text-align: center;
    font-size: var(--fs-m);
  }
</style>
