<!--
  Urkunden: ein A4-Blatt pro Team zum Ausdrucken – Teamname (ohne Team-Kreis), Glückwunsch zur Teilnahme, Spielname und Datum,
  nach dem Spiel dazu „Sieger“ und die Zeit als Mister X. Am Bildschirm unsichtbar, nur beim Drucken (E-65).
  Wird nur eingehängt, solange gedruckt wird; <html data-druck="urkunden"> schaltet das Druckblatt (PrintSheet) aus.
-->
<script lang="ts">
  import type { Results, Team } from "@mrx/shared";
  import Logo from "../../ui/Logo.svelte";
  import { datum, dauer } from "../../lib/format.ts";
  import { T } from "../../texte.ts";

  interface Props {
    gameName: string;
    teams: Record<string, Team>;
    /** nach dem Spiel: Sieger und Zeit als Mister X auf der Urkunde */
    results?: Results;
  }
  let { gameName, teams, results }: Props = $props();
  const U = T.urkunde;
  const ids = $derived(Object.keys(teams).sort((a, b) => teams[a]!.name.localeCompare(teams[b]!.name, "de")));
  const heute = datum(Date.now());

  /** an <body> hängen: beim Druck bleibt nur dieser Teil, der Rest der App erzeugt keine leeren Seiten */
  function anBody(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }
</script>

<div class="urkunden" use:anBody>
  {#each ids as id (id)}
    {@const t = teams[id]!}
    {@const mrx = results?.mrxMs[id] ?? 0}
    <section class="urk" aria-hidden="true">
      <div class="rahmen">
        <i class="ecke tl"></i><i class="ecke tr"></i><i class="ecke bl"></i><i class="ecke br"></i>
        <header><Logo height={96} onDark={false} /></header>

        <p class="kicker">{U.kicker}</p>
        <h1>{U.titel}</h1>
        <p class="fuer">{U.fuer}</p>

        <div class="team">
          <strong>{t.name}</strong>
        </div>

        <p class="text">{U.text(gameName)}</p>

        {#if results}
          <div class="ehren">
            {#if results.winner === id}<span class="stempel">{U.sieger}</span>{/if}
            {#if mrx > 0}<span class="zeit">{U.zeit(dauer(mrx), results.mrxCount[id] ?? 0)}</span>{/if}
          </div>
        {/if}

        <footer>
          <div class="feld"><span class="linie"></span><span>{heute}</span></div>
          <div class="feld"><span class="linie"></span><span>{U.unterschrift}</span></div>
        </footer>
      </div>
    </section>
  {/each}
</div>

<style>
  .urk {
    display: none;
  }
  @media print {
    @page {
      size: A4;
      margin: 0;
    }
    /* nur die Urkunden drucken, alles andere ganz weg (auch kein Hintergrund, keine leeren Seiten) */
    :global(html[data-druck="urkunden"] body > :not(.urkunden)) {
      display: none !important;
    }
    :global(html[data-druck="urkunden"]),
    :global(html[data-druck="urkunden"] body) {
      background: #fff !important;
      min-height: 0 !important;
    }
    .urk {
      display: block;
      width: 210mm;
      height: 297mm;
      padding: 14mm;
      background: #fff;
      color: #111;
      font-family: var(--font-text);
      break-after: page;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .urk:last-child {
      break-after: auto;
    }
    .urk:only-child {
      height: 296mm; /* sonst rundet der Browser manchmal auf eine zweite, leere Seite */
    }
    .rahmen {
      position: relative;
      height: 100%;
      padding: 16mm 14mm 14mm;
      border: 1.2mm solid #0b1825;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    /* Fadenkreuz-Ecken wie in der App */
    .ecke {
      position: absolute;
      width: 12mm;
      height: 12mm;
      border: 1.2mm solid #c51a1a;
    }
    .tl {
      top: 4mm;
      left: 4mm;
      border-right: 0;
      border-bottom: 0;
    }
    .tr {
      top: 4mm;
      right: 4mm;
      border-left: 0;
      border-bottom: 0;
    }
    .bl {
      bottom: 4mm;
      left: 4mm;
      border-right: 0;
      border-top: 0;
    }
    .br {
      bottom: 4mm;
      right: 4mm;
      border-left: 0;
      border-top: 0;
    }
    header {
      margin-bottom: 12mm;
    }
    .kicker,
    .fuer,
    .zeit,
    .feld span:last-child {
      font-family: var(--font-display);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-size: 12pt;
      color: #4a6075;
    }
    h1 {
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 76pt;
      line-height: 0.95;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      margin: 2mm 0 10mm;
      color: #0b1825;
    }
    .fuer {
      margin-bottom: 6mm;
    }
    .team {
      max-width: 100%;
      margin-bottom: 12mm;
    }
    .team strong {
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 46pt;
      line-height: 1;
      color: #c51a1a;
      overflow-wrap: anywhere;
    }
    .text {
      font-size: 16pt;
      line-height: 1.55;
      max-width: 145mm;
      color: #1a2a3a;
    }
    .ehren {
      margin-top: 12mm;
      display: grid;
      justify-items: center;
      gap: 6mm;
    }
    .stempel {
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 30pt;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #c51a1a;
      border: 1.5mm solid #c51a1a;
      border-radius: 3mm;
      padding: 1mm 6mm;
      transform: rotate(-4deg);
    }
    footer {
      margin-top: auto;
      width: 100%;
      display: flex;
      justify-content: space-between;
      gap: 20mm;
    }
    .feld {
      flex: 1;
      display: grid;
      gap: 2mm;
      justify-items: center;
    }
    .linie {
      width: 100%;
      border-top: 0.4mm solid #0b1825;
      margin-top: 10mm;
    }
  }
</style>
