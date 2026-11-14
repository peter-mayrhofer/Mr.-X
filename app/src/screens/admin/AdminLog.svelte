<!-- Screen 17: Protokoll (Audit-Log) – wer hat wann was ausgelöst; wichtig bei Streit. Export als CSV. -->
<script lang="ts">
  import { Download } from "@lucide/svelte";
  import { PROTOKOLL, uebersetzeProtokoll, type AuditEntry } from "@mrx/shared";
  import { sprache } from "../../lib/sprache.ts";
  import Segmented from "../../ui/Segmented.svelte";
  import Button from "../../ui/Button.svelte";
  import Pill from "../../ui/Pill.svelte";
  import { uhr } from "../../lib/format.ts";
  import type { Keyed } from "../../lib/game.svelte.ts";
  import { T } from "../../texte.ts";

  type Cat = "alle" | "uebergabe" | "regeln" | "spielfeld" | "zugang";
  type Entry = Keyed<Omit<AuditEntry, "role"> & { role: string; undone?: boolean }>;
  let { audit }: { audit: Entry[] } = $props();
  let cat = $state<Cat>("alle");

  // Kategorie aus der Aktion (die Texte setzt der Spiel-Server, functions/src/actions)
  const catOf = (a: Entry): Exclude<Cat, "alle"> =>
    /Übergabe/.test(a.action)
      ? "uebergabe"
      : /Bereich|Spielfeld/.test(a.action)
        ? "spielfeld"
        : /Beigetreten|Abgemeldet|Passwort|Code|entfernt|umbenannt|Runde|Gerät|Spiel angelegt|Begleitet/.test(a.action)
          ? "zugang"
          : "regeln";
  const list = $derived([...audit].reverse().filter((a) => cat === "alle" || catOf(a) === cat));
  const ROLE: Record<string, string> = { ...T.warten.rolle, superadmin: T.admin.organisator };
  // Protokoll kommt deutsch vom Server – in der Sprache der Oberfläche zeigen (E-68); freier Text bleibt
  const ue = (s: string) => uebersetzeProtokoll(s, sprache);
  const frei: string[] = [PROTOKOLL.durchsage, PROTOKOLL.nachrichtGeloescht];
  const details = (a: Entry) =>
    !a.details || frei.includes(a.action)
      ? (a.details ?? "")
      : a.action === PROTOKOLL.einstellungen
        ? a.details.split(", ").map(ue).join(", ")
        : ue(a.details);

  function csv() {
    const rows = [
      [T.admin.csv.zeit, T.admin.csv.wer, T.admin.csv.rolle, T.admin.csv.aktion, T.admin.csv.details],
      ...audit.map((a) => [new Date(a.t).toISOString(), ue(a.name), ROLE[a.role] ?? a.role, ue(a.action), details(a)]),
    ];
    const text = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + text], { type: "text/csv" }));
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
    label={T.admin.filterTitel}
    bind:value={cat}
    options={(Object.keys(T.admin.filter) as Cat[]).map((k) => ({ value: k, label: T.admin.filter[k] }))}
  />
  <ol>
    {#each list as a (a.id)}
      <li class:undone={a.undone}>
        <time class="num">{uhr(a.t)}</time>
        <div class="body">
          <p class="act">
            {ue(a.action)}
            {#if a.undone}<Pill tone="warn">{T.admin.rueckgaengigGemacht}</Pill>{/if}
          </p>
          {#if a.details}<p class="det">{details(a)}</p>{/if}
          <p class="who">
            <Pill tone={a.role === "admin" || a.role === "superadmin" ? "accent" : "info"}>{ROLE[a.role] ?? a.role}</Pill>
            {ue(a.name)}
          </p>
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
  /* durchgestrichen + Hinweis „rückgängig gemacht“ – ohne Transparenz, damit der Kontrast reicht */
  .undone .act,
  .undone .det {
    text-decoration: line-through;
    color: var(--text-3);
  }
</style>
