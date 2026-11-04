<!-- Screen 2: Team beitreten (Spiel-Code/QR, Teamname, Team-Passwort). Ersatzgerät nach Rückfrage (F14). -->
<script lang="ts">
  import { CircleCheck } from "@lucide/svelte";
  import type { JoinResult } from "@mrx/shared";
  import AppBar from "../ui/AppBar.svelte";
  import Button from "../ui/Button.svelte";
  import TextField from "../ui/TextField.svelte";
  import Banner from "../ui/Banner.svelte";
  import Stepper from "../ui/Stepper.svelte";
  import QrScanButton from "./parts/QrScanButton.svelte";
  import { ApiError } from "../lib/api.ts";
  import { T } from "../texte.ts";
  import AmbientBackdrop from "../ui/AmbientBackdrop.svelte";

  interface Props {
    /** Spielname, wenn über den QR-Link gekommen – dann kein Code-Feld */
    gameName?: string | null | undefined;
    code?: string;
    name?: string;
    password?: string;
    /** Prototyp: Zustand gleich anzeigen */
    initialError?: string;
    initialExisting?: string;
    onsubmit: (v: { code: string; name: string; password: string; secondDevice: boolean; size: number }) => Promise<JoinResult>;
    onjoined: () => void;
    onback: () => void;
  }

  let {
    gameName,
    code: code0 = "",
    name: name0 = "",
    password: pw0 = "",
    initialError,
    initialExisting,
    onsubmit,
    onjoined,
    onback,
  }: Props = $props();
  // svelte-ignore state_referenced_locally
  let code = $state(code0);
  // svelte-ignore state_referenced_locally
  let name = $state(name0);
  // svelte-ignore state_referenced_locally
  let pw = $state(pw0);
  let loading = $state(false);
  let size = $state(6);
  // svelte-ignore state_referenced_locally
  let error = $state<string | undefined>(initialError);
  // svelte-ignore state_referenced_locally
  let existing = $state<string | null>(initialExisting ?? null);

  async function submit(secondDevice = false) {
    loading = true;
    error = undefined;
    try {
      const r = await onsubmit({ code: code.trim().toLowerCase(), name: name.trim(), password: pw, secondDevice, size });
      if (r.status === "teamExists") existing = r.teamName;
      else onjoined();
    } catch (e) {
      error = e instanceof ApiError ? (e.reason === "invalid" ? e.message : T.apiFehler[e.reason]) : T.apiFehler.network;
    } finally {
      loading = false;
    }
  }
</script>

<AmbientBackdrop />
<main class="page">
  <AppBar title={T.beitritt.titel} {onback} />
  <form
    class="form"
    onsubmit={(e) => {
      e.preventDefault();
      void submit();
    }}
  >
    {#if !gameName}
      <QrScanButton />
    {/if}
    {#if gameName}
      <div class="game">
        <CircleCheck size={24} aria-hidden="true" />
        <div><span class="caps">{T.beitritt.spiel}</span><strong>{gameName}</strong></div>
      </div>
    {:else}
      <TextField
        label={T.beitritt.spielCode}
        hint={T.beitritt.spielCodeHinweis}
        bind:value={code}
        autocapitalize="none"
        autocomplete="off"
      />
    {/if}

    <TextField label={T.beitritt.teamname} hint={T.beitritt.teamnameHinweis} bind:value={name} maxlength={30} autocomplete="organization" />
    <Stepper label={T.beitritt.groesse} hint={T.beitritt.groesseHinweis} bind:value={size} unit="" min={1} max={99} />
    <TextField label={T.beitritt.passwort} hint={T.beitritt.passwortHinweis} type="password" bind:value={pw} {error} autocomplete="off" />

    {#if existing}
      <Banner tone="info" title={T.beitritt.ersatzTitel}>{T.beitritt.zweitgeraet(existing)}</Banner>
    {/if}

    <div class="submit">
      {#if existing}
        <Button size="xl" block {loading} type="button" onclick={() => submit(true)}>{T.beitritt.alsErsatz}</Button>
        <Button variant="ghost" block type="button" onclick={() => (existing = null)}>{T.beitritt.andererName}</Button>
      {:else}
        <Button size="xl" block {loading} disabled={!name.trim() || !pw || (!gameName && !code.trim())} type="submit"
          >{T.beitritt.los}</Button
        >
      {/if}
    </div>
  </form>
</main>

<style>
  .page {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }
  .form {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--sp-5);
    padding: var(--sp-5) var(--gutter) calc(var(--safe-bottom) + var(--sp-4));
    max-width: 560px;
    width: 100%;
    margin: 0 auto;
  }
  .game {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--sp-4);
    border-radius: var(--r-m);
    background: var(--ok-soft);
    border: 2px solid var(--ok);
    color: var(--ok-text);
  }
  .game div {
    display: grid;
  }
  .game strong {
    color: var(--text);
    font-size: var(--fs-l);
  }
  .submit {
    margin-top: auto;
    display: grid;
    gap: var(--sp-2);
    position: sticky;
    bottom: var(--sp-4);
  }
</style>
