<!-- Spielregeln & Hilfe (Abschnitt 7.11): Icon pro Regel, durchsuchbar, aktuelle Werte eingesetzt, FAQ. -->
<script lang="ts">
  import { Search, ShieldCheck } from "@lucide/svelte";
  import type { Config } from "@mrx/shared";
  import { ICONS } from "../../ui/icons.ts";
  import Card from "../../ui/Card.svelte";
  import { T } from "../../texte.ts";

  let { config }: { config: Config } = $props();
  let q = $state("");
  const rules = $derived(T.regeln.liste(config));
  const hits = $derived(rules.filter((r) => (r.titel + r.text).toLowerCase().includes(q.trim().toLowerCase())));
  const faq = $derived(T.regeln.faq.filter((f) => (f.f + f.a).toLowerCase().includes(q.trim().toLowerCase())));

  // aktuelle Werte hervorheben („alle 10 Minuten“)
  const mark = (s: string) => s.split(/(\d+ Minuten)/g);
</script>

<div class="rules">
  <label class="search">
    <Search size={22} aria-hidden="true" />
    <span class="sr-only">{T.regeln.suche}</span>
    <input type="search" bind:value={q} placeholder={T.regeln.suche} />
  </label>

  <ol class="list">
    {#each hits as r (r.titel)}
      {@const IconC = ICONS[r.icon]!}
      <li>
        <span class="ic"><IconC size={28} strokeWidth={2.2} aria-hidden="true" /></span>
        <div>
          <h3>{r.titel}</h3>
          <p>
            {#each mark(r.text) as part, i (i)}{#if /^\d+ Minuten$/.test(part)}<mark>{part}</mark>{:else}{part}{/if}{/each}
          </p>
        </div>
      </li>
    {/each}
  </ol>
  {#if hits.length === 0 && faq.length === 0}<p class="muted">{T.regeln.keinTreffer}</p>{/if}

  {#if faq.length}
    <h2 class="caps sec">{T.regeln.hilfe}</h2>
    <div class="faq">
      {#each faq as f (f.f)}
        <details>
          <summary>{f.f}</summary>
          <p>{f.a}</p>
        </details>
      {/each}
    </div>
  {/if}

  <Card label={T.start.datenschutz} icon={ShieldCheck}>
    <p class="muted">{T.datenschutz.kurz}</p>
  </Card>
</div>

<style>
  .rules {
    display: grid;
    gap: var(--sp-4);
    padding: var(--sp-4) var(--gutter) var(--sp-8);
  }
  .search {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    min-height: var(--touch-l);
    padding: 0 var(--sp-4);
    border-radius: var(--r-pill);
    border: var(--border-strong) solid var(--line);
    background: var(--surface);
    color: var(--text-2);
  }
  .search:focus-within {
    border-color: var(--focus);
  }
  .search input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: none;
    font-size: var(--fs-m);
    outline: none;
    min-height: 48px;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--sp-3);
  }
  li {
    display: flex;
    gap: var(--sp-4);
    padding: var(--sp-4);
    border-radius: var(--r-l);
    background: var(--surface);
    border: var(--border-w) solid var(--line);
  }
  .ic {
    flex: none;
    width: 52px;
    height: 52px;
    border-radius: var(--r-m);
    display: grid;
    place-items: center;
    background: var(--accent-soft);
    color: var(--accent-text);
  }
  h3 {
    font-size: var(--fs-xl);
    margin-bottom: 2px;
  }
  mark {
    background: var(--warn-soft);
    color: inherit;
    font-weight: 800;
    padding: 0 3px;
    border-radius: 4px;
  }
  .sec {
    margin-top: var(--sp-4);
    color: var(--text-2);
  }
  .faq {
    display: grid;
    gap: var(--sp-2);
  }
  details {
    border-radius: var(--r-m);
    background: var(--surface);
    border: var(--border-w) solid var(--line);
  }
  summary {
    min-height: var(--touch-l);
    display: flex;
    align-items: center;
    padding: 0 var(--sp-4);
    font-weight: 700;
    cursor: pointer;
  }
  details p {
    padding: 0 var(--sp-4) var(--sp-4);
    color: var(--text-2);
  }
</style>
