<!-- Screen 13: Live-Übersicht der Spielleitung – Karte mit allen Teams, Warnungen, Schnellaktionen. -->
<script lang="ts">
  import { Flag, Hourglass, MapPin, Megaphone, Pause, TriangleAlert } from "@lucide/svelte";
  import { zoneStatus } from "@mrx/shared";
  import GameMap, { type MapPin as Pin } from "../../map/GameMap.svelte";
  import MapControls from "../parts/MapControls.svelte";
  import ChatView from "../parts/ChatView.svelte";
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
  import { go } from "../../lib/router.svelte.ts";
  import { T } from "../../texte.ts";
  import * as M from "../../proto/mock.svelte.ts";

  let { chat = false }: { chat?: boolean } = $props();
  let map: GameMap | undefined = $state();
  let ann = $state("");
  let askInstant = $state(false);
  let askPause = $state(false);

  const mrx = M.teams[M.MRX]!;
  const OFFLINE = 3 * 60_000;
  const offline = $derived(M.teamIds.filter((id) => clock.now - M.positions[id]!.t > OFFLINE));
  const mrxZone = $derived(zoneStatus(M.positions[M.MRX]!, M.field, M.game.locked));
  const waiting = $derived(Object.entries(M.locks).filter(([, u]) => u > clock.now));
  const trail = $derived(M.reports.filter((r) => r.t >= M.game.mrxSince));

  const pins = $derived<Pin[]>([
    ...M.teamIds.map((id) => {
      const t = M.teams[id]!,
        p = M.positions[id]!;
      return {
        key: id,
        lat: p.lat,
        lng: p.lng,
        props: {
          kind: "team" as const,
          short: t.short,
          color: t.color,
          name: t.name,
          mrx: id === M.MRX,
          locked: (M.locks[id] ?? 0) > clock.now,
          offline: offline.includes(id),
        },
      };
    }),
    ...M.staff.map((s) => ({ key: s.uid, lat: s.pos.lat, lng: s.pos.lng, props: { kind: "staff" as const, name: s.name } })),
  ]);
</script>

{#if chat}
  <div class="chatwrap">
    <ChatView
      group={M.chat}
      direct={M.dm}
      teams={M.teams}
      myUid="adm"
      admin
      inbox={M.inbox}
      onsend={(text) => M.chat.push({ id: `a${Date.now()}`, uid: "adm", name: "Spielleitung", kind: "msg", t: clock.now, text })}
    />
  </div>
{:else}
  <div class="live">
    <div class="mapcol">
      <GameMap
        bind:this={map}
        field={M.field}
        locked={M.game.locked}
        {trail}
        {pins}
        padding={{ top: 40, bottom: 40, left: 40, right: 90 }}
      />
      <div class="ctl"><MapControls onmrx={() => map?.flyTo(M.positions[M.MRX]!)} onfield={() => map?.fitField()} /></div>
    </div>

    <aside class="panel">
      <Card label={T.status.misterX} icon={Flag} tone="accent">
        <div class="mrx">
          <TeamBadge short={mrx.short} color={mrx.color} mrx size={56} />
          <div class="who">
            <strong class="display">{mrx.name}</strong>
            <span class="muted">seit {uhr(M.game.mrxSince)} · {dauer(clock.now - M.game.mrxSince)}</span>
          </div>
          <CountdownRing until={M.game.nextReportAt} total={M.config.intervalMin * 60_000} size={84} label={T.status.naechsteMeldung} />
        </div>
        <div class="row">
          <Button variant="secondary" size="m" icon={MapPin} onclick={() => (askInstant = true)}>{T.admin.sofortMeldung}</Button>
          <Button variant="secondary" size="m" icon={Flag} onclick={() => go("/prototyp/12?v=uebergabe")}>{T.schiri.uebergabe}</Button>
        </div>
      </Card>

      <Card label={T.admin.warnungen} icon={TriangleAlert}>
        <div class="stack">
          {#if mrxZone !== "drinnen"}<Banner tone={mrxZone === "draussen" ? "danger" : "warn"}>{T.admin.mrxGrenze(35)}</Banner>{/if}
          {#each offline as id (id)}
            <Banner tone="warn">{T.admin.teamOhneStandort(M.teams[id]!.name, Math.floor((clock.now - M.positions[id]!.t) / 60_000))}</Banner
            >
          {:else}
            <p class="muted">Alles in Ordnung.</p>
          {/each}
        </div>
      </Card>

      <Card label={T.schiri.wartezeiten} icon={Hourglass}>
        {#each waiting as [id, until] (id)}
          {@const t = M.teams[id]!}
          <ListItem title={t.name} subtitle="bis {uhr(until)}">
            {#snippet lead()}<TeamBadge short={t.short} color={t.color} size={36} locked />{/snippet}
            {#snippet trail()}<b class="num">{mmss(until - clock.now)}</b>{/snippet}
          </ListItem>
        {:else}
          <p class="muted">{T.schiri.keineWartezeit}</p>
        {/each}
      </Card>

      <Card label={T.admin.durchsage} icon={Megaphone}>
        <form
          class="ann"
          onsubmit={(e) => {
            e.preventDefault();
            if (!ann.trim()) return;
            M.chat.push({ id: `ann${Date.now()}`, uid: "adm", name: "Spielleitung", kind: "ann", t: clock.now, text: ann.trim() });
            toast("Durchsage gesendet", "ok");
            ann = "";
          }}
        >
          <label class="sr-only" for="ann">{T.admin.durchsage}</label>
          <textarea id="ann" bind:value={ann} maxlength={300} rows={2} placeholder={T.admin.durchsagePlatzhalter}></textarea>
          <Button size="m" icon={Megaphone} disabled={!ann.trim()} type="submit">{T.admin.durchsage}</Button>
        </form>
      </Card>

      <Card label="Spiel">
        <div class="game">
          <span>{T.status.spielzeit}: <b class="num">{dauer(clock.now - M.game.startedAt)}</b></span>
          <span
            >{T.admin.zufallsende}: <b>{T.admin.endeZwischen(uhr(M.game.endFrom), uhr(M.game.endTo))}</b>
            <Pill tone="info">geheim</Pill></span
          >
          <Button variant="secondary" size="m" icon={Pause} onclick={() => (askPause = true)}>{T.admin.pause}</Button>
        </div>
      </Card>
    </aside>
  </div>
{/if}

<Modal
  open={askInstant}
  title={T.admin.sofortMeldung}
  confirm={T.admin.sofortMeldung}
  onconfirm={() => toast("Standort von Mister X gemeldet", "ok")}
  onclose={() => (askInstant = false)}
>
  {T.admin.sofortFrage}
</Modal>
<Modal
  open={askPause}
  title="Spiel pausieren?"
  confirm={T.admin.pause}
  onconfirm={() => toast(T.allgemein.prototyp(T.admin.pause))}
  onclose={() => (askPause = false)}
>
  Meldungen, Wartezeiten und das Spielende werden angehalten. Alle bekommen eine Meldung.
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
  .chatwrap {
    position: absolute;
    inset: 0;
    max-width: 820px;
    margin: 0 auto;
  }
</style>
