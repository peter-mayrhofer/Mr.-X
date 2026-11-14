<!--
  Screen 12: Schiri-Ansicht. Alle Teams live (Mister X hervorgehoben), Distanz der nächsten Jäger,
  Übergabe-Ablauf: Team wählen (nach Nähe sortiert) → Art → Bestätigen; Rückgängig 2 Min lang.
-->
<script lang="ts">
  import { Flag, Hourglass, Map as MapIcon, Menu, MessageCircle, ScrollText } from "@lucide/svelte";
  import { distanceM } from "@mrx/shared";
  import GameMap, { type MapPin } from "../map/GameMap.svelte";
  import StatusCard from "./parts/StatusCard.svelte";
  import HandoverFlow from "./parts/HandoverFlow.svelte";
  import UndoHandover from "./parts/UndoHandover.svelte";
  import MapControls from "./parts/MapControls.svelte";
  import ChatView from "./parts/ChatView.svelte";
  import RulesView from "./parts/RulesView.svelte";
  import SettingsView from "./parts/SettingsView.svelte";
  import TabBar from "../ui/TabBar.svelte";
  import Button from "../ui/Button.svelte";
  import BottomSheet from "../ui/BottomSheet.svelte";
  import ListItem from "../ui/ListItem.svelte";
  import TeamBadge from "../ui/TeamBadge.svelte";
  import Switch from "../ui/Switch.svelte";
  import AppBar from "../ui/AppBar.svelte";
  import { toast } from "../ui/toast.svelte.ts";
  import { clock } from "../lib/clock.svelte.ts";
  import { meter, mmss, uhr } from "../lib/format.ts";
  import { fehlerText } from "../lib/api.ts";
  import { isOffline, trailOf, type Api, type StaffView } from "../lib/staff.ts";
  import type { PushState } from "../lib/push.svelte.ts";
  import { T } from "../texte.ts";

  interface Props {
    view: StaffView;
    api: Api;
    onsend: (text: string) => void;
    onlogout: () => void;
    push?: PushState;
    /** Prototyp: Übergabe-Ablauf schon offen, mit vorgewähltem Team */
    preset?: string | null;
  }
  let { view, api, onsend, onlogout, push, preset = null }: Props = $props();

  type Tab = "karte" | "chat" | "regeln" | "mehr";
  let tab = $state<Tab>("karte");
  let map: GameMap | undefined = $state();
  /** Höhe der unteren Leiste (nächste Jäger + Übergabe): der Karten-Hinweis (i) rückt darüber */
  let fuss = $state(0);
  // svelte-ignore state_referenced_locally
  let sheet = $state(!!preset);
  let waitSheet = $state(false);

  const unknown = { name: "–", short: "?", color: "#888" };
  const team = (id: string | null | undefined) => (id && view.teams[id]) || unknown;
  const mrx = $derived(view.state.mrx ?? null);
  const mrxPos = $derived(mrx ? view.positions[mrx] : undefined);
  const teamIds = $derived(Object.keys(view.teams));
  const running = $derived(view.state.phase === "laeuft");

  // nach Nähe sortiert (Abschnitt 7.4) – zum Mister X bzw. zum Schiri selbst, wenn Mister X keinen Standort hat
  const anchor = $derived(mrxPos ?? view.me);
  const byDistance = $derived(
    teamIds
      .filter((id) => id !== mrx)
      .map((id) => {
        const p = view.positions[id];
        return { id, d: p && anchor ? distanceM(p, anchor) : Infinity, offline: isOffline(p, clock.now) };
      })
      .sort((a, b) => a.d - b.d),
  );
  const nearest = $derived(byDistance.filter((x) => !x.offline && Number.isFinite(x.d)).slice(0, 3));
  const waiting = $derived(Object.entries(view.locks).filter(([, l]) => l.until > clock.now));

  const trail = $derived(trailOf(view));
  const pins = $derived<MapPin[]>([
    ...teamIds.flatMap((id) => {
      const t = view.teams[id]!;
      const p = view.positions[id];
      if (!p) return [];
      return [
        {
          key: id,
          lat: p.lat,
          lng: p.lng,
          props: {
            kind: "team" as const,
            short: t.short,
            color: t.color,
            name: t.name,
            mrx: id === mrx,
            locked: (view.locks[id]?.until ?? 0) > clock.now,
            offline: isOffline(p, clock.now),
          },
        },
      ];
    }),
    ...(view.me ? [{ key: "me", lat: view.me.lat, lng: view.me.lng, props: { kind: "me" as const, label: view.myName } }] : []),
    ...Object.entries(view.staff)
      .filter(([uid]) => uid !== view.myUid)
      .map(([uid, p]) => ({ key: uid, lat: p.lat, lng: p.lng, props: { kind: "staff" as const, name: p.name ?? T.status.schiri } })),
  ]);

  const msg = (e: unknown) => fehlerText(e);

  async function follow(on: boolean) {
    try {
      await api({ action: "follow", gameId: view.gameId, on });
    } catch (e) {
      toast(msg(e), "warn");
    }
  }
</script>

<main class="screen">
  <div class="mapzone" style:--karten-fuss="{fuss + 12}px">
    <GameMap
      bind:this={map}
      field={view.field}
      locked={Object.keys(view.state.cuts ?? {})}
      preview={Object.keys(view.state.warnCuts ?? {})}
      {trail}
      {pins}
      padding={{ top: 190, bottom: 200, left: 24, right: 90 }}
    />

    <div class="top">
      <StatusCard
        mrxTeam={team(mrx)}
        role="schiri"
        nextReportAt={view.state.nextReportAt ?? clock.now}
        intervalMs={view.config.intervalMin * 60_000}
        startedAt={view.state.startedAt ?? clock.now}
        gpsAcc={view.me?.acc}
        online={view.online}
        lastDataAt={view.lastDataAt}
        paused={view.state.phase === "pause"}
      />
    </div>

    <div class="side">
      <MapControls
        onmrx={mrxPos ? () => map?.flyTo(mrxPos) : undefined}
        onme={view.me ? () => map?.flyTo(view.me!) : undefined}
        onfield={() => map?.fitField()}
      />
    </div>

    <div class="bottom" bind:clientHeight={fuss}>
      <div class="near" aria-label={T.schiri.naechsteJaeger}>
        <span class="caps">{T.schiri.naechsteJaeger}</span>
        {#if view.config.refereeHunters === false}
          <span class="off">{T.schiri.jaegerAus}</span>
        {:else}
          {#each nearest as n (n.id)}
            {@const t = team(n.id)}
            <span class="chip"><TeamBadge short={t.short} color={t.color} size={28} /><b class="num">{meter(n.d)}</b></span>
          {/each}
        {/if}
        <button class="waitbtn" onclick={() => (waitSheet = true)}><Hourglass size={18} aria-hidden="true" />{waiting.length}</button>
      </div>
      <UndoHandover {view} {api} />
      <Button size="xl" block icon={Flag} disabled={!running} onclick={() => (sheet = true)}>{T.schiri.uebergabe}</Button>
    </div>

    {#if tab !== "karte"}
      <div class="pane">
        {#if tab === "chat"}
          <ChatView
            group={view.chat}
            teams={view.teams}
            myUid={view.myUid}
            onreport={(id) => {
              const r = view.reports.find((x) => x.id === id);
              tab = "karte";
              if (r) setTimeout(() => map?.flyTo(r), 50);
            }}
            onsend={(text) => onsend(text)}
          />
        {:else if tab === "regeln"}
          <AppBar title={T.regeln.titel} />
          <RulesView config={view.config} />
        {:else}
          <AppBar title={T.mehr.titel} />
          <div class="follow">
            <Switch label={T.schiri.folgen} hint={T.schiri.folgenHinweis} checked={view.follows} onchange={follow} />
          </div>
          <SettingsView {onlogout} {push} />
        {/if}
      </div>
    {/if}
  </div>

  <TabBar
    items={[
      { id: "karte", label: T.tabs.karte, icon: MapIcon },
      { id: "chat", label: T.tabs.chat, icon: MessageCircle },
      { id: "regeln", label: T.tabs.regeln, icon: ScrollText },
      { id: "mehr", label: T.tabs.mehr, icon: Menu },
    ]}
    active={tab}
    onselect={(id) => (tab = id as Tab)}
  />
</main>

<HandoverFlow {view} {api} bind:open={sheet} {preset} />

<BottomSheet open={waitSheet} title={T.schiri.wartezeiten} onclose={() => (waitSheet = false)}>
  {#each waiting as [id, l] (id)}
    {@const t = team(id)}
    <ListItem title={t.name} subtitle={T.schiri.bis(uhr(l.until))}>
      {#snippet lead()}<TeamBadge short={t.short} color={t.color} size={44} locked />{/snippet}
      {#snippet trail()}<b class="num big">{mmss(l.until - clock.now)}</b>{/snippet}
    </ListItem>
  {:else}
    <p class="muted">{T.schiri.keineWartezeit}</p>
  {/each}
</BottomSheet>

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
    inset: 0 0 auto;
    z-index: var(--z-ui);
    padding: calc(var(--safe-top) + var(--sp-3)) var(--gutter) 0;
  }
  .side {
    position: absolute;
    right: var(--gutter);
    top: 210px;
    z-index: var(--z-ui);
  }
  .bottom {
    position: absolute;
    left: var(--gutter);
    right: var(--gutter);
    bottom: var(--sp-3);
    z-index: var(--z-ui);
    display: grid;
    gap: var(--sp-2);
  }
  .near {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-3);
    border-radius: var(--r-l);
    background: var(--glass);
    border: var(--border-w) solid var(--line);
    box-shadow: var(--shadow-1);
    overflow-x: auto;
  }
  .near .caps {
    font-size: 14px;
    color: var(--text-2);
    flex: none;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex: none;
    font-weight: 600;
  }
  .waitbtn {
    margin-left: auto;
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: var(--touch);
    padding: 0 var(--sp-3);
    border-radius: var(--r-pill);
    border: 0;
    background: var(--warn);
    color: var(--on-warn);
    font-weight: 800;
    cursor: pointer;
  }
  .pane {
    position: absolute;
    inset: 0;
    z-index: calc(var(--z-ui) + 1);
    background: var(--bg);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    animation: einblenden var(--dur-2) var(--ease-out);
  }
  /* Reiterwechsel: der neue Inhalt blendet weich ein */
  .pane > :global(*) {
    animation: einblenden var(--dur-2) var(--ease-out);
  }
  .follow {
    padding: var(--sp-3) var(--gutter) 0;
  }
  .big {
    font-family: var(--font-display);
    font-size: var(--fs-xl);
  }
  .off {
    color: var(--text-2);
    font-size: var(--fs-s);
  }
</style>
