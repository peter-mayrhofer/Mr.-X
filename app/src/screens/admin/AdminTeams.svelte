<!--
  Screen 15: Teams & Schiris & Zugänge. Status pro Team (online, Akku, letzte Position, Rolle), Aktionen,
  Passwörter/Codes neu festlegen (gehasht → nur neu setzen, nicht auslesen, E-06), QR-Codes, Neue Runde.
-->
<script lang="ts">
  import { renderSVG } from "uqr";
  import {
    BatteryFull,
    BatteryLow,
    BatteryMedium,
    Copy,
    Ellipsis,
    Hourglass,
    KeyRound,
    Monitor,
    Pencil,
    Printer,
    QrCode,
    RefreshCw,
    ShieldCheck,
    Trash,
    TriangleAlert,
  } from "@lucide/svelte";
  import Segmented from "../../ui/Segmented.svelte";
  import Card from "../../ui/Card.svelte";
  import ListItem from "../../ui/ListItem.svelte";
  import TeamBadge from "../../ui/TeamBadge.svelte";
  import Pill from "../../ui/Pill.svelte";
  import Button from "../../ui/Button.svelte";
  import IconButton from "../../ui/IconButton.svelte";
  import TextField from "../../ui/TextField.svelte";
  import BottomSheet from "../../ui/BottomSheet.svelte";
  import Modal from "../../ui/Modal.svelte";
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
  let confirmReset = $state(false);
  let teamPw = $state("");
  let schiriCode = $state("");
  let adminPw = $state("");

  const JOIN = "https://mr-x-ooe.web.app/#/s/linz-2027";
  const SCREEN = "https://mr-x-ooe.web.app/#/g/linz-2027?k=7f3a9c";
  const qr = (s: string) => renderSVG(s, { border: 2, whiteColor: "#fff", blackColor: "#000" });
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

  async function copy(s: string) {
    try {
      await navigator.clipboard.writeText(s);
      toast("Link kopiert", "ok");
    } catch {
      toast("Kopieren nicht möglich – Link bitte markieren", "warn");
    }
  }
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
    <div class="grid">
      <Card label={T.admin.teamPasswort} icon={KeyRound}>
        <p class="muted small">
          <Pill tone="ok">festgelegt 13:55</Pill> Aus Sicherheitsgründen nicht mehr anzeigbar – bei Bedarf neu festlegen.
        </p>
        <TextField
          label={T.admin.passwortNeu}
          bind:value={teamPw}
          autocomplete="off"
          hint="mind. 6 Zeichen, gut lesbar (steht auf dem Flyer)"
        />
        <div class="row">
          <Button size="m" disabled={teamPw.length < 6} onclick={() => ((teamPw = ""), toast("Team-Passwort gespeichert", "ok"))}
            >{T.allgemein.speichern}</Button
          >
          <Button
            size="m"
            variant="danger"
            icon={Trash}
            onclick={() => toast("Team-Passwort gelöscht – niemand kann mehr beitreten", "warn")}>{T.allgemein.loeschen}</Button
          >
        </div>
      </Card>
      <Card label={T.admin.schiriCode} icon={ShieldCheck}>
        <TextField label={T.admin.passwortNeu} bind:value={schiriCode} autocomplete="off" />
        <div class="row">
          <Button size="m" disabled={schiriCode.length < 4} onclick={() => ((schiriCode = ""), toast("Schiri-Code gespeichert", "ok"))}
            >{T.allgemein.speichern}</Button
          >
        </div>
      </Card>
      <Card label={T.admin.adminPasswort} icon={KeyRound}>
        <TextField label={T.admin.passwortNeu} type="password" bind:value={adminPw} autocomplete="new-password" />
        <div class="row">
          <Button size="m" disabled={adminPw.length < 8} onclick={() => ((adminPw = ""), toast("Admin-Passwort geändert", "ok"))}
            >{T.allgemein.speichern}</Button
          >
        </div>
      </Card>
      <Card label={T.admin.qrTeams} icon={QrCode}>
        <div class="qr">
          <!-- eslint-disable-next-line svelte/no-at-html-tags -- SVG aus eigenem, festem Link (uqr) -->
          <div class="code">{@html qr(JOIN)}</div>
          <div class="qrtext">
            <code>{JOIN}</code>
            <div class="row">
              <Button size="m" variant="secondary" icon={Copy} onclick={() => copy(JOIN)}>Kopieren</Button>
              <Button size="m" variant="secondary" icon={Printer} onclick={() => print()}>{T.admin.drucken}</Button>
            </div>
          </div>
        </div>
      </Card>
      <Card label={T.admin.grossbildLink} icon={Monitor}>
        <div class="qr">
          <!-- eslint-disable-next-line svelte/no-at-html-tags -- SVG aus eigenem, festem Link (uqr) -->
          <div class="code">{@html qr(SCREEN)}</div>
          <div class="qrtext">
            <code>{SCREEN}</code>
            <div class="row"><Button size="m" variant="secondary" icon={Copy} onclick={() => copy(SCREEN)}>Kopieren</Button></div>
          </div>
        </div>
      </Card>
      <Card label={T.admin.neueRunde} icon={TriangleAlert} tone="warn">
        <p class="small">{T.admin.neueRundeText}</p>
        <Button variant="danger" icon={RefreshCw} onclick={() => (confirmReset = true)}>{T.admin.neueRunde}</Button>
      </Card>
    </div>
  {/if}
</div>

<!-- Druckansicht: Flyer mit QR-Code für die Teams -->
<section class="flyer" aria-hidden="true">
  <h1>Mister X Linz 2027</h1>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- SVG aus eigenem, festem Link (uqr) -->
  <div class="bigqr">{@html qr(JOIN)}</div>
  <p>1. QR-Code mit der Handy-Kamera scannen</p>
  <p>2. Teamname eingeben</p>
  <p>3. Team-Passwort: ______________________</p>
  <p class="small">Android: App installieren unter mr-x-ooe.web.app/app.apk · iPhone: im Browser öffnen und „Zum Home-Bildschirm“</p>
</section>

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
<Modal
  open={confirmReset}
  title="{T.admin.neueRunde}?"
  confirm={T.admin.neueRunde}
  danger
  onconfirm={() => toast(T.allgemein.prototyp(T.admin.neueRunde))}
  onclose={() => (confirmReset = false)}
>
  {T.admin.neueRundeText}
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
  .grid {
    display: grid;
    gap: var(--sp-4);
  }
  @media (min-width: 900px) {
    .grid {
      grid-template-columns: 1fr 1fr;
      align-items: start;
    }
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
    margin-top: var(--sp-3);
  }
  .small {
    font-size: var(--fs-s);
    margin-bottom: var(--sp-3);
  }
  .qr {
    display: flex;
    gap: var(--sp-4);
    align-items: center;
    flex-wrap: wrap;
  }
  .code {
    width: 140px;
    height: 140px;
    flex: none;
    border-radius: var(--r-s);
    overflow: hidden;
  }
  .code :global(svg),
  .bigqr :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }
  .qrtext {
    flex: 1;
    min-width: 200px;
  }
  code {
    word-break: break-all;
    font-size: var(--fs-s);
  }
  .flyer {
    display: none;
  }
  @media print {
    :global(body *) {
      visibility: hidden;
    }
    .flyer,
    .flyer :global(*) {
      visibility: visible;
    }
    .flyer {
      display: block;
      position: fixed;
      inset: 0;
      padding: 24mm;
      background: #fff;
      color: #000;
      font-size: 20pt;
    }
    .bigqr {
      width: 110mm;
      height: 110mm;
      margin: 10mm 0;
    }
  }
</style>
