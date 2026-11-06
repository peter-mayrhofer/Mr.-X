<!--
  Blatt von unten. modal = mit Abdunklung (z. B. Übergabe-Ablauf), sonst eingebettet (z. B. Teamliste über der Karte).
  Escape und Tipp auf die Abdunklung schließen das modale Blatt.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { fly, fade } from "svelte/transition";
  import { X } from "@lucide/svelte";
  import { T } from "../texte.ts";

  interface Props {
    open: boolean;
    title?: string;
    modal?: boolean;
    onclose?: () => void;
    children: Snippet;
    footer?: Snippet;
  }

  let { open, title, modal = true, onclose, children, footer }: Props = $props();
</script>

<svelte:window onkeydown={(e) => open && modal && e.key === "Escape" && onclose?.()} />

{#if open}
  {#if modal}
    <button class="scrim" transition:fade={{ duration: 150 }} aria-label={T.allgemein.schliessen} onclick={onclose}></button>
  {/if}
  <div
    class="sheet"
    class:modal
    role={modal ? "dialog" : "region"}
    aria-modal={modal || undefined}
    aria-label={title}
    transition:fly={{ y: 400, duration: 250 }}
  >
    <div class="grip" aria-hidden="true"></div>
    {#if title}
      <header>
        <h2>{title}</h2>
        {#if onclose}
          <button class="close" onclick={onclose} aria-label={T.allgemein.schliessen}><X size={24} aria-hidden="true" /></button>
        {/if}
      </header>
    {/if}
    <div class="content">{@render children()}</div>
    {#if footer}<footer>{@render footer()}</footer>{/if}
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    border: 0;
    background: var(--scrim);
    z-index: var(--z-sheet);
  }
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    max-height: 88dvh;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border-top-left-radius: var(--r-xl);
    border-top-right-radius: var(--r-xl);
    border: var(--border-w) solid var(--line);
    border-bottom: 0;
    box-shadow: var(--shadow-2);
    z-index: calc(var(--z-sheet) + 1);
    padding-bottom: var(--safe-bottom);
  }
  @media (min-width: 720px) {
    .sheet {
      left: 50%;
      width: 560px;
      translate: -50% 0;
    }
  }
  .grip {
    width: 44px;
    height: 5px;
    border-radius: 3px;
    background: var(--line-strong);
    margin: 10px auto 4px;
  }
  header {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-4) var(--sp-3);
  }
  h2 {
    flex: 1;
    font-size: var(--fs-2xl);
  }
  .close {
    width: var(--touch);
    height: var(--touch);
    border-radius: 50%;
    border: 0;
    background: var(--surface-2);
    color: var(--text);
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .content {
    overflow-y: auto;
    padding: 0 var(--sp-4) var(--sp-4);
    overscroll-behavior: contain;
  }
  footer {
    padding: var(--sp-3) var(--sp-4) var(--sp-4);
    border-top: var(--border-w) solid var(--line);
  }
</style>
