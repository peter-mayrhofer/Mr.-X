<!--
  „/spiel“: alles nach dem Beitritt. Meilenstein 3: Warteraum für alle Rollen, Spielleitung mit Zugängen.
  Karte, Chat und Spielablauf folgen in Meilenstein 5/6.
-->
<script lang="ts">
  import type { Config, Team } from "@mrx/shared";
  import Lobby from "../screens/Lobby.svelte";
  import ErrorStates from "../screens/ErrorStates.svelte";
  import AccessPanel from "../screens/parts/AccessPanel.svelte";
  import Skeleton from "../ui/Skeleton.svelte";
  import { session, leaveGame } from "../lib/session.svelte.ts";
  import { live } from "../lib/live.svelte.ts";
  import { call } from "../lib/api.ts";
  import { go } from "../lib/router.svelte.ts";
  import { T } from "../texte.ts";

  const g = $derived(session.gameId);
  const teams = live<Record<string, Team>>(() => (g ? `games/${g}/teams` : null));
  const config = live<Config>(() => (g ? `games/${g}/config` : null));
  const list = $derived(Object.entries(teams.value ?? {}).map(([id, t]) => ({ id, ...t })));
  const myTeam = $derived(list.find((t) => t.id === session.member?.teamId));
  const base = `${location.origin}${location.pathname}`;

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
{:else if !g || !session.member || !config.value || !session.info}
  <div class="wait" aria-busy="true" aria-label={T.allgemein.laden}>
    <Skeleton h="96px" w="96px" r="50%" />
    <Skeleton h="40px" />
    <Skeleton h="200px" r="var(--r-l)" />
  </div>
{:else}
  <Lobby
    gameName={session.info.name}
    {myTeam}
    roleLabel={T.warten.rolle[session.member.role]}
    name={session.member.name}
    teams={list}
    config={config.value}
    onrules={() => go("/hilfe")}
    onlogout={async () => {
      await leaveGame();
      go("/");
    }}
  >
    {#if session.member.role === "admin"}
      <section class="access" aria-label={T.warten.zugaenge}>
        <h2 class="caps">{T.warten.zugaenge}</h2>
        <AccessPanel
          gameName={session.info.name}
          joinUrl="{base}#/s/{g}"
          loadScreenUrl={async () => `${base}#/g/${g}?k=${(await call({ action: "screenLink", gameId: g })).key}`}
          onsave={async (kind, value) => {
            await call({ action: "setSecret", gameId: g, kind, value });
          }}
        />
      </section>
    {/if}
  </Lobby>
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
  .access {
    display: grid;
    gap: var(--sp-3);
  }
  .access h2 {
    font-size: var(--fs-s);
    color: var(--text-2);
  }
</style>
