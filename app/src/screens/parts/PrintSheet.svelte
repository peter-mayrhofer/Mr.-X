<!--
  Druckblatt (A4) für Teams, Schiris oder die Spielleitung: Logos, QR-Code zur passenden Anmeldung, Spiel-Code und
  Passwort groß gedruckt, Notfall-Telefon und eine kurze Schritt-für-Schritt-Anleitung. Am Bildschirm unsichtbar.
-->
<script lang="ts">
  import { renderSVG } from "uqr";
  import Logo from "../../ui/Logo.svelte";
  import { T } from "../../texte.ts";

  type Role = "team" | "schiri" | "admin";
  interface Props {
    role: Role;
    gameName: string;
    code: string;
    /** Link im QR-Code (nur der Weg zur Anmeldung, kein Passwort) */
    url: string;
    /** Passwort bzw. Code; leer = Linie zum Handschreiben */
    secret: string;
    tel: string;
  }
  let { role, gameName, code, url, secret, tel }: Props = $props();
  const D = T.druck;
  const qr = $derived(renderSVG(url, { border: 1, whiteColor: "#fff", blackColor: "#000" }));
  const address = $derived(url.split("#")[0]);
</script>

<section class="sheet {role}" aria-hidden="true">
  <header class="head">
    <Logo height={56} onDark={false} />
  </header>

  <div class="band">{D.rolle[role]}</div>

  <div class="title">
    <h1>Mister <span class="x">X</span></h1>
    <p class="game">{gameName}</p>
  </div>

  <div class="main">
    <figure class="qr">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- SVG aus eigenem Link (uqr) -->
      {@html qr}
      <figcaption>{D.scannen}</figcaption>
    </figure>
    <dl class="codes">
      <div>
        <dt>{D.spielCode}</dt>
        <dd class="big">{code}</dd>
      </div>
      <div class="secret">
        <dt>{D.geheim[role]}</dt>
        {#if secret}<dd class="big">{secret}</dd>{:else}<dd class="line"></dd>{/if}
      </div>
      <div>
        <dt>{D.notfall}</dt>
        {#if tel}<dd class="tel">{tel}</dd>{:else}<dd class="line"></dd>{/if}
      </div>
    </dl>
  </div>

  <ol class="steps">
    {#each D.schritte[role] as s, i (s.titel)}
      <li>
        <span class="n">{i + 1}</span>
        <div><b>{s.titel}</b> {s.text}</div>
      </li>
    {/each}
  </ol>

  <footer class="foot">
    <p>{D.fuss[role]}</p>
    <p class="url">{D.adresse}: {address}</p>
  </footer>
</section>

<style>
  .sheet {
    display: none;
  }
  @media print {
    @page {
      size: A4;
      margin: 0;
    }
    :global(html:not([data-druck="urkunden"]) body *) {
      visibility: hidden;
    }
    .sheet,
    .sheet :global(*) {
      visibility: visible;
    }
    /* nur eine Seite: der (unsichtbare) Rest der App erzeugt sonst leere Seiten */
    :global(html:not([data-druck="urkunden"]) #app) {
      height: 280mm;
      overflow: hidden;
    }
    /* Urkunden drucken: das Druckblatt bleibt weg */
    :global(html[data-druck="urkunden"]) .sheet {
      display: none;
    }
    .sheet {
      --c: #c51a1a;
      display: flex;
      flex-direction: column;
      gap: 5mm;
      position: fixed;
      inset: 0;
      padding: 12mm 14mm 10mm;
      background: #fff;
      color: #111;
      font-family: var(--font-text);
      font-size: 11.5pt;
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet.schiri {
      --c: #1565c0;
    }
    .sheet.admin {
      --c: #0b1825;
    }
    .head {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .band {
      margin: 0 -14mm;
      padding: 3mm 14mm;
      background: var(--c);
      color: #fff;
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 17pt;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .title h1 {
      font-family: var(--font-display);
      font-size: 58pt;
      font-weight: 800;
      line-height: 0.88;
      text-transform: uppercase;
      margin: 0;
    }
    .x {
      color: #c51a1a;
    }
    .game {
      margin: 1mm 0 0;
      font-size: 17pt;
      font-weight: 700;
    }
    .main {
      display: flex;
      gap: 9mm;
      align-items: stretch;
    }
    .qr {
      margin: 0;
      width: 70mm;
      flex: none;
      padding: 4mm;
      border: 0.8mm solid var(--c);
      border-radius: 5mm;
      text-align: center;
      font-size: 9.5pt;
      font-weight: 600;
    }
    .qr :global(svg) {
      width: 100%;
      height: auto;
      display: block;
      margin-bottom: 2mm;
    }
    .codes {
      flex: 1;
      display: grid;
      align-content: space-between;
      gap: 4mm;
      margin: 0;
    }
    .codes div {
      padding: 3mm 4mm;
      border-radius: 4mm;
      background: #f1f4f7;
    }
    .codes .secret {
      background: #fff;
      border: 0.6mm dashed var(--c);
    }
    dt {
      font-size: 9.5pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--c);
    }
    dd {
      margin: 1mm 0 0;
    }
    .big {
      font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
      font-size: 22pt;
      font-weight: 700;
      letter-spacing: 0.04em;
      word-break: break-all;
    }
    .tel {
      font-size: 16pt;
      font-weight: 700;
    }
    .line {
      height: 9mm;
      border-bottom: 0.5mm solid #111;
    }
    .steps {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3.5mm 6mm;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .steps li {
      display: flex;
      gap: 3mm;
      align-items: flex-start;
    }
    .n {
      flex: none;
      width: 8mm;
      height: 8mm;
      border-radius: 50%;
      background: var(--c);
      color: #fff;
      display: grid;
      place-items: center;
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 13pt;
    }
    .steps b {
      display: block;
      font-family: var(--font-display);
      font-size: 13pt;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .foot {
      margin-top: auto;
      padding-top: 3mm;
      border-top: 0.4mm solid #ccd5dd;
      font-size: 9.5pt;
    }
    .foot p {
      margin: 0 0 1mm;
    }
    .admin .foot p:first-child {
      font-weight: 700;
      color: #b30000;
    }
    .url {
      word-break: break-all;
      color: #555;
    }
  }
</style>
