<!-- Kopfzeile für Unterseiten: Zurück, Titel, optionale Aktionen. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { ArrowLeft } from "@lucide/svelte";
  import IconButton from "./IconButton.svelte";
  import { T } from "../texte.ts";

  let { title, onback, actions }: { title: string; onback?: () => void; actions?: Snippet } = $props();
</script>

<header class="bar">
  {#if onback}<IconButton icon={ArrowLeft} label={T.allgemein.zurueck} tone="plain" onclick={onback} />{/if}
  <h1>{title}</h1>
  {#if actions}<div class="act">{@render actions()}</div>{/if}
</header>

<style>
  .bar {
    position: sticky;
    top: 0;
    z-index: var(--z-ui);
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    min-height: 64px;
    padding: calc(var(--safe-top) + 4px) var(--sp-3) 4px;
    background: var(--bg);
    border-bottom: var(--border-w) solid var(--line);
  }
  h1 {
    flex: 1;
    min-width: 0;
    font-size: var(--fs-2xl);
    padding-left: var(--sp-1);
  }
  .bar:has(.act:not(:empty)) h1 {
    font-size: clamp(var(--fs-l), 6.2vw, var(--fs-2xl));
  }
  .act {
    display: flex;
    gap: var(--sp-2);
  }
</style>
