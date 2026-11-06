<!-- Hintergrund der Startseite: Mister X auf der Flucht vor drei Jägern – erzählt das Spiel in einem Bild.
     Zwei Fassungen: breit (Laptop) und hoch (Handy). Alles bewegt sich nur per transform/opacity auf eigenen Ebenen
     (Grafikkarte, kein Neuzeichnen) – sonst ruckelt es auf schwächeren Geräten. Bei „Bewegung reduzieren“ steht alles still. -->
<script lang="ts">
  import { onMount } from "svelte";
  import { pruefeFluessig } from "../../lib/ruhig.ts";

  onMount(() => pruefeFluessig(3800));
  const hunters = [
    { c: "info", at: 0.34 },
    { c: "warn", at: 0.23 },
    { c: "ok", at: 0.12 },
  ];
</script>

<div class="bd" aria-hidden="true">
  <div class="chase wide">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none"
      ><path
        class="route"
        vector-effect="non-scaling-stroke"
        d="M18.75 23.33L43.75 23.33L43.75 44.44L68.75 44.44L68.75 23.33L86.25 23.33L86.25 64.44L62.50 64.44L62.50 80.00L32.50 80.00L32.50 60.00L18.75 60.00Z"
      /></svg
    >
    {#each hunters as h (h.c)}<i class="runner hunter {h.c}" style="animation-delay:calc(var(--dur) * -{h.at})"></i>{/each}
    <i class="runner mrx"></i>
  </div>
  <div class="chase tall">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none"
      ><path
        class="route"
        vector-effect="non-scaling-stroke"
        d="M17.50 16.25L77.50 16.25L77.50 36.25L32.50 36.25L32.50 56.25L82.50 56.25L82.50 75.00L22.50 75.00Z"
      /></svg
    >
    {#each hunters as h (h.c)}<i class="runner hunter {h.c}" style="animation-delay:calc(var(--dur) * -{h.at})"></i>{/each}
    <i class="runner mrx"></i>
  </div>
</div>

<style>
  .bd {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
    contain: strict;
  }
  /* Jagd: Mister X (rot) auf einer Straßenrunde, die Jäger hinterher. Alles in vw/vh, damit es zur gestrichelten Route passt. */
  .chase {
    position: absolute;
    inset: 0;
  }
  .chase svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .route {
    fill: none;
    stroke: var(--line-strong);
    stroke-width: 2;
    stroke-dasharray: 10 14;
    opacity: 0.7;
  }
  .chase.tall {
    display: none;
    --dur: 40s;
  }
  .chase.wide {
    --dur: 48s;
  }
  @media (max-width: 767px) {
    .chase.wide {
      display: none;
    }
    .chase.tall {
      display: block;
    }
  }
  .runner {
    position: absolute;
    left: -7px;
    top: -7px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    will-change: transform;
    animation: run-wide var(--dur) linear infinite;
  }
  .chase.tall .runner {
    animation-name: run-tall;
  }
  .mrx {
    background: var(--accent);
    box-shadow: 0 0 0 3px var(--text);
  }
  /* Ping-Ringe: wachsen und verblassen */
  .mrx::before,
  .mrx::after {
    content: "";
    position: absolute;
    inset: -2px;
    border-radius: 50%;
    border: 3px solid var(--accent-text);
    opacity: 0;
    animation: ping 2.4s ease-out infinite;
  }
  .mrx::after {
    animation-delay: -1.2s;
  }
  @keyframes ping {
    from {
      opacity: 0.7;
      transform: scale(1);
    }
    to {
      opacity: 0;
      transform: scale(5);
    }
  }
  .hunter.info {
    background: var(--info);
  }
  .hunter.warn {
    background: var(--warn);
  }
  .hunter.ok {
    background: var(--ok);
  }
  @keyframes run-wide {
    0.00% {
      transform: translate(18.75vw, 23.33vh);
    }
    11.24% {
      transform: translate(43.75vw, 23.33vh);
    }
    16.57% {
      transform: translate(43.75vw, 44.44vh);
    }
    27.81% {
      transform: translate(68.75vw, 44.44vh);
    }
    33.15% {
      transform: translate(68.75vw, 23.33vh);
    }
    41.01% {
      transform: translate(86.25vw, 23.33vh);
    }
    51.40% {
      transform: translate(86.25vw, 64.44vh);
    }
    62.08% {
      transform: translate(62.5vw, 64.44vh);
    }
    66.01% {
      transform: translate(62.5vw, 80vh);
    }
    79.49% {
      transform: translate(32.5vw, 80vh);
    }
    84.55% {
      transform: translate(32.5vw, 60vh);
    }
    90.73% {
      transform: translate(18.75vw, 60vh);
    }
    100.00% {
      transform: translate(18.75vw, 23.33vh);
    }
  }
  @keyframes run-tall {
    0.00% {
      transform: translate(17.5vw, 16.25vh);
    }
    13.33% {
      transform: translate(77.5vw, 16.25vh);
    }
    22.22% {
      transform: translate(77.5vw, 36.25vh);
    }
    32.21% {
      transform: translate(32.5vw, 36.25vh);
    }
    41.10% {
      transform: translate(32.5vw, 56.25vh);
    }
    52.21% {
      transform: translate(82.5vw, 56.25vh);
    }
    60.54% {
      transform: translate(82.5vw, 75vh);
    }
    73.87% {
      transform: translate(22.5vw, 75vh);
    }
    100.00% {
      transform: translate(17.5vw, 16.25vh);
    }
  }
</style>
