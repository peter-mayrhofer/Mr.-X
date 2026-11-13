<!--
  Urkunden: ein A4-Blatt pro Team zum Ausdrucken (E-65). Kopf wie die App (Nachtblau, Raster, Radar, Spray-Logo,
  Farbtropfen), darunter ein Stadtplan als Muster mit rotem Spielfeld und Jagd-Route. „URKUNDE“ in Schablonen-Schrift,
  Teamname in Marker-Schrift auf Textmarker, Text in Schreibmaschinen-Schrift, Stempel „Mission erfüllt“ (Sieger: dazu
  „Sieger“). Nur der Teamname, kein Team-Kreis. Am Bildschirm unsichtbar; wird nur zum Drucken eingehängt, direkt an
  <body>, damit der Rest der App keine leeren Seiten erzeugt.
-->
<script lang="ts">
  import "@fontsource/saira-stencil-one/400.css";
  import "@fontsource/permanent-marker/400.css";
  import "@fontsource/special-elite/400.css";
  import type { Results, Team } from "@mrx/shared";
  import { datum, dauer } from "../../lib/format.ts";
  import { feld, fluss, gesperrt, hauptstrassen, punkte, route, strassen } from "../../lib/urkundeKarte.ts";
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
  const logo = `${import.meta.env.BASE_URL}logos/mister-x-urkunde.png`;
  /** lange Teamnamen kleiner, damit sie auf eine bis zwei Zeilen passen */
  const namensGroesse = (n: string) => `${Math.round(Math.min(58, Math.max(30, 720 / Math.max(8, n.length))))}pt`;
  /** Ringe mit Teilstrichen wie die Radar-Kreise in der App */
  const ticks = (r: number) => `0.4 ${((2 * Math.PI * r) / 72 - 0.4).toFixed(2)}`;

  /** an <body> hängen: beim Druck bleibt nur dieser Teil, der Rest der App erzeugt keine leeren Seiten */
  function anBody(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }
</script>

<div class="urkunden" use:anBody>
  <!-- gemeinsame Muster und Filter (einmal für alle Blätter) -->
  <svg class="defs" width="0" height="0" aria-hidden="true">
    <defs>
      <pattern id="urk-raster" width="8" height="8" patternUnits="userSpaceOnUse">
        <path d="M8 0H0V8" fill="none" stroke="#1d3a55" stroke-width="0.25" />
      </pattern>
      <pattern id="urk-schraffur" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <path d="M0 0V3" stroke="#c51a1a" stroke-width="0.5" />
      </pattern>
      <!-- Stempelfarbe: unregelmäßig aufgetragen -->
      <filter id="urk-stempel" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="n" />
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.7" result="m" />
        <feComposite in="SourceGraphic" in2="m" operator="in" />
      </filter>
      <path id="urk-kreis" d="M30 30m-21 0a21 21 0 1 1 42 0a21 21 0 1 1 -42 0" />
    </defs>
  </svg>

  {#each ids as id (id)}
    {@const t = teams[id]!}
    {@const mrx = results?.mrxMs[id] ?? 0}
    {@const sieger = results?.winner === id}
    <section class="urk" aria-hidden="true">
      <!-- Kopf: Nachtblau mit Raster, Radar-Kreisen und Spray-Logo -->
      <header class="kopf">
        <svg class="kopf-deko" viewBox="0 0 210 86" preserveAspectRatio="xMidYMid slice">
          <rect width="210" height="86" fill="url(#urk-raster)" />
          <g fill="none" stroke="#8fb3cf" stroke-opacity="0.35">
            <circle cx="6" cy="80" r="46" stroke-width="0.4" />
            <circle cx="6" cy="80" r="44" stroke-width="2.4" stroke-dasharray={ticks(44)} />
            <circle cx="6" cy="80" r="30" stroke-width="0.4" />
            <circle cx="206" cy="4" r="38" stroke-width="0.4" />
            <circle cx="206" cy="4" r="36" stroke-width="2.4" stroke-dasharray={ticks(36)} />
            <circle cx="206" cy="4" r="22" stroke-width="0.4" />
          </g>
          <path d="M6 80m-44 0a44 44 0 0 1 22 -38" fill="none" stroke="#c51a1a" stroke-width="1.6" stroke-linecap="round" />
          <circle cx="30" cy="14" r="1.6" fill="#3b9cff" />
          <circle cx="182" cy="70" r="1.6" fill="#ffc531" />
          <circle cx="160" cy="18" r="1.6" fill="#2fbf71" />
        </svg>
        <img class="logo" src={logo} alt="Mister X" />
        <p class="kicker">{U.kicker} · {gameName}</p>
      </header>
      <!-- Farbtropfen laufen vom Kopf ins Blatt -->
      <svg class="tropfen" viewBox="0 0 210 16" preserveAspectRatio="none" aria-hidden="true">
        <path
          fill="#0b1825"
          d="M0 0H210V2C204 2 203 5 202 9S199 9 199 5 196 2 190 2H158C154 2 153 4 153 12S149 13 149 6 147 2 140 2H104C100 2 99 6 99 10S95 11 95 6 92 2 86 2H52C47 2 46 4 46 14S42 15 42 7 40 2 33 2H18C14 2 13 4 13 8S9 9 9 5 6 2 0 2Z"
        />
      </svg>

      <div class="blatt">
        <!-- Stadtplan als Muster -->
        <svg class="karte" viewBox="0 0 210 205" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <path d={fluss} fill="none" stroke="#d5e5f1" stroke-width="11" stroke-linecap="round" />
          <path d={strassen} fill="none" stroke="#dde3ea" stroke-width="0.35" />
          <path d={hauptstrassen} fill="none" stroke="#d3dbe3" stroke-width="1.8" stroke-linejoin="round" />
          <path d={gesperrt} fill="url(#urk-schraffur)" opacity="0.22" />
          <path d={feld} fill="none" stroke="#c51a1a" stroke-opacity="0.2" stroke-width="0.9" stroke-linejoin="round" />
          <path d={route} fill="none" stroke="#c51a1a" stroke-opacity="0.45" stroke-width="0.7" stroke-dasharray="2.2 1.6" />
          {#each punkte as p (p.x)}
            {#if p.mrx}
              <circle cx={p.x} cy={p.y} r="7" fill="none" stroke="#c51a1a" stroke-opacity="0.25" stroke-width="0.6" />
              <circle cx={p.x} cy={p.y} r="4.5" fill="none" stroke="#c51a1a" stroke-opacity="0.35" stroke-width="0.6" />
            {/if}
            <circle cx={p.x} cy={p.y} r={p.r} fill={p.c} fill-opacity="0.75" stroke="#fff" stroke-width="0.6" />
          {/each}
        </svg>
        <!-- heller Schleier in der Mitte, damit die Schrift gut lesbar bleibt -->
        <div class="schleier"></div>
        <i class="ecke ol"></i><i class="ecke or"></i><i class="ecke ul"></i><i class="ecke ur"></i>

        <div class="inhalt">
          <h1 class="titel">{U.titel}</h1>
          <svg class="pinsel" viewBox="0 0 120 8" preserveAspectRatio="none" aria-hidden="true">
            <path d="M2 5C20 2 42 6 62 3S100 2 118 4" fill="none" stroke="#c51a1a" stroke-width="3.2" stroke-linecap="round" />
            <path d="M10 6.4C34 5 60 7 88 5.2" fill="none" stroke="#c51a1a" stroke-width="1" stroke-linecap="round" opacity="0.7" />
          </svg>
          <p class="fuer">{U.fuer}</p>
          <h2 class="name" style:font-size={namensGroesse(t.name)}><span>{t.name}</span></h2>
          <p class="text">{U.text(gameName)}</p>

          <div class="ehren">
            <svg class="stempel rund" viewBox="0 0 60 60" aria-hidden="true">
              <g filter="url(#urk-stempel)" fill="none" stroke="#c51a1a">
                <circle cx="30" cy="30" r="28" stroke-width="1.6" />
                <circle cx="30" cy="30" r="17" stroke-width="0.8" />
                <text class="ring"
                  ><textPath href="#urk-kreis" textLength="129" lengthAdjust="spacing">{U.mission} ★ Mister X ★</textPath></text
                >
                <path d="M23 31l5 5 10-12" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
              </g>
            </svg>
            {#if sieger}
              <svg class="stempel sieger" viewBox="0 0 110 40" aria-hidden="true">
                <g filter="url(#urk-stempel)">
                  <rect x="3" y="3" width="104" height="34" rx="4" fill="none" stroke="#c51a1a" stroke-width="2.4" />
                  <text x="55" y="29" text-anchor="middle" class="sieger-text">{U.sieger}</text>
                </g>
              </svg>
            {/if}
          </div>
          {#if mrx > 0}<p class="zeit">{U.zeit(dauer(mrx), results?.mrxCount[id] ?? 0)}</p>{/if}

          <footer>
            <div class="feld"><span class="wert">{heute}</span><span class="linie"></span><span class="lbl">{U.datum}</span></div>
            <div class="feld"><span class="wert"></span><span class="linie"></span><span class="lbl">{U.unterschrift}</span></div>
          </footer>
        </div>
      </div>
    </section>
  {/each}
</div>

<style>
  .urk,
  .defs {
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
    .defs {
      display: block;
      position: absolute;
    }
    .urk {
      --nacht: #0b1825;
      --rot: #c51a1a;
      --papier: #fbf7ef;
      display: flex;
      flex-direction: column;
      position: relative;
      width: 210mm;
      height: 297mm;
      overflow: hidden;
      background: var(--papier);
      color: var(--nacht);
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

    /* ---------- Kopf ---------- */
    .kopf {
      position: relative;
      height: 86mm;
      flex: none;
      background: radial-gradient(120mm 80mm at 50% 40%, #152b40, var(--nacht) 70%);
      display: grid;
      place-items: center;
      align-content: center;
      gap: 3mm;
    }
    .kopf-deko {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }
    .logo {
      position: relative;
      width: 128mm;
      height: auto;
    }
    .kicker {
      position: relative;
      margin: 0;
      font-family: "Special Elite", monospace;
      font-size: 11pt;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #a8bbcc;
    }
    .tropfen {
      display: block;
      width: 100%;
      height: 9mm;
      margin-top: -0.3mm;
      flex: none;
      position: relative;
      z-index: 2;
    }

    /* ---------- Blatt ---------- */
    .blatt {
      position: relative;
      flex: 1;
      margin-top: -9mm;
    }
    .karte {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }
    .schleier {
      position: absolute;
      inset: 0;
      background: radial-gradient(78mm 70mm at 50% 44%, rgb(251 247 239 / 0.94), rgb(251 247 239 / 0.6) 70%, rgb(251 247 239 / 0.15));
    }
    .ecke {
      position: absolute;
      width: 13mm;
      height: 13mm;
      border: 1.3mm solid var(--rot);
    }
    .ol {
      top: 13mm;
      left: 8mm;
      border-right: 0;
      border-bottom: 0;
    }
    .or {
      top: 13mm;
      right: 8mm;
      border-left: 0;
      border-bottom: 0;
    }
    .ul {
      bottom: 8mm;
      left: 8mm;
      border-right: 0;
      border-top: 0;
    }
    .ur {
      bottom: 8mm;
      right: 8mm;
      border-left: 0;
      border-top: 0;
    }
    .inhalt {
      position: relative;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 20mm 22mm 16mm;
    }
    .titel {
      margin: 0;
      font-family: "Saira Stencil One", var(--font-display);
      font-weight: 400;
      font-size: 66pt;
      line-height: 0.9;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--nacht);
    }
    .pinsel {
      width: 118mm;
      height: 5mm;
      margin: 1mm 0 6mm;
    }
    .fuer,
    .lbl {
      margin: 0;
      font-family: "Special Elite", monospace;
      font-size: 11.5pt;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #3e5468;
    }
    .name {
      margin: 3mm 0 7mm;
      max-width: 160mm;
      font-family: "Permanent Marker", var(--font-display);
      font-weight: 400;
      line-height: 1.08;
      color: var(--rot);
      transform: rotate(-2deg);
      text-wrap: balance;
      overflow-wrap: anywhere;
    }
    /* gelber Textmarker hinter dem Namen */
    .name span {
      padding: 0 3mm;
      background: linear-gradient(transparent 46%, rgb(255 197 49 / 0.55) 46%, rgb(255 197 49 / 0.55) 88%, transparent 88%);
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
    }
    .text {
      margin: 0;
      max-width: 146mm;
      font-family: "Special Elite", monospace;
      font-size: 13.5pt;
      line-height: 1.6;
      color: #1a2a3a;
    }
    .ehren {
      margin-top: 8mm;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 9mm;
    }
    .stempel.rund {
      width: 40mm;
      height: 40mm;
      transform: rotate(-12deg);
      opacity: 0.88;
    }
    .ring {
      font-family: "Saira Stencil One", var(--font-display);
      font-size: 5.6px;
      text-transform: uppercase;
      fill: var(--rot);
      stroke: none;
    }
    .stempel.sieger {
      width: 58mm;
      height: 21mm;
      transform: rotate(6deg);
      opacity: 0.9;
    }
    .sieger-text {
      font-family: "Saira Stencil One", var(--font-display);
      font-size: 24px;
      letter-spacing: 3px;
      text-transform: uppercase;
      fill: var(--rot);
    }
    .zeit {
      margin: 4mm 0 0;
      font-family: "Special Elite", monospace;
      font-size: 11.5pt;
      color: #3e5468;
    }
    footer {
      margin-top: auto;
      width: 100%;
      display: flex;
      justify-content: space-between;
      gap: 26mm;
      padding: 0 6mm;
    }
    .feld {
      flex: 1;
      display: grid;
      grid-template-rows: 9mm auto auto;
      align-items: end;
      justify-items: center;
      gap: 1.5mm;
    }
    .feld .lbl {
      font-size: 10pt;
      letter-spacing: 0.14em;
      white-space: nowrap;
    }
    .wert {
      font-family: "Permanent Marker", var(--font-display);
      font-size: 15pt;
      color: var(--nacht);
    }
    .linie {
      width: 100%;
      border-top: 0.4mm solid var(--nacht);
    }
  }
</style>
