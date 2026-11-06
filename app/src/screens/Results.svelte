<!-- Screen 19: Spielende & Auswertung – Feier für den Gewinner, Auszeichnungen, Statistik, Zeitstrahl. -->
<script lang="ts">
  import { Archive, Compass, Footprints, LogOut, MapPinCheck, Medal, Repeat, Route, Timer, Utensils } from "@lucide/svelte";
  import Banner from "../ui/Banner.svelte";
  import Pill from "../ui/Pill.svelte";
  import type { Results, Team } from "@mrx/shared";
  import Confetti from "../ui/Confetti.svelte";
  import TeamBadge from "../ui/TeamBadge.svelte";
  import Button from "../ui/Button.svelte";
  import Logo from "../ui/Logo.svelte";
  import { dauer, km } from "../lib/format.ts";
  import { T } from "../texte.ts";

  interface Props {
    results: Results;
    teams: Record<string, Team>;
    onarchive?: () => void;
    onscreen?: () => void;
    /** z. B. „Zur Startseite“ für Teams nach dem Spiel */
    done?: { label: string; onclick: () => void };
    /** Teams/Schiris: nach dem Spiel abmelden – sonst kommt man nicht mehr zur Startseite */
    onleave?: () => void;
    /** Probelauf: kommt nicht ins Archiv */
    trial?: boolean;
    /** Sammelruf nach dem Spiel (Teams): Weg zeigen, „Wir sind da“ */
    gather?: { name: string; arrived: boolean; onarrived: () => void; oncompass: () => void };
  }
  let { results: R, teams, onarchive, onscreen, done, onleave, trial = false, gather }: Props = $props();

  const team = (id: string | null | undefined): Team => (id && teams[id]) || { name: "–", short: "?", color: "#888" };
  const winner = $derived(team(R.winner));
  const timeline = $derived(R.timeline ?? []);
  const total = $derived(timeline.reduce((s, [, ms]) => s + ms, 0));
  // RTDB speichert keine null-Werte → fehlende Auszeichnungen (z. B. niemand gelaufen) weglassen
  const awards = $derived(
    [
      R.longest && { icon: Timer, label: T.ende.laengste, team: R.longest.teamId, value: dauer(R.longest.ms) },
      R.most && { icon: Repeat, label: T.ende.oefteste, team: R.most.teamId, value: `${R.most.count}×` },
      R.farthest && { icon: Footprints, label: T.ende.distanz, team: R.farthest.teamId, value: km(R.farthest.m) },
      R.food && { icon: Utensils, label: T.ende.futter, team: R.food.teamId, value: `${R.food.visits}×` },
    ].filter((a) => !!a),
  );
</script>

<Confetti />
<main class="end">
  <header><Logo height={44} /></header>

  {#if gather}
    <Banner tone="ann" icon={MapPinCheck} title={T.sammelruf.titel(gather.name)} live>
      <div class="gather">
        <Button size="m" variant="secondary" icon={Compass} onclick={gather.oncompass}>{T.sammelruf.kompass}</Button>
        {#if gather.arrived}
          <span class="here">{T.sammelruf.angekommen}</span>
        {:else}
          <Button size="m" icon={MapPinCheck} onclick={gather.onarrived}>{T.sammelruf.daKnopf}</Button>
        {/if}
      </div>
    </Banner>
  {/if}

  <section class="hero">
    <p class="etikett kicker">{T.ende.titel}</p>
    {#if trial}<Pill tone="info">{T.ende.probelauf}</Pill>{/if}
    <div class="badge"><TeamBadge short={winner.short} color={winner.color} mrx size={128} /></div>
    <p class="etikett">{T.ende.sieger}</p>
    <h1 class="display">{winner.name}</h1>
    <p class="muted">{T.ende.letzterMrx}</p>
  </section>

  <section class="awards">
    {#each awards as a (a.label)}
      {@const IconC = a.icon}
      {@const t = team(a.team)}
      <article>
        <IconC size={30} aria-hidden="true" />
        <p class="etikett">{a.label}</p>
        <div class="row"><TeamBadge short={t.short} color={t.color} size={36} /><strong>{t.name}</strong></div>
        <p class="val display num">{a.value}</p>
      </article>
    {/each}
  </section>

  <section class="stats">
    <div><Repeat size={22} aria-hidden="true" /><b class="num">{R.handovers}</b><span>{T.ende.uebergaben}</span></div>
    <div><Route size={22} aria-hidden="true" /><b class="num">{km(R.totalDistM)}</b><span>{T.ende.gesamtstrecke}</span></div>
    <div><Timer size={22} aria-hidden="true" /><b class="num">{dauer(R.durationMs)}</b><span>{T.ende.dauer}</span></div>
  </section>

  <section class="timeline">
    <h2 class="etikett">{T.ende.zeitstrahl}</h2>
    <div class="bar" role="img" aria-label={timeline.map(([id, ms]) => `${team(id).name} ${dauer(ms)}`).join(", ")}>
      {#each timeline as [id, ms], i (i)}
        {@const t = team(id)}
        <span style:flex={ms} style:--c={t.color} title="{t.name}: {dauer(ms)}">{ms >= total / 12 ? t.short : ""}</span>
      {/each}
    </div>
    <div class="axis num"><span>0:00</span><span>{dauer(total)}</span></div>
  </section>

  <div class="actions">
    {#if onarchive}<Button size="xl" icon={Archive} onclick={onarchive}>{T.ende.archiv}</Button>{/if}
    {#if onscreen}<Button variant="secondary" icon={Medal} onclick={onscreen}>{T.admin.nav.grossbild}</Button>{/if}
    {#if done}<Button size="xl" variant={onarchive ? "secondary" : "primary"} onclick={done.onclick}>{done.label}</Button>{/if}
    {#if onleave}<Button variant="ghost" icon={LogOut} onclick={onleave}>{T.warten.abmelden}</Button>{/if}
  </div>
</main>

<style>
  .end {
    display: grid;
    gap: var(--sp-6);
    max-width: 880px;
    margin: 0 auto;
    padding: calc(var(--safe-top) + var(--sp-4)) var(--gutter) var(--sp-10);
  }
  .hero {
    display: grid;
    justify-items: center;
    text-align: center;
    gap: var(--sp-2);
  }
  .kicker {
    color: var(--accent-text);
    font-size: var(--fs-2xl);
  }
  .badge {
    margin: var(--sp-4) 0;
    animation: rise 700ms var(--ease-out) both;
  }
  @keyframes rise {
    from {
      transform: translateY(40px) scale(0.6);
      opacity: 0;
    }
  }
  h1 {
    font-size: clamp(56px, 14vw, 96px);
    line-height: 0.95;
  }
  .awards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: var(--sp-3);
  }
  article {
    display: grid;
    gap: var(--sp-2);
    padding: var(--sp-4);
    border-radius: var(--r-l);
    background: var(--surface);
    border: var(--border-w) solid var(--line);
  }
  article > :global(svg) {
    color: var(--accent-text);
  }
  article .etikett {
    color: var(--text-2);
  }
  .row {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }
  .val {
    font-size: var(--fs-3xl);
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--sp-3);
  }
  /* Kennzahlen als ruhige Zeile mit Haarlinien statt drei gleicher Kästchen */
  .stats div {
    display: grid;
    align-content: start;
    justify-items: center;
    text-align: center;
    gap: var(--sp-1);
    padding: var(--sp-2);
  }
  .stats div + div {
    border-left: var(--border-w) solid var(--line);
  }
  .stats b {
    font-family: var(--font-display);
    font-size: var(--fs-2xl);
  }
  .stats span {
    font-size: var(--fs-s);
    color: var(--text-2);
  }
  .timeline h2 {
    font-size: var(--fs-s);
    color: var(--text-2);
    margin-bottom: var(--sp-2);
  }
  .bar {
    display: flex;
    height: 48px;
    border-radius: var(--r-m);
    overflow: hidden;
    border: 2px solid var(--line);
  }
  .bar span {
    display: grid;
    place-items: center;
    background: color-mix(in oklab, var(--c) 78%, #000);
    color: #fff;
    font-family: var(--font-display);
    font-weight: 800;
    border-right: 2px solid var(--bg);
    text-shadow: 0 1px 2px rgb(0 0 0 / 0.4);
  }
  .axis {
    display: flex;
    justify-content: space-between;
    color: var(--text-3);
    font-size: var(--fs-s);
    margin-top: var(--sp-1);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-3);
    justify-content: center;
  }
  .gather {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
    margin-top: var(--sp-2);
  }
  .here {
    display: inline-flex;
    align-items: center;
    min-height: var(--touch);
    padding: 0 var(--sp-4);
    border-radius: var(--r-m);
    background: var(--surface);
    color: var(--ok-text);
    font-weight: 700;
  }
  @media (min-width: 1200px) {
    .end {
      max-width: 1680px;
      min-height: 100dvh;
      grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
      align-content: center;
      column-gap: clamp(48px, 5vw, 112px);
      row-gap: var(--sp-8);
      padding: var(--sp-8) clamp(32px, 4vw, 80px);
    }
    header,
    .end > :global(.banner) {
      grid-column: 1 / -1;
    }
    .hero {
      grid-column: 1;
      grid-row: span 4;
      align-content: center;
    }
    .awards,
    .stats,
    .timeline,
    .actions {
      grid-column: 2;
    }
    .kicker {
      font-size: var(--fs-3xl);
    }
    .badge {
      zoom: 1.5;
    }
    .hero .etikett:not(.kicker) {
      font-size: var(--fs-xl);
    }
    h1 {
      font-size: clamp(96px, 8vw, 168px);
    }
    .hero .muted {
      font-size: var(--fs-l);
    }
    article {
      padding: var(--sp-6);
      gap: var(--sp-3);
    }
    article .etikett {
      font-size: var(--fs-l);
    }
    article strong {
      font-size: var(--fs-l);
    }
    .val {
      font-size: var(--fs-4xl);
    }
    .stats b {
      font-size: var(--fs-3xl);
    }
    .stats span,
    .timeline h2 {
      font-size: var(--fs-l);
    }
    .bar {
      height: 64px;
      font-size: var(--fs-l);
    }
    .axis {
      font-size: var(--fs-m);
    }
    .actions {
      justify-content: flex-start;
    }
  }
</style>
