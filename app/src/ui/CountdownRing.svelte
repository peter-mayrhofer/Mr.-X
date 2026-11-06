<!--
  Countdown mit Ring. Rechnet mit der Server-Uhr (lib/clock). Unter `urgentMs` wird der Ring rot und pulsiert.
  Fadenkreuz-Ecken = Agenten-Anmutung.
-->
<script lang="ts">
  import { clock } from "../lib/clock.svelte.ts";
  import { mmss } from "../lib/format.ts";

  interface Props {
    until: number;
    total: number;
    size?: number;
    label?: string;
    urgentMs?: number;
    tone?: "accent" | "warn" | "light";
  }

  let { until, total, size = 96, label, urgentMs = 60_000, tone = "accent" }: Props = $props();

  const left = $derived(Math.max(0, until - clock.now));
  const frac = $derived(total > 0 ? Math.min(1, left / total) : 0);
  const urgent = $derived(left > 0 && left <= urgentMs);
  const R = 45;
  const C = 2 * Math.PI * R;
</script>

<div class="ring {tone}" class:urgent style:--size="{size}px" role="timer" aria-label="{label ?? ''} {mmss(left)}">
  <svg viewBox="0 0 100 100" aria-hidden="true">
    <circle class="track" cx="50" cy="50" r={R} />
    <circle class="bar" cx="50" cy="50" r={R} stroke-dasharray={C} stroke-dashoffset={C * (1 - frac)} />
  </svg>
  <span class="time num">{mmss(left)}</span>
  <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
</div>

<style>
  .ring {
    position: relative;
    width: var(--size);
    height: var(--size);
    display: grid;
    place-items: center;
    flex: none;
  }
  svg {
    position: absolute;
    inset: 6%;
    transform: rotate(-90deg);
  }
  circle {
    fill: none;
    stroke-width: 8;
  }
  .track {
    stroke: var(--line);
  }
  .bar {
    stroke: var(--accent);
    stroke-linecap: round;
    transition: stroke-dashoffset 1s linear;
  }
  .warn .bar {
    stroke: var(--warn);
  }
  .light .bar {
    stroke: #fff;
  }
  .light .track {
    stroke: rgb(255 255 255 / 0.3);
  }
  .time {
    position: relative;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: calc(var(--size) * 0.3);
    line-height: 1;
  }
  .urgent .bar {
    stroke: var(--accent);
  }
  .urgent {
    animation: pulse 1s var(--ease-in-out) infinite;
  }
  @keyframes pulse {
    50% {
      transform: scale(1.06);
    }
  }
  .corner {
    position: absolute;
    width: 14%;
    height: 14%;
    border: 0 solid var(--text-3);
  }
  .tl {
    top: 0;
    left: 0;
    border-top-width: 2px;
    border-left-width: 2px;
  }
  .tr {
    top: 0;
    right: 0;
    border-top-width: 2px;
    border-right-width: 2px;
  }
  .bl {
    bottom: 0;
    left: 0;
    border-bottom-width: 2px;
    border-left-width: 2px;
  }
  .br {
    bottom: 0;
    right: 0;
    border-bottom-width: 2px;
    border-right-width: 2px;
  }
</style>
