<!-- Screen 1: Startseite. Oben das Spray-Logo, darunter alle Wege auf einer ruhigen Fläche (E-63).
     Sprache hinter dem Zahnrad oben rechts (E-67). -->
<script lang="ts">
  import { CircleCheck, Crown, Settings, ShieldCheck, Users } from "@lucide/svelte";
  import Button from "../ui/Button.svelte";
  import IconButton from "../ui/IconButton.svelte";
  import BottomSheet from "../ui/BottomSheet.svelte";
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
  let menue = $state(false);
</script>

<StartBackdrop />
<div class="scan" aria-hidden="true"></div>
<main class="start">
  <div class="zahnrad">
    <IconButton icon={Settings} label={T.einstellungen.titel} size="m" onclick={() => (menue = true)} />
  </div>
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
    <QrScanButton />
    <!-- am Handy ohne Installationshinweis, damit alles ohne Scrollen passt -->
    <DownloadKarte {system} {downloads} ohneHinweis={system === "android"} />
    <!-- Schiri und Spielleitung bewusst leise: Teams sollen den roten Knopf sehen -->
    <div class="staff">
      <button class="quiet" onclick={() => go(links.schiri)}
        ><ShieldCheck size={18} strokeWidth={2.2} aria-hidden="true" />{T.start.schiri}</button
      >
      <button class="quiet" onclick={() => go(links.admin)}><Crown size={18} strokeWidth={2.2} aria-hidden="true" />{T.start.admin}</button>
    </div>
  </section>

  <footer>
    <nav>
      <a href="#{links.help}">{T.start.hilfe}</a>
      <a href="#{links.help}">{T.start.datenschutz}</a>
    </nav>
  </footer>
</main>

<BottomSheet open={menue} title={T.einstellungen.titel} onclose={() => (menue = false)}>
  <h2 class="caps sprache">{T.einstellungen.sprache}</h2>
  <LanguagePicker />
</BottomSheet>

<style>
  .start {
    position: relative;
    z-index: 1;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
    padding: calc(var(--safe-top) + var(--sp-4)) var(--gutter) calc(var(--safe-bottom) + var(--sp-3));
    max-width: 560px;
    margin: 0 auto;
    overflow: clip;
  }
  .hero,
  .actions,
  footer {
    position: relative;
  }
  .zahnrad {
    position: absolute;
    z-index: 2;
    top: calc(var(--safe-top) + var(--sp-3));
    right: var(--gutter);
    animation: rise 0.7s var(--ease-out) 0.45s both;
  }
  .sprache {
    margin: 0 0 var(--sp-3);
    font-size: var(--fs-s);
    color: var(--text-2);
  }
  .hero {
    flex: 1;
    display: grid;
    align-content: center;
    min-height: 150px;
  }
  /* ruhiger Fleck hinter dem Logo: die gestrichelte Jagd-Route läuft nicht mehr durch die Schrift */
  .hero::before {
    content: "";
    position: absolute;
    inset: -8% -12%;
    background: radial-gradient(closest-side, var(--bg) 35%, transparent);
    opacity: 0.9;
    pointer-events: none;
  }
  .title {
    position: relative;
    margin: 0 calc(-1 * var(--sp-2));
    animation: logo-in 0.7s var(--ease-out) both;
  }
  @keyframes logo-in {
    from {
      opacity: 0;
      transform: scale(0.96);
    }
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

  /* Alle Wege auf einer ruhigen Fläche – so stört der bewegte Hintergrund keinen Text */
  .actions {
    display: grid;
    gap: var(--sp-3);
    padding: var(--sp-4);
    border-radius: var(--r-xl);
    border: var(--border-w) solid var(--line);
    background: color-mix(in srgb, var(--surface) 94%, transparent);
    box-shadow: var(--shadow-2), var(--hilite);
    animation: rise 0.7s var(--ease-out) 0.3s both;
  }
  footer {
    animation: rise 0.7s var(--ease-out) 0.45s both;
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(28px);
    }
  }
  .found {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--sp-4);
    border-radius: var(--r-m);
    background: var(--ok-soft);
    border: var(--border-strong) solid var(--ok);
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
    text-wrap: balance;
  }
  /* Schiri und Spielleitung: eigener, leiserer Bereich unter einer feinen Linie */
  .staff {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0 var(--sp-2);
    padding-top: var(--sp-2);
    border-top: var(--border-w) solid var(--line);
  }
  .quiet {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 var(--sp-2);
    border: 0;
    border-radius: var(--r-pill);
    background: none;
    color: var(--text-2);
    font-weight: 600;
    font-size: var(--fs-s);
    cursor: pointer;
    transition:
      color var(--dur-1),
      background-color var(--dur-1),
      transform var(--dur-2) var(--ease-spring);
  }
  @media (hover: hover) {
    .quiet:hover {
      color: var(--text);
      background: var(--hover);
    }
  }
  .quiet:active {
    transform: scale(0.96);
    transition-duration: 60ms;
  }
  footer {
    display: grid;
    justify-items: center;
    gap: var(--sp-1);
  }
  nav {
    display: flex;
    gap: var(--sp-5);
  }
  nav a {
    min-height: 40px;
    display: inline-flex;
    align-items: center;
    color: var(--text-2);
    font-size: var(--fs-s);
    text-underline-offset: 3px;
    transition: color var(--dur-1);
  }
  @media (hover: hover) {
    nav a:hover {
      color: var(--text);
    }
  }

  /* niedrige Handys: enger, damit die Startseite ohne Scrollen passt */
  @media (max-height: 760px) and (max-width: 999px) {
    .start {
      gap: var(--sp-3);
      padding-top: calc(var(--safe-top) + var(--sp-2));
      padding-bottom: calc(var(--safe-bottom) + var(--sp-1));
    }
    .hero {
      min-height: 120px;
    }
    .actions {
      gap: var(--sp-2);
      padding: var(--sp-3);
    }
    .staff {
      padding-top: var(--sp-1);
    }
    footer {
      gap: 0;
    }
  }

  /* sehr niedrige oder schmale Handys: Hinweiszeile weg, Hauptknopf etwas flacher, Schiri/Spielleitung ohne Symbol */
  @media (max-height: 680px) and (max-width: 999px) {
    .hint {
      display: none;
    }
    .hero {
      min-height: 100px;
    }
    .actions :global(.btn.xl) {
      min-height: 60px;
    }
  }
  @media (max-width: 340px) {
    .quiet :global(svg) {
      display: none;
    }
  }

  /* Laptop und größer: zwei Spalten, Logo groß links, die Wege als Karte rechts */
  @media (min-width: 1000px) {
    .start {
      max-width: 1560px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) clamp(380px, 30vw, 460px);
      grid-template-rows: 1fr auto;
      grid-template-areas:
        "hero actions"
        "foot foot";
      column-gap: clamp(32px, 5vw, 96px);
      padding-inline: clamp(32px, 4vw, 80px);
      padding-bottom: calc(var(--safe-bottom) + var(--sp-5));
    }
    .hero {
      grid-area: hero;
    }
    .actions {
      grid-area: actions;
      align-self: center;
      gap: var(--sp-4);
      padding: var(--sp-8);
    }
    footer {
      grid-area: foot;
    }
  }
</style>
