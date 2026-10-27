<!--
  Zugänge eines Spiels (Teil von Screen 15): Team-Passwort, Schiri-Code, Admin-Passwort neu festlegen
  (gehasht gespeichert → nur neu setzen, nicht auslesen, E-06), QR-Code für Teams mit Druck-Flyer,
  Großbild-Link. Optional „Neue Runde vorbereiten“.
-->
<script lang="ts">
  import { renderSVG } from "uqr";
  import { Copy, KeyRound, Monitor, Printer, QrCode, RefreshCw, ShieldCheck, Trash, TriangleAlert } from "@lucide/svelte";
  import { LIMITS, type SecretKind } from "@mrx/shared";
  import Card from "../../ui/Card.svelte";
  import Button from "../../ui/Button.svelte";
  import TextField from "../../ui/TextField.svelte";
  import Modal from "../../ui/Modal.svelte";
  import Logo from "../../ui/Logo.svelte";
  import { toast } from "../../ui/toast.svelte.ts";
  import { ApiError } from "../../lib/api.ts";
  import { T } from "../../texte.ts";

  interface Props {
    gameName: string;
    joinUrl: string;
    /** Großbild-Link wird erst auf Anfrage geholt (enthält den Schlüssel) */
    loadScreenUrl: () => Promise<string>;
    onsave: (kind: SecretKind, value: string | null) => Promise<void>;
    onreset?: () => void;
  }

  let { gameName, joinUrl, loadScreenUrl, onsave, onreset }: Props = $props();
  const values = $state<Record<SecretKind, string>>({ teamPw: "", schiriCode: "", adminPw: "" });
  let busy = $state<SecretKind | null>(null);
  let screenUrl = $state<string | null>(null);
  let confirmDelete = $state(false);
  let confirmReset = $state(false);

  const MIN: Record<SecretKind, number> = { teamPw: LIMITS.teamPw, schiriCode: LIMITS.schiriCode, adminPw: LIMITS.adminPw };
  const LABEL: Record<SecretKind, string> = {
    teamPw: T.admin.teamPasswort,
    schiriCode: T.admin.schiriCode,
    adminPw: T.admin.adminPasswort,
  };
  const qr = (s: string) => renderSVG(s, { border: 2, whiteColor: "#fff", blackColor: "#000" });
  const F = T.zugang.flyer;
  /** Spiel-Code fürs Abtippen (Android-App): letzter Teil des Beitritts-Links …/#/s/<code> */
  const code = $derived(joinUrl.split("/").pop() ?? "");

  async function save(kind: SecretKind, value: string | null) {
    busy = kind;
    try {
      await onsave(kind, value);
      values[kind] = "";
      toast(value === null ? T.zugang.geloescht(LABEL[kind]) : T.zugang.gespeichert(LABEL[kind]), value === null ? "warn" : "ok");
    } catch (e) {
      toast(e instanceof ApiError ? (e.reason === "invalid" ? e.message : T.apiFehler[e.reason]) : T.apiFehler.network, "warn");
    } finally {
      busy = null;
    }
  }

  async function copy(s: string) {
    try {
      await navigator.clipboard.writeText(s);
      toast(T.zugang.kopiert, "ok");
    } catch {
      toast(T.zugang.nichtKopiert, "warn");
    }
  }
</script>

<div class="grid">
  {#each ["teamPw", "schiriCode", "adminPw"] as const as kind (kind)}
    <Card label={LABEL[kind]} icon={kind === "schiriCode" ? ShieldCheck : KeyRound}>
      <p class="muted small">{kind === "teamPw" ? T.zugang.teamPwHinweis : T.zugang.nichtAnzeigbar}</p>
      <TextField
        label={T.admin.passwortNeu}
        type={kind === "adminPw" ? "password" : "text"}
        bind:value={values[kind]}
        autocomplete={kind === "adminPw" ? "new-password" : "off"}
        hint={T.zugang.mindestens(MIN[kind])}
      />
      <div class="row">
        <Button size="m" loading={busy === kind} disabled={values[kind].length < MIN[kind]} onclick={() => save(kind, values[kind])}
          >{T.allgemein.speichern}</Button
        >
        {#if kind === "teamPw"}
          <Button size="m" variant="danger" icon={Trash} onclick={() => (confirmDelete = true)}>{T.allgemein.loeschen}</Button>
        {/if}
      </div>
    </Card>
  {/each}

  <Card label={T.admin.qrTeams} icon={QrCode}>
    <div class="qr">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- SVG aus eigenem Link (uqr) -->
      <div class="code">{@html qr(joinUrl)}</div>
      <div class="qrtext">
        <code>{joinUrl}</code>
        <div class="row">
          <Button size="m" variant="secondary" icon={Copy} onclick={() => copy(joinUrl)}>{T.zugang.kopieren}</Button>
          <Button size="m" variant="secondary" icon={Printer} onclick={() => print()}>{T.admin.drucken}</Button>
        </div>
      </div>
    </div>
  </Card>

  <Card label={T.admin.grossbildLink} icon={Monitor}>
    {#if screenUrl}
      <div class="qr">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -- SVG aus eigenem Link (uqr) -->
        <div class="code">{@html qr(screenUrl)}</div>
        <div class="qrtext">
          <code>{screenUrl}</code>
          <div class="row">
            <Button size="m" variant="secondary" icon={Copy} onclick={() => copy(screenUrl!)}>{T.zugang.kopieren}</Button>
          </div>
        </div>
      </div>
    {:else}
      <p class="muted small">{T.zugang.grossbildHinweis}</p>
      <Button size="m" variant="secondary" icon={Monitor} onclick={async () => (screenUrl = await loadScreenUrl())}
        >{T.zugang.grossbildZeigen}</Button
      >
    {/if}
  </Card>

  {#if onreset}
    <Card label={T.admin.neueRunde} icon={TriangleAlert} tone="warn">
      <p class="small">{T.admin.neueRundeText}</p>
      <Button variant="danger" icon={RefreshCw} onclick={() => (confirmReset = true)}>{T.admin.neueRunde}</Button>
    </Card>
  {/if}
</div>

<!-- Druckansicht: A4-Flyer für die Teams (QR-Code, Spiel-Code, die wichtigsten Schritte); Beispiel: docs/flyer-beispiel.pdf -->
<section class="flyer" aria-hidden="true">
  <header class="fl-head">
    <Logo height={60} onDark={false} />
    <Logo which="kinderfreunde-ooe" height={40} onDark={false} />
  </header>
  <h1 class="fl-title">Mister <span class="fl-x">X</span></h1>
  <p class="fl-game">{gameName}</p>
  <div class="fl-main">
    <figure class="fl-qr">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- SVG aus eigenem Link (uqr) -->
      {@html qr(joinUrl)}
      <figcaption>{F.scannen}</figcaption>
    </figure>
    <dl class="fl-codes">
      <dt>{F.code}</dt>
      <dd class="fl-code">{code}</dd>
      <dt>{F.passwort}</dt>
      <dd class="fl-line"></dd>
      <dt>{F.notfall}</dt>
      <dd class="fl-line"></dd>
    </dl>
  </div>
  <ol class="fl-steps">
    {#each F.schritte as s, i (s.titel)}<li><b>{i + 1}. {s.titel}</b> {s.text}</li>{/each}
  </ol>
  <p class="fl-small">{F.mitnehmen}</p>
  <p class="fl-small">{T.datenschutz.kurz}</p>
  <p class="fl-url">{joinUrl}</p>
</section>

<Modal
  open={confirmDelete}
  title="{T.admin.teamPasswort} {T.allgemein.loeschen}?"
  confirm={T.allgemein.loeschen}
  danger
  onconfirm={() => save("teamPw", null)}
  onclose={() => (confirmDelete = false)}
>
  {T.zugang.loeschenFrage}
</Modal>
{#if onreset}
  <Modal
    open={confirmReset}
    title="{T.admin.neueRunde}?"
    confirm={T.admin.neueRunde}
    danger
    onconfirm={onreset}
    onclose={() => (confirmReset = false)}
  >
    {T.admin.neueRundeText}
  </Modal>
{/if}

<style>
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
  .code :global(svg) {
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
    /* nur die erste Seite: der (unsichtbare) Rest der App erzeugt sonst leere Seiten mit demselben Flyer */
    :global(#app) {
      height: 280mm;
      overflow: hidden;
    }
    .flyer {
      display: flex;
      flex-direction: column;
      gap: 6mm;
      position: fixed;
      inset: 0;
      padding: 14mm 16mm;
      background: #fff;
      color: #000;
      font-family: var(--font-text);
      font-size: 12.5pt;
      line-height: 1.35;
    }
    .fl-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .fl-title {
      font-family: var(--font-display);
      font-size: 64pt;
      font-weight: 800;
      line-height: 0.9;
      text-transform: uppercase;
    }
    .fl-x {
      color: #b30000;
    }
    .fl-game {
      font-size: 18pt;
      font-weight: 700;
      margin-top: -3mm;
    }
    .fl-main {
      display: flex;
      gap: 10mm;
      align-items: center;
    }
    .fl-qr {
      margin: 0;
      width: 80mm;
      flex: none;
      text-align: center;
      font-weight: 700;
    }
    .fl-qr :global(svg) {
      width: 80mm;
      height: 80mm;
      display: block;
    }
    .fl-codes {
      flex: 1;
      display: grid;
      gap: 2mm;
      margin: 0;
    }
    .fl-codes dt {
      font-size: 11pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .fl-codes dd {
      margin: 0 0 4mm;
    }
    .fl-code {
      font-family: var(--font-display);
      font-size: 30pt;
      font-weight: 800;
    }
    .fl-line {
      height: 12mm;
      border-bottom: 0.6mm solid #000;
    }
    .fl-steps {
      display: grid;
      gap: 3mm;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .fl-small {
      font-size: 10.5pt;
    }
    .fl-url {
      margin-top: auto;
      font-size: 9pt;
      word-break: break-all;
    }
  }
</style>
