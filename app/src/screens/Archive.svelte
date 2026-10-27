<!--
  Screen 20: Archiv & Replay. Liste vergangener Spiele; Wiederholung mit Zeitschieberegler:
  Mister-X-Meldungen, Übergaben (Fangorte) und Verkleinerungen erscheinen im Zeitverlauf.
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import { Flag, Pause, Play, Trophy, Users, Timer } from "@lucide/svelte";
  import { inField } from "@mrx/shared";
  import GameMap, { type MapPin } from "../map/GameMap.svelte";
  import AppBar from "../ui/AppBar.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import IconButton from "../ui/IconButton.svelte";
  import ListItem from "../ui/ListItem.svelte";
  import TeamBadge from "../ui/TeamBadge.svelte";
  import Pill from "../ui/Pill.svelte";
  import { datum, dauer, uhr } from "../lib/format.ts";
  import { go } from "../lib/router.svelte.ts";
  import { T } from "../texte.ts";
  import * as M from "../proto/mock.svelte.ts";

  let { variant = "liste" }: { variant?: string } = $props();
  const MIN = 60_000;
  const game = M.archive[0]!;

  // Synthetisches Spiel für das Replay: Meldungen alle 10 Min, Übergaben laut Zeitstrahl, deterministisch
  function buildReplay() {
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    let p = { lat: 48.3036, lng: 14.2878 };
    const reports: { id: string; lat: number; lng: number; t: number; teamId: string }[] = [];
    const handovers: { at: number; to: string; lat: number; lng: number }[] = [];
    const cuts: { at: number; id: string }[] = [
      { at: 95 * MIN, id: "westen" },
      { at: 150 * MIN, id: "norden" },
      { at: 190 * MIN, id: "osten" },
    ];
    let t = 0;
    for (const [teamId, ms] of M.result.timeline) {
      const mins = ms / MIN;
      handovers.push({ at: t, to: teamId, ...p });
      for (let m = 0; m < mins; m += 10) {
        const locked = cuts.filter((c) => c.at <= t + m * MIN).map((c) => c.id);
        for (let k = 0; k < 20; k++) {
          const q = { lat: p.lat + (rnd() - 0.5) * 0.004, lng: p.lng + (rnd() - 0.5) * 0.006 };
          if (inField(q, M.field, locked)) {
            p = q;
            break;
          }
        }
        reports.push({ id: `x${reports.length}`, ...p, t: t + m * MIN, teamId });
      }
      t += mins * MIN;
    }
    return { reports, handovers, cuts, duration: t };
  }
  const R = buildReplay();

  let pos = $state(R.duration * 0.42);
  let speed = $state("60");
  let playing = $state(false);
  let tab = $state<"auswertung" | "chat">("auswertung");
  let timer: ReturnType<typeof setInterval> | undefined;

  function toggle() {
    playing = !playing;
    clearInterval(timer);
    if (!playing) return;
    if (pos >= R.duration) pos = 0;
    timer = setInterval(() => {
      pos = Math.min(R.duration, pos + Number(speed) * 100);
      if (pos >= R.duration) toggle();
    }, 100);
  }
  onDestroy(() => clearInterval(timer));

  const lastHandover = $derived(R.handovers.filter((h) => h.at <= pos).at(-1)!);
  const trail = $derived(R.reports.filter((r) => r.t <= pos && r.t >= lastHandover.at));
  const locked = $derived(R.cuts.filter((c) => c.at <= pos).map((c) => c.id));
  const startT = game.date;
  const pins = $derived<MapPin[]>([
    ...R.handovers
      .filter((h) => h.at <= pos && h.at > 0)
      .map((h, i) => {
        const t = M.teams[h.to]!;
        return { key: `h${i}`, lat: h.lat, lng: h.lng, props: { kind: "team" as const, short: t.short, color: t.color } };
      }),
    ...(trail.length
      ? [
          {
            key: "cur",
            lat: trail.at(-1)!.lat,
            lng: trail.at(-1)!.lng,
            props: { kind: "mrx" as const, label: M.teams[lastHandover.to]!.name, sub: uhr(startT + trail.at(-1)!.t) },
          },
        ]
      : []),
  ]);
</script>

{#if variant === "replay"}
  <div class="replay">
    <AppBar title={game.name} onback={() => go("/prototyp/20?v=liste")} />
    <div class="map">
      <GameMap field={M.field} {locked} {trail} {pins} padding={{ top: 30, bottom: 30, left: 30, right: 30 }} label="Wiederholung" />
    </div>
    <div class="controls">
      <IconButton icon={playing ? Pause : Play} label={playing ? T.archiv.anhalten : T.archiv.abspielen} tone="accent" onclick={toggle} />
      <div class="slider">
        <label class="sr-only" for="replay-t">{T.archiv.replay}</label>
        <input id="replay-t" type="range" min="0" max={R.duration} step={MIN} bind:value={pos} />
        <div class="ticks" aria-hidden="true">
          {#each R.handovers.slice(1) as h (h.at)}<i style:left="{(h.at / R.duration) * 100}%" style:background={M.teams[h.to]!.color}
            ></i>{/each}
          {#each R.cuts as c (c.id)}<b style:left="{(c.at / R.duration) * 100}%"></b>{/each}
        </div>
        <div class="time num"><span>{uhr(startT + pos)}</span><span>{dauer(pos)} / {dauer(R.duration)}</span></div>
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
      <Segmented
        label="Ansicht"
        bind:value={tab}
        options={[
          { value: "auswertung", label: T.archiv.auswertung },
          { value: "chat", label: T.archiv.chat },
        ]}
      />
      {#if tab === "auswertung"}
        <div class="sum">
          <Pill tone="accent" icon={Trophy}>{T.ende.sieger}: {game.winner}</Pill>
          <Pill icon={Timer}>{dauer(game.durationMs)}</Pill>
          <Pill icon={Flag}>{M.result.handovers} {T.ende.uebergaben}</Pill>
          <Pill icon={Users}>{game.teams} Teams</Pill>
        </div>
      {:else}
        <div class="chatlog">
          {#each M.chat as m (m.id)}<p><time class="num">{uhr(m.t)}</time> <b>{m.name}:</b> {m.text}</p>{/each}
        </div>
      {/if}
    </div>
  </div>
{:else}
  <div class="list">
    <AppBar title={T.archiv.titel} onback={() => go("/prototyp/13")} />
    <div class="items">
      {#each M.archive as a (a.id)}
        <ListItem
          title={a.name}
          subtitle="{datum(a.date)} · {dauer(a.durationMs)} · {a.teams} Teams"
          onclick={() => go("/prototyp/20?v=replay")}
          chevron
        >
          {#snippet lead()}<span class="trophy"><Trophy size={26} aria-hidden="true" /></span>{/snippet}
          {#snippet trail()}<span class="win"
              ><TeamBadge short={a.winner.slice(0, 2).toUpperCase()} color="#00a3a3" size={32} mrx />{a.winner}</span
            >{/snippet}
        </ListItem>
      {/each}
    </div>
  </div>
{/if}

<style>
  .replay {
    position: fixed;
    inset: 0;
    display: grid;
    grid-template-rows: auto 1fr auto auto;
  }
  .map {
    position: relative;
    min-height: 0;
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
    max-height: 30vh;
    overflow-y: auto;
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
  .chatlog time {
    color: var(--text-3);
  }
  .list {
    min-height: 100dvh;
  }
  .items {
    display: grid;
    gap: 2px;
    padding: var(--sp-3) var(--sp-2);
    max-width: 800px;
    margin: 0 auto;
  }
  .trophy {
    width: 48px;
    height: 48px;
    border-radius: var(--r-m);
    display: grid;
    place-items: center;
    background: var(--accent-soft);
    color: var(--accent-text);
  }
  .win {
    display: none;
    align-items: center;
    gap: var(--sp-2);
    font-weight: 700;
  }
  @media (min-width: 600px) {
    .win {
      display: flex;
    }
  }
</style>
