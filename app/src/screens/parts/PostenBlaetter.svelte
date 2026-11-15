<!--
  Bonus-Posten zum Aufhängen (E-75): ein A4-Blatt pro Posten mit großem QR-Code, Name des Postens und kurzer
  Anleitung. Am Bildschirm unsichtbar; wird nur zum Drucken direkt an <body> gehängt (wie die Urkunden), damit der Rest
  der App keine leeren Seiten erzeugt.
-->
<script lang="ts">
  import { renderSVG } from "uqr";
  import { POSTEN_FARBE } from "../../map/style.ts";
  import { T } from "../../texte.ts";

  let { gameName, posten }: { gameName: string; posten: { name: string; url: string }[] } = $props();
  const D = T.postenDruck;

  function anBody(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }
</script>

<div class="posten-blaetter" use:anBody style:--c={POSTEN_FARBE}>
  {#each posten as x (x.url)}
    <section class="blatt" aria-hidden="true">
      <p class="band">{D.band}</p>
      <h1>Mister <span class="x">X</span></h1>
      <p class="name">{x.name}</p>
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- SVG aus eigenem Link (uqr) -->
      <div class="qr">{@html renderSVG(x.url, { border: 1, whiteColor: "#fff", blackColor: "#000" })}</div>
      <ol>
        {#each D.schritte as s (s)}<li>{s}</li>{/each}
      </ol>
      <p class="fuss">{gameName}</p>
    </section>
  {/each}
</div>

<style>
  .posten-blaetter {
    display: none;
  }
  @media print {
    @page {
      size: A4;
      margin: 0;
    }
    :global(html[data-druck="posten"] body > :not(.posten-blaetter)) {
      display: none !important;
    }
    :global(html[data-druck="posten"]),
    :global(html[data-druck="posten"] body) {
      background: #fff !important;
      min-height: 0 !important;
    }
    .posten-blaetter {
      display: block;
    }
    .blatt {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6mm;
      width: 210mm;
      height: 296mm;
      padding: 14mm 16mm 12mm;
      box-sizing: border-box;
      background: #fff;
      color: #111;
      font-family: var(--font-text);
      text-align: center;
      break-after: page;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .blatt:last-child {
      break-after: auto;
    }
    .band {
      margin: 0;
      padding: 3mm 10mm;
      border-radius: 99mm;
      background: var(--c);
      color: #fff;
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 22pt;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    h1 {
      margin: 0;
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 40pt;
      line-height: 1;
    }
    .x {
      color: #c51a1a;
    }
    .name {
      margin: 0;
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 34pt;
      line-height: 1.1;
      color: var(--c);
    }
    .qr {
      width: 120mm;
      height: 120mm;
    }
    .qr :global(svg) {
      width: 100%;
      height: 100%;
    }
    ol {
      margin: 0;
      padding-left: 7mm;
      text-align: left;
      font-size: 14pt;
      line-height: 1.4;
    }
    .fuss {
      margin: auto 0 0;
      font-size: 11pt;
      color: #555;
    }
  }
</style>
