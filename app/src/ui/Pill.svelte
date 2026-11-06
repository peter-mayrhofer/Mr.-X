<!-- Kleine Status-Marke (online, offline, Wartezeit …) – immer mit Icon oder Punkt + Text. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { Icon } from "./icons.ts";

  interface Props {
    tone?: "neutral" | "ok" | "warn" | "danger" | "info" | "accent";
    icon?: Icon;
    dot?: boolean;
    children: Snippet;
  }

  let { tone = "neutral", icon: IconC, dot = false, children }: Props = $props();
</script>

<span class="pill {tone}">
  {#if IconC}<IconC size={16} strokeWidth={2.6} aria-hidden="true" />{:else if dot}<i aria-hidden="true"></i>{/if}
  {@render children()}
</span>

<style>
  .pill {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    min-height: 28px;
    padding: 2px 10px;
    border-radius: var(--r-pill);
    font-size: var(--fs-s);
    font-weight: 600;
    line-height: 1.2;
    white-space: nowrap;
    background: var(--surface-2);
    color: var(--text-2);
    border: var(--border-w) solid var(--line);
  }
  i {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: currentColor;
  }
  .ok {
    color: var(--ok-text);
    background: var(--ok-soft);
    border-color: transparent;
  }
  .warn {
    color: var(--warn-text);
    background: var(--warn-soft);
    border-color: transparent;
  }
  .danger,
  .accent {
    color: var(--accent-text);
    background: var(--accent-soft);
    border-color: transparent;
  }
  .info {
    color: var(--info-text);
    background: var(--info-soft);
    border-color: transparent;
  }
</style>
