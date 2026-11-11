<script lang="ts">
  import { fly } from "svelte/transition";
  import { backOut } from "svelte/easing";
  import { CircleCheck, Info, TriangleAlert } from "@lucide/svelte";
  import { toasts } from "./toast.svelte.ts";

  const ICON = { ok: CircleCheck, info: Info, warn: TriangleAlert };
</script>

<div class="toaster" aria-live="polite">
  <!-- höchstens drei auf einmal; sie fangen keine Klicks ab (nur ihr Aktionsknopf), damit nichts darunter blockiert ist -->
  {#each toasts.list.slice(-3) as t (t.id)}
    {@const IconC = ICON[t.tone]}
    <div class="toast {t.tone}" in:fly={{ y: 40, duration: 320, easing: backOut }} out:fly={{ y: 20, duration: 180 }}>
      <IconC size={22} aria-hidden="true" />
      <span>{t.text}</span>
      {#if t.action}<button onclick={t.action.run}>{t.action.label}</button>{/if}
    </div>
  {/each}
</div>

<style>
  .toaster {
    position: fixed;
    left: 50%;
    bottom: calc(88px + var(--safe-bottom));
    translate: -50% 0;
    display: grid;
    gap: var(--sp-2);
    z-index: var(--z-toast);
    width: min(92vw, 480px);
    pointer-events: none;
  }
  .toast {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--sp-4);
    border-radius: var(--r-m);
    background: var(--text);
    color: var(--bg);
    box-shadow: var(--shadow-2);
    font-weight: 600;
  }
  span {
    flex: 1;
  }
  .ok :global(svg) {
    color: var(--ok);
  }
  .warn :global(svg) {
    color: var(--warn);
  }
  button {
    pointer-events: auto;
    min-height: var(--touch);
    padding: 0 var(--sp-3);
    border: 2px solid currentColor;
    border-radius: var(--r-s);
    background: none;
    color: inherit;
    font-weight: 800;
    cursor: pointer;
  }
</style>
