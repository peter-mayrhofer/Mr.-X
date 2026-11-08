<!--
  Screen 15: Teams & Schiris & Zugänge. Status pro Team (online, Akku, letzte Position, Geräte), Aktionen,
  Passwörter/Codes neu festlegen (gehasht → nur neu setzen, nicht auslesen, E-06), QR-Codes, Neue Runde.
-->
<script lang="ts">
  import { BatteryFull, BatteryLow, BatteryMedium, Ellipsis, Hourglass, Pencil, ShieldCheck, Split, Trash, Users } from "@lucide/svelte";
  import Stepper from "../../ui/Stepper.svelte";
  import { uhr } from "../../lib/format.ts";
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
    /** nur Desktop-App: Großbild im Vollbild auf dem Beamer öffnen */
    onbeamer?: () => void;
  }
  let { view, api, joinUrl, screenUrl, variant = "teams", onbeamer }: Props = $props();
  // svelte-ignore state_referenced_locally
  let tab = $state(
    variant === "schiris" || variant === "zugaenge" || variant === "tracker" ? variant : variant === "beamer" ? "zugaenge" : "teams",
  );
  let action = $state<string | null>(null);
  let rename = $state<{ id: string; name: string } | null>(null);
  let kick = $state<{ kind: "team" | "member"; id: string; name: string } | null>(null);
  let sizeEdit = $state<{ id: string; size: number } | null>(null);
  let split = $state<{ id: string; name: string; size: number; uids: string[] } | null>(null);
  const teamDevices = (id: string) =>
    Object.entries(view.members)
      .filter(([, m]) => m.teamId === id)
      .sort((a, b) => a[1].joinedAt - b[1].joinedAt);

  const g = $derived(view.gameId);
  const teamIds = $derived(Object.keys(view.teams).sort((a, b) => view.teams[a]!.name.localeCompare(view.teams[b]!.name, "de")));
  const totalPeople = $derived(teamIds.reduce((s, id) => s + (view.teams[id]?.size ?? 0), 0));
  const unknownSize = $derived(teamIds.filter((id) => !view.teams[id]?.size).length);
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
    {#if teamIds.length}
      <p class="sum num">
        <Users size={18} aria-hidden="true" />{T.admin.personenGesamt(totalPeople, teamIds.length)}
        {#if unknownSize}<span class="muted">· {T.admin.ohneAngabe(unknownSize)}</span>{/if}
      </p>
    {/if}
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
              {#if t.size}<Pill icon={Users}><span class="num">{t.size}</span></Pill>{/if}
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
      checkSecret={async (kind: SecretKind, value: string) => (await api({ action: "checkSecret", gameId: g, kind, value })).ok}
      loadScreenUrl={async () => screenUrl((await api({ action: "screenLink", gameId: g })).key)}
      onsave={async (kind: SecretKind, value: string | null) => {
        await api({ action: "setSecret", gameId: g, kind, value });
      }}
      onreset={() => run(() => api({ action: "resetRound", gameId: g }), T.admin.neueRundeOk)}
      {onbeamer}
    />
  {/if}
</div>

<BottomSheet open={!!action} title={action ? (view.teams[action]?.name ?? "") : ""} onclose={() => (action = null)}>
  {#if action}
    {@const id = action}
    <ListItem title={T.admin.umbenennen} onclick={() => ((rename = { id, name: view.teams[id]?.name ?? "" }), (action = null))}>
      {#snippet lead()}<Pencil size={24} aria-hidden="true" />{/snippet}
    </ListItem>
    <ListItem
      title={T.admin.groesseAendern}
      subtitle={view.teams[id]?.size ? T.admin.personen(view.teams[id]!.size!) : T.admin.keineAngabe}
      onclick={() => ((sizeEdit = { id, size: view.teams[id]?.size ?? 6 }), (action = null))}
    >
      {#snippet lead()}<Users size={24} aria-hidden="true" />{/snippet}
    </ListItem>
    <ListItem
      title={T.admin.aufteilen}
      subtitle={T.admin.aufteilenHinweis}
      onclick={() => {
        const t = view.teams[id];
        split = { id, name: `${t?.name ?? ""} 2`, size: Math.max(1, Math.floor((t?.size ?? 2) / 2)), uids: [] };
        action = null;
      }}
    >
      {#snippet lead()}<Split size={24} aria-hidden="true" />{/snippet}
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

<BottomSheet open={!!sizeEdit} title={T.admin.groesseAendern} onclose={() => (sizeEdit = null)}>
  {#if sizeEdit}
    <Stepper label={T.mehr.groesse} bind:value={sizeEdit.size} unit="" min={1} max={99} />
  {/if}
  {#snippet footer()}
    <Button
      block
      size="l"
      onclick={() => {
        const s = sizeEdit!;
        sizeEdit = null;
        void run(() => api({ action: "setTeamSize", gameId: g, teamId: s.id, size: s.size }), T.allgemein.gespeichert);
      }}>{T.allgemein.speichern}</Button
    >
  {/snippet}
</BottomSheet>

<BottomSheet open={!!split} title={T.admin.aufteilenTitel(split ? (view.teams[split.id]?.name ?? "") : "")} onclose={() => (split = null)}>
  {#if split}
    {@const s = split}
    <TextField label={T.admin.neuesTeam} bind:value={s.name} maxlength={30} />
    <Stepper label={T.admin.neuesTeamGroesse} bind:value={s.size} unit="" min={1} max={99} />
    <fieldset class="devs">
      <legend class="caps">{T.admin.welcheGeraete}</legend>
      {#each teamDevices(s.id) as [uid, m], i (uid)}
        <label>
          <input
            type="checkbox"
            checked={s.uids.includes(uid)}
            onchange={(e) => (s.uids = e.currentTarget.checked ? [...s.uids, uid] : s.uids.filter((x) => x !== uid))}
          />
          {T.admin.geraetNr(i + 1, uhr(m.joinedAt))}
        </label>
      {:else}
        <p class="muted">{T.admin.keineGeraete}</p>
      {/each}
    </fieldset>
    <p class="muted small">{T.admin.aufteilenText}</p>
  {/if}
  {#snippet footer()}
    <Button
      block
      size="l"
      icon={Split}
      disabled={!split || !split.uids.length || split.name.trim().length < LIMITS.teamName[0]}
      onclick={() => {
        const s = split!;
        split = null;
        void run(
          () => api({ action: "splitTeam", gameId: g, teamId: s.id, name: s.name.trim(), uids: s.uids, size: s.size }),
          T.admin.aufgeteilt(s.name.trim()),
        );
      }}>{T.admin.aufteilen}</Button
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
  .sum {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-2);
    font-weight: 600;
  }
  .devs {
    display: grid;
    gap: var(--sp-2);
    border: 0;
    margin: 0;
    padding: 0;
  }
  .devs label {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    min-height: var(--touch);
  }
  .devs input {
    width: 24px;
    height: 24px;
  }
  .small {
    font-size: var(--fs-s);
  }
</style>
