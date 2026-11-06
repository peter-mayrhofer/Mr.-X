<!--
  Team-Abzeichen: Farbe + Kürzel. Mister X = rot mit Fahne. Zustände nie nur über Farbe:
  Wartezeit = Sanduhr, offline = gestrichelt + durchgestrichen-Symbol, wir = blauer Ring.
-->
<script lang="ts">
  import { Flag, Hourglass, WifiOff } from "@lucide/svelte";

  interface Props {
    short: string;
    color: string;
    size?: number;
    mrx?: boolean;
    locked?: boolean;
    offline?: boolean;
    me?: boolean;
    label?: string;
  }

  let { short, color, size = 40, mrx = false, locked = false, offline = false, me = false, label }: Props = $props();
</script>

<span
  class="badge"
  class:mrx
  class:offline
  class:me
  style:--c={color}
  style:--size="{size}px"
  role={label ? "img" : undefined}
  aria-label={label}
>
  {#if mrx}
    <Flag size={size * 0.5} strokeWidth={2.6} aria-hidden="true" />
  {:else}
    <span class="short" aria-hidden={label ? "true" : undefined}>{short}</span>
  {/if}
  {#if locked}<span class="sub warn"><Hourglass size={size * 0.32} strokeWidth={3} aria-hidden="true" /></span>{/if}
  {#if offline}<span class="sub off"><WifiOff size={size * 0.32} strokeWidth={3} aria-hidden="true" /></span>{/if}
</span>

<style>
  .badge {
    position: relative;
    display: inline-grid;
    place-items: center;
    flex: none;
    width: var(--size);
    height: var(--size);
    border-radius: 50%;
    /* abgedunkelt, damit das weiße Kürzel auf jeder Teamfarbe ≥ 4,5:1 hat (WCAG AA) */
    background: color-mix(in oklab, var(--c) 78%, #000);
    color: #fff;
    border: 2px solid rgb(255 255 255 / 0.9);
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.35);
  }
  .short {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: calc(var(--size) * 0.42);
    letter-spacing: 0.02em;
    line-height: 1;
    text-shadow: 0 1px 1px rgb(0 0 0 / 0.35);
  }
  .mrx {
    background: var(--rf-rot);
    border-color: #fff;
  }
  .me {
    box-shadow:
      0 0 0 3px var(--bg),
      0 0 0 6px var(--me);
  }
  .offline {
    /* gedämpft statt durchsichtig – Kürzel bleibt lesbar */
    background: color-mix(in oklab, var(--c) 35%, #3a4450);
    border-style: dashed;
  }
  .sub {
    position: absolute;
    right: -6px;
    bottom: -6px;
    display: grid;
    place-items: center;
    width: calc(var(--size) * 0.5);
    height: calc(var(--size) * 0.5);
    border-radius: 50%;
    border: 2px solid var(--bg);
  }
  .warn {
    background: var(--warn);
    color: var(--on-warn);
  }
  .off {
    background: var(--surface-3);
    color: var(--text);
  }
</style>
