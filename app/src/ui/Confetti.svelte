<!-- Konfetti in Rot/Weiß (Spielende). Bei „Bewegung reduzieren“ aus. -->
<script lang="ts">
  import { onMount } from "svelte";

  let cv: HTMLCanvasElement;

  onMount(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const g = cv.getContext("2d")!;
    const dpr = devicePixelRatio || 1;
    const resize = () => {
      cv.width = innerWidth * dpr;
      cv.height = innerHeight * dpr;
    };
    resize();
    const colors = ["#c51a1a", "#ffffff", "#dc0219", "#f3f6f9", "#214c6b"];
    const parts = Array.from({ length: 160 }, () => ({
      x: Math.random() * innerWidth,
      y: -20 - Math.random() * innerHeight * 0.6,
      vx: (Math.random() - 0.5) * 2,
      vy: 2 + Math.random() * 3,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      w: 8 + Math.random() * 8,
      h: 5 + Math.random() * 6,
      c: colors[Math.floor(Math.random() * colors.length)]!,
    }));
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of parts) {
        p.x += p.vx + Math.sin((t + p.y) / 300) * 0.6;
        p.y += p.vy;
        p.r += p.vr;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.r);
        g.fillStyle = p.c;
        g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        g.restore();
      }
      if (t - t0 < 6000) raf = requestAnimationFrame(step);
      else g.clearRect(0, 0, innerWidth, innerHeight);
    };
    raf = requestAnimationFrame(step);
    addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize);
    };
  });
</script>

<canvas bind:this={cv} aria-hidden="true"></canvas>

<style>
  canvas {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: var(--z-overlay);
  }
</style>
