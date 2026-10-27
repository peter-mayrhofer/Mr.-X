<!-- Screen 19: Spielende & Auswertung – Feier für den Gewinner, Auszeichnungen, Statistik, Zeitstrahl. -->
<script lang="ts">
  import { Archive, Footprints, Medal, Repeat, Route, Timer } from "@lucide/svelte";
  import Confetti from "../ui/Confetti.svelte";
  import TeamBadge from "../ui/TeamBadge.svelte";
  import Button from "../ui/Button.svelte";
  import Logo from "../ui/Logo.svelte";
  import { dauer, km } from "../lib/format.ts";
  import { go } from "../lib/router.svelte.ts";
  import { T } from "../texte.ts";
  import * as M from "../proto/mock.svelte.ts";

  const R = M.result;
  const winner = M.teams[R.winner]!;
  const total = R.timeline.reduce((s, [, m]) => s + m, 0);
  const awards = [
    { icon: Timer, label: T.ende.laengste, team: R.longest.teamId, value: dauer(R.longest.ms) },
    { icon: Repeat, label: T.ende.oefteste, team: R.most.teamId, value: `${R.most.count}×` },
    { icon: Footprints, label: T.ende.distanz, team: R.farthest.teamId, value: km(R.farthest.m) },
  ];
</script>

<Confetti />
<main class="end">
  <header><Logo height={44} /></header>

  <section class="hero">
    <p class="caps kicker">{T.ende.titel}</p>
    <div class="badge"><TeamBadge short={winner.short} color={winner.color} mrx size={128} /></div>
    <p class="caps">{T.ende.sieger}</p>
    <h1 class="display">{winner.name}</h1>
    <p class="muted">{T.ende.letzterMrx}</p>
  </section>

  <section class="awards">
    {#each awards as a (a.label)}
      {@const IconC = a.icon}
      {@const t = M.teams[a.team]!}
      <article>
        <IconC size={30} aria-hidden="true" />
        <p class="caps">{a.label}</p>
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
    <h2 class="caps">{T.ende.zeitstrahl}</h2>
    <div class="bar" role="img" aria-label={R.timeline.map(([id, m]) => `${M.teams[id]!.name} ${m} Min`).join(", ")}>
      {#each R.timeline as [id, m], i (i)}
        {@const t = M.teams[id]!}
        <span style:flex={m} style:background={t.color} title="{t.name}: {m} Min">{m >= 15 ? t.short : ""}</span>
      {/each}
    </div>
    <div class="axis num"><span>0:00</span><span>{dauer(total * 60_000)}</span></div>
  </section>

  <div class="actions">
    <Button size="xl" icon={Archive} onclick={() => go("/prototyp/20?v=replay")}>{T.ende.archiv}</Button>
    <Button variant="secondary" icon={Medal} onclick={() => go("/prototyp/18")}>{T.admin.nav.grossbild}</Button>
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
  article .caps {
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
  .stats div {
    display: grid;
    justify-items: center;
    text-align: center;
    gap: 2px;
    padding: var(--sp-3);
    border-radius: var(--r-m);
    background: var(--surface-2);
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
    margin-top: 4px;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-3);
    justify-content: center;
  }
</style>
