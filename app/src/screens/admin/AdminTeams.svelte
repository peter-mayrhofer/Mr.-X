<!--
  Screen 15: Teams & Schiris & Zugänge. Status pro Team (online, Akku, letzte Position, Rolle), Aktionen,
  Passwörter/Codes neu festlegen (gehasht → nur neu setzen, nicht auslesen, E-06), QR-Codes, Neue Runde.
-->
<script lang="ts">
  import { BatteryFull, BatteryLow, BatteryMedium, Ellipsis, Hourglass, Pencil, ShieldCheck, Trash } from "@lucide/svelte";
  import Segmented from "../../ui/Segmented.svelte";
  import ListItem from "../../ui/ListItem.svelte";
  import TeamBadge from "../../ui/TeamBadge.svelte";
  import Pill from "../../ui/Pill.svelte";
  import IconButton from "../../ui/IconButton.svelte";
  import BottomSheet from "../../ui/BottomSheet.svelte";
  import Modal from "../../ui/Modal.svelte";
  import AccessPanel from "../parts/AccessPanel.svelte";
  import { toast } from "../../ui/toast.svelte.ts";
  import { clock } from "../../lib/clock.svelte.ts";
  import { vor } from "../../lib/format.ts";
  import { T } from "../../texte.ts";
  import * as M from "../../proto/mock.svelte.ts";

  let { variant = "teams" }: { variant?: string } = $props();
  // svelte-ignore state_referenced_locally
  let tab = $state(variant === "schiris" || variant === "zugaenge" ? variant : "teams");
  let action = $state<string | null>(null);
  let confirmKick = $state<string | null>(null);
  const battery: Record<string, number> = {
    urfahr: 18,
    kleinmuenchen: 64,
    auwiesen: 81,
    ebelsberg: 55,
    pichling: 92,
    spallerhof: 47,
    bindermichl: 73,
    neueheimat: 38,
    leonding: 12,
    traun: 66,
    ansfelden: 70,
    wels: 59,
  };
  const offline = (id: string) => clock.now - M.positions[id]!.t > 3 * 60_000;
</script>

<div class="wrap">
  <Segmented
    label="Bereich"
    bind:value={tab}
    options={[
      { value: "teams", label: `${T.admin.teams} (${M.teamIds.length})` },
      { value: "schiris", label: `${T.admin.schiris} (${M.staff.length})` },
      { value: "zugaenge", label: T.admin.zugaenge },
    ]}
  />

  {#if tab === "teams"}
    <div class="list">
      {#each M.teamIds as id (id)}
        {@const t = M.teams[id]!}
        {@const p = M.positions[id]!}
        {@const b = battery[id] ?? 50}
        {@const locked = (M.locks[id] ?? 0) > clock.now}
        <ListItem title={t.name} subtitle="{T.admin.zuletzt} {vor(p.t, clock.now)} · 2 Geräte">
          {#snippet lead()}<TeamBadge
              short={t.short}
              color={t.color}
              size={44}
              mrx={id === M.MRX}
              {locked}
              offline={offline(id)}
            />{/snippet}
          {#snippet trail()}
            <span class="pills">
              {#if id === M.MRX}<Pill tone="accent">Mister X</Pill>{/if}
              {#if locked}<Pill tone="warn" icon={Hourglass}>wartet</Pill>{/if}
              {#if offline(id)}<Pill tone="danger" dot>offline</Pill>{:else}<Pill tone="ok" dot>online</Pill>{/if}
              <Pill tone={b < 20 ? "danger" : "neutral"} icon={b < 20 ? BatteryLow : b < 70 ? BatteryMedium : BatteryFull}
                ><span class="num">{b} %</span></Pill
              >
            </span>
            <IconButton icon={Ellipsis} label="Aktionen für {t.name}" size="m" tone="plain" onclick={() => (action = id)} />
          {/snippet}
        </ListItem>
      {/each}
    </div>
  {:else if tab === "schiris"}
    <div class="list">
      {#each M.staff as s (s.uid)}
        <ListItem title={s.name} subtitle="{T.admin.zuletzt} {vor(s.pos.t, clock.now)}">
          {#snippet lead()}<span class="staff"><ShieldCheck size={24} aria-hidden="true" /></span>{/snippet}
          {#snippet trail()}
            <span class="pills">
              {#if s.followsFlag}<Pill tone="accent">begleitet Mister X</Pill>{/if}
              <Pill tone="ok" dot>online</Pill>
            </span>
            <IconButton icon={Trash} label="{s.name} entfernen" size="m" tone="plain" onclick={() => (confirmKick = s.name)} />
          {/snippet}
        </ListItem>
      {/each}
    </div>
  {:else}
    <AccessPanel
      gameName="Mister X Linz 2027"
      joinUrl="https://mr-x-ooe-neu.web.app/#/s/linz-2027"
      loadScreenUrl={async () => "https://mr-x-ooe-neu.web.app/#/g/linz-2027?k=7f3a9c0b2e"}
      onsave={async () => {}}
      onreset={() => toast(T.allgemein.prototyp(T.admin.neueRunde))}
    />
  {/if}
</div>

<BottomSheet open={!!action} title={action ? M.teams[action]!.name : ""} onclose={() => (action = null)}>
  <ListItem title={T.admin.umbenennen} onclick={() => ((action = null), toast(T.allgemein.prototyp(T.admin.umbenennen)))}>
    {#snippet lead()}<Pencil size={24} aria-hidden="true" />{/snippet}
  </ListItem>
  <ListItem
    title={T.admin.wartezeitGeben}
    subtitle="{M.config.waitMin} Min ab jetzt"
    onclick={() => ((action = null), toast("Wartezeit gesetzt", "ok"))}
  >
    {#snippet lead()}<Hourglass size={24} aria-hidden="true" />{/snippet}
  </ListItem>
  <ListItem
    title={T.admin.entfernen}
    subtitle="Handy wird abgemeldet"
    onclick={() => ((confirmKick = M.teams[action!]!.name), (action = null))}
  >
    {#snippet lead()}<Trash size={24} aria-hidden="true" />{/snippet}
  </ListItem>
</BottomSheet>

<Modal
  open={!!confirmKick}
  title="{confirmKick} entfernen?"
  confirm={T.admin.entfernen}
  danger
  onconfirm={() => toast(`${confirmKick} entfernt`, "ok")}
  onclose={() => (confirmKick = null)}
>
  Das Gerät wird abgemeldet und landet mit einer Erklärung auf der Startseite.
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
