<!-- Screen 3: Schiri-/Admin-Login – eigener Zugang, nicht erst als Team. -->
<script lang="ts">
  import AppBar from "../ui/AppBar.svelte";
  import Button from "../ui/Button.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import TextField from "../ui/TextField.svelte";
  import { go } from "../lib/router.svelte.ts";
  import { T } from "../texte.ts";

  let { variant = "schiri" }: { variant?: string } = $props();
  // svelte-ignore state_referenced_locally
  let role = $state<"schiri" | "admin">(variant === "admin" ? "admin" : "schiri");
  let code = $state("linz-2027");
  let name = $state("");
  let secret = $state("");
  let loading = $state(false);

  function submit(e: SubmitEvent) {
    e.preventDefault();
    loading = true;
    setTimeout(() => go(role === "admin" ? "/prototyp/13" : "/prototyp/12"), 600);
  }
</script>

<div class="page">
  <AppBar title={T.staffLogin.titel} onback={() => go("/prototyp/1")} />
  <form class="form" onsubmit={submit}>
    <Segmented
      label={T.staffLogin.titel}
      bind:value={role}
      options={[
        { value: "schiri", label: T.staffLogin.schiri },
        { value: "admin", label: T.staffLogin.admin },
      ]}
    />
    <TextField label={T.beitritt.spielCode} bind:value={code} autocapitalize="none" />
    <TextField label={T.staffLogin.name} hint={T.staffLogin.nameHinweis} bind:value={name} autocomplete="name" />
    <TextField
      label={role === "admin" ? T.staffLogin.adminPasswort : T.staffLogin.schiriCode}
      type="password"
      bind:value={secret}
      autocomplete="off"
    />
    <Button size="xl" block {loading} disabled={!name || !secret} type="submit">{T.staffLogin.los}</Button>
    <div class="super">
      <Button variant="ghost" type="button" onclick={() => go("/prototyp/21")}>{T.staffLogin.superAdmin}</Button>
    </div>
  </form>
</div>

<style>
  .page {
    min-height: 100dvh;
  }
  .form {
    display: grid;
    gap: var(--sp-5);
    padding: var(--sp-5) var(--gutter) var(--sp-8);
    max-width: 560px;
    margin: 0 auto;
  }
  .super {
    display: flex;
    justify-content: center;
    border-top: var(--border-w) solid var(--line);
    padding-top: var(--sp-3);
  }
</style>
