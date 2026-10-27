<!--
  „/spiel“: alles nach dem Beitritt. Teams: TeamPage, Schiri und Spielleitung: StaffGamePage,
  Großbild und Zuschauer: ScreenPage (Zuschauer ohne Live-Positionen).
-->
<script lang="ts">
  import ErrorStates from "../screens/ErrorStates.svelte";
  import Skeleton from "../ui/Skeleton.svelte";
  import TeamPage from "./TeamPage.svelte";
  import { session, leaveGame } from "../lib/session.svelte.ts";
  import { go } from "../lib/router.svelte.ts";
  import { T } from "../texte.ts";

  const g = $derived(session.gameId);
  const view = $derived(session.view);

  $effect(() => {
    if (session.ready && !session.gameId && !session.removed) go("/");
  });
</script>

{#if session.removed === "version"}
  <ErrorStates variant="veraltet" onaction={() => location.reload()} />
{:else if session.removed}
  <ErrorStates
    variant="entfernt"
    onaction={async () => {
      await leaveGame();
      go("/");
    }}
  />
{:else if !g || !view || !session.uid}
  <div class="wait" aria-busy="true" aria-label={T.allgemein.laden}>
    <Skeleton h="96px" w="96px" r="50%" />
    <Skeleton h="40px" />
    <Skeleton h="200px" r="var(--r-l)" />
  </div>
{:else if view.me.role === "team"}
  <TeamPage {g} uid={session.uid} member={view.me} gameName={view.info.name} />
{:else if view.me.role === "schiri" || view.me.role === "admin"}
  <!-- Teams brauchen den Spielleitungs- und Großbild-Teil nie: der wird erst hier geladen -->
  {#await import("./StaffGamePage.svelte") then { default: StaffGamePage }}
    <StaffGamePage {g} uid={session.uid} member={view.me} gameName={view.info.name} />
  {/await}
{:else}
  {#await import("./ScreenPage.svelte") then { default: ScreenPage }}
    {#if view.me.role === "screen"}
      <ScreenPage gameName={view.info.name} onarchive={() => go("/archiv")} />
    {:else}
      <ScreenPage
        gameName={view.info.name}
        viewer
        onleave={async () => {
          await leaveGame();
          go("/");
        }}
      />
    {/if}
  {/await}
{/if}

<style>
  .wait {
    display: grid;
    justify-items: center;
    gap: var(--sp-4);
    padding: var(--sp-10) var(--gutter);
    max-width: 640px;
    margin: 0 auto;
  }
</style>
