<!-- Screen 1: Splash / Startseite. Großes Logo, App-Name, zwei klare Wege. -->
<script lang="ts">
  import { CircleCheck, ShieldCheck, Users, Crown } from "@lucide/svelte";
  import Button from "../ui/Button.svelte";
  import Logo from "../ui/Logo.svelte";
  import { go } from "../lib/router.svelte.ts";
  import { T } from "../texte.ts";

  let { game }: { game?: string } = $props();
</script>

<main class="start">
  <div class="radar" aria-hidden="true"><i></i><i></i><i></i><span class="sweep"></span></div>

  <header>
    <Logo height={48} />
  </header>

  <section class="hero">
    <h1 class="title"><span>Mister</span> <span class="x">X</span></h1>
    <p class="caps claim">{T.app.org} · {T.app.claim}</p>
  </section>

  <section class="actions">
    {#if game}
      <div class="found" role="status">
        <CircleCheck size={26} aria-hidden="true" />
        <div><span class="caps">{T.start.spielGefunden}</span><strong>{game}</strong></div>
      </div>
    {/if}
    <Button size="xl" block icon={Users} onclick={() => go(game ? "/prototyp/2?v=spiel" : "/prototyp/2")}>{T.start.teamBeitreten}</Button>
    <p class="hint">{T.start.teamHinweis}</p>
    <div class="staff">
      <Button variant="secondary" icon={ShieldCheck} onclick={() => go("/prototyp/3?v=schiri")}>{T.start.schiri}</Button>
      <Button variant="secondary" icon={Crown} onclick={() => go("/prototyp/3?v=admin")}>{T.start.admin}</Button>
    </div>
  </section>

  <footer>
    <Logo which="kinderfreunde-ooe" height={28} />
    <nav>
      <a href="#/prototyp/11">{T.start.hilfe}</a>
      <a href="#/prototyp/11">{T.start.datenschutz}</a>
    </nav>
  </footer>
</main>

<style>
  .start {
    position: relative;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    gap: var(--sp-6);
    padding: calc(var(--safe-top) + var(--sp-5)) var(--gutter) calc(var(--safe-bottom) + var(--sp-4));
    max-width: 560px;
    margin: 0 auto;
    overflow: hidden;
  }
  .radar {
    position: absolute;
    top: 30%;
    left: 50%;
    width: 640px;
    height: 640px;
    translate: -50% -50%;
    pointer-events: none;
    opacity: 0.6;
  }
  .radar i {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid var(--accent-soft);
  }
  .radar i:nth-child(2) {
    inset: 18%;
  }
  .radar i:nth-child(3) {
    inset: 36%;
  }
  .sweep {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: conic-gradient(from 0deg, transparent 0deg, var(--accent-soft) 60deg, transparent 61deg);
    animation: sweep 6s linear infinite;
  }
  @keyframes sweep {
    to {
      transform: rotate(360deg);
    }
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
    text-transform: uppercase;
    letter-spacing: -0.01em;
  }
  .x {
    color: var(--accent-text);
    display: inline-block;
    transform: rotate(-6deg);
  }
  .claim {
    color: var(--text-2);
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
</style>
