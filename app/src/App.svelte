<!-- Router. Meilenstein 2: Klick-Prototyp (/prototyp) und Komponenten-Seite (/komponenten). -->
<script lang="ts">
  import { router, match } from "./lib/router.svelte.ts";
  import Toaster from "./ui/Toaster.svelte";
  import Gallery from "./proto/Gallery.svelte";
  import ProtoScreen from "./proto/ProtoScreen.svelte";
  import Components from "./proto/Components.svelte";

  const screen = $derived(match("/prototyp/:n"));
</script>

{#if screen}
  {#key router.path}<ProtoScreen n={Number(screen.n)} />{/key}
{:else if match("/komponenten")}
  <Components />
{:else}
  <Gallery />
{/if}
<Toaster />
