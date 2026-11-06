<!--
  Kompass (Team-Ansicht „Kompass“ bzw. Weg zum Treffpunkt): großer Pfeil zum Ziel, der sich mitdreht, wenn man das
  Handy dreht; Entfernung, Himmelsrichtung, Link zu Google Maps. Ohne Kompass im Handy: N oben (bzw. Laufrichtung).
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { Compass, ExternalLink, X } from "@lucide/svelte";
  import { bearingDeg, distanceM, type Point, type Position } from "@mrx/shared";
  import Button from "../../ui/Button.svelte";
  import IconButton from "../../ui/IconButton.svelte";
  import { Heading, unwrap } from "../../lib/kompass.svelte.ts";
  import { meter } from "../../lib/format.ts";
  import { T } from "../../texte.ts";

  interface Props {
    target: Point | null;
    title: string;
    sub?: string;
    me: Position | null;
    /** Text, wenn es (noch) kein Ziel gibt */
    empty: string;
    /** als Overlay: Schließen-Knopf */
    onclose?: () => void;
  }
  let { target, title, sub, me, empty, onclose }: Props = $props();

  const heading = new Heading();
  let noSensor = $state(false);
  onMount(() => {
    heading.start();
    // kommt nach 2 s nichts, hat das Handy (bzw. der Laptop) keinen Kompass
    const t = setTimeout(() => (noSensor = heading.deg === null && !heading.needsTap), 2000);
    return () => {
      clearTimeout(t);
      heading.stop();
    };
  });

  // Blickrichtung: Kompass, sonst Laufrichtung aus dem GPS, sonst Norden oben
  const gpsHeading = $derived(me?.heading !== undefined ? me.heading : null);
  const facing = $derived(heading.deg ?? gpsHeading ?? 0);
  const source = $derived(heading.deg !== null ? "kompass" : gpsHeading !== null ? "gps" : "norden");
  const bearing = $derived(me && target ? bearingDeg(me, target) : null);
  const dist = $derived(me && target ? distanceM(me, target) : null);
  const arrived = $derived(dist !== null && dist < 25);
  const dirWord = $derived(bearing === null ? "" : T.kompass.richtung[Math.round(bearing / 45) % 8]);

  // ohne Sprung bei 359° → 1° drehen
  let dialRot = $state(0);
  let arrowRot = $state(0);
  $effect(() => {
    dialRot = unwrap(dialRot, -facing);
    if (bearing !== null) arrowRot = unwrap(arrowRot, bearing - facing);
  });

  const mapsUrl = $derived(
    target ? `https://www.google.com/maps/dir/?api=1&destination=${target.lat.toFixed(6)},${target.lng.toFixed(6)}&travelmode=walking` : "",
  );
  const LETTERS = [
    ["N", 0],
    ["O", 90],
    ["S", 180],
    ["W", 270],
  ] as const;
</script>

<section class="compass" class:overlay={!!onclose} aria-label={T.kompass.titel}>
  <header>
    <div>
      <h2 class="etikett">{title}</h2>
      {#if sub}<p class="muted">{sub}</p>{/if}
    </div>
    {#if onclose}<IconButton icon={X} label={T.allgemein.schliessen} tone="plain" onclick={onclose} />{/if}
  </header>

  {#if !target}
    <p class="empty">{empty}</p>
  {:else if !me}
    <p class="empty">{T.kompass.keinGps}</p>
  {:else}
    <div class="dial-wrap">
      <svg class="dial" viewBox="-160 -160 320 320" style:transform="rotate({dialRot}deg)" aria-hidden="true">
        <circle r="150" class="ring" />
        {#each Array.from({ length: 72 }, (_, i) => i * 5) as d (d)}
          <line
            x1="0"
            y1={d % 90 === 0 ? -150 : d % 30 === 0 ? -146 : -144}
            x2="0"
            y2={d % 90 === 0 ? -128 : d % 30 === 0 ? -134 : -138}
            class:major={d % 30 === 0}
            transform="rotate({d})"
          />
        {/each}
        {#each LETTERS as [l, d] (l)}
          <text transform="rotate({d}) translate(0 -108) rotate({-d})" class:north={l === "N"}>{l}</text>
        {/each}
      </svg>
      <svg class="arrow" viewBox="-160 -160 320 320" style:transform="rotate({arrowRot}deg)" role="img" aria-label="Richtung {dirWord}">
        <path d="M0 -118 L44 40 L0 18 L-44 40 Z" class="head" />
        <circle r="10" class="hub" />
      </svg>
    </div>

    <div class="info">
      {#if arrived}
        <strong class="display big">{T.kompass.da}</strong>
      {:else}
        <strong class="display big num">{meter(dist ?? 0)}</strong>
        <span class="etikett">Richtung {dirWord}</span>
      {/if}
    </div>

    {#if heading.needsTap}
      <div class="tap">
        <Button icon={Compass} onclick={() => heading.request()}>{T.kompass.aktivieren}</Button>
        <p class="muted small">{T.kompass.aktivierenHinweis}</p>
      </div>
    {:else if source === "gps"}
      <p class="muted small">{T.kompass.gpsRichtung}</p>
    {:else if source === "norden" && noSensor}
      <p class="muted small">{T.kompass.ohneKompass}</p>
    {:else}
      <p class="muted small">{T.kompass.flach}</p>
    {/if}

    <a class="maps" href={mapsUrl} target="_blank" rel="noopener noreferrer"
      ><ExternalLink size={20} aria-hidden="true" />{T.kompass.karten}</a
    >
  {/if}
</section>

<style>
  .compass {
    position: relative;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-4);
    padding: var(--sp-4) var(--gutter) var(--sp-6);
    background: var(--bg);
    overflow-y: auto;
    text-align: center;
  }
  .compass.overlay {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal, 50);
    padding-top: calc(var(--safe-top) + var(--sp-4));
    padding-bottom: calc(var(--safe-bottom) + var(--sp-6));
  }
  header {
    width: 100%;
    max-width: 520px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--sp-3);
    text-align: left;
  }
  h2 {
    font-size: var(--fs-l);
    color: var(--accent-text);
  }
  .empty {
    margin: auto;
    max-width: 32ch;
    color: var(--text-2);
    font-size: var(--fs-l);
  }
  .dial-wrap {
    position: relative;
    width: min(78vw, 340px);
    aspect-ratio: 1;
    max-width: 100%;
  }
  .dial,
  .arrow {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    transition: transform 0.35s ease-out;
    will-change: transform;
  }
  .ring {
    fill: var(--surface);
    stroke: var(--line-strong);
    stroke-width: 3;
  }
  line {
    stroke: var(--text-2);
    stroke-width: 2;
  }
  line.major {
    stroke: var(--text);
    stroke-width: 3;
  }
  text {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 30px;
    fill: var(--text);
    text-anchor: middle;
    dominant-baseline: central;
  }
  text.north {
    fill: var(--accent-text);
  }
  .head {
    fill: var(--accent);
    stroke: var(--text);
    stroke-width: 4;
    stroke-linejoin: round;
  }
  .hub {
    fill: var(--text);
  }
  .info {
    display: grid;
    gap: var(--sp-1);
  }
  .big {
    font-size: clamp(48px, 16vw, 80px);
    line-height: 1;
  }
  .small {
    font-size: var(--fs-s);
    max-width: 36ch;
  }
  .tap {
    display: grid;
    justify-items: center;
    gap: var(--sp-2);
  }
  .maps {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    min-height: var(--touch);
    padding: 0 var(--sp-5);
    border-radius: var(--r-m);
    border: var(--border-strong, 2px) solid var(--line);
    background: var(--surface-2);
    color: var(--text);
    font-family: var(--font-display);
    font-weight: 700;
    letter-spacing: 0.01em;
    text-decoration: none;
  }
  @media (prefers-reduced-motion: reduce) {
    .dial,
    .arrow {
      transition: none;
    }
  }
</style>
