<!-- Radar-Scheibe (Ringe, Skala, leuchtende Bögen), die sich langsam dreht. Ein eigenes Element mit transform-Animation:
     der Browser dreht es auf der Grafikkarte, ohne jedes Bild neu zu zeichnen (wichtig, sonst ruckelt es). -->
<script lang="ts">
  interface Props {
    /** Kantenlänge als CSS-Länge */
    size: string;
    /** Sekunden für eine Umdrehung */
    dur: number;
    reverse?: boolean;
    /** Lage im Bild, z. B. "left:-50%;bottom:-50%" (Prozent beziehen sich auf die Größe) */
    pos: string;
    /** mit Füllung, Gold- und Weißbogen */
    rich?: boolean;
    /** schnell hereindrehen beim Öffnen */
    intro?: boolean;
    opacity?: number;
  }
  let { size, dur, reverse = false, pos, rich = false, intro = false, opacity = 1 }: Props = $props();

  const R = 500;
  const tick = `2 ${((2 * Math.PI * R * 0.96) / 120 - 2).toFixed(2)}`;
  const arc = (r: number, deg: number) => {
    const c = 2 * Math.PI * r;
    return `${((c * deg) / 360).toFixed(1)} ${(c - (c * deg) / 360).toFixed(1)}`;
  };
</script>

<div class="o" class:intro style="--s:{size};{pos};opacity:{opacity}">
  <div class="spin" style="animation-duration:{dur}s;animation-direction:{reverse ? 'reverse' : 'normal'}">
    <svg viewBox="-520 -520 1040 1040">
      {#if rich}<circle r={R} class="fill" />{/if}
      <circle r={R} class="ring" />
      <circle r={R * 0.96} class="tick" stroke-dasharray={tick} />
      <circle r={R * 0.8} class="ring" />
      <circle r={R * 0.85} class="arc red" stroke-dasharray={arc(R * 0.85, 55)} />
      <circle r={R * 0.62} class="ring" />
      {#if rich}
        <circle r={R * 0.69} class="arc gold" stroke-dasharray={arc(R * 0.69, 24)} stroke-dashoffset={-R * 2} />
        <circle r={R * 0.52} class="arc white" stroke-dasharray={arc(R * 0.52, 14)} stroke-dashoffset={-R * 3} />
      {/if}
      <circle r={R * 0.44} class="ring" />
      <path d="M0 -{R}V{R}M-{R} 0H{R}" class="ring" />
    </svg>
  </div>
</div>

<style>
  .o {
    position: absolute;
    width: var(--s);
    height: var(--s);
  }
  .o.intro {
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
  .spin {
    width: 100%;
    height: 100%;
    will-change: transform;
    animation: spin linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  svg {
    display: block;
    width: 100%;
    height: 100%;
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
    stroke-width: 15;
  }
  .arc {
    fill: none;
    stroke-linecap: round;
  }
  .arc.red {
    stroke: var(--accent-text);
    stroke-width: 13;
    opacity: 0.8;
  }
  .arc.gold {
    stroke: var(--warn);
    stroke-width: 8;
    opacity: 0.7;
  }
  .arc.white {
    stroke: var(--text-2);
    stroke-width: 5;
    opacity: 0.6;
  }
</style>
