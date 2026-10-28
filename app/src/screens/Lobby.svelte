<!-- Screen 5: Warteraum vor Spielstart (Teamliste, Checks, wichtigste Regeln). Für alle Rollen. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { LogOut, MessageCircle, ScrollText } from "@lucide/svelte";
  import type { Config, Team } from "@mrx/shared";
  import Card from "../ui/Card.svelte";
  import Button from "../ui/Button.svelte";
  import TeamBadge from "../ui/TeamBadge.svelte";
  import Pill from "../ui/Pill.svelte";
  import Logo from "../ui/Logo.svelte";
  import Modal from "../ui/Modal.svelte";
  import { ICONS, type Icon } from "../ui/icons.ts";
  import { T } from "../texte.ts";
  import AmbientBackdrop from "../ui/AmbientBackdrop.svelte";

  interface Props {
    gameName: string;
    /** eigenes Team (Rolle Team) – sonst Rolle + Name */
    myTeam?: (Team & { id: string }) | undefined;
    roleLabel: string;
    name: string;
    teams: (Team & { id: string })[];
    config: Config;
    startPlanned?: string | undefined;
    checks?: { label: string; ok: boolean; icon: Icon }[];
    onrules: () => void;
    onchat?: () => void;
    onlogout?: () => Promise<void> | void;
    children?: Snippet;
  }

  let {
    gameName,
    myTeam,
    roleLabel,
    name,
    teams,
    config,
    startPlanned,
    checks = [],
    onrules,
    onchat,
    onlogout,
    children,
  }: Props = $props();
  let confirmOut = $state(false);
  const quick = $derived(T.regeln.liste(config).filter((r) => ["Fangen", "Übergabe", "Meldungen"].includes(r.titel)));
</script>

<AmbientBackdrop />
<main class="lobby">
  <header>
    <Logo height={36} />
    <p class="caps">{gameName}</p>
  </header>

  <section class="hero">
    {#if myTeam}
      <TeamBadge short={myTeam.short} color={myTeam.color} size={96} me />
    {/if}
    <h1>{T.lobby.angemeldet}</h1>
    <p class="name display">{myTeam ? myTeam.name : name}</p>
    {#if !myTeam}<p class="muted">{T.warten.angemeldetAls(roleLabel, name)}</p>{/if}
    <div class="wait" role="status">
      <span class="dotpulse" aria-hidden="true"></span>
      <span class="caps">{T.lobby.warten}</span>
      {#if startPlanned}<span class="muted">· {T.lobby.startGeplant(startPlanned)}</span>{/if}
    </div>
  </section>

  {#if checks.length}
    <div class="checks">
      {#each checks as c (c.label)}<Pill tone={c.ok ? "ok" : "warn"} icon={c.icon}>{c.label}</Pill>{/each}
    </div>
  {/if}

  {#if children}{@render children()}{/if}

  <Card label={T.lobby.teams(teams.length)}>
    {#if teams.length}
      <ul class="teams">
        {#each teams as t (t.id)}
          <li><TeamBadge short={t.short} color={t.color} size={44} me={t.id === myTeam?.id} /><span>{t.name}</span></li>
        {/each}
      </ul>
    {:else}
      <p class="muted">{T.lobby.nochKeine}</p>
    {/if}
  </Card>

  <Card label={T.lobby.regelnKurz}>
    <ul class="rules">
      {#each quick as r (r.titel)}
        {@const IconC = ICONS[r.icon]!}
        <li>
          <IconC size={24} aria-hidden="true" />
          <div>
            <strong>{r.titel}</strong>
            <p class="muted">{r.text}</p>
          </div>
        </li>
      {/each}
    </ul>
  </Card>

  <div class="actions">
    <Button variant="secondary" icon={ScrollText} onclick={onrules}>{T.lobby.alleRegeln}</Button>
    {#if onchat}<Button variant="secondary" icon={MessageCircle} onclick={onchat}>{T.tabs.chat}</Button>{/if}
    {#if onlogout}<Button variant="ghost" icon={LogOut} onclick={() => (confirmOut = true)}>{T.warten.abmelden}</Button>{/if}
  </div>
</main>

{#if onlogout}
  <Modal
    open={confirmOut}
    title={T.einstellungen.abmelden}
    confirm={T.einstellungen.abmelden}
    danger
    onconfirm={onlogout}
    onclose={() => (confirmOut = false)}
  >
    {T.einstellungen.abmeldenFrage}
  </Modal>
{/if}

<style>
  .lobby {
    display: grid;
    gap: var(--sp-4);
    max-width: 640px;
    margin: 0 auto;
    padding: calc(var(--safe-top) + var(--sp-4)) var(--gutter) calc(var(--safe-bottom) + var(--sp-6));
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
    color: var(--text-2);
  }
  .hero {
    display: grid;
    justify-items: center;
    gap: var(--sp-2);
    text-align: center;
    padding: var(--sp-4) 0;
  }
  h1 {
    font-size: var(--fs-3xl);
    text-transform: uppercase;
    margin-top: var(--sp-2);
  }
  .name {
    font-size: var(--fs-2xl);
    color: var(--accent-text);
  }
  .wait {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    flex-wrap: wrap;
    justify-content: center;
    margin-top: var(--sp-2);
  }
  .dotpulse {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--warn);
    animation: blink 1.2s ease-in-out infinite;
  }
  @keyframes blink {
    50% {
      opacity: 0.25;
    }
  }
  .checks {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
    justify-content: center;
  }
  .teams {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: var(--sp-3);
  }
  .teams li {
    display: grid;
    justify-items: center;
    gap: 4px;
    text-align: center;
    font-size: var(--fs-s);
    font-weight: 600;
  }
  .rules {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--sp-3);
  }
  .rules li {
    display: flex;
    gap: var(--sp-3);
  }
  .rules :global(svg) {
    color: var(--accent-text);
    flex: none;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-3);
  }
  .actions > :global(*) {
    flex: 1 1 160px;
  }
</style>
