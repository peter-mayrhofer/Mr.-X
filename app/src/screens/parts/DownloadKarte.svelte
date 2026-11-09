<!--
  App-Download für das eigene System (docs/DESKTOP-APP.md): Hauptknopf, Installationshinweis, darunter „Andere Systeme“.
  Zeigt nichts, wenn es für dieses System keine Datei am Server gibt (iPhone, ChromeOS, Installer noch nicht hochgeladen).
-->
<script lang="ts">
  import { Laptop, Smartphone } from "@lucide/svelte";
  import { andereDownloads, passenderDownload, type Downloads, type DownloadSystem, type System } from "@mrx/shared";
  import { mb } from "../../lib/format.ts";
  import { T } from "../../texte.ts";

  interface Props {
    system: System;
    downloads: Downloads;
    /** schlanker für Anmeldeseiten: kleinerer Knopf, ohne „Andere Systeme“ */
    kompakt?: boolean;
    /** ohne Installationshinweis (Startseite am Handy) */
    ohneHinweis?: boolean;
  }

  let { system, downloads, kompakt = false, ohneHinweis = false }: Props = $props();

  const treffer = $derived(passenderDownload(system, downloads));
  const andere = $derived(kompakt ? [] : andereDownloads(system, downloads));

  const knopf: Record<DownloadSystem, string> = {
    android: T.start.androidApp,
    windows: T.start.windowsApp,
    mac: T.start.macApp,
    linux: T.start.linuxApp,
  };
  const hinweis: Record<DownloadSystem, string> = {
    android: T.start.androidHinweis,
    windows: T.start.windowsHinweis,
    mac: T.start.macHinweis,
    linux: T.start.linuxHinweis,
  };
  const lang = typeof document === "undefined" ? "de-AT" : document.documentElement.lang || "de-AT";
  const href = (datei: string) => `${import.meta.env.BASE_URL}${datei}`;
</script>

{#if treffer}
  {@const Symbol = treffer.system === "android" ? Smartphone : Laptop}
  <div class="karte" class:kompakt>
    <a class="dl" href={href(treffer.datei.datei)} download>
      <Symbol size={22} strokeWidth={2.4} aria-hidden="true" />
      <span>{knopf[treffer.system]} <span class="gr">({mb(treffer.datei.groesse, lang)})</span></span>
    </a>
    {#if !ohneHinweis}<p class="hint">{hinweis[treffer.system]}</p>{/if}
    {#if andere.length}
      <details>
        <summary>{T.start.andereSysteme}</summary>
        <ul>
          {#each andere as a (a.system)}
            <li><a href={href(a.datei.datei)} download>{T.start.systemName[a.system]} ({mb(a.datei.groesse, lang)})</a></li>
          {/each}
        </ul>
      </details>
    {/if}
  </div>
{/if}

<style>
  .karte {
    display: grid;
    gap: var(--sp-3);
  }
  /* sieht aus wie ein zweitrangiger Knopf, ist aber ein Download-Link */
  .dl {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--sp-2);
    min-height: var(--touch);
    padding: var(--sp-2) var(--sp-4);
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
  .gr {
    font-family: var(--font-text);
    font-weight: 500;
    font-size: var(--fs-s);
    letter-spacing: 0;
    text-transform: none;
    color: var(--text-2);
  }
  .hint {
    text-align: center;
    color: var(--text-2);
    font-size: var(--fs-s);
  }
  .kompakt {
    gap: var(--sp-2);
  }
  .kompakt .dl {
    font-size: var(--fs-m);
  }
  details {
    text-align: center;
    font-size: var(--fs-s);
  }
  summary {
    cursor: pointer;
    min-height: var(--touch);
    display: inline-flex;
    align-items: center;
    padding-inline: var(--sp-3);
    color: var(--text-2);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--sp-1) var(--sp-4);
  }
  li a {
    display: inline-flex;
    align-items: center;
    min-height: var(--touch);
    color: var(--text);
    text-decoration: underline;
  }
</style>
