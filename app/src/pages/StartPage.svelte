<!-- „/“ und „/s/:spiel“ (QR-Link): Startseite; wer schon in einem Spiel ist, landet direkt dort. -->
<script lang="ts">
  import Start from "../screens/Start.svelte";
  import ErrorStates from "../screens/ErrorStates.svelte";
  import { session } from "../lib/session.svelte.ts";
  import { remote } from "../lib/remote.svelte.ts";
  import { call } from "../lib/api.ts";
  import { go } from "../lib/router.svelte.ts";
  import type { Downloads } from "@mrx/shared";
  import { ladeDownloads, meinSystem } from "../lib/downloads.ts";

  let { gameId }: { gameId?: string | undefined } = $props();

  // App zum Herunterladen (docs/DESKTOP-APP.md): /downloads.json sagt, was am Server liegt
  let downloads = $state<Downloads>({});
  void ladeDownloads().then((d) => (downloads = d));

  $effect(() => {
    if (session.ready && session.gameId) go("/spiel");
  });
  const info = remote(
    () => gameId ?? null,
    (id) => call({ action: "gameInfo", gameId: id }),
  );
  const q = $derived(gameId ? `?g=${gameId}` : "");
</script>

{#if gameId && info.loaded && !info.value}
  <ErrorStates variant="nichtGefunden" onaction={() => go("/beitreten")} />
{:else}
  <Start
    system={meinSystem()}
    {downloads}
    game={info.value?.name}
    links={{ join: gameId ? `/beitreten/${gameId}` : "/beitreten", schiri: `/staff/schiri${q}`, admin: `/staff/admin${q}`, help: "/hilfe" }}
  />
{/if}
