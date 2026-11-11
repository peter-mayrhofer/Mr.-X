<!-- Eingabefeld mit Beschriftung, Hinweis, Fehler; Passwort mit Anzeigen-Knopf. -->
<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";
  import { Eye, EyeOff } from "@lucide/svelte";
  import { T } from "../texte.ts";

  interface Props extends Omit<HTMLInputAttributes, "value"> {
    label: string;
    value?: string;
    hint?: string;
    error?: string;
  }

  let { label, value = $bindable(""), hint, error, type = "text", id, ...rest }: Props = $props();
  const uid = $props.id();
  const fid = $derived(id ?? `f-${uid}`);
  let show = $state(false);
</script>

<div class="field" class:has-error={!!error}>
  <label for={fid}>{label}</label>
  <div class="wrap">
    <input
      id={fid}
      type={type === "password" && show ? "text" : type}
      bind:value
      aria-invalid={!!error}
      aria-describedby={error || hint ? `${fid}-d` : undefined}
      {...rest}
    />
    {#if type === "password"}
      <button type="button" class="eye" onclick={() => (show = !show)} aria-label={show ? T.beitritt.verbergen : T.beitritt.zeigen}>
        {#if show}<EyeOff size={22} aria-hidden="true" />{:else}<Eye size={22} aria-hidden="true" />{/if}
      </button>
    {/if}
  </div>
  {#if error}
    <p id="{fid}-d" class="error" role="alert">{error}</p>
  {:else if hint}
    <p id="{fid}-d" class="hint">{hint}</p>
  {/if}
</div>

<style>
  .field {
    display: grid;
    gap: 6px;
  }
  label {
    font-weight: 600;
    font-size: var(--fs-s);
    color: var(--text-2);
  }
  .wrap {
    position: relative;
  }
  input {
    width: 100%;
    min-height: var(--touch-l);
    padding: 0 var(--sp-4);
    border-radius: var(--r-m);
    border: var(--border-strong) solid var(--line);
    background: var(--surface);
    font-size: var(--fs-l);
    transition:
      border-color var(--dur-1),
      box-shadow var(--dur-2) var(--ease-out);
  }
  @media (hover: hover) {
    input:hover:not(:focus) {
      border-color: var(--line-strong);
    }
  }
  input:focus {
    outline: none;
    border-color: var(--focus);
    box-shadow: 0 0 0 4px var(--ring);
  }
  .has-error input {
    border-color: var(--accent);
  }
  .eye {
    position: absolute;
    right: 4px;
    top: 50%;
    translate: 0 -50%;
    width: var(--touch);
    height: var(--touch);
    border: 0;
    background: none;
    color: var(--text-2);
    cursor: pointer;
    display: grid;
    place-items: center;
  }
  .wrap:has(.eye) input {
    padding-right: var(--touch);
  }
  .hint {
    font-size: var(--fs-s);
    color: var(--text-3);
  }
  .error {
    font-size: var(--fs-s);
    color: var(--accent-text);
    font-weight: 600;
  }
</style>
