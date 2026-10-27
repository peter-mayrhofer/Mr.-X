<!--
  Hauptansicht für Teams (Screens 6, 7, 8, 10, 11, 22): Vollbild-Karte, Statusleiste, Kartenknöpfe,
  untere Navigation Karte · Chat · Regeln · Mehr. Mister-X-Modus = rote Farbwelt + Rahmen (Abschnitt 7.3).
-->
<script lang="ts">
  import { Flag, LogOut, Map as MapIcon, MessageCircle, Menu, ScrollText, Settings, Shrink, Users, X } from "@lucide/svelte";
  import { zoneStatus } from "@mrx/shared";
  import GameMap, { type MapPin } from "../map/GameMap.svelte";
  import StatusCard from "./parts/StatusCard.svelte";
  import MapControls from "./parts/MapControls.svelte";
  import LockOverlay from "./parts/LockOverlay.svelte";
  import HandoverScene from "./parts/HandoverScene.svelte";
  import ChatView from "./parts/ChatView.svelte";
  import RulesView from "./parts/RulesView.svelte";
  import SettingsView from "./parts/SettingsView.svelte";
  import TabBar from "../ui/TabBar.svelte";
  import Banner from "../ui/Banner.svelte";
  import ListItem from "../ui/ListItem.svelte";
  import AppBar from "../ui/AppBar.svelte";
  import TeamBadge from "../ui/TeamBadge.svelte";
  import IconButton from "../ui/IconButton.svelte";
  import { clock } from "../lib/clock.svelte.ts";
  import { uhr, vor, meter } from "../lib/format.ts";
  import { signal } from "../lib/signal.ts";
  import { go } from "../lib/router.svelte.ts";
  import { T } from "../texte.ts";
  import * as M from "../proto/mock.svelte.ts";

  type Tab = "karte" | "chat" | "regeln" | "mehr";
  interface Props {
    mode?: "jaeger" | "mrx";
    tab?: Tab;
    overlay?: "lock" | "handover-alle" | "handover-neu" | "handover-erwischt" | null;
    variant?: string;
  }

  let { mode = "jaeger", tab = $bindable("karte"), overlay = $bindable(null), variant = "" }: Props = $props();
  let sub = $state<"menu" | "einstellungen" | "team">("menu");
  let ruleHint = $state(true);
  let map: GameMap | undefined = $state();

  const isMrx = $derived(mode === "mrx");
  const me = $derived(isMrx ? M.positions[M.MRX]! : M.positions[M.ME]!);
  const myTeam = $derived(isMrx ? M.teams[M.MRX]! : M.teams[M.ME]!);
  const mrxTeam = M.teams[M.MRX]!;
  const shrinking = $derived(variant === "verkleinerung");
  const locked = $derived(shrinking ? [...M.game.locked, "norden"] : M.game.locked);
  const trail = $derived(M.reports.filter((r) => r.t >= M.game.mrxSince));
  const last = $derived(trail.at(-1));

  // Spielfeld-Warnung für Mister X: gelb unter 50 m, rot draußen (Abschnitt 7.3)
  const zone = $derived(
    variant === "grenze" ? "grenze" : variant === "draussen" ? "draussen" : isMrx ? zoneStatus(me, M.field, locked) : "drinnen",
  );

  const pins = $derived<MapPin[]>([
    ...(last
      ? [
          {
            key: "mrx",
            lat: last.lat,
            lng: last.lng,
            props: {
              kind: "mrx" as const,
              label: vor(last.t, clock.now),
              sub: [uhr(last.t), T.karte.quelle[last.src]].filter(Boolean).join(" · "),
              ping: M.game.ping,
            },
          },
        ]
      : []),
    { key: "me", lat: me.lat, lng: me.lng, props: { kind: "me" as const, heading: me.heading, label: T.karte.wir } },
  ]);

  const unread = $derived(tab === "chat" ? 0 : 3);
  const tabs = $derived([
    { id: "karte", label: T.tabs.karte, icon: MapIcon },
    { id: "chat", label: T.tabs.chat, icon: MessageCircle, badge: unread },
    { id: "regeln", label: T.tabs.regeln, icon: ScrollText },
    { id: "mehr", label: T.tabs.mehr, icon: Menu },
  ]);

  function showReport(id: string) {
    const r = M.reports.find((x) => x.id === id);
    tab = "karte";
    if (r) setTimeout(() => map?.flyTo(r), 50);
  }

  function sendChat(text: string, ch: "alle" | "dm") {
    const msg = { id: `p${Date.now()}`, uid: "u-ur", name: myTeam.name, teamId: M.ME, kind: "msg" as const, t: clock.now, text };
    (ch === "alle" ? M.chat : M.dm).push(msg);
    signal("nachricht");
  }
</script>

<div class="screen" class:mrx={isMrx}>
  <div class="mapzone">
    <GameMap
      bind:this={map}
      field={M.field}
      {locked}
      preview={shrinking ? ["norden"] : []}
      {trail}
      {pins}
      accuracy={me}
      padding={{ top: 190, bottom: 90, left: 24, right: 90 }}
    />

    <div class="top">
      {#if variant === "durchsage"}
        <Banner tone="ann" title={T.chat.durchsage} live>Treffpunkt nach dem Spiel: Hauptplatz beim Brunnen.</Banner>
      {/if}
      {#if shrinking}
        <div class="shrink">
          <Banner tone="warn" icon={Shrink} title="Der Norden wird gesperrt!" live
            >Schraffierter Bereich gehört nicht mehr zum Spielfeld.</Banner
          >
        </div>
      {/if}
      {#if isMrx && zone === "grenze"}
        <Banner tone="warn" live>{T.mrx.grenzeNah(35)}</Banner>
      {:else if isMrx && zone === "draussen"}
        <Banner tone="danger" live>{T.mrx.draussen}</Banner>
      {/if}
      <StatusCard
        {mrxTeam}
        {isMrx}
        nextReportAt={M.game.nextReportAt}
        intervalMs={M.config.intervalMin * 60_000}
        startedAt={M.game.startedAt}
        gpsAcc={me.acc}
        online={variant !== "offline"}
        lastDataAt={clock.now - 4 * 60_000}
      />
    </div>

    <div class="side">
      <MapControls onmrx={last ? () => map?.flyTo(last) : undefined} onme={() => map?.flyTo(me)} onfield={() => map?.fitField()} />
    </div>

    <div class="bottom">
      {#if isMrx && ruleHint}
        <div class="hint">
          <Flag size={24} aria-hidden="true" />
          <div>
            <strong class="caps">{T.mrx.regelnTitel}</strong>
            <ul>
              {#each T.mrx.regeln as r (r)}<li>{r}</li>{/each}
            </ul>
          </div>
          <IconButton icon={X} label={T.allgemein.schliessen} size="m" tone="plain" onclick={() => (ruleHint = false)} />
        </div>
      {:else if last && !isMrx}
        <button class="lastchip" onclick={() => map?.flyTo(last)}>
          <span class="caps">{T.karte.letzteMeldung}</span>
          <span><strong class="num">{uhr(last.t)}</strong> · {vor(last.t, clock.now)}</span>
        </button>
      {/if}
    </div>

    {#if tab !== "karte"}
      <div class="pane">
        {#if tab === "chat"}
          <ChatView group={M.chat} direct={M.dm} teams={M.teams} myUid="u-ur" onreport={showReport} onsend={sendChat} />
        {:else if tab === "regeln"}
          <AppBar title={T.regeln.titel} />
          <RulesView config={M.config} />
        {:else if sub === "einstellungen"}
          <AppBar title={T.einstellungen.titel} onback={() => (sub = "menu")} />
          <SettingsView onlogout={() => go("/prototyp/1")} />
        {:else if sub === "team"}
          <AppBar title={T.mehr.team} onback={() => (sub = "menu")} />
          <div class="teaminfo">
            <TeamBadge short={myTeam.short} color={myTeam.color} size={88} mrx={isMrx} />
            <h2>{myTeam.name}</h2>
            <p class="muted">2 Geräte angemeldet · {meter(M.stats[M.ME]!.distM)} gelaufen</p>
          </div>
        {:else}
          <AppBar title={T.mehr.titel} />
          <div class="menu">
            <ListItem title={T.mehr.team} subtitle={myTeam.name} onclick={() => (sub = "team")} chevron>
              {#snippet lead()}<Users size={26} aria-hidden="true" />{/snippet}
            </ListItem>
            <ListItem
              title={T.mehr.einstellungen}
              subtitle="Darstellung, Ton, Benachrichtigungen"
              onclick={() => (sub = "einstellungen")}
              chevron
            >
              {#snippet lead()}<Settings size={26} aria-hidden="true" />{/snippet}
            </ListItem>
            <ListItem title={T.mehr.regeln} onclick={() => (tab = "regeln")} chevron>
              {#snippet lead()}<ScrollText size={26} aria-hidden="true" />{/snippet}
            </ListItem>
            <ListItem title={T.mehr.abmelden} onclick={() => (sub = "einstellungen")} chevron>
              {#snippet lead()}<LogOut size={26} aria-hidden="true" />{/snippet}
            </ListItem>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <TabBar items={tabs} active={tab} onselect={(id) => ((tab = id as Tab), (sub = "menu"))} />
</div>

{#if overlay === "lock"}
  <LockOverlay until={M.locks.bindermichl!} total={M.config.waitMin * 60_000} />
{:else if overlay === "handover-alle"}
  <HandoverScene
    variant="alle"
    from={M.teams.spallerhof!}
    to={mrxTeam}
    waitMin={M.config.waitMin}
    at={clock.now}
    onclose={() => (overlay = null)}
  />
{:else if overlay === "handover-neu"}
  <HandoverScene
    variant="neuMrx"
    from={M.teams.spallerhof!}
    to={mrxTeam}
    waitMin={M.config.waitMin}
    at={clock.now}
    onclose={() => (overlay = null)}
  />
{:else if overlay === "handover-erwischt"}
  <HandoverScene
    variant="erwischt"
    from={M.teams.spallerhof!}
    to={mrxTeam}
    waitMin={M.config.waitMin}
    at={clock.now}
    onclose={() => (overlay = "lock")}
  />
{/if}

<style>
  .screen {
    position: fixed;
    inset: 0;
    display: grid;
    grid-template-rows: 1fr auto;
  }
  .mapzone {
    position: relative;
    min-height: 0;
    overflow: hidden;
  }
  .top {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: var(--z-ui);
    display: grid;
    gap: var(--sp-2);
    padding: calc(var(--safe-top) + var(--sp-3)) var(--gutter) 0;
    pointer-events: none;
  }
  .top > :global(*) {
    pointer-events: auto;
  }
  .shrink {
    animation: drop var(--dur-3) var(--ease-out);
  }
  @keyframes drop {
    from {
      transform: translateY(-20px);
      opacity: 0;
    }
  }
  .side {
    position: absolute;
    right: var(--gutter);
    bottom: 96px;
    z-index: var(--z-ui);
  }
  .bottom {
    position: absolute;
    left: var(--gutter);
    right: calc(var(--gutter) + var(--touch-l) + var(--sp-3));
    bottom: var(--sp-6);
    z-index: var(--z-ui);
  }
  .lastchip {
    display: inline-grid;
    justify-items: start;
    min-height: var(--touch-l);
    padding: var(--sp-1) var(--sp-4);
    border-radius: var(--r-m);
    border: var(--border-w) solid var(--line);
    background: var(--glass);
    color: var(--text);
    box-shadow: var(--shadow-1);
    cursor: pointer;
    font-size: var(--fs-m);
  }
  .lastchip .caps {
    color: var(--accent-text);
    font-size: 15px;
  }
  .lastchip strong {
    font-family: var(--font-display);
    font-size: var(--fs-xl);
  }
  .hint {
    display: flex;
    align-items: flex-start;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--sp-2) var(--sp-3) var(--sp-4);
    border-radius: var(--r-l);
    background: var(--glass);
    border: 2px solid var(--accent);
    box-shadow: var(--shadow-2);
  }
  .hint > :global(svg) {
    color: var(--accent-text);
    flex: none;
    margin-top: 2px;
  }
  .hint div {
    flex: 1;
  }
  .hint ul {
    display: flex;
    flex-wrap: wrap;
    gap: 4px var(--sp-3);
    margin: 4px 0 0;
    padding: 0;
    list-style: none;
    font-weight: 600;
  }
  .hint li {
    white-space: nowrap;
  }
  .hint li::before {
    content: "✓ ";
    color: var(--ok-text);
  }
  .pane {
    position: absolute;
    inset: 0;
    z-index: calc(var(--z-ui) + 1);
    background: var(--bg);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
  .menu {
    padding: var(--sp-3) var(--sp-2);
    display: grid;
    gap: 2px;
  }
  .teaminfo {
    display: grid;
    justify-items: center;
    gap: var(--sp-3);
    padding: var(--sp-8) var(--gutter);
    text-align: center;
  }
  /* Mister-X-Modus: roter Rahmen um den ganzen Bildschirm */
  .mrx .mapzone::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: var(--z-ui);
    pointer-events: none;
    border: 6px solid var(--accent);
    box-shadow: inset 0 0 40px rgb(197 26 26 / 0.55);
  }
</style>
