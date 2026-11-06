<!-- Zahl mit großen −/+ Knöpfen (Einstellungen mit Handschuhen bedienbar). -->
<script lang="ts">
  import { Minus, Plus } from "@lucide/svelte";

  interface Props {
    label: string;
    value: number;
    unit: string;
    min?: number;
    max?: number;
    step?: number;
    hint?: string;
  }

  let { label, value = $bindable(), unit, min = 0, max = 999, step = 1, hint }: Props = $props();
  const uid = $props.id();
</script>

<div class="stepper">
  <div class="txt">
    <span id="l-{uid}">{label}</span>
    {#if hint}<small>{hint}</small>{/if}
  </div>
  <div class="ctl" role="group" aria-labelledby="l-{uid}">
    <button type="button" aria-label="weniger" disabled={value <= min} onclick={() => (value = Math.max(min, value - step))}>
      <Minus size={22} strokeWidth={2.6} aria-hidden="true" />
    </button>
    <output class="num" aria-live="polite">{value} <span>{unit}</span></output>
    <button type="button" aria-label="mehr" disabled={value >= max} onclick={() => (value = Math.min(max, value + step))}>
      <Plus size={22} strokeWidth={2.6} aria-hidden="true" />
    </button>
  </div>
</div>

<style>
  .stepper {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    flex-wrap: wrap;
    min-height: var(--touch-l);
  }
  .txt {
    flex: 1 1 140px;
    display: grid;
  }
  small {
    color: var(--text-3);
    font-size: var(--fs-s);
  }
  .ctl {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }
  button {
    width: var(--touch);
    height: var(--touch);
    border-radius: var(--r-m);
    border: var(--border-w) solid var(--line);
    background: var(--surface-2);
    color: var(--text);
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.4;
  }
  output {
    min-width: 88px;
    text-align: center;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: var(--fs-xl);
  }
  output span {
    font-size: var(--fs-s);
    color: var(--text-2);
  }
</style>
