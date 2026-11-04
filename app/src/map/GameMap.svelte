<!--
  Spielkarte (MapLibre, lazy geladen). Zeichnet nur bei Datenänderung neu (Akku, Abschnitt 7).
  Marker sind Svelte-Komponenten (MapMarker); Spiel-Ebenen kommen aus overlays.ts.
-->
<script module lang="ts">
  import type { Point } from "@mrx/shared";
  import type { MarkerProps } from "./MapMarker.svelte";

  export interface MapPin extends Point {
    key: string;
    props: MarkerProps;
    onclick?: () => void;
  }
</script>

<script lang="ts">
  import { mount, onDestroy, onMount, unmount, untrack } from "svelte";
  import type { Map as MLMap, Marker } from "maplibre-gl";
  import { bounds, type Field } from "@mrx/shared";
  import { theme } from "../lib/theme.svelte.ts";
  import { EMPTY, hatchImage, mapStyle, type Overlays } from "./style.ts";
  import { accuracyOverlay, fieldOverlays, trailOverlay, type TrailReport } from "./overlays.ts";
  import MapMarker from "./MapMarker.svelte";

  interface Props {
    field: Field;
    locked?: string[];
    preview?: string[];
    trail?: TrailReport[];
    pins?: MapPin[];
    accuracy?: (Point & { acc: number }) | undefined;
    padding?: { top: number; bottom: number; left: number; right: number };
    interactive?: boolean;
    label?: string;
    edit?: GeoJSON.FeatureCollection;
    onready?: (map: MLMap) => void;
    /** Teamnamen immer zeigen (Großbild) */
    alwaysNames?: boolean;
  }

  let {
    field,
    locked = [],
    preview = [],
    trail = [],
    pins = [],
    accuracy,
    padding = { top: 150, bottom: 110, left: 24, right: 88 },
    interactive = true,
    label = "Karte des Spielfelds",
    edit = EMPTY,
    onready,
    alwaysNames = false,
  }: Props = $props();

  let el: HTMLDivElement;
  let map: MLMap | undefined = $state();
  // Marker brauchen nur die Karte, nicht die geladenen Kacheln: „load“ kommt erst, wenn alle Kacheln da sind – bei
  // langsamem Netz oder hängendem Kartendienst wären die Teams sonst unsichtbar
  let markerMap: MLMap | undefined = $state();
  let ML: typeof import("maplibre-gl") | undefined;
  let raster = false;

  const overlays = $derived<Overlays>({
    ...fieldOverlays(field, locked, preview),
    trail: trailOverlay(trail),
    accuracy: accuracyOverlay(accuracy),
    edit,
  });

  /** Linzer Innenstadt, solange es noch kein Spielfeld gibt */
  const LINZ: [[number, number], [number, number]] = [
    [14.27, 48.295],
    [14.305, 48.312],
  ];
  const box = () => (field.base.length >= 4 ? bounds(field.base) : LINZ);

  export function fitField(animate = true) {
    map?.fitBounds(box(), { padding, animate, duration: 600 });
  }

  export function flyTo(p: Point, zoom = 16.5) {
    map?.flyTo({ center: [p.lng, p.lat], zoom, padding, duration: 700 });
  }

  onMount(() => {
    let alive = true;
    // die Karte gibt es schon vor „load“ – wird die Ansicht vorher verlassen, muss sie trotzdem weg (WebGL-Kontexte sind knapp)
    let created: MLMap | undefined;
    // MapLibre 6 lädt seinen Worker relativ zum eigenen Modul – nach dem Bündeln stimmt das nicht mehr, daher explizit
    void Promise.all([
      import("maplibre-gl"),
      import("maplibre-gl/dist/maplibre-gl-worker.mjs?url"),
      import("maplibre-gl/dist/maplibre-gl.css"),
    ]).then(([ml, worker]) => {
      if (!alive) return;
      ML = ml;
      ml.setWorkerUrl(worker.default);
      const m = (created = new ml.Map({
        container: el,
        style: mapStyle(theme.active, overlays),
        bounds: box(),
        fitBoundsOptions: { padding },
        interactive,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        maxZoom: 19,
      }));
      m.touchZoomRotate.disableRotation();
      markerMap = m;
      m.setMissingStyleImageResolver((id) => {
        if (id.startsWith("hatch-") && !m.hasImage(id)) m.addImage(id, hatchImage(id.slice(6) as typeof theme.active), { pixelRatio: 2 });
      });
      // OpenFreeMap nicht erreichbar → OSM-Raster (E-07)
      let errors = 0;
      m.on("error", (e) => {
        console.error("Karte:", e.error?.message); // sonst schluckt der eigene Listener MapLibres Fehlermeldung
        if (!raster && (e as { sourceId?: string }).sourceId === "omt" && ++errors >= 3) {
          raster = true;
          m.setStyle(mapStyle(theme.active, overlays, true));
        }
      });
      // Teamnamen erst ab Zoom 15.5, sonst überlappen 30 Teams (Kürzel bleiben sichtbar)
      const names = () => (el.dataset.names = m.getZoom() >= 15.5 ? "on" : "off");
      m.on("zoomend", names);
      names();
      m.on("load", () => {
        if (!alive) return;
        // Namensnennung eingeklappt („i“-Knopf), damit sie keine Bedienelemente verdeckt
        el.querySelector(".maplibregl-compact-show")?.classList.remove("maplibregl-compact-show");
        map = m;
        onready?.(m);
      });
    });
    return () => {
      alive = false;
      created?.remove();
    };
  });

  onDestroy(() => markers.forEach((x) => unmount(x.inst)));

  // Theme-Wechsel: Stil neu setzen, MapLibre übernimmt nur die Unterschiede
  $effect(() => {
    const t = theme.active;
    map?.setStyle(mapStyle(t, untrack(() => $state.snapshot(overlays)) as Overlays, raster));
  });

  // Daten-Änderung: nur die Quellen aktualisieren
  $effect(() => {
    if (!map) return;
    const o = overlays;
    for (const k of Object.keys(o) as (keyof Overlays)[]) {
      const src = map.getSource(k) as { setData?: (d: GeoJSON.FeatureCollection) => void } | undefined;
      src?.setData?.(o[k] ?? EMPTY);
    }
  });

  // ---------- Marker ----------
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- interne Buchhaltung, soll keine Neuberechnung auslösen
  const markers = new Map<string, { m: Marker; props: MarkerProps; inst: ReturnType<typeof mount> }>();

  $effect(() => {
    const map = markerMap;
    if (!map || !ML) return;
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- lokal im Effekt
    const seen = new Set<string>();
    for (const pin of pins) {
      seen.add(pin.key);
      const old = markers.get(pin.key);
      if (old) {
        old.m.setLngLat([pin.lng, pin.lat]);
        Object.assign(old.props, pin.props);
        continue;
      }
      const node = document.createElement("div");
      if (pin.onclick) {
        node.style.cursor = "pointer";
        node.addEventListener("click", pin.onclick);
      }
      const props = $state({ ...pin.props });
      const inst = mount(MapMarker, { target: node, props });
      const anchor = pin.props.kind === "team" ? "top" : "center";
      const m = new ML.Marker({ element: node, anchor, offset: pin.props.kind === "team" ? [0, -19] : [0, 0] })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map);
      if (pin.props.kind === "mrx") node.style.zIndex = "3";
      if (pin.props.kind === "me") node.style.zIndex = "2";
      markers.set(pin.key, { m, props, inst });
    }
    for (const [key, x] of markers)
      if (!seen.has(key)) {
        x.m.remove();
        void unmount(x.inst);
        markers.delete(key);
      }
  });
</script>

<div class="map" class:always={alwaysNames} bind:this={el} role="region" aria-label={label}>
  {#if !map}<div class="loading" aria-hidden="true"></div>{/if}
</div>

<style>
  .map {
    position: absolute;
    inset: 0;
    background: var(--bg);
  }
  .loading {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px);
    background-size: 48px 48px;
    opacity: 0.5;
    animation: fade 1.4s ease-in-out infinite alternate;
  }
  @keyframes fade {
    to {
      opacity: 0.2;
    }
  }
  .map :global(.maplibregl-ctrl-attrib) {
    font-size: 12px;
  }
  /* data-names wird zur Laufzeit gesetzt → :global, sonst entfernt Svelte die Regel */
  .map:global([data-names="off"]):not(.always) :global(.name) {
    display: none;
  }
</style>
