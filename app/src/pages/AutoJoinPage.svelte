<!-- Zuschauer-Link „/z/:spiel“ und Großbild-Link „/g/:spiel?k=…“: treten ohne Formular bei. -->
<script lang="ts">
  import { onMount } from "svelte";
  import ErrorStates from "../screens/ErrorStates.svelte";
  import Skeleton from "../ui/Skeleton.svelte";
  import { startSession } from "../lib/session.svelte.ts";
  import { call } from "../lib/api.ts";
  import { go, query } from "../lib/router.svelte.ts";

  let { role, gameId }: { role: "viewer" | "screen"; gameId: string } = $props();
  let failed = $state(false);

  async function join() {
    failed = false;
    try {
      startSession(gameId, await call({ action: "join", gameId, role, name: "", secret: query().get("k") ?? "" }));
      go("/spiel");
    } catch {
      failed = true;
    }
  }
  onMount(join);
</script>

{#if failed}
  <ErrorStates variant="nichtGefunden" onaction={join} />
{:else}
  <div class="wait" aria-busy="true">
    <Skeleton h="56px" r="var(--r-l)" />
    <Skeleton h="240px" r="var(--r-l)" />
  </div>
{/if}

<style>
  .wait {
    display: grid;
    gap: var(--sp-4);
    padding: var(--sp-8) var(--gutter);
    max-width: 640px;
    margin: 0 auto;
  }
</style>
