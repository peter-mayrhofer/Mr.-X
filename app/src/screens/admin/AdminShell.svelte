<!--
  Rahmen für die Spielleitung (Screens 13–17): auf Laptop Seitenleiste, am Handy untere Navigation
  (Live · Steuerung · Teams · Chat · Mehr).
-->
<script module lang="ts">
  export type Section = "live" | "steuerung" | "teams" | "zonen" | "protokoll" | "chat" | "grossbild" | "archiv";
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import {
    Archive,
    LogOut,
    Map as MapIcon,
    Menu,
    MessageCircle,
    Monitor,
    Radar,
    ScrollText,
    SlidersHorizontal,
    Users,
  } from "@lucide/svelte";
  import type { Phase } from "@mrx/shared";
  import TabBar from "../../ui/TabBar.svelte";
  import BottomSheet from "../../ui/BottomSheet.svelte";
  import ListItem from "../../ui/ListItem.svelte";
  import Logo from "../../ui/Logo.svelte";
  import Pill from "../../ui/Pill.svelte";
  import { go } from "../../lib/router.svelte.ts";
  import { T } from "../../texte.ts";

  interface Props {
    section: Section;
    gameName: string;
    phase: Phase;
    /** Adresse eines Bereichs; Bereiche ohne Adresse werden nicht angezeigt */
    link: (id: Section) => string | null;
    /** Ungelesene Direktnachrichten */
    unread?: number;
    /** Probelauf: sichtbar markieren */
    trial?: boolean;
    onlogout?: () => void;
    children: Snippet;
  }
  let { section, gameName, phase, link, unread = 0, trial = false, onlogout, children }: Props = $props();
  let more = $state(false);

  const ALL: { id: Section; label: string; icon: typeof Radar }[] = [
    { id: "live", label: T.admin.nav.live, icon: Radar },
    { id: "steuerung", label: T.admin.nav.steuerung, icon: SlidersHorizontal },
    { id: "teams", label: T.admin.nav.teams, icon: Users },
    { id: "zonen", label: T.admin.nav.zonen, icon: MapIcon },
    { id: "protokoll", label: T.admin.nav.protokoll, icon: ScrollText },
    { id: "chat", label: T.admin.nav.chat, icon: MessageCircle },
    { id: "grossbild", label: T.admin.nav.grossbild, icon: Monitor },
    { id: "archiv", label: T.admin.nav.archiv, icon: Archive },
  ];
  const NAV = $derived(ALL.flatMap((n) => (link(n.id) ? [{ ...n, to: link(n.id)! }] : [])));
  const MOBILE = ["live", "steuerung", "teams", "chat"];
  const TONE: Record<Phase, "ok" | "info" | "warn" | "neutral"> = { laeuft: "ok", vorbereitung: "info", pause: "warn", beendet: "neutral" };
</script>

<div class="shell">
  <aside class="side" aria-label={T.admin.menue}>
    <div class="brand">
      <Logo height={40} />
      <div>
        <strong class="display">{gameName}</strong>
        <Pill tone={TONE[phase]} dot>{T.superadmin.phase[phase]}</Pill>
        {#if trial}<Pill tone="info">{T.status.probelauf}</Pill>{/if}
      </div>
    </div>
    <nav>
      {#each NAV as n (n.id)}
        {@const IconC = n.icon}
        <a href="#{n.to}" class:on={section === n.id} aria-current={section === n.id ? "page" : undefined}>
          <IconC size={22} aria-hidden="true" />{n.label}
          {#if n.id === "chat" && unread}<span class="badge num">{unread}</span>{/if}
        </a>
      {/each}
    </nav>
    {#if onlogout}<button class="out" onclick={onlogout}><LogOut size={22} aria-hidden="true" />{T.einstellungen.abmelden}</button>{/if}
  </aside>

  <main class="content">{@render children()}</main>

  <div class="tabs">
    <TabBar
      items={[...NAV.filter((n) => MOBILE.includes(n.id)), { id: "mehr", label: T.tabs.mehr, icon: Menu }].map((n) => ({
        id: n.id,
        label: n.id === "teams" ? T.admin.teams : n.label,
        icon: n.icon,
        badge: n.id === "chat" ? unread : 0,
      }))}
      active={MOBILE.includes(section) ? section : "mehr"}
      onselect={(id) => (id === "mehr" ? (more = true) : go(NAV.find((n) => n.id === id)!.to))}
    />
  </div>
</div>

<BottomSheet open={more} title={T.tabs.mehr} onclose={() => (more = false)}>
  {#each NAV.filter((n) => !MOBILE.includes(n.id)) as n (n.id)}
    {@const IconC = n.icon}
    <ListItem title={n.label} onclick={() => go(n.to)} chevron>
      {#snippet lead()}<IconC size={24} aria-hidden="true" />{/snippet}
    </ListItem>
  {/each}
  {#if onlogout}
    <ListItem title={T.einstellungen.abmelden} onclick={onlogout}>
      {#snippet lead()}<LogOut size={24} aria-hidden="true" />{/snippet}
    </ListItem>
  {/if}
</BottomSheet>

<style>
  .shell {
    position: fixed;
    inset: 0;
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: 1fr auto;
  }
  .side {
    display: none;
  }
  .content {
    min-height: 0;
    overflow: auto;
    position: relative;
  }
  /* Bereichswechsel: der neue Inhalt blendet weich ein */
  .content > :global(*) {
    animation: einblenden var(--dur-2) var(--ease-out);
  }
  @media (min-width: 1000px) {
    .shell {
      grid-template-columns: 248px 1fr;
      grid-template-rows: 1fr;
    }
    .tabs {
      display: none;
    }
    .side {
      display: flex;
      flex-direction: column;
      gap: var(--sp-6);
      padding: var(--sp-5) var(--sp-3);
      background: var(--surface);
      border-right: var(--border-w) solid var(--line);
      overflow-y: auto;
    }
  }
  .brand {
    display: grid;
    gap: var(--sp-3);
    padding: 0 var(--sp-2);
  }
  .brand div {
    display: grid;
    gap: 6px;
    justify-items: start;
  }
  .brand strong {
    font-size: var(--fs-xl);
  }
  nav {
    display: grid;
    gap: 2px;
  }
  nav a {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    min-height: var(--touch);
    padding: 0 var(--sp-3);
    border-radius: var(--r-m);
    color: var(--text-2);
    text-decoration: none;
    font-weight: 600;
  }
  .out {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    min-height: var(--touch);
    padding: 0 var(--sp-3);
    margin-top: auto;
    border: 0;
    border-radius: var(--r-m);
    background: none;
    color: var(--text-2);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  nav a:hover,
  .out:hover {
    background: var(--surface-2);
  }
  nav a.on {
    background: var(--accent-soft);
    color: var(--accent-text);
  }
  .badge {
    margin-left: auto;
    min-width: 26px;
    height: 26px;
    padding: 0 7px;
    border-radius: var(--r-pill);
    background: var(--accent);
    color: var(--on-accent);
    font-weight: 800;
    display: grid;
    place-items: center;
  }
  :global([data-theme="sonne"]) nav a.on {
    background: #000;
    color: #fff;
  }
</style>
