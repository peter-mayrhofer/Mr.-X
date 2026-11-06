<!-- Screen 20 (Liste): vergangene Läufe dieses Spiels mit Sieger, Dauer und Anzahl Teams. -->
<script lang="ts">
  import { Trophy } from "@lucide/svelte";
  import type { ArchiveListEntry } from "@mrx/shared";
  import AppBar from "../ui/AppBar.svelte";
  import ListItem from "../ui/ListItem.svelte";
  import Skeleton from "../ui/Skeleton.svelte";
  import { datum, dauer } from "../lib/format.ts";
  import { T } from "../texte.ts";
  import AmbientBackdrop from "../ui/AmbientBackdrop.svelte";

  let { runs, onopen, onback }: { runs: ArchiveListEntry[] | null; onopen: (run: string) => void; onback: () => void } = $props();
</script>

<AmbientBackdrop />
<main class="list">
  <AppBar title={T.archiv.titel} {onback} />
  <div class="items">
    {#if !runs}
      <Skeleton h="72px" r="var(--r-l)" />
      <Skeleton h="72px" r="var(--r-l)" />
    {:else}
      {#each runs as a (a.run)}
        <ListItem
          title={a.name}
          subtitle="{T.ende.sieger}: {a.winner ?? '–'} · {datum(a.startedAt)} · {dauer(a.durationMs)} · {a.teams} Teams"
          onclick={() => onopen(a.run)}
          chevron
        >
          {#snippet lead()}<span class="trophy"><Trophy size={26} aria-hidden="true" /></span>{/snippet}
          {#snippet trail()}<span class="win">{a.winner ?? "–"}</span>{/snippet}
        </ListItem>
      {:else}
        <p class="muted">{T.archiv.leer}</p>
      {/each}
    {/if}
  </div>
</main>

<style>
  .list {
    min-height: 100dvh;
  }
  .items {
    display: grid;
    gap: 2px;
    padding: var(--sp-3) var(--sp-2);
    max-width: 800px;
    margin: 0 auto;
  }
  .muted {
    padding: var(--sp-4);
    color: var(--text-2);
  }
  .trophy {
    width: 48px;
    height: 48px;
    border-radius: var(--r-m);
    display: grid;
    place-items: center;
    background: var(--accent-soft);
    color: var(--accent-text);
  }
  .win {
    display: none;
    align-items: center;
    gap: var(--sp-2);
    font-weight: 700;
  }
  @media (min-width: 600px) {
    .win {
      display: flex;
    }
  }
</style>
