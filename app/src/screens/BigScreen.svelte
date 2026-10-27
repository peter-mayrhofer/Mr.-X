<!--
  Screen 18: Großbild für Zentrale/Beamer – lesbar aus 3–5 m, keine Bedienelemente.
  Zuschauer-Modus (Eltern): nur Mister-X-Meldungen, keine Live-Positionen (Abschnitt 7.9).
-->
<script lang="ts">
  import { Flag, Megaphone, Trophy } from "@lucide/svelte";
  import GameMap, { type MapPin } from "../map/GameMap.svelte";
  import CountdownRing from "../ui/CountdownRing.svelte";
  import TeamBadge from "../ui/TeamBadge.svelte";
  import Logo from "../ui/Logo.svelte";
  import { clock } from "../lib/clock.svelte.ts";
  import { dauer, uhr, vor } from "../lib/format.ts";
  import { T } from "../texte.ts";
  import * as M from "../proto/mock.svelte.ts";

  let { variant = "" }: { variant?: string } = $props();
  const viewer = $derived(variant === "zuschauer");
  const mrx = M.teams[M.MRX]!;
  const trail = $derived(M.reports.filter((r) => r.t >= M.game.mrxSince));
  const last = $derived(trail.at(-1));

  const pins = $derived<MapPin[]>([
    ...(viewer
      ? []
      : M.teamIds.map((id) => {
          const t = M.teams[id]!,
            p = M.positions[id]!;
          return {
            key: id,
            lat: p.lat,
            lng: p.lng,
            props: {
              kind: "team" as const,
              short: t.short,
              color: t.color,
              name: t.name,
              mrx: id === M.MRX,
              big: true,
              locked: (M.locks[id] ?? 0) > clock.now,
            },
          };
        })),
    ...(last
      ? [
          {
            key: "mrx",
            lat: last.lat,
            lng: last.lng,
            props: { kind: "mrx" as const, label: uhr(last.t), sub: vor(last.t, clock.now), ping: M.game.ping },
          },
        ]
      : []),
  ]);

  const ranking = $derived(
    M.teamIds
      .map((id) => ({
        id,
        ms: (M.stats[id]?.mrxMs ?? 0) + (id === M.MRX ? clock.now - M.game.mrxSince - 38 * 60_000 : 0),
        n: M.stats[id]?.mrxCount ?? 0,
      }))
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 6),
  );
  const ticker = $derived(
    [...M.chat]
      .filter((m) => m.kind !== "msg")
      .slice(-4)
      .reverse(),
  );
</script>

<div class="big" data-theme="dunkel">
  <div class="map">
    <GameMap
      field={M.field}
      locked={M.game.locked}
      {trail}
      {pins}
      interactive={false}
      alwaysNames
      padding={{ top: 60, bottom: 60, left: 60, right: 60 }}
      label="Spielfeld Großbild"
    />
  </div>

  <aside>
    <header>
      <Logo height={56} onDark />
      <Logo which="kinderfreunde-ooe" height={36} onDark />
    </header>

    <section class="mrx">
      <p class="caps">{T.status.misterX}</p>
      <div class="who">
        <TeamBadge short={mrx.short} color={mrx.color} mrx size={88} />
        <strong class="display">{mrx.name}</strong>
      </div>
    </section>

    <section class="count">
      <CountdownRing until={M.game.nextReportAt} total={M.config.intervalMin * 60_000} size={230} label={T.status.naechsteMeldung} />
      <div>
        <p class="caps">{T.status.naechsteMeldung}</p>
        <p class="caps">{T.status.spielzeit}</p>
        <p class="clock num">{dauer(clock.now - M.game.startedAt)}</p>
      </div>
    </section>

    <section class="rank">
      <p class="caps"><Trophy size={26} aria-hidden="true" /> {T.grossbild.rangliste} · {T.grossbild.zeitAlsMrx}</p>
      <ol>
        {#each ranking as r, i (r.id)}
          {@const t = M.teams[r.id]!}
          <li>
            <span class="pos num">{i + 1}</span>
            <TeamBadge short={t.short} color={t.color} size={40} mrx={r.id === M.MRX} />
            <span class="nm">{t.name}</span>
            <span class="num">{dauer(r.ms)}</span>
            <span class="num n">{r.n}×</span>
          </li>
        {/each}
      </ol>
    </section>

    <section class="ticker" aria-live="polite">
      <p class="caps">{T.grossbild.ereignisse}</p>
      {#each ticker as m (m.id)}
        <p class="ev"><time class="num">{uhr(m.t)}</time> {m.text}</p>
      {/each}
    </section>
  </aside>

  {#if variant === "durchsage"}
    <div class="ann" role="alert">
      <Megaphone size={96} aria-hidden="true" />
      <p class="caps">{T.chat.durchsage}</p>
      <p class="text display">Treffpunkt nach dem Spiel: Hauptplatz beim Brunnen!</p>
    </div>
  {/if}
  {#if viewer}<div class="viewer"><Flag size={22} aria-hidden="true" /> Zuschauer-Ansicht · nur Mister-X-Meldungen</div>{/if}
</div>

<style>
  .big {
    position: fixed;
    inset: 0;
    display: grid;
    grid-template-columns: 1fr minmax(540px, 38vw);
    background: var(--nacht-950);
    color: #fff;
  }
  .map {
    position: relative;
  }
  aside {
    display: flex;
    flex-direction: column;
    gap: 28px;
    padding: 32px;
    background: var(--nacht-900);
    border-left: 2px solid var(--nacht-700);
    overflow: hidden;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .caps {
    font-size: 24px;
    color: #a8bbcc;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .who {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-top: 8px;
  }
  .who strong {
    font-size: 64px;
    line-height: 1;
    color: #fff;
  }
  .count {
    display: flex;
    align-items: center;
    gap: 24px;
  }
  .clock {
    font-family: var(--font-display);
    font-size: 44px;
    font-weight: 800;
    white-space: nowrap;
  }
  .rank ol {
    list-style: none;
    margin: 12px 0 0;
    padding: 0;
    display: grid;
    gap: 10px;
  }
  .rank li {
    display: flex;
    align-items: center;
    gap: 14px;
    font-size: 26px;
    font-weight: 700;
  }
  .pos {
    width: 32px;
    color: #a8bbcc;
  }
  .nm {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rank .num {
    white-space: nowrap;
  }
  .n {
    color: #a8bbcc;
    min-width: 48px;
    text-align: right;
  }
  .ticker {
    margin-top: auto;
  }
  .ev {
    font-size: 22px;
    padding: 6px 0;
    border-top: 1px solid var(--nacht-700);
  }
  .ev time {
    color: var(--rot-400);
    font-weight: 800;
    margin-right: 8px;
  }
  .ann {
    position: fixed;
    inset: 0;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 24px;
    padding: 80px;
    text-align: center;
    background: var(--rf-rot);
    z-index: var(--z-overlay);
    animation: in var(--dur-3) var(--ease-out);
  }
  .ann .caps {
    color: #fff;
    font-size: 40px;
  }
  .ann .text {
    font-size: 96px;
    max-width: 18ch;
  }
  @keyframes in {
    from {
      opacity: 0;
      transform: scale(1.05);
    }
  }
  .viewer {
    position: fixed;
    left: 24px;
    top: 24px;
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 10px 18px;
    border-radius: var(--r-pill);
    background: var(--glass);
    font-size: 22px;
    font-weight: 700;
    z-index: var(--z-ui);
  }
</style>
