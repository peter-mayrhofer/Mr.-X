<!--
  Hauptansicht für Teams (Screens 6, 7, 8, 10, 11, 22): Vollbild-Karte, Statusleiste, Kartenknöpfe,
  untere Navigation Karte · Chat · Regeln · Mehr. Mister-X-Modus = rote Farbwelt + Rahmen (Abschnitt 7.3).
-->
<script module lang="ts">
  import type { Config, Field, GameState, Lock, Position, Report, Team } from "@mrx/shared";
  import type { Keyed, Msg } from "../lib/game.svelte.ts";

  /** Alles, was die Team-Ansicht zeigt – im echten Spiel live aus der Datenbank, im Prototyp aus Testdaten */
  export interface TeamView {
    field: Field;
    config: Config;
    state: GameState;
    teams: Record<string, Team>;
    myTeamId: string;
    myUid: string;
    /** eigener Standort (GPS dieses Handys) */
    me: Position | null;
    reports: Keyed<Report>[];
    /** eigene Wartezeit */
    lock: (Lock & { caught?: boolean }) | null;
    chat: Msg[];
    dm: Msg[];
    online: boolean;
    lastDataAt: number;
    distM: number;
  }

  /** Übergabe-Moment (Screen 9) */
  export interface Scene {
    variant: "alle" | "neuMrx" | "erwischt";
    from: string;
    to: string;
    type: "fang" | "strafe";
    at: number;
  }
</script>

<script lang="ts">
  import { Flag, LogOut, Map as MapIcon, MessageCircle, Menu, ScrollText, Settings, Shrink, Users, X } from "@lucide/svelte";
  import { distanceToBoundaryM, zoneStatus, type ZoneStatus } from "@mrx/shared";
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
  import type { PushState } from "../lib/push.svelte.ts";
  import { T } from "../texte.ts";

  type Tab = "karte" | "chat" | "regeln" | "mehr";
  interface Props {
    view: TeamView;
    tab?: Tab;
    scene?: Scene | null;
    /** neueste Durchsage, solange sie oben stehen soll */
    announcement?: Msg | null;
    /** gerade gesperrter Bereich → Banner + Hervorhebung auf der Karte */
    shrinking?: string | null;
    /** nur Prototyp: Spielfeld-Warnung erzwingen */
    zoneOverride?: ZoneStatus;
    onsend: (text: string, channel: "alle" | "dm") => void;
    onlogout: () => void;
    push?: PushState;
  }

  let {
    view,
    tab = $bindable("karte"),
    scene = $bindable(null),
    announcement = null,
    shrinking = null,
    zoneOverride,
    onsend,
    onlogout,
    push,
  }: Props = $props();
  let sub = $state<"menu" | "einstellungen" | "team">("menu");
  let ruleHint = $state(true);
  let map: GameMap | undefined = $state();
  let seen = $state(clock.now);

  const st = $derived(view.state);
  const isMrx = $derived(st.mrx === view.myTeamId);
  const me = $derived(view.me);
  const unknown: Team = { name: "–", short: "?", color: "#888" };
  const myTeam = $derived(view.teams[view.myTeamId] ?? unknown);
  const mrxTeam = $derived((st.mrx && view.teams[st.mrx]) || unknown);
  const locked = $derived(Object.keys(st.cuts ?? {}));
  // Spur seit der letzten Übergabe (Abschnitt 7.2), rückgängig gemachte Meldungen nicht
  const trail = $derived(view.reports.filter((r) => !r.void && r.teamId === st.mrx && r.t >= (st.mrxSince ?? 0)));
  const last = $derived(trail.at(-1));
  const firstReport = $derived(!st.lastReportAt || st.lastReportAt <= (st.startedAt ?? 0));

  // Spielfeld-Warnung für Mister X: gelb unter 50 m, rot draußen (Abschnitt 7.3)
  const zone = $derived<ZoneStatus>(zoneOverride ?? (isMrx && me ? zoneStatus(me, view.field, locked) : "drinnen"));
  const edgeM = $derived(me && zone === "grenze" ? Math.round(distanceToBoundaryM(me, view.field, locked)) : 0);

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
              ping: trail.length,
            },
          },
        ]
      : []),
    ...(me ? [{ key: "me", lat: me.lat, lng: me.lng, props: { kind: "me" as const, heading: me.heading, label: T.karte.wir } }] : []),
  ]);

  // Ungelesen: Nachrichten und Durchsagen nach dem letzten Blick in den Chat (System-Meldungen zeigt die Karte)
  $effect(() => {
    if (tab === "chat") seen = Math.max(seen, view.chat.at(-1)?.t ?? 0, view.dm.at(-1)?.t ?? 0);
  });
  const unread = $derived(
    tab === "chat" ? 0 : [...view.chat, ...view.dm].filter((m) => m.t > seen && m.kind !== "sys" && m.uid !== view.myUid).length,
  );
  const tabs = $derived([
    { id: "karte", label: T.tabs.karte, icon: MapIcon },
    { id: "chat", label: T.tabs.chat, icon: MessageCircle, badge: unread },
    { id: "regeln", label: T.tabs.regeln, icon: ScrollText },
    { id: "mehr", label: T.tabs.mehr, icon: Menu },
  ]);

  function showReport(id: string) {
    const r = view.reports.find((x) => x.id === id);
    tab = "karte";
    if (r) setTimeout(() => map?.flyTo(r), 50);
  }

  const lockLeft = $derived(view.lock && !isMrx ? view.lock.until - clock.now : 0);
  const cutName = (id: string) => view.field.cuts[id]?.short ?? id;
</script>

<div class="screen" class:mrx={isMrx}>
  <div class="mapzone">
    <GameMap
      bind:this={map}
      field={view.field}
      {locked}
      preview={shrinking ? [shrinking] : []}
      {trail}
      {pins}
      accuracy={me ?? undefined}
      padding={{ top: 190, bottom: 90, left: 24, right: 90 }}
    />

    <div class="top">
      {#if announcement}
        <Banner tone="ann" title={T.chat.durchsage} live>{announcement.text}</Banner>
      {/if}
      {#if shrinking}
        <div class="shrink">
          <Banner tone="warn" icon={Shrink} title={T.verkleinerung.titel(cutName(shrinking))} live>{T.verkleinerung.text}</Banner>
        </div>
      {/if}
      {#if zone === "grenze"}
        <Banner tone="warn" live>{T.mrx.grenzeNah(edgeM || 35)}</Banner>
      {:else if zone === "draussen"}
        <Banner tone="danger" live>{T.mrx.draussen}</Banner>
      {:else if isMrx && !me}
        <Banner tone="warn" live>{T.mrx.keinGps}</Banner>
      {/if}
      <StatusCard
        {mrxTeam}
        {isMrx}
        nextReportAt={st.nextReportAt ?? clock.now}
        intervalMs={(firstReport ? view.config.headStartMin : view.config.intervalMin) * 60_000}
        startedAt={st.startedAt ?? clock.now}
        gpsAcc={me?.acc}
        online={view.online}
        lastDataAt={view.lastDataAt}
        paused={st.phase === "pause"}
      />
    </div>

    <div class="side">
      <MapControls
        onmrx={last ? () => map?.flyTo(last) : undefined}
        onme={me ? () => map?.flyTo(me) : undefined}
        onfield={() => map?.fitField()}
      />
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
          <ChatView group={view.chat} direct={view.dm} teams={view.teams} myUid={view.myUid} onreport={showReport} {onsend} />
        {:else if tab === "regeln"}
          <AppBar title={T.regeln.titel} />
          <RulesView config={view.config} />
        {:else if sub === "einstellungen"}
          <AppBar title={T.einstellungen.titel} onback={() => (sub = "menu")} />
          <SettingsView {onlogout} {push} />
        {:else if sub === "team"}
          <AppBar title={T.mehr.team} onback={() => (sub = "menu")} />
          <div class="teaminfo">
            <TeamBadge short={myTeam.short} color={myTeam.color} size={88} mrx={isMrx} />
            <h2>{myTeam.name}</h2>
            <p class="muted">{T.mehr.gelaufen(meter(view.distM))}</p>
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

{#if lockLeft > 0 && view.lock}
  <LockOverlay
    until={view.lock.until}
    total={(view.lock.reason === "start" ? view.config.headStartMin : view.config.waitMin) * 60_000}
    reason={view.lock.caught ? "alterMrx" : view.lock.reason}
  />
{/if}
{#if scene}
  <HandoverScene
    variant={scene.variant}
    from={view.teams[scene.from] ?? unknown}
    to={view.teams[scene.to] ?? unknown}
    type={scene.type}
    waitMin={view.config.waitMin}
    at={scene.at}
    onclose={() => (scene = null)}
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
