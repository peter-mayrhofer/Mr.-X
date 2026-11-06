<!-- Spielregeln & Hilfe (Abschnitt 7.11): Icon pro Regel, durchsuchbar, aktuelle Werte eingesetzt, FAQ. -->
<script lang="ts">
  import { Megaphone, Search, ShieldCheck } from "@lucide/svelte";
  import type { Config } from "@mrx/shared";
  import { ICONS } from "../../ui/icons.ts";
  import Card from "../../ui/Card.svelte";
  import RichText from "../../ui/RichText.svelte";
  import { T } from "../../texte.ts";

  let { config }: { config: Config } = $props();
  let q = $state("");
  const rules = $derived(T.regeln.liste(config));
  const hits = $derived(rules.filter((r) => (r.titel + r.text).toLowerCase().includes(q.trim().toLowerCase())));
  const faq = $derived(T.regeln.faq.filter((f) => (f.f + f.a).toLowerCase().includes(q.trim().toLowerCase())));
  const own = $derived(config.rulesText && config.rulesText.toLowerCase().includes(q.trim().toLowerCase()) ? config.rulesText : "");

  // aktuelle Werte hervorheben („alle 10 Minuten“)
  const mark = (s: string) => s.split(/(\d+ Minuten)/g);
</script>

<div class="rules">
  <label class="search">
    <Search size={22} aria-hidden="true" />
    <span class="sr-only">{T.regeln.suche}</span>
    <input type="search" bind:value={q} placeholder={T.regeln.suche} />
  </label>

  {#if own}
    <Card label={T.regeln.eigene} icon={Megaphone} tone="info">
      <RichText text={own} />
    </Card>
  {/if}

  <ol class="list">
    {#each hits as r (r.titel)}
      {@const IconC = ICONS[r.icon]!}
      <li>
        <span class="ic"><IconC size={28} strokeWidth={2.2} aria-hidden="true" /></span>
        <div>
          <h2 class="rt">{r.titel}</h2>
          <p>
            {#each mark(r.text) as part, i (i)}{#if /^\d+ Minuten$/.test(part)}<mark>{part}</mark>{:else}{part}{/if}{/each}
          </p>
        </div>
      </li>
    {/each}
  </ol>
  {#if hits.length === 0 && faq.length === 0 && !own}<p class="muted">{T.regeln.keinTreffer}</p>{/if}

  {#if faq.length}
    <h2 class="etikett sec">{T.regeln.hilfe}</h2>
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
    <details class="privacy">
      <summary>{T.datenschutz.voll}</summary>
      {#each T.datenschutz.abschnitte as a (a.titel)}
        <h3>{a.titel}</h3>
        <p>{a.text}</p>
      {/each}
    </details>
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
  .rt {
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
  .privacy {
    margin-top: var(--sp-3);
  }
  .privacy h3 {
    padding: var(--sp-2) var(--sp-4) var(--sp-1);
    font-family: var(--font-text);
    font-size: var(--fs-m);
    font-weight: 700;
    line-height: var(--lh);
    letter-spacing: 0;
  }
</style>
