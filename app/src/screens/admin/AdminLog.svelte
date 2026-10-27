<!-- Screen 17: Protokoll (Audit-Log) – wer hat wann was ausgelöst; wichtig bei Streit. Export als CSV. -->
<script lang="ts">
  import { Download } from "@lucide/svelte";
  import Segmented from "../../ui/Segmented.svelte";
  import Button from "../../ui/Button.svelte";
  import Pill from "../../ui/Pill.svelte";
  import { uhr } from "../../lib/format.ts";
  import { T } from "../../texte.ts";
  import * as M from "../../proto/mock.svelte.ts";

  type Cat = "alle" | "uebergabe" | "regeln" | "spielfeld" | "zugang";
  let cat = $state<Cat>("alle");
  const list = $derived([...M.audit].reverse().filter((a) => cat === "alle" || a.cat === cat));
  const ROLE = { admin: "Spielleitung", schiri: "Schiri", team: "Team", screen: "Großbild", viewer: "Zuschauer" } as const;

  function csv() {
    const rows = [
      ["Zeit", "Wer", "Rolle", "Aktion", "Details", "Rückgängig"],
      ...M.audit.map((a) => [new Date(a.t).toISOString(), a.name, ROLE[a.role], a.action, a.details, a.undone ? "ja" : ""]),
    ];
    const text = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv" }));
    a.download = "protokoll.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }
</script>

<div class="log">
  <header>
    <h1>{T.admin.protokoll}</h1>
    <Button variant="secondary" size="m" icon={Download} onclick={csv}>CSV</Button>
  </header>
  <Segmented
    label="Filter"
    bind:value={cat}
    options={(Object.keys(T.admin.filter) as Cat[]).map((k) => ({ value: k, label: T.admin.filter[k] }))}
  />
  <ol>
    {#each list as a (a.id)}
      <li class:undone={a.undone}>
        <time class="num">{uhr(a.t)}</time>
        <div class="body">
          <p class="act">
            {a.action}
            {#if a.undone}<Pill tone="warn">rückgängig gemacht</Pill>{/if}
          </p>
          {#if a.details}<p class="det">{a.details}</p>{/if}
          <p class="who"><Pill tone={a.role === "admin" ? "accent" : "info"}>{ROLE[a.role]}</Pill> {a.name}</p>
        </div>
      </li>
    {/each}
  </ol>
</div>

<style>
  .log {
    display: grid;
    gap: var(--sp-4);
    padding: var(--sp-4) var(--gutter) var(--sp-8);
    max-width: 900px;
    margin: 0 auto;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
  }
  li {
    display: flex;
    gap: var(--sp-4);
    padding: var(--sp-3) 0;
    border-bottom: var(--border-w) solid var(--line);
  }
  time {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: var(--fs-xl);
    min-width: 64px;
  }
  .body {
    display: grid;
    gap: 4px;
  }
  .act {
    font-weight: 700;
    display: flex;
    gap: var(--sp-2);
    align-items: center;
    flex-wrap: wrap;
  }
  .det {
    color: var(--text-2);
  }
  .who {
    font-size: var(--fs-s);
    display: flex;
    gap: var(--sp-2);
    align-items: center;
  }
  .undone .act,
  .undone .det {
    text-decoration: line-through;
    opacity: 0.7;
  }
</style>
