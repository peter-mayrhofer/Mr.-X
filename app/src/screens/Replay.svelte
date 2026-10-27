<!--
  Screen 20 (Wiederholung): ein beendeter Lauf auf der Karte, mit Zeitschieberegler. Mister-X-Meldungen (Spur seit der
  letzten Übergabe), Fangorte und Verkleinerungen erscheinen im Zeitverlauf; darunter Auswertung und Chat-Verlauf.
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import { Download, Flag, Footprints, Pause, Play, Printer, Repeat, Timer, Trophy, Users } from "@lucide/svelte";
  import { replayAt, replayMarks, type ArchiveData, type Team } from "@mrx/shared";
  import GameMap, { type MapPin } from "../map/GameMap.svelte";
  import AppBar from "../ui/AppBar.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import IconButton from "../ui/IconButton.svelte";
  import Button from "../ui/Button.svelte";
  import Pill from "../ui/Pill.svelte";
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
      return { key: `h${h.id}`, lat: h.lat, lng: h.lng, props: { kind: "team" as const, short: t.short, color: t.color, name: t.name } };
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
  const chat = $derived(Object.entries(data.chat ?? {}).sort(([a], [b]) => (a < b ? -1 : 1)));
  const R = $derived(data.results);

  /** Sicherung als Datei (Backup, Vereinszeitung) – ohne Live-Standorte, die gibt es im Archiv nicht */
  function save() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${data.name.replace(/[^\wäöüÄÖÜß-]+/g, "-")}-${new Date(start).toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
</script>

<div class="replay">
  <AppBar title={data.name} {onback} />
  <div class="map">
    <GameMap
      field={data.field}
      locked={frame.locked}
      trail={frame.trail}
      {pins}
      padding={{ top: 30, bottom: 30, left: 30, right: 30 }}
      label={T.archiv.replay}
    />
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
        <Button size="m" variant="secondary" icon={Download} onclick={save}>{T.archiv.sichern}</Button>
        <Button size="m" variant="secondary" icon={Printer} onclick={() => window.print()}>{T.archiv.drucken}</Button>
      </span>
    </div>
    {#if tab === "auswertung"}
      <div class="sum">
        <Pill tone="accent" icon={Trophy}>{T.ende.sieger}: {team(R.winner).name}</Pill>
        <Pill icon={Timer}>{dauer(R.durationMs)}</Pill>
        <Pill icon={Flag}>{R.handovers} {T.ende.uebergaben}</Pill>
        <Pill icon={Users}>{Object.keys(data.teams).length} Teams</Pill>
        {#if R.longest}<Pill icon={Timer}>{T.ende.laengste}: {team(R.longest.teamId).name} ({dauer(R.longest.ms)})</Pill>{/if}
        {#if R.most}<Pill icon={Repeat}>{T.ende.oefteste}: {team(R.most.teamId).name} ({R.most.count}×)</Pill>{/if}
        {#if R.farthest}<Pill icon={Footprints}>{T.ende.distanz}: {team(R.farthest.teamId).name} ({km(R.farthest.m)})</Pill>{/if}
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
</div>

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
    gap: var(--sp-2);
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
