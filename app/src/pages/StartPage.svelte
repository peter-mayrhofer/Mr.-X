<!-- „/“ und „/s/:spiel“ (QR-Link): Startseite; wer schon in einem Spiel ist, landet direkt dort. -->
<script lang="ts">
  import type { GameInfo } from "@mrx/shared";
  import Start from "../screens/Start.svelte";
  import ErrorStates from "../screens/ErrorStates.svelte";
  import { session, ensureDevice } from "../lib/session.svelte.ts";
  import { live } from "../lib/live.svelte.ts";
  import { go } from "../lib/router.svelte.ts";

  let { gameId }: { gameId?: string | undefined } = $props();

  $effect(() => {
    if (session.ready && session.gameId) go("/spiel");
  });
  // Spielname lesen braucht ein (anonymes) Konto
  $effect(() => {
    if (gameId) void ensureDevice();
  });
  const info = live<GameInfo>(() => (gameId && session.user ? `games/${gameId}/info` : null));
  const q = $derived(gameId ? `?g=${gameId}` : "");
</script>

{#if gameId && info.loaded && !info.value}
  <ErrorStates variant="nichtGefunden" onaction={() => go("/beitreten")} />
{:else}
  <Start
    game={info.value?.name}
    links={{ join: gameId ? `/beitreten/${gameId}` : "/beitreten", schiri: `/staff/schiri${q}`, admin: `/staff/admin${q}`, help: "/hilfe" }}
  />
{/if}
