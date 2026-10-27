<!--
  Screen 12: Schiri-Ansicht. Alle Teams live (Mister X hervorgehoben), Distanz der nächsten Jäger,
  Übergabe-Ablauf: Team wählen (nach Nähe sortiert) → Art → Bestätigen; Rückgängig 2 Min lang.
-->
<script lang="ts">
  import { Flag, Hourglass, Map as MapIcon, Menu, MessageCircle, ScrollText, Undo2 } from "@lucide/svelte";
  import { distanceM } from "@mrx/shared";
  import GameMap, { type MapPin } from "../map/GameMap.svelte";
  import StatusCard from "./parts/StatusCard.svelte";
  import MapControls from "./parts/MapControls.svelte";
  import ChatView from "./parts/ChatView.svelte";
  import RulesView from "./parts/RulesView.svelte";
  import SettingsView from "./parts/SettingsView.svelte";
  import TabBar from "../ui/TabBar.svelte";
  import Button from "../ui/Button.svelte";
  import BottomSheet from "../ui/BottomSheet.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import ListItem from "../ui/ListItem.svelte";
  import TeamBadge from "../ui/TeamBadge.svelte";
  import Pill from "../ui/Pill.svelte";
  import Modal from "../ui/Modal.svelte";
  import Switch from "../ui/Switch.svelte";
  import AppBar from "../ui/AppBar.svelte";
  import { toast } from "../ui/toast.svelte.ts";
  import { clock } from "../lib/clock.svelte.ts";
  import { meter, mmss, uhr, vor } from "../lib/format.ts";
  import { signal } from "../lib/signal.ts";
  import { go } from "../lib/router.svelte.ts";
  import { T } from "../texte.ts";
  import * as M from "../proto/mock.svelte.ts";

  let { variant = "" }: { variant?: string } = $props();
  type Tab = "karte" | "chat" | "regeln" | "mehr";
  let tab = $state<Tab>("karte");
  let map: GameMap | undefined = $state();
  // svelte-ignore state_referenced_locally
  let sheet = $state(variant === "uebergabe");
  // svelte-ignore state_referenced_locally
  let pick = $state<string | null>(variant === "uebergabe" ? "auwiesen" : null);
  let kind = $state<"fang" | "strafe">("fang");
  let confirm = $state(false);
  let waitSheet = $state(false);
  let follows = $state(true);
  let mrx = $state(M.MRX);
  // svelte-ignore state_referenced_locally
  let undoUntil = $state(variant === "rueckgaengig" ? clock.now + 2 * 60_000 - 12_000 : 0);
  let prevMrx = $state(M.MRX);

  const me = M.staff[0]!;
  const mrxPos = $derived(M.positions[mrx]!);
  const OFFLINE_MS = 3 * 60_000;
  const isOffline = (id: string) => clock.now - M.positions[id]!.t > OFFLINE_MS;

  // nach Nähe zum Fangort sortiert (Abschnitt 7.4)
  const byDistance = $derived(
    M.teamIds
      .filter((id) => id !== mrx)
      .map((id) => ({ id, d: distanceM(M.positions[id]!, mrxPos), offline: isOffline(id) }))
      .sort((a, b) => a.d - b.d),
  );
  const nearest = $derived(byDistance.filter((x) => !x.offline).slice(0, 3));
  const waiting = $derived(Object.entries(M.locks).filter(([, until]) => until > clock.now));

  // Vorschau Wartezeit: altes Team + alle mit frischem Standort im Umkreis des Übergabeorts
  const lockPreview = $derived(
    pick
      ? [
          mrx,
          ...M.teamIds.filter(
            (id) => id !== pick && id !== mrx && !isOffline(id) && distanceM(M.positions[id]!, M.positions[pick!]!) <= M.config.radiusM,
          ),
        ]
      : [],
  );

  const trail = $derived(M.reports.filter((r) => r.t >= M.game.mrxSince));
  const pins = $derived<MapPin[]>([
    ...M.teamIds.map((id) => {
      const t = M.teams[id]!;
      const p = M.positions[id]!;
      return {
        key: id,
        lat: p.lat,
        lng: p.lng,
        props: {
          kind: "team" as const,
          short: t.short,
          color: t.color,
          name: t.name,
          mrx: id === mrx,
          locked: (M.locks[id] ?? 0) > clock.now,
          offline: isOffline(id),
        },
      };
    }),
    { key: "me", lat: me.pos.lat, lng: me.pos.lng, props: { kind: "me" as const, label: me.name } },
    ...M.staff.slice(1).map((s) => ({ key: s.uid, lat: s.pos.lat, lng: s.pos.lng, props: { kind: "staff" as const, name: s.name } })),
  ]);

  function doHandover() {
    if (!pick) return;
    prevMrx = mrx;
    mrx = pick;
    sheet = false;
    undoUntil = clock.now + M.config.undoMin * 60_000;
    signal("uebergabe");
    toast(T.schiri.gespeichert, "ok", { label: T.schiri.rueckgaengig, run: () => (confirmUndo = true) });
    pick = null;
  }
  let confirmUndo = $state(false);
  function undo() {
    mrx = prevMrx;
    undoUntil = 0;
    toast("Übergabe rückgängig gemacht", "info");
  }
</script>

<div class="screen">
  <div class="mapzone">
    <GameMap
      bind:this={map}
      field={M.field}
      locked={M.game.locked}
      {trail}
      {pins}
      padding={{ top: 190, bottom: 200, left: 24, right: 90 }}
    />

    <div class="top">
      <StatusCard
        mrxTeam={M.teams[mrx]!}
        role="schiri"
        nextReportAt={M.game.nextReportAt}
        intervalMs={M.config.intervalMin * 60_000}
        startedAt={M.game.startedAt}
        gpsAcc={me.pos.acc}
      />
    </div>

    <div class="side">
      <MapControls onmrx={() => map?.flyTo(mrxPos)} onme={() => map?.flyTo(me.pos)} onfield={() => map?.fitField()} />
    </div>

    <div class="bottom">
      <div class="near" aria-label={T.schiri.naechsteJaeger}>
        <span class="caps">{T.schiri.naechsteJaeger}</span>
        {#each nearest as n (n.id)}
          {@const t = M.teams[n.id]!}
          <span class="chip"><TeamBadge short={t.short} color={t.color} size={28} /><b class="num">{meter(n.d)}</b></span>
        {/each}
        <button class="waitbtn" onclick={() => (waitSheet = true)}><Hourglass size={18} aria-hidden="true" />{waiting.length}</button>
      </div>
      {#if undoUntil > clock.now}
        <Button variant="secondary" block icon={Undo2} onclick={() => (confirmUndo = true)}
          >{T.schiri.rueckgaengigNoch(mmss(undoUntil - clock.now))}</Button
        >
      {/if}
      <Button size="xl" block icon={Flag} onclick={() => (sheet = true)}>{T.schiri.uebergabe}</Button>
    </div>

    {#if tab !== "karte"}
      <div class="pane">
        {#if tab === "chat"}
          <ChatView
            group={M.chat}
            direct={M.dm}
            teams={M.teams}
            myUid="s1"
            onreport={() => (tab = "karte")}
            onsend={(text) => M.chat.push({ id: `s${Date.now()}`, uid: "s1", name: me.name, kind: "msg", t: clock.now, text })}
          />
        {:else if tab === "regeln"}
          <AppBar title={T.regeln.titel} />
          <RulesView config={M.config} />
        {:else}
          <AppBar title={T.mehr.titel} />
          <div class="follow">
            <Switch label={T.schiri.folgen} hint={T.schiri.folgenHinweis} bind:checked={follows} />
          </div>
          <SettingsView onlogout={() => go("/prototyp/1")} />
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
</div>

<BottomSheet open={sheet} title={T.schiri.uebergabe} onclose={() => (sheet = false)}>
  <h3 class="step"><span class="n">1</span>{T.schiri.schritt1}</h3>
  <p class="muted small">{T.schiri.schritt1Hinweis}</p>
  <div class="picklist">
    {#each byDistance as x (x.id)}
      {@const t = M.teams[x.id]!}
      <ListItem
        title={t.name}
        subtitle={x.offline ? `${T.schiri.keinStandort} · ${vor(M.positions[x.id]!.t, clock.now)}` : `${meter(x.d)} entfernt`}
        selected={pick === x.id}
        onclick={() => (pick = x.id)}
      >
        {#snippet lead()}<TeamBadge short={t.short} color={t.color} size={44} offline={x.offline} />{/snippet}
        {#snippet trail()}{#if (M.locks[x.id] ?? 0) > clock.now}<Pill tone="warn" icon={Hourglass}>wartet</Pill>{/if}{/snippet}
      </ListItem>
    {/each}
  </div>
  <h3 class="step"><span class="n">2</span>{T.schiri.schritt2}</h3>
  <Segmented
    label={T.schiri.schritt2}
    bind:value={kind}
    options={[
      { value: "fang", label: T.schiri.fang },
      { value: "strafe", label: T.schiri.strafe },
    ]}
  />
  {#if pick}
    <div class="preview">
      <p class="caps">{T.schiri.vorschau(M.config.waitMin)}</p>
      <div class="chips">
        {#each lockPreview as id (id)}
          {@const t = M.teams[id]!}
          <span class="chip"><TeamBadge short={t.short} color={t.color} size={28} locked />{t.name}</span>
        {/each}
      </div>
    </div>
  {/if}
  {#snippet footer()}
    <Button size="xl" block icon={Flag} disabled={!pick} onclick={() => (confirm = true)}
      >{pick ? T.schiri.bestaetigen(M.teams[pick]!.name) : T.schiri.schritt1}</Button
    >
  {/snippet}
</BottomSheet>

<BottomSheet open={waitSheet} title={T.schiri.wartezeiten} onclose={() => (waitSheet = false)}>
  {#each waiting as [id, until] (id)}
    {@const t = M.teams[id]!}
    <ListItem title={t.name} subtitle="bis {uhr(until)}">
      {#snippet lead()}<TeamBadge short={t.short} color={t.color} size={44} locked />{/snippet}
      {#snippet trail()}<b class="num big">{mmss(until - clock.now)}</b>{/snippet}
    </ListItem>
  {:else}
    <p class="muted">{T.schiri.keineWartezeit}</p>
  {/each}
</BottomSheet>

<Modal
  open={confirm}
  title={pick ? T.schiri.bestaetigen(M.teams[pick]!.name) + "?" : ""}
  confirm={T.allgemein.bestaetigen}
  onconfirm={doHandover}
  onclose={() => (confirm = false)}
>
  {kind === "fang" ? T.schiri.fang : T.schiri.strafe} · {T.schiri.vorschau(M.config.waitMin)}
  {lockPreview.map((id) => M.teams[id]!.name).join(", ")}
</Modal>

<Modal
  open={confirmUndo}
  title={T.schiri.rueckgaengigFrage(M.teams[mrx]!.name)}
  confirm={T.schiri.rueckgaengig}
  danger
  onconfirm={undo}
  onclose={() => (confirmUndo = false)}
/>

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
  }
  .follow {
    padding: var(--sp-3) var(--gutter) 0;
  }
  .step {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    margin-top: var(--sp-3);
  }
  .n {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--accent);
    color: var(--on-accent);
    font-size: 18px;
  }
  .small {
    font-size: var(--fs-s);
    margin-bottom: var(--sp-2);
  }
  .picklist {
    display: grid;
    gap: 2px;
    margin-bottom: var(--sp-3);
  }
  .preview {
    margin-top: var(--sp-4);
    padding: var(--sp-3);
    border-radius: var(--r-m);
    background: var(--warn-soft);
    border: 2px solid var(--warn);
  }
  .preview .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-3);
    margin-top: var(--sp-2);
  }
  .big {
    font-family: var(--font-display);
    font-size: var(--fs-xl);
  }
</style>
