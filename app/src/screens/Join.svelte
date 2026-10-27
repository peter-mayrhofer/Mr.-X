<!-- Screen 2: Team beitreten (Spiel-Code/QR, Teamname, Team-Passwort). -->
<script lang="ts">
  import { CircleCheck, ScanQrCode } from "@lucide/svelte";
  import AppBar from "../ui/AppBar.svelte";
  import Button from "../ui/Button.svelte";
  import TextField from "../ui/TextField.svelte";
  import Banner from "../ui/Banner.svelte";
  import { go } from "../lib/router.svelte.ts";
  import { toast } from "../ui/toast.svelte.ts";
  import { T } from "../texte.ts";

  let { variant = "" }: { variant?: string } = $props();
  // svelte-ignore state_referenced_locally
  let code = $state(variant === "spiel" ? "" : "linz-2027");
  // svelte-ignore state_referenced_locally
  let name = $state(variant ? "Urfahr" : "");
  // svelte-ignore state_referenced_locally
  let pw = $state(variant ? "falke27" : "");
  let loading = $state(false);

  function submit(e: SubmitEvent) {
    e.preventDefault();
    loading = true;
    setTimeout(() => go("/prototyp/4?v=1"), 700);
  }
</script>

<div class="page">
  <AppBar title={T.beitritt.titel} onback={() => go("/prototyp/1")} />
  <form class="form" onsubmit={submit}>
    {#if variant === "spiel"}
      <div class="game">
        <CircleCheck size={24} aria-hidden="true" />
        <div><span class="caps">{T.beitritt.spiel}</span><strong>Mister X Linz 2027</strong></div>
      </div>
    {:else}
      <div class="coderow">
        <TextField
          label={T.beitritt.spielCode}
          hint={T.beitritt.spielCodeHinweis}
          bind:value={code}
          autocapitalize="none"
          autocomplete="off"
        />
        <Button type="button" variant="secondary" icon={ScanQrCode} onclick={() => toast(T.allgemein.prototyp(T.beitritt.qrScannen))}
          >{T.beitritt.qrScannen}</Button
        >
      </div>
    {/if}

    <TextField label={T.beitritt.teamname} hint={T.beitritt.teamnameHinweis} bind:value={name} maxlength={30} autocomplete="organization" />
    <TextField
      label={T.beitritt.passwort}
      hint={T.beitritt.passwortHinweis}
      type="password"
      bind:value={pw}
      error={variant === "fehler" ? T.beitritt.fehlerPasswort : undefined}
      autocomplete="off"
    />

    {#if variant === "zweit"}
      <Banner tone="info" title="Ersatzgerät">{T.beitritt.zweitgeraet(name)}</Banner>
    {/if}

    <div class="submit">
      <Button size="xl" block {loading} disabled={!name || !pw} type="submit"
        >{variant === "zweit" ? "Als Ersatzgerät beitreten" : T.beitritt.los}</Button
      >
    </div>
  </form>
</div>

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
  .coderow {
    display: grid;
    gap: var(--sp-3);
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
    position: sticky;
    bottom: var(--sp-4);
  }
</style>
