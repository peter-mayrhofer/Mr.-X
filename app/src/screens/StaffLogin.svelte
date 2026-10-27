<!-- Screen 3: Schiri-/Admin-Login – eigener Zugang mit Schiri-Code bzw. Admin-Passwort, nicht erst als Team. -->
<script lang="ts">
  import AppBar from "../ui/AppBar.svelte";
  import Button from "../ui/Button.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import TextField from "../ui/TextField.svelte";
  import { ApiError } from "../lib/api.ts";
  import { T } from "../texte.ts";

  type StaffRole = "schiri" | "admin";
  interface Props {
    role?: StaffRole;
    code?: string;
    onsubmit: (v: { role: StaffRole; code: string; name: string; secret: string }) => Promise<void>;
    onsuperadmin: () => void;
    onback: () => void;
  }

  let { role: role0 = "schiri", code: code0 = "", onsubmit, onsuperadmin, onback }: Props = $props();
  // svelte-ignore state_referenced_locally
  let role = $state<StaffRole>(role0);
  // svelte-ignore state_referenced_locally
  let code = $state(code0);
  let name = $state("");
  let secret = $state("");
  let loading = $state(false);
  let error = $state<string | undefined>();

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    loading = true;
    error = undefined;
    try {
      await onsubmit({ role, code: code.trim().toLowerCase(), name: name.trim(), secret });
    } catch (err) {
      error = err instanceof ApiError ? (err.reason === "invalid" ? err.message : T.apiFehler[err.reason]) : T.apiFehler.network;
    } finally {
      loading = false;
    }
  }
</script>

<div class="page">
  <AppBar title={T.staffLogin.titel} {onback} />
  <form class="form" onsubmit={submit}>
    <Segmented
      label={T.staffLogin.titel}
      bind:value={role}
      options={[
        { value: "schiri", label: T.staffLogin.schiri },
        { value: "admin", label: T.staffLogin.admin },
      ]}
    />
    <TextField label={T.beitritt.spielCode} bind:value={code} autocapitalize="none" autocomplete="off" />
    <TextField label={T.staffLogin.name} hint={T.staffLogin.nameHinweis} bind:value={name} autocomplete="name" maxlength={30} />
    <TextField
      label={role === "admin" ? T.staffLogin.adminPasswort : T.staffLogin.schiriCode}
      type="password"
      bind:value={secret}
      {error}
      autocomplete="off"
    />
    <Button size="xl" block {loading} disabled={!name.trim() || !secret || !code.trim()} type="submit">{T.staffLogin.los}</Button>
    <div class="super">
      <Button variant="ghost" type="button" onclick={onsuperadmin}>{T.staffLogin.superAdmin}</Button>
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
