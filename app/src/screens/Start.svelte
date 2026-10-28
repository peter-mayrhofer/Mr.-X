<!-- Screen 1: Splash / Startseite. Großes Logo, App-Name, zwei klare Wege. -->
<script lang="ts">
  import { CircleCheck, Crown, ShieldCheck, Smartphone, Users } from "@lucide/svelte";
  import Button from "../ui/Button.svelte";
  import Logo from "../ui/Logo.svelte";
  import StartBackdrop from "./parts/StartBackdrop.svelte";
  import { go } from "../lib/router.svelte.ts";
  import { T } from "../texte.ts";

  interface Props {
    /** Spielname aus dem QR-Link */
    game?: string | null | undefined;
    links: { join: string; schiri: string; admin: string; help: string };
    /** Android im Browser und die APK liegt am Server: Download-Link */
    apk?: string | null;
  }

  let { game, links, apk }: Props = $props();
</script>

<StartBackdrop />
<div class="flash" aria-hidden="true"></div>
<div class="scan" aria-hidden="true"></div>
<main class="start">
  <header>
    <Logo height={48} />
  </header>

  <section class="hero">
    <h1 class="title" aria-label="Mister X">
      <span class="word" aria-hidden="true"
        >{#each "MISTER" as ch, i (i)}<span class="ch" style="--i:{i}">{ch}</span>{/each}</span
      >
      <span class="x" aria-hidden="true">X</span>
    </h1>
    <p class="caps claim">{T.app.org} · {T.app.claim}</p>
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
    {#if apk}
      <a class="apk" href={apk} download><Smartphone size={22} strokeWidth={2.4} aria-hidden="true" />{T.start.androidApp}</a>
      <p class="hint">{T.start.androidHinweis}</p>
    {/if}
    <div class="staff">
      <Button variant="secondary" icon={ShieldCheck} onclick={() => go(links.schiri)}>{T.start.schiri}</Button>
      <Button variant="secondary" icon={Crown} onclick={() => go(links.admin)}>{T.start.admin}</Button>
    </div>
  </section>

  <footer>
    <Logo which="kinderfreunde-ooe" height={28} />
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
    gap: var(--sp-6);
    padding: calc(var(--safe-top) + var(--sp-5)) var(--gutter) calc(var(--safe-bottom) + var(--sp-4));
    max-width: 560px;
    margin: 0 auto;
    overflow: clip;
  }
  header,
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
    gap: var(--sp-3);
    min-height: 200px;
  }
  .title {
    font-size: clamp(72px, 24vw, 132px);
    line-height: 0.85;
    /* immer eine Zeile – sonst springt alles, wenn die Schrift nachlädt (schmälere Ersatzschrift bricht um) */
    white-space: nowrap;
    text-transform: uppercase;
    letter-spacing: -0.01em;
  }
  .word {
    display: inline-block;
  }
  .x {
    position: relative;
    color: var(--accent-text);
    display: inline-block;
    transform: rotate(-6deg);
    text-shadow: 0 0 40px var(--accent-soft);
    animation:
      x-in 1.1s cubic-bezier(0.2, 1.15, 0.3, 1) 1.15s both,
      x-glow 3.2s ease-in-out 2.4s infinite;
  }
  /* Druckwelle, wenn das X einschlägt */
  .x::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    width: 0.9em;
    height: 0.9em;
    margin: -0.45em 0 0 -0.45em;
    border-radius: 50%;
    border: 0.05em solid var(--accent-text);
    opacity: 0;
    animation: boom 1.3s cubic-bezier(0.1, 0.6, 0.3, 1) 1.75s both;
  }
  .ch {
    display: inline-block;
    animation: slam 0.75s cubic-bezier(0.2, 1.2, 0.3, 1) calc(0.45s + var(--i) * 0.075s) both;
  }
  @keyframes slam {
    from {
      opacity: 0;
      transform: translateY(-140px) scale(2.4) rotate(-9deg);
      filter: blur(16px);
    }
    to {
      opacity: 1;
      transform: none;
      filter: blur(0);
    }
  }
  @keyframes x-in {
    from {
      opacity: 0;
      transform: rotate(-6deg) scale(8) rotate(-560deg);
      filter: blur(12px);
    }
    60% {
      opacity: 1;
    }
    to {
      opacity: 1;
      transform: rotate(-6deg);
      filter: blur(0);
    }
  }
  @keyframes x-glow {
    50% {
      text-shadow: 0 0 70px var(--accent);
    }
  }
  @keyframes boom {
    from {
      opacity: 0.95;
      transform: scale(0.3);
    }
    to {
      opacity: 0;
      transform: scale(16);
    }
  }
  /* Blitz beim Einschlag und ein Lichtstrahl, der einmal über die Seite fegt */
  .flash {
    position: fixed;
    inset: 0;
    z-index: 4;
    pointer-events: none;
    background: radial-gradient(circle at 50% 40%, rgb(255 255 255 / 0.55), transparent 65%);
    animation: flash 0.7s ease-out 1.75s both;
  }
  @keyframes flash {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }
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
  header,
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
  .claim {
    color: var(--text-2);
    animation: rise 0.9s ease-out 1.6s both;
  }
  .actions {
    display: grid;
    gap: var(--sp-3);
  }
  /* sieht aus wie ein zweitrangiger Knopf, ist aber ein Download-Link */
  .apk {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--sp-2);
    min-height: var(--touch);
    border: var(--border-strong) solid var(--line);
    border-radius: var(--r-m);
    background: var(--surface-2);
    color: var(--text);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--fs-l);
    letter-spacing: 0.03em;
    text-transform: uppercase;
    text-decoration: none;
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
  nav a {
    min-height: var(--touch);
    display: inline-flex;
    align-items: center;
    color: var(--text-2);
  }

  /* Laptop und größer: zwei Spalten, Titel riesig links, die Wege als Glaskarte rechts */
  @media (min-width: 1000px) {
    .start {
      max-width: 1720px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) clamp(380px, 28vw, 500px);
      grid-template-rows: auto 1fr auto;
      grid-template-areas:
        "head head"
        "hero actions"
        "foot foot";
      column-gap: clamp(32px, 5vw, 110px);
      padding-inline: clamp(32px, 4vw, 80px);
    }
    header {
      grid-area: head;
    }
    .hero {
      grid-area: hero;
      text-align: left;
      align-content: center;
      gap: var(--sp-5);
    }
    .title {
      font-size: clamp(110px, 12.5vw, 270px);
      line-height: 0.8;
    }
    .claim {
      font-size: clamp(18px, 1.5vw, 26px);
      max-width: 34ch;
      white-space: normal;
    }
    .actions {
      grid-area: actions;
      align-self: center;
      padding: var(--sp-8);
      border-radius: var(--r-l, 24px);
      border: var(--border-w) solid var(--line-strong);
      background: color-mix(in srgb, var(--surface) 72%, transparent);
      backdrop-filter: blur(18px);
      box-shadow: 0 30px 90px rgb(0 0 0 / 0.35);
    }
    footer {
      grid-area: foot;
    }
  }
</style>
