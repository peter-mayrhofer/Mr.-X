<!--
  Bestätigungs-Dialog auf Basis von <dialog> (Fokusfalle und Escape kommen vom Browser).
  danger = gefährliche Aktion → roter Rahmen, Bestätigen-Knopf rot umrandet statt gefüllt.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import Button from "./Button.svelte";
  import { T } from "../texte.ts";

  interface Props {
    open: boolean;
    title: string;
    confirm?: string;
    danger?: boolean;
    onconfirm: () => void;
    onclose: () => void;
    children?: Snippet;
  }

  let { open, title, confirm = T.allgemein.bestaetigen, danger = false, onconfirm, onclose, children }: Props = $props();
  let dlg: HTMLDialogElement | undefined = $state();

  $effect(() => {
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  });
</script>

<dialog bind:this={dlg} class:danger {onclose} aria-labelledby="modal-title">
  <h2 id="modal-title">{title}</h2>
  {#if children}<div class="body">{@render children()}</div>{/if}
  <div class="actions">
    <Button variant="secondary" onclick={onclose}>{T.allgemein.abbrechen}</Button>
    <Button
      variant={danger ? "danger" : "primary"}
      onclick={() => {
        onconfirm();
        onclose();
      }}>{confirm}</Button
    >
  </div>
</dialog>

<style>
  dialog {
    width: min(92vw, 440px);
    border: var(--border-strong) solid var(--line);
    border-radius: var(--r-l);
    background: var(--surface);
    color: var(--text);
    padding: var(--sp-6);
    box-shadow: var(--shadow-2);
  }
  dialog::backdrop {
    background: var(--scrim);
    animation: dim var(--dur-2) var(--ease-out);
  }
  dialog[open] {
    animation: pop var(--dur-3) var(--ease-spring);
  }
  @keyframes pop {
    from {
      opacity: 0;
      transform: translateY(12px) scale(0.95);
    }
  }
  @keyframes dim {
    from {
      opacity: 0;
    }
  }
  .danger {
    border-color: var(--accent);
  }
  h2 {
    font-size: var(--fs-2xl);
    margin-bottom: var(--sp-3);
  }
  .body {
    color: var(--text-2);
    margin-bottom: var(--sp-5);
  }
  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-3);
  }
</style>
