<!--
  Knopf mit Varianten und Zuständen (normal, gedrückt, deaktiviert, Laden).
  primary = Rot (Hauptaktion), secondary = Fläche, ghost = nur Text, danger = gefährlich (rot umrandet), ok = grün.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";
  import type { Icon } from "./icons.ts";

  interface Props extends HTMLButtonAttributes {
    variant?: "primary" | "secondary" | "ghost" | "danger" | "ok" | "warn";
    size?: "m" | "l" | "xl";
    icon?: Icon;
    loading?: boolean;
    block?: boolean;
    children?: Snippet;
  }

  let { variant = "primary", size = "l", icon: IconC, loading = false, block = false, disabled, children, ...rest }: Props = $props();
</script>

<button class="btn {variant} {size}" class:block disabled={disabled || loading} aria-busy={loading} {...rest}>
  {#if loading}
    <span class="spin" aria-hidden="true"></span>
  {:else if IconC}
    <IconC size={size === "xl" ? 30 : 22} strokeWidth={2.4} aria-hidden="true" />
  {/if}
  {#if children}<span class="label">{@render children()}</span>{/if}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--sp-2);
    min-height: var(--touch);
    padding: 0 var(--sp-5);
    border: var(--border-strong) solid transparent;
    border-radius: var(--r-m);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--fs-l);
    letter-spacing: 0.03em;
    text-transform: uppercase;
    cursor: pointer;
    user-select: none;
    transition:
      transform var(--dur-1) var(--ease-out),
      background-color var(--dur-1),
      opacity var(--dur-1);
  }
  .btn:active:not(:disabled) {
    transform: scale(0.97);
  }
  .btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .l {
    min-height: var(--touch-l);
  }
  .xl {
    min-height: var(--touch-xl);
    font-size: var(--fs-xl);
    border-radius: var(--r-l);
    padding: 0 var(--sp-6);
  }
  .m {
    font-size: var(--fs-m);
    padding: 0 var(--sp-4);
  }
  .block {
    display: flex;
    width: 100%;
  }
  .primary {
    background: var(--accent);
    color: var(--on-accent);
    box-shadow: var(--shadow-1);
  }
  .primary:active:not(:disabled) {
    background: var(--accent-press);
  }
  .secondary {
    background: var(--surface-2);
    color: var(--text);
    border-color: var(--line);
  }
  .ghost {
    background: transparent;
    color: var(--text);
    text-transform: none;
    font-family: var(--font-text);
    font-weight: 600;
    font-size: var(--fs-m);
    letter-spacing: 0;
  }
  .danger {
    background: transparent;
    color: var(--accent-text);
    border-color: var(--accent);
  }
  .ok {
    background: var(--ok);
    color: var(--on-ok);
  }
  .warn {
    background: var(--warn);
    color: var(--on-warn);
  }
  .label {
    line-height: 1.1;
  }
  .spin {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 3px solid currentColor;
    border-right-color: transparent;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
