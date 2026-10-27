<!--
  „/spiel“: alles nach dem Beitritt. Teams: TeamPage, Schiri und Spielleitung: StaffGamePage.
  Großbild und Zuschauer sehen vorerst den Warteraum – ihre Ansichten folgen in Meilenstein 10.
-->
<script lang="ts">
  import type { Config, Team } from "@mrx/shared";
  import Lobby from "../screens/Lobby.svelte";
  import ErrorStates from "../screens/ErrorStates.svelte";
  import Skeleton from "../ui/Skeleton.svelte";
  import TeamPage from "./TeamPage.svelte";
  import StaffGamePage from "./StaffGamePage.svelte";
  import { session, leaveGame } from "../lib/session.svelte.ts";
  import { live } from "../lib/live.svelte.ts";
  import { go } from "../lib/router.svelte.ts";
  import { T } from "../texte.ts";

  const g = $derived(session.gameId);
  const teams = live<Record<string, Team>>(() => (g ? `games/${g}/teams` : null));
  const config = live<Config>(() => (g ? `games/${g}/config` : null));
  const list = $derived(Object.entries(teams.value ?? {}).map(([id, t]) => ({ id, ...t })));

  $effect(() => {
    if (session.ready && !session.gameId && !session.removed) go("/");
  });
</script>

{#if session.removed}
  <ErrorStates
    variant="entfernt"
    onaction={async () => {
      await leaveGame();
      go("/");
    }}
  />
{:else if !g || !session.member || !config.value || !session.info || !session.user}
  <div class="wait" aria-busy="true" aria-label={T.allgemein.laden}>
    <Skeleton h="96px" w="96px" r="50%" />
    <Skeleton h="40px" />
    <Skeleton h="200px" r="var(--r-l)" />
  </div>
{:else if session.member.role === "team"}
  <TeamPage {g} uid={session.user.uid} member={session.member} gameName={session.info.name} />
{:else if session.member.role === "schiri" || session.member.role === "admin"}
  <StaffGamePage {g} uid={session.user.uid} member={session.member} gameName={session.info.name} />
{:else}
  <Lobby
    gameName={session.info.name}
    roleLabel={T.warten.rolle[session.member.role]}
    name={session.member.name}
    teams={list}
    config={config.value}
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
