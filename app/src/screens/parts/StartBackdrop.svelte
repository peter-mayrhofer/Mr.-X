<!-- Lebendiger Hintergrund der Startseite: drehende Viertelkreise, ein Mister X auf der Flucht vor drei Jägern, ein rollendes X.
     Zwei Fassungen: breit (Laptop) und hoch (Handy). Läuft von allein weiter, nur transform/opacity (flüssig, schont den Akku).
     Bei „Bewegung reduzieren“ steht alles still. -->
<script lang="ts">
  import { onMount } from "svelte";

  let wide = $state<SVGSVGElement>();
  let tall = $state<SVGSVGElement>();

  // Maus bewegt den Hintergrund leicht mit (Tiefe); auf Touch-Geräten passiert nichts
  let root = $state<HTMLDivElement>();
  let raf = 0;
  function look(e: PointerEvent) {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      root?.style.setProperty("--px", String((e.clientX / innerWidth - 0.5) * 2));
      root?.style.setProperty("--py", String((e.clientY / innerHeight - 0.5) * 2));
    });
  }

  onMount(() => {
    addEventListener("pointermove", look, { passive: true });
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      wide?.pauseAnimations();
      tall?.pauseAnimations();
    }
    return () => removeEventListener("pointermove", look);
  });

  /** Strichelung als Skala: `n` Striche rund um einen Kreis */
  const ticks = (r: number, n = 150) => `2 ${((2 * Math.PI * r) / n - 2).toFixed(2)}`;
  const arc = (r: number, deg: number) => {
    const c = 2 * Math.PI * r;
    return `${((c * deg) / 360).toFixed(1)} ${(c - (c * deg) / 360).toFixed(1)}`;
  };

  // geschlossene Straßenrunde, auf der Mister X läuft und die Jäger ihm hinterher
  const ROUTE_WIDE = "M300 210H700V400H1100V210H1380V580H1000V720H520V540H300Z";
  const ROUTE_TALL = "M70 130H310V290H130V450H330V600H90Z";
</script>

{#snippet orb(cx: number, cy: number, r: number, dur: number, reverse: boolean)}
  <g class="intro" style="transform-origin:{cx}px {cy}px">
    <g class="spin" style="transform-origin:{cx}px {cy}px;animation-duration:{dur}s;animation-direction:{reverse ? 'reverse' : 'normal'}">
      <circle {cx} {cy} {r} class="fill" />
      <circle {cx} {cy} {r} class="ring" />
      <circle {cx} {cy} r={r * 0.96} class="tick" stroke-width={r * 0.03} stroke-dasharray={ticks(r * 0.96)} />
      <circle {cx} {cy} r={r * 0.8} class="ring" />
      <circle {cx} {cy} r={r * 0.85} class="arc red" stroke-width={r * 0.026} stroke-dasharray={arc(r * 0.85, 55)} />
      <circle {cx} {cy} r={r * 0.62} class="ring" />
      <circle
        {cx}
        {cy}
        r={r * 0.69}
        class="arc gold"
        stroke-width={r * 0.016}
        stroke-dasharray={arc(r * 0.69, 24)}
        stroke-dashoffset={-r * 2}
      />
      <circle {cx} {cy} r={r * 0.44} class="ring" />
      <circle
        {cx}
        {cy}
        r={r * 0.52}
        class="arc white"
        stroke-width={r * 0.01}
        stroke-dasharray={arc(r * 0.52, 14)}
        stroke-dashoffset={-r * 3}
      />
      <path d="M{cx} {cy - r}V{cy + r}M{cx - r} {cy}H{cx + r}" class="ring" />
    </g>
  </g>
{/snippet}

{#snippet chase(d: string, dur: number)}
  <g class="chase">
    <path {d} class="route" />
    {#each [{ c: "info", at: 16 }, { c: "warn", at: 11 }, { c: "ok", at: 6 }] as h (h.c)}
      <circle r="9" class="hunter {h.c}">
        <animateMotion dur="{dur}s" begin="-{(h.at * dur) / 48}s" repeatCount="indefinite" path={d} />
      </circle>
    {/each}
    <g>
      <animateMotion dur="{dur}s" repeatCount="indefinite" path={d} />
      <circle r="12" class="ping"
        ><animate attributeName="r" values="12;58" dur="2.4s" repeatCount="indefinite" /><animate
          attributeName="opacity"
          values=".7;0"
          dur="2.4s"
          repeatCount="indefinite"
        /></circle
      >
      <circle r="12" class="ping"
        ><animate attributeName="r" values="12;58" dur="2.4s" begin="-1.2s" repeatCount="indefinite" /><animate
          attributeName="opacity"
          values=".7;0"
          dur="2.4s"
          begin="-1.2s"
          repeatCount="indefinite"
        /></circle
      >
      <circle r="13" class="mrx" />
    </g>
  </g>
{/snippet}

<div class="bd" aria-hidden="true" bind:this={root}>
  <div class="glow"></div>

  <svg bind:this={wide} class="wide" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
    <defs>
      <pattern id="bd-grid" width="80" height="80" patternUnits="userSpaceOnUse">
        <path d="M80 0H0V80" class="grid" />
      </pattern>
    </defs>
    <rect x="-80" y="-80" width="1760" height="1060" fill="url(#bd-grid)" class="drift" />
    {@render orb(0, 900, 640, 120, false)}
    {@render orb(1600, 0, 470, 150, true)}
    <g class="roll big"><text text-anchor="middle" dominant-baseline="central">X</text></g>
    <g class="roll small"><text text-anchor="middle" dominant-baseline="central">X</text></g>
    {@render chase(ROUTE_WIDE, 48)}
  </svg>

  <svg bind:this={tall} class="tall" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
    <defs>
      <pattern id="bd-grid-t" width="50" height="50" patternUnits="userSpaceOnUse">
        <path d="M50 0H0V50" class="grid" />
      </pattern>
    </defs>
    <rect x="-50" y="-50" width="500" height="900" fill="url(#bd-grid-t)" class="drift t" />
    {@render orb(0, 800, 380, 100, false)}
    <g class="roll phone"><text text-anchor="middle" dominant-baseline="central">X</text></g>
    {@render chase(ROUTE_TALL, 40)}
  </svg>
</div>

<style>
  .bd {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
  }
  .glow {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(900px 700px at 0% 100%, var(--accent-soft), transparent 70%),
      radial-gradient(700px 500px at 100% 0%, var(--info-soft), transparent 70%);
  }
  svg {
    position: absolute;
    inset: -40px;
    width: calc(100% + 80px);
    height: calc(100% + 80px);
    transform: translate(calc(var(--px, 0) * -22px), calc(var(--py, 0) * -14px));
    transition: transform 0.5s ease-out;
  }
  /* Einflug beim Öffnen: Kreise drehen schnell herein und bremsen ab, dann übernimmt die langsame Drehung */
  .intro {
    animation: orb-in 2.2s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
  }
  @keyframes orb-in {
    from {
      opacity: 0;
      transform: scale(0.15) rotate(-260deg);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
  .chase {
    animation: fade-in 1.4s ease-out 1s both;
  }
  .drift {
    opacity: 1;
  }
  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  .tall {
    display: none;
  }
  @media (max-width: 767px) {
    .wide {
      display: none;
    }
    .tall {
      display: block;
    }
  }

  .grid {
    fill: none;
    stroke: var(--line);
    stroke-width: 1.2;
    opacity: 0.55;
  }
  .drift {
    animation: drift 14s linear infinite;
  }
  .drift.t {
    animation-duration: 12s;
  }
  @keyframes drift {
    to {
      transform: translate(80px, 80px);
    }
  }
  .drift.t {
    animation-name: drift-t;
  }
  @keyframes drift-t {
    to {
      transform: translate(50px, 50px);
    }
  }

  .spin {
    animation: spin linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .fill {
    fill: var(--accent-soft);
  }
  .ring {
    fill: none;
    stroke: var(--line);
    stroke-width: 1.6;
  }
  .tick {
    fill: none;
    stroke: var(--line-strong);
  }
  .arc {
    fill: none;
    stroke-linecap: round;
  }
  .arc.red {
    stroke: var(--accent-text);
    opacity: 0.8;
  }
  .arc.gold {
    stroke: var(--warn);
    opacity: 0.7;
  }
  .arc.white {
    stroke: var(--text-2);
    opacity: 0.6;
  }

  /* rollende X: laufen am Rand durchs Bild und drehen sich dabei wie ein Rad */
  .roll text {
    font-family: var(--font-display);
    font-weight: 800;
    fill: none;
    stroke: var(--accent-text);
    stroke-width: 3;
  }
  .roll.big text {
    font-size: 560px;
  }
  .roll.small text {
    font-size: 240px;
  }
  .roll.phone text {
    font-size: 300px;
  }
  .roll {
    opacity: 0.22;
  }
  .roll.big {
    animation: roll-big 80s linear infinite;
  }
  .roll.small {
    opacity: 0.16;
    animation: roll-small 55s linear infinite;
  }
  .roll.phone {
    animation: roll-phone 55s linear infinite;
  }
  @keyframes roll-big {
    from {
      transform: translate(-380px, 760px) rotate(0deg);
    }
    to {
      transform: translate(1980px, 760px) rotate(720deg);
    }
  }
  @keyframes roll-small {
    from {
      transform: translate(1750px, 120px) rotate(0deg);
    }
    to {
      transform: translate(-200px, 120px) rotate(-540deg);
    }
  }
  @keyframes roll-phone {
    from {
      transform: translate(-200px, 690px) rotate(0deg);
    }
    to {
      transform: translate(600px, 690px) rotate(360deg);
    }
  }

  .route {
    fill: none;
    stroke: var(--line-strong);
    stroke-width: 2;
    stroke-dasharray: 10 14;
    opacity: 0.7;
    animation: march 3s linear infinite;
  }
  @keyframes march {
    to {
      stroke-dashoffset: -24;
    }
  }
  .mrx {
    fill: var(--accent);
    stroke: var(--text);
    stroke-width: 3;
  }
  .ping {
    fill: none;
    stroke: var(--accent-text);
    stroke-width: 3;
  }
  .hunter {
    stroke: var(--surface);
    stroke-width: 2;
  }
  .hunter.info {
    fill: var(--info);
  }
  .hunter.warn {
    fill: var(--warn);
  }
  .hunter.ok {
    fill: var(--ok);
  }
</style>
