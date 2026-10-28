<!-- Dezenter, ruhiger Hintergrund für alle Seiten ohne Karte (Beitritt, Anmeldung, Einführung, Warteraum, Hilfe, Auswertung …):
     ein langsam drehender Viertelkreis, ein wanderndes Raster, ein paar schwebende Punkte. Viel leiser als auf der Startseite,
     liegt hinter dem Inhalt und stört weder Lesen noch Bedienen. Bei „Bewegung reduzieren“ steht alles still. -->
<script lang="ts">
  const R = 500;
  const tick = `2 ${((2 * Math.PI * R * 0.96) / 120 - 2).toFixed(2)}`;
  const arc = (r: number, deg: number) => {
    const c = 2 * Math.PI * r;
    return `${((c * deg) / 360).toFixed(1)} ${(c - (c * deg) / 360).toFixed(1)}`;
  };
</script>

<div class="amb" aria-hidden="true">
  <div class="grid"></div>
  <div class="orb a">
    <svg viewBox="-520 -520 1040 1040">
      <circle r={R} class="fill" />
      <circle r={R} class="ring" />
      <circle r={R * 0.96} class="tick" stroke-dasharray={tick} />
      <circle r={R * 0.78} class="ring" />
      <circle r={R * 0.84} class="arc" stroke-dasharray={arc(R * 0.84, 50)} />
      <circle r={R * 0.56} class="ring" />
      <circle r={R * 0.34} class="ring" />
      <path d="M0 -{R}V{R}M-{R} 0H{R}" class="ring" />
    </svg>
  </div>
  <div class="orb b">
    <svg viewBox="-520 -520 1040 1040">
      <circle r={R} class="ring" />
      <circle r={R * 0.96} class="tick" stroke-dasharray={tick} />
      <circle r={R * 0.7} class="ring" />
      <circle r={R * 0.76} class="arc" stroke-dasharray={arc(R * 0.76, 36)} />
    </svg>
  </div>
  <i class="dot d1"></i><i class="dot d2"></i><i class="dot d3"></i>
</div>

<style>
  .amb {
    position: fixed;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    overflow: hidden;
    animation: in 1.6s ease-out both;
    background:
      radial-gradient(800px 600px at 0% 100%, var(--accent-soft), transparent 70%),
      radial-gradient(600px 400px at 100% 0%, var(--info-soft), transparent 70%);
  }
  @keyframes in {
    from {
      opacity: 0;
    }
  }
  .grid {
    position: absolute;
    inset: -64px;
    opacity: 0.45;
    background-image: linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px);
    background-size: 64px 64px;
    animation: drift 24s linear infinite;
  }
  @keyframes drift {
    to {
      transform: translate(64px, 64px);
    }
  }
  .orb {
    --s: clamp(380px, 78vmin, 820px);
    position: absolute;
    width: var(--s);
    height: var(--s);
    opacity: 0.7;
  }
  .orb svg {
    width: 100%;
    height: 100%;
    display: block;
    animation: spin 140s linear infinite;
  }
  .orb.a {
    left: calc(var(--s) / -2);
    bottom: calc(var(--s) / -2);
  }
  .orb.b {
    display: none;
    --s: clamp(300px, 46vmin, 560px);
    right: calc(var(--s) / -2);
    top: calc(var(--s) / -2);
  }
  .orb.b svg {
    animation-direction: reverse;
    animation-duration: 180s;
  }
  @media (min-width: 1000px) {
    .orb.b {
      display: block;
    }
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
    stroke-width: 2;
  }
  .tick {
    fill: none;
    stroke: var(--line-strong);
    stroke-width: 14;
  }
  .arc {
    fill: none;
    stroke: var(--accent-text);
    stroke-width: 10;
    stroke-linecap: round;
    opacity: 0.55;
  }
  /* wenige, winzige Punkte, die langsam durchs Bild schweben (Teams unterwegs) */
  .dot {
    position: absolute;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    opacity: 0.5;
    animation: float linear infinite;
  }
  .d1 {
    background: var(--accent-text);
    top: 22%;
    animation-duration: 70s;
  }
  .d2 {
    background: var(--info);
    top: 58%;
    animation-duration: 95s;
    animation-delay: -30s;
  }
  .d3 {
    background: var(--warn);
    top: 80%;
    animation-duration: 120s;
    animation-delay: -70s;
  }
  @keyframes float {
    from {
      transform: translate(-5vw, 0);
    }
    50% {
      transform: translate(55vw, -6vh);
    }
    to {
      transform: translate(105vw, 4vh);
    }
  }
</style>
