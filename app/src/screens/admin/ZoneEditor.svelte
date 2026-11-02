<!--
  Screen 16: Spielfeld-Editor (Abschnitt 7.8). Punkte ziehen, über Mittelpunkte einfügen, löschen, Rückgängig,
  GeoJSON-Import/-Export, Toleranz, Vorschau „so sieht es aus, wenn gesperrt“, Validierung
  (keine Selbstüberschneidung, Sperrbereich muss das Spielfeld schneiden).
-->
<script lang="ts">
  import type { Map as MLMap, MapMouseEvent, MapTouchEvent } from "maplibre-gl";
  import {
    CircleCheck,
    Download,
    Eye,
    EyeOff,
    LayoutTemplate,
    Plus,
    Save,
    Trash,
    Undo2,
    Upload,
    Utensils,
    MapPinCheck,
  } from "@lucide/svelte";
  import { fieldProblems, LINZ_INNENSTADT, type Field, type LngLat, type Polygon } from "@mrx/shared";
  import GameMap from "../../map/GameMap.svelte";
  import Button from "../../ui/Button.svelte";
  import Banner from "../../ui/Banner.svelte";
  import Stepper from "../../ui/Stepper.svelte";
  import TextField from "../../ui/TextField.svelte";
  import IconButton from "../../ui/IconButton.svelte";
  import { toast } from "../../ui/toast.svelte.ts";
  import { T } from "../../texte.ts";

  interface Props {
    /** Spielfeld beim Öffnen (Änderungen von anderen Geräten werden nicht hineingemischt) */
    initial: Field;
    /** im laufenden Spiel nur ansehen */
    readonly?: boolean;
    onsave: (f: Field) => Promise<void>;
  }
  let { initial, readonly = false, onsave }: Props = $props();

  // svelte-ignore state_referenced_locally
  let field = $state<Field>({ ...($state.snapshot(initial) as Field), cuts: { ...$state.snapshot(initial.cuts ?? {}) } });
  // Stand beim Öffnen = gespeichert (Vergleich für „ungespeicherte Änderungen“)
  // svelte-ignore state_referenced_locally
  let saved = $state(JSON.stringify(field));
  let saving = $state(false);
  const dirty = $derived(JSON.stringify(field) !== saved);
  let sel = $state<string>("base");
  let vtx = $state<number | null>(null);
  let preview = $state<string[]>([]);
  let history: string[] = [];
  let file: HTMLInputElement;

  const COLORS: Record<string, string> = { base: "#ff4636", spots: "#ffc531", meet: "#2fbf71" };
  // „spots“ = Essens-Orte: keine Fläche, sondern einzelne Punkte (jeder ein ziehbarer Punkt auf der Karte)
  const spotsMode = $derived(sel === "spots");
  // „meet“ = Treffpunkt für den Sammelruf: ein einzelner ziehbarer Punkt
  const meetMode = $derived(sel === "meet");
  const pointMode = $derived(spotsMode || meetMode);
  const poly = $derived(sel === "base" ? field.base : pointMode ? [] : (field.cuts[sel]?.poly ?? []));
  const cut = $derived(sel === "base" ? undefined : field.cuts[sel]);
  const color = $derived(COLORS[sel] ?? field.cuts[sel]?.color ?? "#fff");
  // geschlossene Ringe: letzter Punkt = erster → beim Bearbeiten ignorieren
  const closed = (p: Polygon) => p.length > 1 && p[0]![0] === p.at(-1)![0] && p[0]![1] === p.at(-1)![1];
  const pts = $derived<LngLat[]>(
    spotsMode
      ? (field.spots ?? []).map((s): LngLat => [s.lng, s.lat])
      : meetMode
        ? field.meet
          ? [[field.meet.lng, field.meet.lat]]
          : []
        : closed(poly)
          ? poly.slice(0, -1)
          : poly,
  );

  const edit = $derived<GeoJSON.FeatureCollection>({
    type: "FeatureCollection",
    features: [
      ...(pts.length && !pointMode
        ? [{ type: "Feature", properties: { color }, geometry: { type: "LineString", coordinates: [...pts, pts[0]!] } } as GeoJSON.Feature]
        : []),
      ...(pointMode
        ? []
        : pts.map((p, i): GeoJSON.Feature => ({
            type: "Feature",
            properties: { kind: "mid", i, color },
            geometry: { type: "Point", coordinates: mid(p, pts[(i + 1) % pts.length]!) },
          }))),
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

  // Validierung – dieselbe Prüfung macht der Server beim Speichern
  const TEXT = { leer: T.zonen.fehlerLeer, kreuz: T.zonen.fehlerKreuz, aussen: T.zonen.fehlerAussen };
  const problems = $derived(
    fieldProblems(field).map((p) => `${p.id === "base" ? T.zonen.spielfeld : (field.cuts[p.id]?.short ?? p.id)}: ${TEXT[p.kind]}`),
  );

  /** Quadrat um die Kartenmitte als Startform */
  function square(map: MLMap | undefined, d: number): Polygon {
    const c = map?.getCenter() ?? { lng: 14.2895, lat: 48.301 };
    return [
      [c.lng - d, c.lat - d],
      [c.lng + d, c.lat - d],
      [c.lng + d, c.lat + d],
      [c.lng - d, c.lat + d],
      [c.lng - d, c.lat - d],
    ];
  }
  function newBase() {
    snapshot();
    field.base = square(mapRef, 0.006);
    sel = "base";
  }
  function removeCut() {
    if (sel === "base") return;
    snapshot();
    delete field.cuts[sel];
    preview = preview.filter((x) => x !== sel);
    sel = "base";
  }
  function loadTemplate() {
    snapshot();
    field = structuredClone(LINZ_INNENSTADT);
    sel = "base";
    toast(T.zonen.vorlageGeladen, "ok");
  }
  async function save() {
    saving = true;
    try {
      const snap = $state.snapshot(field) as Field;
      await onsave(snap);
      saved = JSON.stringify(snap);
      toast(T.zonen.gespeichert, "ok");
    } catch (e) {
      toast(e instanceof Error ? e.message : T.apiFehler.network, "warn");
    } finally {
      saving = false;
    }
  }

  function setPts(next: LngLat[]) {
    if (spotsMode) {
      field.spots = (field.spots ?? []).map((s, i) => ({ ...s, lng: next[i]![0], lat: next[i]![1] }));
      return;
    }
    if (meetMode) {
      if (field.meet && next[0]) field.meet = { ...field.meet, lng: next[0][0], lat: next[0][1] };
      return;
    }
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
    if (vtx === null) return;
    if (spotsMode) {
      snapshot();
      field.spots = (field.spots ?? []).filter((_, i) => i !== vtx);
      vtx = null;
      return;
    }
    if (meetMode) {
      snapshot();
      delete field.meet;
      vtx = null;
      return;
    }
    if (pts.length <= 3) return;
    snapshot();
    setPts(pts.filter((_, i) => i !== vtx));
    vtx = null;
  }

  function addCut(map: MLMap | undefined) {
    snapshot();
    let n = Object.keys(field.cuts).length + 1;
    while (field.cuts[`bereich-${n}`]) n++;
    const id = `bereich-${n}`;
    field.cuts[id] = {
      name: T.zonen.neuerBereich,
      short: T.zonen.neuerBereich,
      color: "#e84393",
      order: Math.min(20, Object.keys(field.cuts).length + 1),
      poly: square(map, 0.0015),
    };
    sel = id;
  }

  function addSpot(map: MLMap | undefined) {
    snapshot();
    const c = map?.getCenter() ?? { lng: 14.2895, lat: 48.301 };
    field.spots = [...(field.spots ?? []), { name: T.zonen.neuerOrt, lat: c.lat, lng: c.lng, radiusM: 40 }];
    vtx = field.spots.length - 1;
  }

  function setMeet(map: MLMap | undefined) {
    snapshot();
    const c = map?.getCenter() ?? { lng: 14.2895, lat: 48.301 };
    field.meet = { name: field.meet?.name ?? T.zonen.treffpunktName, lat: c.lat, lng: c.lng };
    vtx = 0;
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
      toast(T.zonen.importiert, "ok");
    } catch {
      toast(T.zonen.importFehler, "warn");
    }
  }

  // ---------- Ziehen auf der Karte ----------
  let mapRef: MLMap | undefined;
  function ready(map: MLMap) {
    mapRef = map;
    let drag: number | null = null;
    const down = (e: MapMouseEvent | MapTouchEvent) => {
      if (readonly) return;
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
    {#if !readonly}
      <div class="tools" role="toolbar" aria-label={T.zonen.werkzeuge}>
        <IconButton icon={Undo2} label={T.allgemein.zurueck} onclick={undo} />
        <IconButton icon={Trash} label={T.zonen.punktWeg} disabled={vtx === null} onclick={removeVertex} />
      </div>
      <p class="tip">{T.zonen.tipp}</p>
    {/if}
  </div>

  <aside class="panel" aria-label={T.zonen.werkzeuge}>
    <h2>{T.zonen.titel}</h2>
    {#if readonly}<Banner tone="info">{T.zonen.nurAnsehen}</Banner>{/if}
    <TextField label={T.zonen.feldName} bind:value={field.name} disabled={readonly} />
    {#if !field.base.length}
      <Banner tone="info">{T.zonen.nochKeinFeld}</Banner>
      <div class="row">
        <Button size="m" icon={Plus} disabled={readonly} onclick={newBase}>{T.zonen.feldAnlegen}</Button>
        <Button variant="secondary" size="m" icon={LayoutTemplate} disabled={readonly} onclick={loadTemplate}>{T.zonen.vorlageLaden}</Button
        >
      </div>
    {/if}

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
    {#if !readonly}
      <Button variant="secondary" size="m" icon={Plus} disabled={!field.base.length} onclick={() => addCut(mapRef)}
        >{T.zonen.neuerBereich}</Button
      >
    {/if}

    <ul class="areas">
      <li class:on={spotsMode}>
        <button class="pick" onclick={() => ((sel = "spots"), (vtx = null))}
          ><span class="sw" style:background={COLORS.spots}></span><Utensils size={16} aria-hidden="true" />{T.zonen.essensOrte}<small
            class="num">{field.spots?.length ?? 0}</small
          ></button
        >
      </li>
    </ul>
    <ul class="areas">
      <li class:on={meetMode}>
        <button class="pick" onclick={() => ((sel = "meet"), (vtx = field.meet ? 0 : null))}
          ><span class="sw" style:background={COLORS.meet}></span><MapPinCheck size={16} aria-hidden="true" />{T.zonen.treffpunkt}<small
            class="num">{field.meet?.name ?? ""}</small
          ></button
        >
      </li>
    </ul>
    {#if meetMode}
      <div class="props">
        <p class="muted">{T.zonen.treffpunktHinweis}</p>
        {#if field.meet}
          <TextField label={T.zonen.name} bind:value={field.meet.name} disabled={readonly} />
        {/if}
        {#if !readonly}
          <div class="row">
            <Button variant="secondary" size="m" icon={MapPinCheck} onclick={() => setMeet(mapRef)}
              >{field.meet ? T.zonen.treffpunktHierher : T.zonen.treffpunktSetzen}</Button
            >
            {#if field.meet}<Button variant="danger" size="m" icon={Trash} onclick={removeVertex}>{T.zonen.treffpunktWeg}</Button>{/if}
          </div>
        {/if}
      </div>
    {/if}
    {#if spotsMode}
      <div class="props">
        <p class="muted">{T.zonen.essensHinweis}</p>
        <ul class="areas">
          {#each field.spots ?? [] as s, i (i)}
            <li class:on={vtx === i}><button class="pick" onclick={() => (vtx = i)}>{s.name}</button></li>
          {/each}
        </ul>
        {#if vtx !== null && field.spots?.[vtx]}
          {@const s = field.spots[vtx]!}
          <TextField label={T.zonen.name} bind:value={s.name} disabled={readonly} />
          {#if !readonly}<Stepper label={T.zonen.umkreis} bind:value={s.radiusM} unit="m" min={15} max={100} step={5} />{/if}
        {/if}
        {#if !readonly}
          <div class="row">
            <Button variant="secondary" size="m" icon={Plus} onclick={() => addSpot(mapRef)}>{T.zonen.ortHinzu}</Button>
            <Button variant="danger" size="m" icon={Trash} disabled={vtx === null} onclick={removeVertex}>{T.zonen.ortWeg}</Button>
          </div>
        {/if}
      </div>
    {/if}

    {#if cut}
      <div class="props">
        <TextField label={T.zonen.name} bind:value={cut.name} disabled={readonly} />
        <TextField label={T.zonen.kurzname} bind:value={cut.short} disabled={readonly} />
        <div class="row">
          <label class="color">{T.zonen.farbe} <input type="color" bind:value={cut.color} disabled={readonly} /></label>
          {#if !readonly}<Stepper label={T.zonen.reihenfolge} bind:value={cut.order} unit="" min={1} max={20} />{/if}
        </div>
        {#if !readonly}<Button variant="danger" size="m" icon={Trash} onclick={removeCut}>{T.zonen.bereichLoeschen}</Button>{/if}
      </div>
    {/if}

    {#if !readonly}<Stepper label={T.zonen.toleranz} bind:value={field.toleranceM} unit="m" min={0} max={50} step={5} />{/if}

    <div class="row">
      {#if !readonly}<Button variant="secondary" size="m" icon={Upload} onclick={() => file.click()}>{T.zonen.importieren}</Button>{/if}
      <Button variant="secondary" size="m" icon={Download} onclick={exportGeo}>{T.zonen.exportieren}</Button>
      <input
        bind:this={file}
        type="file"
        accept=".geojson,.json,application/geo+json"
        hidden
        onchange={(e) => importGeo(e.currentTarget.files?.[0])}
      />
    </div>
    {#if !readonly}
      {#if field.base.length}
        <Button variant="ghost" size="m" icon={LayoutTemplate} onclick={loadTemplate}>{T.zonen.vorlageLaden}</Button>
      {/if}
      <Button block icon={Save} loading={saving} disabled={problems.length > 0 || !dirty || saving} onclick={save}
        >{dirty ? T.allgemein.speichern : T.zonen.allesGespeichert}</Button
      >
    {/if}
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
