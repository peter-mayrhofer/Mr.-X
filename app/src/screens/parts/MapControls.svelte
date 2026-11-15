<!-- Große Kartenknöpfe rechts (Abschnitt 8.4): Mister X zeigen, auf mich, ganzes Spielfeld, Sonnen-Modus.
     Zentrieren wie bei Navi-Apps (E-71): 1× tippen = Karte folgt mir, 2× = Karte dreht mit der Blickrichtung,
     3× = wieder Norden oben. Karte mit dem Finger verschieben = frei (`frei()`). -->
<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import { Flag, LocateFixed, Maximize2, Navigation, Sun } from "@lucide/svelte";
  import IconButton from "../../ui/IconButton.svelte";
  import type GameMap from "../../map/GameMap.svelte";
  import { Heading } from "../../lib/kompass.svelte.ts";
  import { theme } from "../../lib/theme.svelte.ts";
  import { toast } from "../../ui/toast.svelte.ts";
  import { T } from "../../texte.ts";

  interface Props {
    onmrx?: () => void;
    onfield: () => void;
    /** Knopf „zentrieren“ zeigen (auch solange noch kein Standort da ist) */
    zentrieren?: boolean;
    /** eigener Standort (mit Richtung, falls das GPS eine liefert) */
    me?: { lat: number; lng: number; heading?: number } | null | undefined;
    map?: GameMap | undefined;
  }

  let { onmrx, onfield, zentrieren = false, me, map }: Props = $props();

  let modus = $state<"frei" | "folgen" | "drehen">("frei");
  const heading = new Heading();

  /** Karte wurde mit dem Finger verschoben: nicht mehr folgen, Norden wieder oben */
  export function frei() {
    if (modus === "drehen") {
      heading.stop();
      map?.north();
    }
    modus = "frei";
  }

  function tippen() {
    if (!me) return toast(T.kompass.keinGps, "warn");
    if (modus === "frei") {
      modus = "folgen";
      map?.follow(me, 0, true);
    } else if (modus === "folgen") {
      modus = "drehen";
      heading.start();
      // iPhone: Kompass erst nach Erlaubnis – muss direkt im Tipp gefragt werden
      if (heading.needsTap) void heading.request();
    } else {
      modus = "folgen";
      heading.stop();
      map?.follow(me, 0);
    }
  }

  // Blickrichtung: Kompass des Handys, sonst Gehrichtung vom GPS
  const bearing = $derived(modus === "drehen" ? (heading.deg ?? me?.heading ?? 0) : 0);
  // mitgehen – höchstens alle 250 ms, der Kompass meldet sich viel öfter
  let zuletzt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    if (modus === "frei" || !me) return;
    const p = { lat: me.lat, lng: me.lng };
    const b = bearing;
    untrack(() => {
      clearTimeout(timer);
      const warten = Math.max(0, 250 - (performance.now() - zuletzt));
      timer = setTimeout(() => {
        zuletzt = performance.now();
        map?.follow(p, b);
      }, warten);
    });
  });
  onDestroy(() => {
    clearTimeout(timer);
    heading.stop();
  });

  const zentrierLabel = $derived(modus === "frei" ? T.karte.aufMich : modus === "folgen" ? T.karte.mitdrehen : T.karte.nordenOben);
</script>

<div class="controls">
  {#if onmrx}<IconButton icon={Flag} label={T.karte.misterXZeigen} tone="accent" onclick={() => (frei(), onmrx())} />{/if}
  {#if zentrieren}
    <IconButton icon={modus === "drehen" ? Navigation : LocateFixed} label={zentrierLabel} active={modus !== "frei"} onclick={tippen} />
  {/if}
  <IconButton icon={Maximize2} label={T.karte.ganzesFeld} onclick={() => (frei(), onfield())} />
  <IconButton icon={Sun} label={T.karte.sonne} active={theme.active === "sonne"} onclick={() => theme.toggleSun()} />
</div>

<style>
  .controls {
    display: grid;
    gap: var(--sp-3);
  }
</style>
