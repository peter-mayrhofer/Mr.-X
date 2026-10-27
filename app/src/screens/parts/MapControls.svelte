<!-- Große Kartenknöpfe rechts (Abschnitt 8.4): Mister X zeigen, auf mich, ganzes Spielfeld, Sonnen-Modus. -->
<script lang="ts">
  import { Flag, LocateFixed, Maximize2, Sun } from "@lucide/svelte";
  import IconButton from "../../ui/IconButton.svelte";
  import { theme } from "../../lib/theme.svelte.ts";
  import { T } from "../../texte.ts";

  interface Props {
    onmrx?: () => void;
    onme?: () => void;
    onfield: () => void;
  }

  let { onmrx, onme, onfield }: Props = $props();
</script>

<div class="controls">
  {#if onmrx}<IconButton icon={Flag} label={T.karte.misterXZeigen} tone="accent" onclick={onmrx} />{/if}
  {#if onme}<IconButton icon={LocateFixed} label={T.karte.aufMich} onclick={onme} />{/if}
  <IconButton icon={Maximize2} label={T.karte.ganzesFeld} onclick={onfield} />
  <IconButton icon={Sun} label={T.karte.sonne} active={theme.active === "sonne"} onclick={() => theme.toggleSun()} />
</div>

<style>
  .controls {
    display: grid;
    gap: var(--sp-3);
  }
</style>
