<!--
  Rahmen für die Spielleitung (Screens 13–17): auf Laptop Seitenleiste, am Handy untere Navigation
  (Live · Steuerung · Teams · Chat · Mehr).
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { Archive, Map as MapIcon, Menu, MessageCircle, Monitor, Radar, ScrollText, SlidersHorizontal, Users } from "@lucide/svelte";
  import TabBar from "../../ui/TabBar.svelte";
  import BottomSheet from "../../ui/BottomSheet.svelte";
  import ListItem from "../../ui/ListItem.svelte";
  import Logo from "../../ui/Logo.svelte";
  import Pill from "../../ui/Pill.svelte";
  import { go } from "../../lib/router.svelte.ts";
  import { T } from "../../texte.ts";

  let { section, children }: { section: "live" | "steuerung" | "teams" | "zonen" | "protokoll" | "chat"; children: Snippet } = $props();
  let more = $state(false);

  const NAV = [
    { id: "live", label: T.admin.nav.live, icon: Radar, to: "/prototyp/13" },
    { id: "steuerung", label: T.admin.nav.steuerung, icon: SlidersHorizontal, to: "/prototyp/14" },
    { id: "teams", label: T.admin.nav.teams, icon: Users, to: "/prototyp/15" },
    { id: "zonen", label: T.admin.nav.zonen, icon: MapIcon, to: "/prototyp/16" },
    { id: "protokoll", label: T.admin.nav.protokoll, icon: ScrollText, to: "/prototyp/17" },
    { id: "chat", label: T.admin.nav.chat, icon: MessageCircle, to: "/prototyp/13?v=chat" },
    { id: "grossbild", label: T.admin.nav.grossbild, icon: Monitor, to: "/prototyp/18" },
    { id: "archiv", label: T.admin.nav.archiv, icon: Archive, to: "/prototyp/20?v=liste" },
  ];
  const MOBILE = ["live", "steuerung", "teams", "chat"];
</script>

<div class="shell">
  <aside class="side">
    <div class="brand">
      <Logo height={40} />
      <div>
        <strong class="display">Mister X Linz 2027</strong>
        <Pill tone="ok" dot>läuft</Pill>
      </div>
    </div>
    <nav>
      {#each NAV as n (n.id)}
        {@const IconC = n.icon}
        <a href="#{n.to}" class:on={section === n.id} aria-current={section === n.id ? "page" : undefined}>
          <IconC size={22} aria-hidden="true" />{n.label}
        </a>
      {/each}
    </nav>
  </aside>

  <main class="content">{@render children()}</main>

  <div class="tabs">
    <TabBar
      items={[...NAV.filter((n) => MOBILE.includes(n.id)), { id: "mehr", label: T.tabs.mehr, icon: Menu }].map((n) => ({
        id: n.id,
        label: n.id === "teams" ? T.admin.teams : n.label,
        icon: n.icon,
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
  nav a:hover {
    background: var(--surface-2);
  }
  nav a.on {
    background: var(--accent-soft);
    color: var(--accent-text);
  }
  :global([data-theme="sonne"]) nav a.on {
    background: #000;
    color: #fff;
  }
</style>
