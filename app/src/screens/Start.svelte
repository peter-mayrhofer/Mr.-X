<!-- Screen 1: Splash / Startseite. Spray-Logo, zwei klare Wege. -->
<script lang="ts">
  import { CircleCheck, Crown, ShieldCheck, Users } from "@lucide/svelte";
  import Button from "../ui/Button.svelte";
  import StartBackdrop from "./parts/StartBackdrop.svelte";
  import SprayLogo from "./parts/SprayLogo.svelte";
  import QrScanButton from "./parts/QrScanButton.svelte";
  import DownloadKarte from "./parts/DownloadKarte.svelte";
  import LanguagePicker from "./parts/LanguagePicker.svelte";
  import type { Downloads, System } from "@mrx/shared";
  import { go } from "../lib/router.svelte.ts";
  import { T } from "../texte.ts";

  interface Props {
    /** Spielname aus dem QR-Link */
    game?: string | null | undefined;
    links: { join: string; schiri: string; admin: string; help: string };
    /** Gerät im Browser und App-Dateien am Server: Download-Karte (leer = keine Karte) */
    system?: System;
    downloads?: Downloads;
  }

  let { game, links, system = "andere", downloads = {} }: Props = $props();
</script>

<StartBackdrop />
<div class="scan" aria-hidden="true"></div>
<main class="start">
  <section class="hero">
    <h1 class="title" aria-label="Mister X"><SprayLogo /></h1>
  </section>

  <section class="actions">
    {#if game}
      <div class="found" role="status">
        <CircleCheck size={26} aria-hidden="true" />
        <div><span class="caps">{T.start.spielGefunden}</span><strong>{game}</strong></div>
      </div>
    {/if}
    <Button size="xl" block icon={Users} onclick={() => go(links.join)}>{T.start.teamBeitreten}</Button>
    <p class="hint">{T.start.teamHinweis}</p>
    <DownloadKarte {system} {downloads} ohneHinweis />
    <QrScanButton />
    <div class="staff">
      <Button variant="secondary" icon={ShieldCheck} onclick={() => go(links.schiri)}>{T.start.schiri}</Button>
      <Button variant="secondary" icon={Crown} onclick={() => go(links.admin)}>{T.start.admin}</Button>
    </div>
  </section>

  <footer>
    <div class="sprache"><LanguagePicker kurz /></div>
    <nav>
      <a href="#{links.help}">{T.start.hilfe}</a>
      <a href="#{links.help}">{T.start.datenschutz}</a>
    </nav>
  </footer>
</main>

<style>
  .start {
    position: relative;
    z-index: 1;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
    padding: calc(var(--safe-top) + var(--sp-4)) var(--gutter) calc(var(--safe-bottom) + var(--sp-4));
    max-width: 560px;
    margin: 0 auto;
    overflow: clip;
  }
  .hero,
  .actions,
  footer {
    position: relative;
  }
  .hero {
    flex: 1;
    display: grid;
    align-content: center;
    text-align: center;
  }
  .title {
    margin: 0 calc(-1 * var(--sp-2));
  }
  /* Ein Lichtstrahl, der einmal über die Seite fegt */
  .scan {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    width: 3px;
    z-index: 4;
    pointer-events: none;
    background: var(--accent-text);
    box-shadow: 0 0 40px 12px var(--accent);
    animation: scan 1.3s cubic-bezier(0.6, 0, 0.3, 1) 0.15s both;
  }
  @keyframes scan {
    from {
      transform: translateX(-10px);
      opacity: 1;
    }
    to {
      transform: translateX(100vw);
      opacity: 0;
    }
  }
  footer {
    animation: rise 0.9s ease-out 2.2s both;
  }
  .actions {
    animation: rise 0.9s cubic-bezier(0.2, 0.9, 0.3, 1) 1.9s both;
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(44px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
  .actions {
    display: grid;
    gap: var(--sp-3);
  }
  .found {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--sp-4);
    border-radius: var(--r-m);
    background: var(--ok-soft);
    border: 2px solid var(--ok);
    color: var(--ok-text);
  }
  .found div {
    display: grid;
  }
  .found strong {
    color: var(--text);
    font-size: var(--fs-l);
  }
  .hint {
    text-align: center;
    color: var(--text-2);
    font-size: var(--fs-s);
  }
  .staff {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-3);
    margin-top: var(--sp-2);
  }
  footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-4);
    padding-top: var(--sp-4);
    border-top: var(--border-w) solid var(--line);
  }
  nav {
    display: flex;
    gap: var(--sp-4);
  }
  .sprache {
    flex-basis: 100%;
  }
  nav a {
    min-height: var(--touch);
    display: inline-flex;
    align-items: center;
    color: var(--text-2);
  }

  /* niedrige Handys: enger, damit die Startseite ohne Scrollen passt */
  @media (max-height: 760px) and (max-width: 999px) {
    .start {
      gap: var(--sp-3);
      padding-top: calc(var(--safe-top) + var(--sp-2));
    }
    .actions {
      gap: var(--sp-2);
    }
    .staff {
      margin-top: 0;
    }
    footer {
      padding-top: var(--sp-2);
      gap: var(--sp-2);
    }
  }

  /* Laptop und größer: zwei Spalten, Titel riesig links, die Wege als Glaskarte rechts */
  @media (min-width: 1000px) {
    .start {
      max-width: 1720px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) clamp(380px, 28vw, 500px);
      grid-template-rows: 1fr auto;
      grid-template-areas:
        "hero actions"
        "foot foot";
      column-gap: clamp(32px, 5vw, 110px);
      padding-inline: clamp(32px, 4vw, 80px);
    }
    .hero {
      grid-area: hero;
      text-align: left;
      align-content: center;
      gap: var(--sp-5);
    }
    .actions {
      grid-area: actions;
      align-self: center;
      padding: var(--sp-8);
      border-radius: var(--r-l, 24px);
      border: var(--border-w) solid var(--line-strong);
      background: color-mix(in srgb, var(--surface) 88%, transparent);
      box-shadow: 0 30px 90px rgb(0 0 0 / 0.35);
    }
    footer {
      grid-area: foot;
    }
  }
</style>
