<!-- Übersicht des Klick-Prototyps: alle 23 Screens, nach Bereichen gruppiert. -->
<script lang="ts">
  import { Blocks, ChevronRight, Monitor, Smartphone } from "@lucide/svelte";
  import Logo from "../ui/Logo.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import { theme, type ThemeChoice } from "../lib/theme.svelte.ts";
  import { T } from "../texte.ts";
  import { SCREENS } from "./registry.ts";

  let choice = $state<ThemeChoice>(theme.choice);
  const groups = [...new Set(SCREENS.map((s) => s.group))];
</script>

<main class="gal">
  <header>
    <Logo height={48} />
    <div>
      <p class="caps kicker">Meilenstein 2 · Design</p>
      <h1>Klick-Prototyp</h1>
    </div>
  </header>
  <p class="intro">
    Alle 23 Screens mit Testdaten aus einem laufenden Spiel in Linz. Die Countdowns laufen echt, Knöpfe führen durch die Abläufe. Am <b
      >linken Bildschirmrand</b
    > jedes Screens öffnet der lila Griff das Prototyp-Menü (Zustände, Darstellung, vor/zurück).
  </p>
  <div class="theme">
    <span class="caps">Darstellung</span>
    <Segmented
      label="Darstellung"
      bind:value={choice}
      onchange={(c) => theme.set(c)}
      options={(["auto", "hell", "dunkel", "sonne"] as const).map((c) => ({ value: c, label: T.einstellungen.themes[c] }))}
    />
  </div>

  {#each groups as g (g)}
    <section>
      <h2 class="caps">{g}</h2>
      <ul>
        {#each SCREENS.filter((s) => s.group === g) as s (s.n)}
          <li>
            <a href="#/prototyp/{s.n}">
              <span class="n num">{s.n}</span>
              <span class="txt">
                <strong>{s.title}</strong>
                <small>{s.who} · {s.desc}</small>
              </span>
              {#if s.wide}<Monitor size={20} aria-label="für Laptop optimiert" />{:else}<Smartphone
                  size={20}
                  aria-label="für Handy optimiert"
                />{/if}
              <ChevronRight size={22} aria-hidden="true" />
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/each}

  <a class="comp" href="#/komponenten"
    ><Blocks size={24} aria-hidden="true" /> Komponenten-Bibliothek & Design-Tokens <ChevronRight size={22} aria-hidden="true" /></a
  >
</main>

<style>
  .gal {
    max-width: 920px;
    margin: 0 auto;
    padding: var(--sp-6) var(--gutter) var(--sp-12);
    display: grid;
    gap: var(--sp-5);
  }
  header {
    display: flex;
    align-items: center;
    gap: var(--sp-5);
    flex-wrap: wrap;
  }
  .kicker {
    color: var(--accent-text);
  }
  h1 {
    font-size: var(--fs-4xl);
    text-transform: uppercase;
    line-height: 0.9;
  }
  .intro {
    font-size: var(--fs-l);
    color: var(--text-2);
    max-width: 62ch;
  }
  .theme {
    display: grid;
    gap: var(--sp-2);
    max-width: 520px;
  }
  .theme .caps,
  h2 {
    color: var(--text-2);
    font-size: var(--fs-s);
  }
  ul {
    list-style: none;
    margin: var(--sp-2) 0 0;
    padding: 0;
    display: grid;
    gap: var(--sp-2);
  }
  @media (min-width: 760px) {
    ul {
      grid-template-columns: 1fr 1fr;
    }
  }
  a {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    min-height: 72px;
    padding: var(--sp-3);
    border-radius: var(--r-l);
    background: var(--surface);
    border: var(--border-w) solid var(--line);
    color: var(--text);
    text-decoration: none;
    transition: border-color var(--dur-1);
  }
  a:hover {
    border-color: var(--accent);
  }
  .n {
    width: 44px;
    height: 44px;
    flex: none;
    border-radius: var(--r-m);
    display: grid;
    place-items: center;
    background: var(--accent);
    color: var(--on-accent);
    font-family: var(--font-display);
    font-weight: 800;
    font-size: var(--fs-xl);
  }
  .txt {
    flex: 1;
    display: grid;
    min-width: 0;
  }
  small {
    color: var(--text-2);
    font-size: var(--fs-s);
  }
  .comp {
    font-weight: 700;
    justify-content: center;
  }
</style>
