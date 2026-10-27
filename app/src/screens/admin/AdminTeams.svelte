<!--
  Screen 15: Teams & Schiris & Zugänge. Status pro Team (online, Akku, letzte Position, Geräte), Aktionen,
  Passwörter/Codes neu festlegen (gehasht → nur neu setzen, nicht auslesen, E-06), QR-Codes, Neue Runde.
-->
<script lang="ts">
  import { BatteryFull, BatteryLow, BatteryMedium, Ellipsis, Hourglass, Pencil, ShieldCheck, Trash } from "@lucide/svelte";
  import { LIMITS, type ApiReason, type SecretKind } from "@mrx/shared";
  import Segmented from "../../ui/Segmented.svelte";
  import ListItem from "../../ui/ListItem.svelte";
  import TeamBadge from "../../ui/TeamBadge.svelte";
  import Pill from "../../ui/Pill.svelte";
  import IconButton from "../../ui/IconButton.svelte";
  import BottomSheet from "../../ui/BottomSheet.svelte";
  import TextField from "../../ui/TextField.svelte";
  import Button from "../../ui/Button.svelte";
  import Modal from "../../ui/Modal.svelte";
  import AccessPanel from "../parts/AccessPanel.svelte";
  import TrackerPanel from "../parts/TrackerPanel.svelte";
  import { API_URL } from "../../lib/server.ts";
  import { toast } from "../../ui/toast.svelte.ts";
  import { clock } from "../../lib/clock.svelte.ts";
  import { vor } from "../../lib/format.ts";
  import { ApiError } from "../../lib/api.ts";
  import { isOffline, type Api, type StaffView } from "../../lib/staff.ts";
  import { T } from "../../texte.ts";

  interface Props {
    view: StaffView;
    api: Api;
    joinUrl: string;
    screenUrl: (key: string) => string;
    variant?: string;
  }
  let { view, api, joinUrl, screenUrl, variant = "teams" }: Props = $props();
  // svelte-ignore state_referenced_locally
  let tab = $state(variant === "schiris" || variant === "zugaenge" || variant === "tracker" ? variant : "teams");
  let action = $state<string | null>(null);
  let rename = $state<{ id: string; name: string } | null>(null);
  let kick = $state<{ kind: "team" | "member"; id: string; name: string } | null>(null);

  const g = $derived(view.gameId);
  const teamIds = $derived(Object.keys(view.teams).sort((a, b) => view.teams[a]!.name.localeCompare(view.teams[b]!.name, "de")));
  const schiris = $derived(Object.entries(view.members).filter(([, m]) => m.role === "schiri"));
  const devices = (id: string) => Object.values(view.members).filter((m) => m.teamId === id).length;
  const locked = (id: string) => (view.locks[id]?.until ?? 0) > clock.now;
  const running = $derived(view.state.phase === "laeuft");

  const errText = (e: unknown) =>
    e instanceof ApiError ? (e.reason === "invalid" ? e.message : T.apiFehler[e.reason as ApiReason | "network"]) : T.apiFehler.network;
  async function run(fn: () => Promise<unknown>, okText: string) {
    try {
      await fn();
      toast(okText, "ok");
    } catch (e) {
      toast(errText(e), "warn");
    }
  }
</script>

<div class="wrap">
  <Segmented
    label={T.admin.bereich}
    bind:value={tab}
    options={[
      { value: "teams", label: `${T.admin.teams} (${teamIds.length})` },
      { value: "schiris", label: `${T.admin.schiris} (${schiris.length})` },
      { value: "zugaenge", label: T.admin.zugaenge },
      { value: "tracker", label: `${T.tracker.tab} (${Object.keys(view.devices).length})` },
    ]}
  />

  {#if tab === "teams"}
    <div class="list">
      {#each teamIds as id (id)}
        {@const t = view.teams[id]!}
        {@const p = view.positions[id]}
        {@const off = isOffline(p, clock.now)}
        {@const n = devices(id)}
        <ListItem
          title={t.name}
          subtitle="{p ? `${T.admin.zuletzt} ${vor(p.t, clock.now)}` : T.admin.keinStandortBisher} · {T.admin.geraete(n)}"
        >
          {#snippet lead()}<TeamBadge
              short={t.short}
              color={t.color}
              size={44}
              mrx={id === view.state.mrx}
              locked={locked(id)}
              offline={off}
            />{/snippet}
          {#snippet trail()}
            <span class="pills">
              {#if id === view.state.mrx}<Pill tone="accent">Mister X</Pill>{/if}
              {#if locked(id)}<Pill tone="warn" icon={Hourglass}>{T.schiri.wartet}</Pill>{/if}
              {#if off}<Pill tone="danger" dot>offline</Pill>{:else}<Pill tone="ok" dot>online</Pill>{/if}
              {#if p?.battery !== undefined}
                {@const b = p.battery}
                <Pill tone={b < 20 ? "danger" : "neutral"} icon={b < 20 ? BatteryLow : b < 70 ? BatteryMedium : BatteryFull}
                  ><span class="num">{b} %</span></Pill
                >
              {/if}
            </span>
            <IconButton icon={Ellipsis} label={T.admin.aktionenFuer(t.name)} size="m" tone="plain" onclick={() => (action = id)} />
          {/snippet}
        </ListItem>
      {:else}
        <p class="muted">{T.lobby.nochKeine}</p>
      {/each}
    </div>
  {:else if tab === "schiris"}
    <div class="list">
      {#each schiris as [uid, m] (uid)}
        {@const p = view.staff[uid]}
        <ListItem title={m.name} subtitle={p ? `${T.admin.zuletzt} ${vor(p.t, clock.now)}` : T.admin.keinStandortBisher}>
          {#snippet lead()}<span class="staff"><ShieldCheck size={24} aria-hidden="true" /></span>{/snippet}
          {#snippet trail()}
            <span class="pills">
              {#if m.followsFlag}<Pill tone="accent">{T.admin.begleitet}</Pill>{/if}
              {#if isOffline(p, clock.now)}<Pill tone="danger" dot>offline</Pill>{:else}<Pill tone="ok" dot>online</Pill>{/if}
            </span>
            <IconButton
              icon={Trash}
              label={T.admin.entfernenWer(m.name)}
              size="m"
              tone="plain"
              onclick={() => (kick = { kind: "member", id: uid, name: m.name })}
            />
          {/snippet}
        </ListItem>
      {:else}
        <p class="muted">{T.admin.keineSchiris}</p>
      {/each}
    </div>
  {:else if tab === "tracker"}
    <TrackerPanel
      gameId={g}
      devices={view.devices}
      teams={view.teams}
      serverUrl="{API_URL || location.origin}/tracker"
      onadd={(name) => api({ action: "addDevice", gameId: g, name })}
      onassign={async (device, assign) => {
        await api({ action: "setDevice", gameId: g, device, assign });
      }}
      onremove={async (device) => {
        await api({ action: "removeDevice", gameId: g, device });
      }}
      onkey={async (device) => (await api({ action: "deviceKey", gameId: g, device })).key}
    />
  {:else}
    <AccessPanel
      gameName={view.gameName}
      {joinUrl}
      loadScreenUrl={async () => screenUrl((await api({ action: "screenLink", gameId: g })).key)}
      onsave={async (kind: SecretKind, value: string | null) => {
        await api({ action: "setSecret", gameId: g, kind, value });
      }}
      onreset={() => run(() => api({ action: "resetRound", gameId: g }), T.admin.neueRundeOk)}
    />
  {/if}
</div>

<BottomSheet open={!!action} title={action ? (view.teams[action]?.name ?? "") : ""} onclose={() => (action = null)}>
  {#if action}
    {@const id = action}
    <ListItem title={T.admin.umbenennen} onclick={() => ((rename = { id, name: view.teams[id]?.name ?? "" }), (action = null))}>
      {#snippet lead()}<Pencil size={24} aria-hidden="true" />{/snippet}
    </ListItem>
    {#if running && id !== view.state.mrx}
      {#if locked(id)}
        <ListItem
          title={T.admin.wartezeitAufheben}
          onclick={() => {
            const teamId = id; // vor dem Schließen lesen: `id` hängt am offenen Dialog
            action = null;
            void run(() => api({ action: "setLock", gameId: g, teamId, min: 0 }), T.admin.wartezeitAufgehoben);
          }}
        >
          {#snippet lead()}<Hourglass size={24} aria-hidden="true" />{/snippet}
        </ListItem>
      {:else}
        <ListItem
          title={T.admin.wartezeitGeben}
          subtitle={T.admin.abJetzt(view.config.waitMin)}
          onclick={() => {
            const teamId = id;
            action = null;
            void run(() => api({ action: "setLock", gameId: g, teamId, min: view.config.waitMin }), T.admin.wartezeitGesetzt);
          }}
        >
          {#snippet lead()}<Hourglass size={24} aria-hidden="true" />{/snippet}
        </ListItem>
      {/if}
    {/if}
    <ListItem
      title={T.admin.entfernen}
      subtitle={T.admin.wirdAbgemeldet}
      onclick={() => ((kick = { kind: "team", id, name: view.teams[id]?.name ?? "" }), (action = null))}
    >
      {#snippet lead()}<Trash size={24} aria-hidden="true" />{/snippet}
    </ListItem>
  {/if}
</BottomSheet>

<BottomSheet open={!!rename} title={T.admin.umbenennen} onclose={() => (rename = null)}>
  {#if rename}
    <TextField label={T.beitritt.teamname} bind:value={rename.name} />
  {/if}
  {#snippet footer()}
    <Button
      block
      size="l"
      disabled={!rename || rename.name.trim().length < LIMITS.teamName[0]}
      onclick={() => {
        const r = rename!;
        rename = null;
        void run(() => api({ action: "renameTeam", gameId: g, teamId: r.id, name: r.name }), T.allgemein.gespeichert);
      }}>{T.allgemein.speichern}</Button
    >
  {/snippet}
</BottomSheet>

<Modal
  open={!!kick}
  title={T.admin.entfernenFrage(kick?.name ?? "")}
  confirm={T.admin.entfernen}
  danger
  onconfirm={() => {
    const k = kick!;
    void run(
      () =>
        k.kind === "team" ? api({ action: "removeTeam", gameId: g, teamId: k.id }) : api({ action: "removeMember", gameId: g, uid: k.id }),
      T.admin.entferntOk(k.name),
    );
  }}
  onclose={() => (kick = null)}
>
  {T.admin.entfernenText}
</Modal>

<style>
  .wrap {
    display: grid;
    gap: var(--sp-4);
    padding: var(--sp-4) var(--gutter) var(--sp-8);
    max-width: 1100px;
    margin: 0 auto;
  }
  .list {
    display: grid;
    gap: 2px;
  }
  .pills {
    display: none;
    gap: 6px;
  }
  @media (min-width: 760px) {
    .pills {
      display: flex;
    }
  }
  .staff {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--surface-3);
  }
</style>
