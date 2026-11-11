<!-- Untere Navigation: groß, Daumen-erreichbar, mit Ungelesen-Zählern. -->
<script lang="ts">
  import type { Icon } from "./icons.ts";

  interface Props {
    items: { id: string; label: string; icon: Icon; badge?: number }[];
    active: string;
    onselect: (id: string) => void;
  }

  let { items, active, onselect }: Props = $props();
</script>

<nav class="tabbar">
  {#each items as it (it.id)}
    {@const IconC = it.icon}
    <button
      class:on={active === it.id}
      aria-current={active === it.id ? "page" : undefined}
      aria-label={it.badge ? `${it.label}, ${it.badge} neu` : it.label}
      onclick={() => onselect(it.id)}
    >
      <span class="ic">
        <IconC size={26} strokeWidth={active === it.id ? 2.6 : 2} aria-hidden="true" />
        {#if it.badge}<span class="badge num" aria-hidden="true">{it.badge}</span>{/if}
      </span>
      <span class="lbl">{it.label}</span>
    </button>
  {/each}
</nav>

<style>
  .tabbar {
    display: flex;
    background: var(--surface);
    border-top: var(--border-w) solid var(--line);
    padding-bottom: var(--safe-bottom);
  }
  button {
    flex: 1;
    min-height: 64px;
    border: 0;
    background: none;
    color: var(--text-3);
    display: grid;
    place-items: center;
    gap: 2px;
    padding: 8px 0 6px;
    cursor: pointer;
    font-size: var(--fs-s);
    font-weight: 600;
    transition: color var(--dur-1);
  }
  @media (hover: hover) {
    button:hover:not(.on) {
      color: var(--text);
    }
  }
  .on {
    color: var(--accent-text);
  }
  .on .ic {
    background: var(--accent-soft);
  }
  button:active .ic {
    transform: scale(0.9);
    transition-duration: 60ms;
  }
  :global([data-theme="sonne"]) .on {
    color: #000;
    text-decoration: underline 3px;
    text-underline-offset: 4px;
  }
  .ic {
    position: relative;
    display: grid;
    padding: 2px 14px;
    border-radius: var(--r-pill);
    transition:
      background-color var(--dur-2) var(--ease-out),
      transform var(--dur-2) var(--ease-spring);
  }
  .badge {
    position: absolute;
    top: -4px;
    right: 0;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    border-radius: var(--r-pill);
    background: var(--accent);
    color: var(--on-accent);
    font-size: 14px;
    line-height: 22px;
    font-weight: 700;
    border: 2px solid var(--surface);
  }
  .lbl {
    line-height: 1.1;
  }
</style>
