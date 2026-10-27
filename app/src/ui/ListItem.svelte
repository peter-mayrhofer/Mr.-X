<!-- Listenzeile: vorne (Abzeichen/Icon), Titel + Untertitel, hinten (Status/Knopf). Klickbar, wenn onclick. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { ChevronRight } from "@lucide/svelte";

  interface Props {
    title: string;
    subtitle?: string;
    lead?: Snippet;
    trail?: Snippet;
    onclick?: () => void;
    selected?: boolean;
    chevron?: boolean;
  }

  let { title, subtitle, lead, trail, onclick, selected = false, chevron = false }: Props = $props();
</script>

{#snippet inner()}
  {#if lead}<span class="lead">{@render lead()}</span>{/if}
  <span class="txt">
    <span class="title">{title}</span>
    {#if subtitle}<span class="sub">{subtitle}</span>{/if}
  </span>
  {#if trail}<span class="trail">{@render trail()}</span>{/if}
  {#if chevron}<ChevronRight size={22} aria-hidden="true" />{/if}
{/snippet}

{#if onclick}
  <button class="item" class:selected aria-pressed={selected || undefined} {onclick}>{@render inner()}</button>
{:else}
  <div class="item">{@render inner()}</div>
{/if}

<style>
  .item {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    width: 100%;
    min-height: 64px;
    padding: var(--sp-2) var(--sp-3);
    border: var(--border-w) solid transparent;
    border-radius: var(--r-m);
    background: none;
    text-align: left;
    color: var(--text);
  }
  button.item {
    cursor: pointer;
  }
  button.item:active {
    background: var(--surface-2);
  }
  .selected {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .txt {
    flex: 1;
    min-width: 0;
    display: grid;
  }
  .title {
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sub {
    font-size: var(--fs-s);
    color: var(--text-2);
  }
  .trail {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    flex: none;
  }
</style>
