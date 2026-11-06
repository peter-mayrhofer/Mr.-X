<!-- „/archiv“ und „/archiv/:lauf“: vergangene Läufe des eigenen Spiels, Wiederholung mit Zeitschieberegler (Meilenstein 10). -->
<script lang="ts">
  import type { ApiReason } from "@mrx/shared";
  import Archive from "../screens/Archive.svelte";
  import Replay from "../screens/Replay.svelte";
  import ErrorStates from "../screens/ErrorStates.svelte";
  import Skeleton from "../ui/Skeleton.svelte";
  import { session } from "../lib/session.svelte.ts";
  import { remote } from "../lib/remote.svelte.ts";
  import { ApiError, call } from "../lib/api.ts";
  import { go } from "../lib/router.svelte.ts";
  import { toast } from "../ui/toast.svelte.ts";
  import { T } from "../texte.ts";

  let { run }: { run?: string | undefined } = $props();
  const g = $derived(session.gameId);

  const errText = (e: unknown) =>
    e instanceof ApiError ? (e.reason === "invalid" ? e.message : T.apiFehler[e.reason as ApiReason | "network"]) : T.apiFehler.network;
  const runs = remote(
    () => (g && !run ? g : null),
    async (id) => {
      try {
        return (await call({ action: "archiveList", gameId: id })).runs;
      } catch (e) {
        toast(errText(e), "warn");
        throw e;
      }
    },
  );
  const data = remote(
    () => (g && run ? run : null),
    async (r) => (await call({ action: "archiveGet", gameId: g!, run: r })).archive,
  );
  $effect(() => {
    if (session.ready && !g) go("/");
  });
</script>

{#if run}
  {#if data.value}
    <Replay data={data.value} onback={() => go("/archiv")} />
  {:else if data.loaded}
    <ErrorStates variant="nichtGefunden" onaction={() => go("/archiv")} />
  {:else}
    <div class="wait" aria-busy="true" aria-label={T.allgemein.laden}><Skeleton h="60vh" r="var(--r-l)" /></div>
  {/if}
{:else}
  <Archive runs={runs.loaded ? (runs.value ?? []) : null} onopen={(r) => go(`/archiv/${r}`)} onback={() => go("/spiel")} />
{/if}

<style>
  .wait {
    padding: var(--sp-6) var(--gutter);
  }
</style>
