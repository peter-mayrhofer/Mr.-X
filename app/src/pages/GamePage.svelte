<!--
  „/spiel“: alles nach dem Beitritt. Teams: TeamPage, Schiri und Spielleitung: StaffGamePage.
  Großbild und Zuschauer sehen vorerst den Warteraum – ihre Ansichten folgen in Meilenstein 10.
-->
<script lang="ts">
  import Lobby from "../screens/Lobby.svelte";
  import ErrorStates from "../screens/ErrorStates.svelte";
  import Skeleton from "../ui/Skeleton.svelte";
  import TeamPage from "./TeamPage.svelte";
  import StaffGamePage from "./StaffGamePage.svelte";
  import { session, leaveGame } from "../lib/session.svelte.ts";
  import { go } from "../lib/router.svelte.ts";
  import { T } from "../texte.ts";

  const g = $derived(session.gameId);
  const view = $derived(session.view);
  const list = $derived(Object.entries(view?.teams ?? {}).map(([id, t]) => ({ id, ...t })));

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
  <StaffGamePage {g} uid={session.uid} member={view.me} gameName={view.info.name} />
{:else}
  <Lobby
    gameName={view.info.name}
    roleLabel={T.warten.rolle[view.me.role]}
    name={view.me.name}
    teams={list}
    config={view.config}
    onrules={() => go("/hilfe")}
    onlogout={async () => {
      await leaveGame();
      go("/");
    }}
  />
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
