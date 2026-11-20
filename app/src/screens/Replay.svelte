<!--
  Screen 20 (Wiederholung): ein beendeter Lauf auf der Karte, mit Zeitschieberegler. Mister-X-Meldungen (Spur seit der
  letzten Übergabe), Fangorte, Verkleinerungen und alle Teams (30 Tage lang, E-72) erscheinen im Zeitverlauf; darunter
  Auswertung und Chat-Verlauf. „Video“ speichert das ganze Spiel als MP4 (hoch oder quer).
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import {
    Download,
    FileSpreadsheet,
    Film,
    Flag,
    Flame,
    Footprints,
    Pause,
    Play,
    Printer,
    Repeat,
    Timer,
    Trophy,
    Users,
    Utensils,
    X,
  } from "@lucide/svelte";
  import { replayAt, replayMarks, replayTeams, type ArchiveData, type Team } from "@mrx/shared";
  import GameMap, { type MapPin } from "../map/GameMap.svelte";
  import { EMPTY } from "../map/style.ts";
  import AppBar from "../ui/AppBar.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import IconButton from "../ui/IconButton.svelte";
  import Button from "../ui/Button.svelte";
  import Pill from "../ui/Pill.svelte";
  import Modal from "../ui/Modal.svelte";
  import { toast } from "../ui/toast.svelte.ts";
  import { herunterladen } from "../lib/native.ts";
  import { tabelleHerunterladen } from "../lib/tabelle.ts";
  import { session } from "../lib/session.svelte.ts";
  import { dauer, km, uhr } from "../lib/format.ts";
  import { T } from "../texte.ts";

  let { data, onback }: { data: ArchiveData; onback: () => void } = $props();

  const team = (id: string | null | undefined): Team => (id && data.teams[id]) || { name: "–", short: "?", color: "#888" };
  const start = $derived(data.startedAt);
  const end = $derived(data.endedAt);
  let pos = $state(0);
  $effect.pre(() => {
    if (!pos) pos = end;
  });
  let speed = $state("60");
  let playing = $state(false);
  let tab = $state<"auswertung" | "chat">("auswertung");
  let timer: ReturnType<typeof setInterval> | undefined;

  function toggle() {
    playing = !playing;
    clearInterval(timer);
    if (!playing) return;
    if (pos >= end) pos = start;
    timer = setInterval(() => {
      pos = Math.min(end, pos + Number(speed) * 100);
      if (pos >= end) toggle();
    }, 100);
  }
  onDestroy(() => clearInterval(timer));

  const frame = $derived(replayAt(data, pos));
  const marks = $derived(replayMarks(data));
  const at = (t: number) => `${((t - start) / Math.max(1, end - start)) * 100}%`;
  const pins = $derived<MapPin[]>([
    ...frame.catches.map((h) => {
      const t = team(h.to);
      // mit Team-Wegen ohne Namen – sonst sieht der Fangort aus wie ein Team
      const name = data.tracks ? undefined : t.name;
      return { key: `h${h.id}`, lat: h.lat, lng: h.lng, props: { kind: "team" as const, short: t.short, color: t.color, name } };
    }),
    ...replayTeams(data, pos).map((p) => {
      const t = team(p.teamId);
      return {
        key: `t${p.teamId}`,
        lat: p.lat,
        lng: p.lng,
        props: { kind: "team" as const, short: t.short, color: t.color, name: t.name, mrx: p.teamId === frame.mrx },
      };
    }),
    ...(frame.trail.length
      ? [
          {
            key: "cur",
            lat: frame.trail.at(-1)!.lat,
            lng: frame.trail.at(-1)!.lng,
            props: { kind: "mrx" as const, label: team(frame.mrx).name, sub: uhr(frame.trail.at(-1)!.t) },
          },
        ]
      : []),
  ]);
  // Wärmekarte (E-73): alle Punkte aller Teams auf einmal – zeigt, wo am meisten gelaufen wurde
  let waerme = $state(false);
  const heat = $derived<GeoJSON.FeatureCollection>(
    waerme && data.tracks
      ? {
          type: "FeatureCollection",
          features: Object.values(data.tracks).flatMap((spur) =>
            spur.map(([, lat, lng]): GeoJSON.Feature => ({
              type: "Feature",
              properties: {},
              geometry: { type: "Point", coordinates: [lng / 1e5, lat / 1e5] },
            })),
          ),
        }
      : EMPTY,
  );
  const chat = $derived(Object.entries(data.chat ?? {}).sort(([a], [b]) => (a < b ? -1 : 1)));
  const R = $derived(data.results);

  const dateiname = $derived(`${data.name.replace(/[^\wäöüÄÖÜß-]+/g, "-")}-${new Date(start).toISOString().slice(0, 10)}`);

  /** Sicherung als Datei (Backup, Vereinszeitung) */
  function save() {
    herunterladen(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `${dateiname}.json`).catch(() =>
      toast(T.archiv.videoFehler, "warn"),
    );
  }

  // ---------- Video (E-72) ----------
  let videoWahl = $state(false);
  let format = $state<"hoch" | "quer">("hoch");
  let fortschritt = $state<number | null>(null);
  let abbruch: AbortController | undefined;

  async function video() {
    const { kannVideo, replayVideo } = await import("../map/video.ts");
    if (!kannVideo()) return toast(T.archiv.videoGehtNicht, "warn");
    abbruch = new AbortController();
    fortschritt = 0;
    try {
      const blob = await replayVideo($state.snapshot(data) as ArchiveData, format, (f) => (fortschritt = f), abbruch.signal);
      await herunterladen(blob, `${dateiname}-${format}.mp4`);
      toast(T.archiv.videoFertig, "ok");
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      console.error("Video", e);
      toast((e as Error).message === "unsupported" ? T.archiv.videoGehtNicht : T.archiv.videoFehler, "warn");
    } finally {
      fortschritt = null;
    }
  }
  onDestroy(() => abbruch?.abort());
</script>

<main class="replay">
  <AppBar title={data.name} {onback} />
  <div class="map">
    <GameMap
      field={data.field}
      locked={frame.locked}
      trail={frame.trail}
      {pins}
      {heat}
      padding={{ top: 30, bottom: 30, left: 30, right: 30 }}
      label={T.archiv.replay}
    />
    {#if data.tracks}
      <div class="heatbtn">
        <IconButton icon={Flame} label={T.archiv.waermekarte} active={waerme} onclick={() => (waerme = !waerme)} />
      </div>
    {/if}
    <div class="now"><span class="caps">{T.status.misterX}</span> <b>{team(frame.mrx).name}</b></div>
  </div>
  <div class="controls">
    <IconButton icon={playing ? Pause : Play} label={playing ? T.archiv.anhalten : T.archiv.abspielen} tone="accent" onclick={toggle} />
    <div class="slider">
      <label class="sr-only" for="replay-t">{T.archiv.replay}</label>
      <input
        id="replay-t"
        type="range"
        min={start}
        max={end}
        step={10_000}
        bind:value={pos}
        aria-valuetext="{uhr(pos)}, {dauer(pos - start)}"
      />
      <div class="ticks" aria-hidden="true">
        {#each marks as m (m.kind + m.t)}
          {#if m.kind === "uebergabe"}<i style:left={at(m.t)} style:background={team(m.teamId).color}></i>{:else}<b style:left={at(m.t)}
            ></b>{/if}
        {/each}
      </div>
      <div class="time num"><span>{uhr(pos)}</span><span>{dauer(pos - start)} / {dauer(end - start)}</span></div>
    </div>
    <Segmented
      label={T.archiv.tempo}
      bind:value={speed}
      options={[
        { value: "30", label: "30×" },
        { value: "60", label: "60×" },
        { value: "180", label: "180×" },
      ]}
    />
  </div>
  <div class="below">
    <div class="tabs">
      <Segmented
        label={T.archiv.ansicht}
        bind:value={tab}
        options={[
          { value: "auswertung", label: T.archiv.auswertung },
          { value: "chat", label: T.archiv.chat },
        ]}
      />
      <span class="acts">
        {#if fortschritt === null}
          <Button size="m" variant="secondary" icon={Film} onclick={() => (videoWahl = true)}>{T.archiv.video}</Button>
        {:else}
          <span class="fortschritt">
            <progress max="1" value={fortschritt} aria-label={T.archiv.videoLaeuft}></progress>
            <span class="num">{Math.round(fortschritt * 100)} %</span>
            <IconButton icon={X} label={T.allgemein.abbrechen} onclick={() => abbruch?.abort()} />
          </span>
        {/if}
        {#if session.role === "admin"}
          <Button size="m" variant="secondary" icon={FileSpreadsheet} onclick={() => tabelleHerunterladen(data)}>{T.tabelle.knopf}</Button>
        {/if}
        <Button size="m" variant="secondary" icon={Download} onclick={save}>{T.archiv.sichern}</Button>
        <Button size="m" variant="secondary" icon={Printer} onclick={() => window.print()}>{T.archiv.drucken}</Button>
      </span>
    </div>
    {#if tab === "auswertung"}
      <div class="sum">
        <Pill tone="accent" icon={Trophy}>{T.ende.sieger}: {team(R.winner).name}</Pill>
        <Pill icon={Timer}>{dauer(R.durationMs)}</Pill>
        <Pill icon={Flag}>{R.handovers} {T.ende.uebergaben}</Pill>
        <Pill icon={Users}>{T.archiv.teams(Object.keys(data.teams).length)}</Pill>
        {#if R.longest}<Pill icon={Timer}>{T.ende.laengste}: {team(R.longest.teamId).name} ({dauer(R.longest.ms)})</Pill>{/if}
        {#if R.most}<Pill icon={Repeat}>{T.ende.oefteste}: {team(R.most.teamId).name} ({R.most.count}×)</Pill>{/if}
        {#if R.farthest}<Pill icon={Footprints}>{T.ende.distanz}: {team(R.farthest.teamId).name} ({km(R.farthest.m)})</Pill>{/if}
        {#if R.food}<Pill icon={Utensils}>{T.ende.futter}: {team(R.food.teamId).name} ({R.food.visits}×)</Pill>{/if}
        {#if data.reason === "notstopp"}<Pill tone="warn">{T.archiv.notstopp}</Pill>{/if}
      </div>
    {:else}
      <div class="chatlog">
        {#each chat as [id, m] (id)}
          <p class:future={m.t > pos}><time class="num">{uhr(m.t)}</time> <b>{m.name}:</b> {m.text}</p>
        {:else}
          <p class="muted">{T.archiv.chatGeloescht}</p>
        {/each}
      </div>
    {/if}
  </div>
</main>

<Modal
  open={videoWahl}
  title={T.archiv.videoTitel}
  confirm={T.archiv.videoErstellen}
  onconfirm={() => void video()}
  onclose={() => (videoWahl = false)}
>
  <Segmented
    label={T.archiv.format}
    bind:value={format}
    options={[
      { value: "hoch", label: T.archiv.hochformat },
      { value: "quer", label: T.archiv.querformat },
    ]}
  />
  <p class="muted">{T.archiv.videoHinweis}</p>
</Modal>

<style>
  .replay {
    position: fixed;
    inset: 0;
    display: grid;
    grid-template-rows: auto 1fr auto auto;
    background: var(--bg);
  }
  .map {
    position: relative;
    min-height: 0;
  }
  .heatbtn {
    position: absolute;
    top: var(--sp-3);
    right: var(--sp-3);
    z-index: var(--z-ui);
  }
  .now {
    position: absolute;
    left: var(--sp-3);
    bottom: var(--sp-3);
    padding: var(--sp-2) var(--sp-3);
    border-radius: var(--r-pill);
    background: var(--glass);
    z-index: var(--z-ui);
  }
  .controls {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    flex-wrap: wrap;
    padding: var(--sp-3) var(--gutter);
    border-top: var(--border-w) solid var(--line);
    background: var(--surface);
  }
  .slider {
    position: relative;
    flex: 1 1 240px;
  }
  input[type="range"] {
    width: 100%;
    height: var(--touch);
    accent-color: var(--accent);
  }
  .ticks {
    position: absolute;
    left: 0;
    right: 0;
    top: 6px;
    height: 8px;
    pointer-events: none;
  }
  .ticks i,
  .ticks b {
    position: absolute;
    width: 4px;
    height: 10px;
    border-radius: 2px;
    translate: -2px 0;
  }
  .ticks b {
    background: var(--warn);
    height: 14px;
    top: -2px;
  }
  .time {
    display: flex;
    justify-content: space-between;
    font-size: var(--fs-s);
    color: var(--text-2);
  }
  .below {
    display: grid;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--gutter) calc(var(--safe-bottom) + var(--sp-3));
    max-height: 32vh;
    overflow-y: auto;
  }
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
    align-items: center;
    justify-content: space-between;
  }
  .acts {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-2);
  }
  .fortschritt {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }
  .fortschritt progress {
    width: 120px;
    accent-color: var(--accent);
  }
  .sum {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
  }
  .chatlog p {
    padding: 4px 0;
    border-bottom: var(--border-w) solid var(--line);
  }
  .chatlog p.future {
    opacity: 0.4;
  }
  .chatlog time {
    color: var(--text-3);
  }
  .muted {
    color: var(--text-2);
  }
  /* Drucken (Vereinszeitung): Auswertung und Chat, ohne Karte und Bedienung */
  @media print {
    .replay {
      position: static;
      display: block;
    }
    .map,
    .controls,
    .acts {
      display: none;
    }
    .below {
      max-height: none;
      overflow: visible;
    }
    .chatlog p.future {
      opacity: 1;
    }
  }
</style>
