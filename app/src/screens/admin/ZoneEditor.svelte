<!--
  Screen 16: Spielfeld-Editor (Abschnitt 7.8). Punkte ziehen, über Mittelpunkte einfügen, löschen, Rückgängig,
  GeoJSON-Import/-Export, Toleranz, Vorschau „so sieht es aus, wenn gesperrt“, Validierung
  (keine Selbstüberschneidung, Sperrbereich muss das Spielfeld schneiden).
-->
<script lang="ts">
  import type { Map as MLMap, MapMouseEvent, MapTouchEvent } from "maplibre-gl";
  import { CircleCheck, Download, Eye, EyeOff, Plus, Trash, Undo2, Upload } from "@lucide/svelte";
  import { areaM2, cutInField, selfIntersection, type Field, type LngLat, type Polygon } from "@mrx/shared";
  import GameMap from "../../map/GameMap.svelte";
  import Button from "../../ui/Button.svelte";
  import Banner from "../../ui/Banner.svelte";
  import Stepper from "../../ui/Stepper.svelte";
  import TextField from "../../ui/TextField.svelte";
  import IconButton from "../../ui/IconButton.svelte";
  import Pill from "../../ui/Pill.svelte";
  import { toast } from "../../ui/toast.svelte.ts";
  import { T } from "../../texte.ts";
  import * as M from "../../proto/mock.svelte.ts";

  let { variant = "" }: { variant?: string } = $props();

  function startField(v: string): Field {
    const f = structuredClone($state.snapshot(M.field)) as Field;
    // Fehlerzustand vorführen: zwei Eckpunkte vertauscht → Linie kreuzt sich
    if (v === "fehler") [f.base[40], f.base[60]] = [f.base[60]!, f.base[40]!];
    return f;
  }
  // Prototyp-Screens werden pro Route neu erzeugt → Startwert aus der Variante ist gewollt
  // svelte-ignore state_referenced_locally
  let field = $state<Field>(startField(variant));
  let sel = $state<string>("base");
  let vtx = $state<number | null>(null);
  let preview = $state<string[]>([]);
  let history: string[] = [];
  let file: HTMLInputElement;

  const COLORS: Record<string, string> = { base: "#ff4636" };
  const poly = $derived(sel === "base" ? field.base : (field.cuts[sel]?.poly ?? []));
  const cut = $derived(sel === "base" ? undefined : field.cuts[sel]);
  const color = $derived(COLORS[sel] ?? field.cuts[sel]?.color ?? "#fff");
  // geschlossene Ringe: letzter Punkt = erster → beim Bearbeiten ignorieren
  const closed = (p: Polygon) => p.length > 1 && p[0]![0] === p.at(-1)![0] && p[0]![1] === p.at(-1)![1];
  const pts = $derived(closed(poly) ? poly.slice(0, -1) : poly);

  const edit = $derived<GeoJSON.FeatureCollection>({
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: { color }, geometry: { type: "LineString", coordinates: [...pts, pts[0]!] } },
      ...pts.map((p, i): GeoJSON.Feature => ({
        type: "Feature",
        properties: { kind: "mid", i, color },
        geometry: { type: "Point", coordinates: mid(p, pts[(i + 1) % pts.length]!) },
      })),
      ...pts.map((p, i): GeoJSON.Feature => ({
        type: "Feature",
        properties: { kind: "vertex", i, color, sel: vtx === i },
        geometry: { type: "Point", coordinates: p },
      })),
    ],
  });

  function mid(a: LngLat, b: LngLat): LngLat {
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  }

  // Validierung
  const problems = $derived.by(() => {
    const out: string[] = [];
    if (selfIntersection(field.base)) out.push(`${T.zonen.spielfeld}: ${T.zonen.fehlerKreuz}`);
    for (const [id, c] of Object.entries(field.cuts)) {
      if (selfIntersection(c.poly)) out.push(`${c.short}: ${T.zonen.fehlerKreuz}`);
      else if (areaM2(cutInField(field, id)) < 1000) out.push(`${c.short}: ${T.zonen.fehlerAussen}`);
    }
    return out;
  });

  function setPts(next: LngLat[]) {
    const ring = [...next, next[0]!];
    if (sel === "base") field.base = ring;
    else field.cuts[sel]!.poly = ring;
  }
  const snapshot = () => history.push(JSON.stringify($state.snapshot(field)));

  function undo() {
    const last = history.pop();
    if (last) field = JSON.parse(last) as Field;
    vtx = null;
  }

  function removeVertex() {
    if (vtx === null || pts.length <= 3) return;
    snapshot();
    setPts(pts.filter((_, i) => i !== vtx));
    vtx = null;
  }

  function addCut(map: MLMap | undefined) {
    const c = map?.getCenter() ?? { lng: 14.2895, lat: 48.301 };
    const d = 0.0015;
    snapshot();
    const id = `bereich-${Object.keys(field.cuts).length + 1}`;
    field.cuts[id] = {
      name: T.zonen.neuerBereich,
      short: T.zonen.neuerBereich,
      color: "#e84393",
      order: Object.keys(field.cuts).length + 1,
      poly: [
        [c.lng - d, c.lat - d],
        [c.lng + d, c.lat - d],
        [c.lng + d, c.lat + d],
        [c.lng - d, c.lat + d],
        [c.lng - d, c.lat - d],
      ],
    };
    sel = id;
  }

  function exportGeo() {
    const fc = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { rolle: "spielfeld", name: field.name, toleranzM: field.toleranceM },
          geometry: { type: "Polygon", coordinates: [field.base] },
        },
        ...Object.entries(field.cuts).map(([id, c]) => ({
          type: "Feature",
          properties: { rolle: "sperrbereich", id, name: c.name, kurz: c.short, farbe: c.color, reihenfolge: c.order },
          geometry: { type: "Polygon", coordinates: [c.poly] },
        })),
      ],
    };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(fc, null, 1)], { type: "application/geo+json" }));
    a.download = "spielfeld.geojson";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importGeo(f: File | undefined) {
    if (!f) return;
    try {
      type Feat = { properties?: Record<string, unknown>; geometry?: { type: string; coordinates: LngLat[][] } };
      const fc = JSON.parse(await f.text()) as { features?: Feat[] };
      const polys = (fc.features ?? []).filter((x) => x.geometry?.type === "Polygon");
      const base = polys.find((x) => x.properties?.rolle === "spielfeld") ?? polys[0];
      if (!base?.geometry) throw new Error("kein Polygon");
      snapshot();
      field.base = base.geometry.coordinates[0]!;
      field.cuts = Object.fromEntries(
        polys
          .filter((x) => x !== base)
          .map((x, i) => {
            const p = x.properties ?? {};
            const name = String(p.name ?? `Bereich ${i + 1}`);
            return [
              String(p.id ?? `bereich-${i + 1}`),
              {
                name,
                short: String(p.kurz ?? name),
                color: String(p.farbe ?? "#e84393"),
                order: Number(p.reihenfolge ?? i + 1),
                poly: x.geometry!.coordinates[0]!,
              },
            ];
          }),
      );
      sel = "base";
      toast("GeoJSON importiert", "ok");
    } catch {
      toast("Datei ist kein gültiges GeoJSON mit Polygonen", "warn");
    }
  }

  // ---------- Ziehen auf der Karte ----------
  let mapRef: MLMap | undefined;
  function ready(map: MLMap) {
    mapRef = map;
    let drag: number | null = null;
    const down = (e: MapMouseEvent | MapTouchEvent) => {
      const f = map.queryRenderedFeatures(e.point, { layers: ["edit-vertex", "edit-mid"] })[0];
      if (!f) return;
      e.preventDefault();
      snapshot();
      const i = Number(f.properties.i);
      if (f.properties.kind === "mid") {
        const next = [...pts];
        next.splice(i + 1, 0, mid(pts[i]!, pts[(i + 1) % pts.length]!));
        setPts(next);
        drag = i + 1;
      } else drag = i;
      vtx = drag;
      map.dragPan.disable();
    };
    const move = (e: MapMouseEvent | MapTouchEvent) => {
      if (drag === null) {
        map.getCanvas().style.cursor = map.queryRenderedFeatures(e.point, { layers: ["edit-vertex", "edit-mid"] }).length ? "grab" : "";
        return;
      }
      const next = [...pts];
      next[drag] = [e.lngLat.lng, e.lngLat.lat];
      setPts(next);
    };
    const up = () => {
      if (drag === null) return;
      drag = null;
      map.dragPan.enable();
    };
    map.on("mousedown", down);
    map.on("touchstart", down);
    map.on("mousemove", move);
    map.on("touchmove", move);
    map.on("mouseup", up);
    map.on("touchend", up);
  }
</script>

<div class="editor">
  <div class="mapcol">
    <GameMap
      {field}
      locked={preview}
      preview={sel === "base" ? [] : [sel]}
      {edit}
      onready={ready}
      padding={{ top: 40, bottom: 40, left: 40, right: 40 }}
      label={T.zonen.titel}
    />
    <div class="tools" role="toolbar" aria-label="Werkzeuge">
      <IconButton icon={Undo2} label={T.allgemein.zurueck} onclick={undo} />
      <IconButton icon={Trash} label={T.zonen.punktWeg} disabled={vtx === null} onclick={removeVertex} />
    </div>
    <p class="tip">Punkt ziehen = verschieben · kleinen Punkt ziehen = {T.zonen.punktHinzu}</p>
  </div>

  <aside class="panel">
    <h2>{T.zonen.titel}</h2>
    <Pill tone="info">{T.zonen.vorlage}</Pill>

    {#if problems.length}
      <Banner tone="danger" title="Bitte prüfen">
        {#each problems as p (p)}<div>{p}</div>{/each}
      </Banner>
    {:else}
      <Banner tone="ok" icon={CircleCheck}>{T.zonen.ok}</Banner>
    {/if}

    <ul class="areas">
      <li class:on={sel === "base"}>
        <button class="pick" onclick={() => ((sel = "base"), (vtx = null))}
          ><span class="sw" style:background={COLORS.base}></span>{T.zonen.spielfeld}<small class="num"
            >{pts.length && sel === "base" ? `${pts.length} Punkte` : ""}</small
          ></button
        >
      </li>
      {#each Object.entries(field.cuts).sort((a, b) => a[1].order - b[1].order) as [id, c] (id)}
        <li class:on={sel === id}>
          <button class="pick" onclick={() => ((sel = id), (vtx = null))}
            ><span class="sw" style:background={c.color}></span><span class="num ord">{c.order}.</span>{c.short}</button
          >
          <IconButton
            icon={preview.includes(id) ? EyeOff : Eye}
            label="{T.zonen.vorschau}: {c.short}"
            size="m"
            tone="plain"
            active={preview.includes(id)}
            onclick={() => (preview = preview.includes(id) ? preview.filter((x) => x !== id) : [...preview, id])}
          />
        </li>
      {/each}
    </ul>
    <Button variant="secondary" size="m" icon={Plus} onclick={() => addCut(mapRef)}>{T.zonen.neuerBereich}</Button>

    {#if cut}
      <div class="props">
        <TextField label="Name" bind:value={cut.name} />
        <TextField label="Kurzname (Karte, Meldungen)" bind:value={cut.short} />
        <div class="row">
          <label class="color">Farbe <input type="color" bind:value={cut.color} /></label>
          <Stepper label={T.zonen.reihenfolge} bind:value={cut.order} unit="" min={1} max={9} />
        </div>
      </div>
    {/if}

    <Stepper label={T.zonen.toleranz} bind:value={field.toleranceM} unit="m" min={0} max={50} step={5} />

    <div class="row">
      <Button variant="secondary" size="m" icon={Upload} onclick={() => file.click()}>{T.zonen.importieren}</Button>
      <Button variant="secondary" size="m" icon={Download} onclick={exportGeo}>{T.zonen.exportieren}</Button>
      <input
        bind:this={file}
        type="file"
        accept=".geojson,.json,application/geo+json"
        hidden
        onchange={(e) => importGeo(e.currentTarget.files?.[0])}
      />
    </div>
    <Button block disabled={problems.length > 0} onclick={() => toast(T.allgemein.prototyp(T.allgemein.speichern))}
      >{T.allgemein.speichern}</Button
    >
  </aside>
</div>

<style>
  .editor {
    display: grid;
    grid-template-rows: 60vh auto;
    min-height: 100%;
  }
  @media (min-width: 1000px) {
    .editor {
      grid-template-rows: none;
      grid-template-columns: 1fr 380px;
      height: 100%;
    }
    .panel {
      overflow-y: auto;
      border-left: var(--border-w) solid var(--line);
    }
  }
  .mapcol {
    position: relative;
  }
  .tools {
    position: absolute;
    top: var(--sp-4);
    right: var(--sp-4);
    display: grid;
    gap: var(--sp-2);
    z-index: var(--z-ui);
  }
  .tip {
    position: absolute;
    left: var(--sp-3);
    bottom: var(--sp-3);
    z-index: var(--z-ui);
    padding: var(--sp-1) var(--sp-3);
    border-radius: var(--r-pill);
    background: var(--glass);
    font-size: var(--fs-s);
  }
  .panel {
    display: grid;
    gap: var(--sp-3);
    align-content: start;
    padding: var(--sp-4) var(--gutter) var(--sp-8);
    background: var(--bg);
  }
  .areas {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 4px;
  }
  .areas li {
    display: flex;
    align-items: center;
    border-radius: var(--r-m);
    border: 2px solid transparent;
  }
  .areas li.on {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .pick {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    min-height: var(--touch);
    padding: 0 var(--sp-3);
    border: 0;
    background: none;
    color: var(--text);
    font-weight: 700;
    text-align: left;
    cursor: pointer;
  }
  .pick small {
    margin-left: auto;
    color: var(--text-3);
    font-weight: 500;
  }
  .ord {
    color: var(--text-3);
  }
  .sw {
    width: 18px;
    height: 18px;
    border-radius: 5px;
    flex: none;
  }
  .props {
    display: grid;
    gap: var(--sp-3);
    padding: var(--sp-3);
    border-radius: var(--r-m);
    background: var(--surface);
    border: var(--border-w) solid var(--line);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
    align-items: center;
  }
  .color {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    font-weight: 600;
  }
  .color input {
    width: var(--touch);
    height: var(--touch);
    border: 0;
    padding: 0;
    background: none;
  }
</style>
