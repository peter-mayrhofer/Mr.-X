<!-- Fläche mit optionalem Akten-Etikett oben. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { Icon } from "./icons.ts";

  interface Props {
    label?: string;
    icon?: Icon;
    tone?: "plain" | "accent" | "warn" | "info" | "ok";
    pad?: boolean;
    children: Snippet;
    action?: Snippet;
  }

  let { label, icon: IconC, tone = "plain", pad = true, children, action }: Props = $props();
</script>

<section class="card {tone}" class:pad>
  {#if label}
    <header>
      {#if IconC}<IconC size={20} strokeWidth={2.4} aria-hidden="true" />{/if}
      <h2 class="caps">{label}</h2>
      {#if action}<div class="action">{@render action()}</div>{/if}
    </header>
  {/if}
  {@render children()}
</section>

<style>
  .card {
    background: var(--surface);
    border: var(--border-w) solid var(--line);
    border-radius: var(--r-l);
    box-shadow: var(--shadow-1), var(--hilite);
  }
  .pad {
    padding: var(--sp-4);
  }
  header {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    margin-bottom: var(--sp-3);
    color: var(--text-2);
  }
  h2 {
    font-size: var(--fs-s);
    flex: 1;
  }
  .action {
    margin-left: auto;
  }
  .accent {
    border-color: var(--accent);
    background: linear-gradient(var(--accent-soft), var(--accent-soft)), var(--surface);
  }
  .accent header {
    color: var(--accent-text);
  }
  .warn {
    border-color: var(--warn);
    background: linear-gradient(var(--warn-soft), var(--warn-soft)), var(--surface);
  }
  .warn header {
    color: var(--warn-text);
  }
  .info {
    border-color: var(--info);
  }
  .ok {
    border-color: var(--ok);
  }
</style>
