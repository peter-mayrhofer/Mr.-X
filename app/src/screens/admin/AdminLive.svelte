<!-- Screen 13: Live-Übersicht der Spielleitung – Karte mit allen Teams, Warnungen, Schnellaktionen. -->
<script lang="ts">
  import { Flag, Hourglass, MapPin, Megaphone, Pause, Play, TriangleAlert } from "@lucide/svelte";
  import { distanceToBoundaryM, zoneStatus, type ApiReason } from "@mrx/shared";
  import GameMap, { type MapPin as Pin } from "../../map/GameMap.svelte";
  import MapControls from "../parts/MapControls.svelte";
  import HandoverFlow from "../parts/HandoverFlow.svelte";
  import UndoHandover from "../parts/UndoHandover.svelte";
  import Card from "../../ui/Card.svelte";
  import Button from "../../ui/Button.svelte";
  import Banner from "../../ui/Banner.svelte";
  import CountdownRing from "../../ui/CountdownRing.svelte";
  import TeamBadge from "../../ui/TeamBadge.svelte";
  import ListItem from "../../ui/ListItem.svelte";
  import Modal from "../../ui/Modal.svelte";
  import Pill from "../../ui/Pill.svelte";
  import { toast } from "../../ui/toast.svelte.ts";
  import { clock } from "../../lib/clock.svelte.ts";
  import { dauer, mmss, uhr } from "../../lib/format.ts";
  import { ApiError } from "../../lib/api.ts";
  import { isOffline, trailOf, type Api, type StaffView } from "../../lib/staff.ts";
  import { T } from "../../texte.ts";

  let { view, api }: { view: StaffView; api: Api } = $props();
  let map: GameMap | undefined = $state();
  let ann = $state("");
  let ask = $state<null | "instant" | "pause">(null);
  let handover = $state(false);
  let busy = $state(false);

  const unknown = { name: "–", short: "?", color: "#888" };
  const team = (id: string | null | undefined) => (id && view.teams[id]) || unknown;
  const st = $derived(view.state);
  const mrx = $derived(team(st.mrx));
  const mrxPos = $derived(st.mrx ? view.positions[st.mrx] : undefined);
  const teamIds = $derived(Object.keys(view.teams));
  const locked = $derived(Object.keys(st.cuts ?? {}));
  const running = $derived(st.phase === "laeuft" || st.phase === "pause");
  const offline = $derived(teamIds.filter((id) => isOffline(view.positions[id], clock.now)));
  const mrxZone = $derived(mrxPos ? zoneStatus(mrxPos, view.field, locked) : "drinnen");
  const waiting = $derived(Object.entries(view.locks).filter(([, l]) => l.until > clock.now));
  const trail = $derived(trailOf(view));
  const minSince = (t: number) => Math.floor((clock.now - t) / 60_000);

  const pins = $derived<Pin[]>([
    ...teamIds.flatMap((id) => {
      const t = view.teams[id]!,
        p = view.positions[id];
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
            mrx: id === st.mrx,
            locked: (view.locks[id]?.until ?? 0) > clock.now,
            offline: offline.includes(id),
          },
        },
      ];
    }),
    ...Object.entries(view.staff).map(([uid, p]) => ({
      key: uid,
      lat: p.lat,
      lng: p.lng,
      props: { kind: "staff" as const, name: p.name ?? T.status.schiri },
    })),
    // Tracker in der Fahne (Team-Tracker erscheinen als Standort ihres Teams)
    ...Object.entries(view.devices).flatMap(([id, d]) =>
      d.assign === "fahne" && d.pos
        ? [{ key: `dev-${id}`, lat: d.pos.lat, lng: d.pos.lng, props: { kind: "staff" as const, name: d.name } }]
        : [],
    ),
  ]);

  async function run(fn: () => Promise<unknown>, okText?: string) {
    busy = true;
    try {
      await fn();
      if (okText) toast(okText, "ok");
    } catch (e) {
      toast(e instanceof ApiError && e.reason !== "invalid" ? T.apiFehler[e.reason as ApiReason | "network"] : T.apiFehler.network, "warn");
    } finally {
      busy = false;
    }
  }
  const g = $derived(view.gameId);
</script>

<div class="live">
  <div class="mapcol">
    <GameMap bind:this={map} field={view.field} {locked} {trail} {pins} padding={{ top: 40, bottom: 40, left: 40, right: 90 }} />
    <div class="ctl">
      <MapControls onmrx={mrxPos ? () => map?.flyTo(mrxPos) : undefined} onfield={() => map?.fitField()} />
    </div>
  </div>

  <aside class="panel">
    {#if running}
      <Card label={T.status.misterX} icon={Flag} tone="accent">
        <div class="mrx">
          <TeamBadge short={mrx.short} color={mrx.color} mrx size={56} />
          <div class="who">
            <strong class="display">{mrx.name}</strong>
            {#if st.mrxSince}<span class="muted">{T.admin.seit(uhr(st.mrxSince), dauer(clock.now - st.mrxSince))}</span>{/if}
          </div>
          {#if st.phase === "pause"}
            <Pill tone="warn">{T.status.pause}</Pill>
          {:else if st.nextReportAt}
            <CountdownRing until={st.nextReportAt} total={view.config.intervalMin * 60_000} size={84} label={T.status.naechsteMeldung} />
          {/if}
        </div>
        <div class="row">
          <Button variant="secondary" size="m" icon={MapPin} disabled={st.phase !== "laeuft"} onclick={() => (ask = "instant")}
            >{T.admin.sofortMeldung}</Button
          >
          <Button variant="secondary" size="m" icon={Flag} disabled={st.phase !== "laeuft"} onclick={() => (handover = true)}
            >{T.schiri.uebergabe}</Button
          >
        </div>
        <div class="row"><UndoHandover {view} {api} /></div>
      </Card>

      <Card label={T.admin.warnungen} icon={TriangleAlert}>
        <div class="stack">
          {#if st.mrx && !mrxPos}
            <Banner tone="danger">{T.admin.mrxOhneStandort(0)}</Banner>
          {:else if st.mrx && isOffline(mrxPos, clock.now)}
            <Banner tone="danger">{T.admin.mrxOhneStandort(minSince(mrxPos!.t))}</Banner>
          {/if}
          {#if mrxPos && mrxZone === "draussen"}
            <Banner tone="danger">{T.admin.mrxDraussen}</Banner>
          {:else if mrxPos && mrxZone === "grenze"}
            <Banner tone="warn">{T.admin.mrxGrenze(Math.round(distanceToBoundaryM(mrxPos, view.field, locked)))}</Banner>
          {/if}
          {#each offline.filter((id) => id !== st.mrx) as id (id)}
            {@const p = view.positions[id]}
            <Banner tone="warn"
              >{p ? T.admin.teamOhneStandort(team(id).name, minSince(p.t)) : T.admin.teamNieStandort(team(id).name)}</Banner
            >
          {:else}
            {#if !(st.mrx && isOffline(mrxPos, clock.now)) && mrxZone === "drinnen"}<p class="muted">{T.admin.allesOk}</p>{/if}
          {/each}
        </div>
      </Card>

      <Card label={T.schiri.wartezeiten} icon={Hourglass}>
        {#each waiting as [id, l] (id)}
          {@const t = team(id)}
          <ListItem title={t.name} subtitle={T.schiri.bis(uhr(l.until))}>
            {#snippet lead()}<TeamBadge short={t.short} color={t.color} size={36} locked />{/snippet}
            {#snippet trail()}<b class="num">{mmss(l.until - clock.now)}</b>{/snippet}
          </ListItem>
        {:else}
          <p class="muted">{T.schiri.keineWartezeit}</p>
        {/each}
      </Card>
    {/if}

    <Card label={T.admin.durchsage} icon={Megaphone}>
      <form
        class="ann"
        onsubmit={(e) => {
          e.preventDefault();
          const text = ann.trim();
          if (text) void run(() => api({ action: "announce", gameId: g, text }), T.admin.durchsageGesendet).then(() => (ann = ""));
        }}
      >
        <label class="sr-only" for="ann">{T.admin.durchsage}</label>
        <textarea id="ann" bind:value={ann} maxlength={300} rows={2} placeholder={T.admin.durchsagePlatzhalter}></textarea>
        <Button size="m" icon={Megaphone} disabled={!ann.trim() || busy} type="submit">{T.admin.durchsage}</Button>
      </form>
    </Card>

    {#if running}
      <Card label={T.admin.spiel}>
        <div class="game">
          {#if st.startedAt}<span>{T.status.spielzeit}: <b class="num">{dauer(clock.now - st.startedAt)}</b></span>{/if}
          {#if st.startedAt}
            <span
              >{T.admin.zufallsende}:
              <b
                >{T.admin.endeZwischen(
                  uhr(st.startedAt + view.config.endMinH * 3_600_000),
                  uhr(st.startedAt + view.config.endMaxH * 3_600_000),
                )}</b
              >
              <Pill tone="info">{T.admin.geheimKurz}</Pill></span
            >
          {/if}
          {#if st.phase === "pause"}
            <Button variant="secondary" size="m" icon={Play} disabled={busy} onclick={() => run(() => api({ action: "resume", gameId: g }))}
              >{T.admin.fortsetzen}</Button
            >
          {:else}
            <Button variant="secondary" size="m" icon={Pause} onclick={() => (ask = "pause")}>{T.admin.pause}</Button>
          {/if}
        </div>
      </Card>
    {/if}
  </aside>
</div>

<HandoverFlow {view} {api} bind:open={handover} />

<Modal
  open={ask === "instant"}
  title={T.admin.sofortMeldung}
  confirm={T.admin.sofortMeldung}
  onconfirm={() => run(() => api({ action: "instantReport", gameId: g }), T.admin.sofortGemeldet)}
  onclose={() => (ask = null)}
>
  {T.admin.sofortFrage}
</Modal>
<Modal
  open={ask === "pause"}
  title={T.admin.pauseFrage}
  confirm={T.admin.pause}
  onconfirm={() => run(() => api({ action: "pause", gameId: g }))}
  onclose={() => (ask = null)}
>
  {T.admin.pauseText}
</Modal>

<style>
  .live {
    display: grid;
    grid-template-rows: 55vh auto;
    min-height: 100%;
  }
  .mapcol {
    position: relative;
  }
  .ctl {
    position: absolute;
    right: var(--gutter);
    top: var(--sp-4);
    z-index: var(--z-ui);
  }
  .panel {
    display: grid;
    gap: var(--sp-3);
    align-content: start;
    padding: var(--sp-3) var(--gutter) var(--sp-6);
  }
  @media (min-width: 1000px) {
    .live {
      grid-template-rows: none;
      grid-template-columns: 1fr 400px;
      height: 100%;
    }
    .panel {
      overflow-y: auto;
      border-left: var(--border-w) solid var(--line);
      background: var(--bg);
    }
  }
  .mrx {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
  }
  .who {
    flex: 1;
    display: grid;
    min-width: 0;
  }
  .who strong {
    font-size: var(--fs-2xl);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
    margin-top: var(--sp-3);
  }
  .stack {
    display: grid;
    gap: var(--sp-2);
  }
  .ann {
    display: grid;
    gap: var(--sp-2);
  }
  textarea {
    width: 100%;
    padding: var(--sp-3);
    border-radius: var(--r-m);
    border: var(--border-strong) solid var(--line);
    background: var(--bg);
    resize: vertical;
    font-size: var(--fs-m);
  }
  .game {
    display: grid;
    gap: var(--sp-2);
    justify-items: start;
  }
</style>
