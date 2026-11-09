<!--
  Screen 18: Großbild für Zentrale/Beamer – lesbar aus 3–5 m, keine Bedienelemente (Abschnitt 7.9).
  Zuschauer-Modus (Eltern, F6): dieselbe Ansicht ohne Live-Positionen – der Server schickt sie gar nicht erst.
  Auf dem Handy (Zuschauer) stapelt sich alles untereinander.
-->
<script module lang="ts">
  import type { CutEvent, Field, GameState, Handover, Lock, Pause, Position, Report, Team, TeamStats } from "@mrx/shared";
  import type { Keyed, Msg } from "../lib/game.svelte.ts";

  /** Was das Großbild zeigt – im Spiel aus GameData, im Prototyp aus Testdaten */
  export interface BigView {
    gameName: string;
    field: Field;
    intervalMin: number;
    state: GameState;
    teams: Record<string, Team>;
    /** fehlt beim Zuschauer */
    positions?: Record<string, Position> | undefined;
    reports: Keyed<Report>[];
    handovers: Keyed<Handover>[];
    locks: Record<string, Lock>;
    pauses: Keyed<Pause>[];
    cutLog: Keyed<CutEvent>[];
    stats: Record<string, TeamStats>;
    /** fehlt beim Zuschauer → keine Durchsagen */
    chat?: Msg[] | undefined;
  }
</script>

<script lang="ts">
  import { Flag, Hourglass, LogOut, Megaphone, Pause as PauseIcon, Trophy, Users } from "@lucide/svelte";
  import { activeMs, results } from "@mrx/shared";
  import GameMap, { type MapPin } from "../map/GameMap.svelte";
  import CountdownRing from "../ui/CountdownRing.svelte";
  import TeamBadge from "../ui/TeamBadge.svelte";
  import Logo from "../ui/Logo.svelte";
  import { clock } from "../lib/clock.svelte.ts";
  import { dauer, uhr, vor } from "../lib/format.ts";
  import { T } from "../texte.ts";

  let { v, viewer = false, onleave, leaveLabel }: { v: BigView; viewer?: boolean; onleave?: () => void; leaveLabel?: string } = $props();

  const st = $derived(v.state);
  const team = (id: string | undefined): Team => (id && v.teams[id]) || { name: "–", short: "?", color: "#888" };
  const mrx = $derived(team(st.mrx));
  const trail = $derived(v.reports.filter((r) => !r.void && r.teamId === st.mrx && r.t >= (st.mrxSince ?? 0)));
  const last = $derived(trail.at(-1));
  const locked = $derived(Object.keys(st.cuts ?? {}));
  const warned = $derived(Object.keys(st.warnCuts ?? {}));
  const running = $derived(st.phase === "laeuft" || st.phase === "pause");

  const pins = $derived<MapPin[]>([
    ...Object.entries(v.positions ?? {}).flatMap(([id, p]) => {
      const t = v.teams[id];
      return t
        ? [
            {
              key: id,
              lat: p.lat,
              lng: p.lng,
              props: {
                kind: "team" as const,
                short: t.short,
                color: t.color,
                name: t.name,
                mrx: id === st.mrx,
                big: true,
                locked: (v.locks[id]?.until ?? 0) > clock.now,
              },
            },
          ]
        : [];
    }),
    ...(last
      ? [
          {
            key: "mrx",
            lat: last.lat,
            lng: last.lng,
            props: { kind: "mrx" as const, label: uhr(last.t), sub: vor(last.t, clock.now), ping: last.t },
          },
        ]
      : []),
  ]);

  // Live-Rangliste: Zeit als Mister X (ohne Pausen) und wie oft – dieselbe Rechnung wie die Auswertung
  const res = $derived(
    st.startedAt
      ? results({
          handovers: v.handovers,
          startedAt: st.startedAt,
          endedAt: st.phase === "pause" && st.pausedAt ? st.pausedAt : clock.now,
          pauses: v.pauses,
          distM: Object.fromEntries(Object.entries(v.stats).map(([t, s]) => [t, s.distM])),
        })
      : null,
  );
  const ranking = $derived(
    Object.keys(v.teams)
      .map((id) => ({ id, ms: res?.mrxMs[id] ?? 0, n: res?.mrxCount[id] ?? 0 }))
      .filter((r) => r.n > 0)
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 6),
  );
  const playMs = $derived(st.startedAt ? activeMs(st.startedAt, clock.now, v.pauses, clock.now) : 0);

  // Ereignisse aus den Spieldaten (auch für Zuschauer, die keinen Chat sehen)
  const ticker = $derived(
    [
      ...v.reports
        .filter((r) => !r.void && r.kind !== "uebergabe")
        .map((r) => ({ id: `r${r.id}`, t: r.t, text: T.grossbild.evMeldung(team(r.teamId).name) })),
      ...v.handovers
        .filter((h) => !h.undoneAt && h.type !== "start")
        .map((h) => ({ id: `h${h.id}`, t: h.at, text: T.grossbild.evUebergabe(team(h.to).name, team(h.from).name) })),
      ...v.cutLog.map((c) => ({
        id: `c${c.id}`,
        t: c.t,
        text: (c.locked ? T.grossbild.evSperre : T.grossbild.evFrei)(v.field.cuts[c.cut]?.short ?? c.cut),
      })),
    ]
      .filter((e) => !st.startedAt || e.t >= st.startedAt)
      .sort((a, b) => b.t - a.t)
      .slice(0, 5),
  );
  // Durchsage 60 s lang groß (antippen blendet sie früher aus)
  let hidden = $state<string | null>(null);
  const announcement = $derived((v.chat ?? []).filter((m) => m.kind === "ann" && clock.now - m.t < 60_000 && m.id !== hidden).at(-1));
</script>

<main class="big" data-theme="dunkel">
  <div class="map">
    <GameMap
      field={v.field}
      {locked}
      preview={warned}
      {trail}
      {pins}
      interactive={viewer}
      alwaysNames
      padding={{ top: 40, bottom: 40, left: 40, right: 40 }}
      label={T.grossbild.karte}
    />
  </div>

  <aside>
    {#if onleave}<button class="leave" onclick={onleave}><LogOut size={18} aria-hidden="true" /> {leaveLabel ?? T.warten.abmelden}</button
      >{/if}
    <header>
      <Logo height={56} onDark />
    </header>
    <h1 class="game">{v.gameName}</h1>

    {#if !running}
      <section class="wait">
        <Hourglass size={56} aria-hidden="true" />
        <p class="display">{T.grossbild.gleich}</p>
        <p class="caps"><Users size={26} aria-hidden="true" /> {T.grossbild.teamsAngemeldet(Object.keys(v.teams).length)}</p>
      </section>
    {:else}
      <section class="mrx">
        <p class="caps">{T.status.misterX}</p>
        <div class="who">
          <TeamBadge short={mrx.short} color={mrx.color} mrx size={88} />
          <strong class="display">{mrx.name}</strong>
        </div>
      </section>

      <section class="count">
        {#if st.phase === "pause"}
          <div class="paused"><PauseIcon size={64} aria-hidden="true" /><span class="display">{T.grossbild.pause}</span></div>
        {:else if st.nextReportAt}
          <CountdownRing until={st.nextReportAt} total={v.intervalMin * 60_000} size={200} label={T.status.naechsteMeldung} />
        {/if}
        <div>
          <p class="caps">{T.status.spielzeit}</p>
          <p class="clock num">{dauer(playMs)}</p>
        </div>
      </section>

      <section class="rank">
        <p class="caps"><Trophy size={26} aria-hidden="true" /> {T.grossbild.rangliste} · {T.grossbild.zeitAlsMrx}</p>
        <ol>
          {#each ranking as r, i (r.id)}
            {@const t = team(r.id)}
            <li>
              <span class="pos num">{i + 1}</span>
              <TeamBadge short={t.short} color={t.color} size={40} mrx={r.id === st.mrx} />
              <span class="nm">{t.name}</span>
              <span class="num">{dauer(r.ms)}</span>
              <span class="num n">{r.n}×</span>
            </li>
          {/each}
        </ol>
      </section>

      <section class="ticker" aria-live="polite">
        <p class="caps">{T.grossbild.ereignisse}</p>
        {#each ticker as e (e.id)}
          <p class="ev"><time class="num">{uhr(e.t)}</time> {e.text}</p>
        {:else}
          <p class="ev">{T.grossbild.nochNichts}</p>
        {/each}
      </section>
    {/if}
  </aside>

  {#if announcement}
    <div class="ann" role="alert">
      <Megaphone size={96} aria-hidden="true" />
      <p class="caps">{T.chat.durchsage}</p>
      <p class="text display">{announcement.text}</p>
      <button class="hide" onclick={() => (hidden = announcement.id)}>{T.grossbild.ausblenden}</button>
    </div>
  {/if}
  {#if viewer}<div class="viewer"><Flag size={22} aria-hidden="true" /> {T.grossbild.zuschauer}</div>{/if}
</main>

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
  .game {
    font-family: var(--font-text);
    font-size: 26px;
    font-weight: 700;
    line-height: var(--lh);
    letter-spacing: 0;
    color: #a8bbcc;
    margin-top: -12px;
  }
  .wait {
    display: grid;
    gap: 16px;
    justify-items: start;
    margin-top: 24px;
  }
  .wait .display {
    font-size: 56px;
    line-height: 1.05;
  }
  .paused {
    display: grid;
    justify-items: center;
    gap: 8px;
    width: 200px;
    color: var(--gelb-400);
  }
  .paused .display {
    font-size: 40px;
  }
  .leave {
    align-self: flex-end;
    margin: -16px -8px -16px 0;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 12px;
    border: 0;
    background: none;
    color: #a8bbcc;
    font: inherit;
    font-size: 16px;
    text-decoration: underline;
    cursor: pointer;
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
    background: var(--mrx-rot);
    z-index: var(--z-overlay);
    animation: in var(--dur-3) var(--ease-out);
  }
  .ann .caps {
    color: #fff;
    font-size: 40px;
  }
  .ann .hide {
    margin-top: 24px;
    min-height: 48px;
    padding: 0 24px;
    border: 2px solid rgb(255 255 255 / 0.6);
    border-radius: var(--r-pill);
    background: none;
    color: #fff;
    font: inherit;
    font-size: 20px;
    cursor: pointer;
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
  /* Handy (Zuschauer, Eltern) und kleine Laptops: Karte oben, Infos darunter, kleinere Schrift */
  @media (max-width: 900px) {
    .big {
      position: static;
      min-height: 100dvh;
      grid-template-columns: 1fr;
      grid-template-rows: 55dvh auto;
    }
    aside {
      padding: 16px;
      gap: 18px;
      border-left: 0;
      border-top: 2px solid var(--nacht-700);
      overflow: visible;
    }
    .caps,
    .game {
      font-size: 16px;
    }
    .who strong {
      font-size: 36px;
    }
    .clock {
      font-size: 32px;
    }
    .rank li {
      font-size: 18px;
    }
    .ev {
      font-size: 16px;
    }
    .wait .display {
      font-size: 36px;
    }
    .ann {
      padding: 24px;
    }
    .ann .caps {
      font-size: 24px;
    }
    .ann .hide {
      margin-top: 24px;
      min-height: 48px;
      padding: 0 24px;
      border: 2px solid rgb(255 255 255 / 0.6);
      border-radius: var(--r-pill);
      background: none;
      color: #fff;
      font: inherit;
      font-size: 20px;
      cursor: pointer;
    }
    .ann .text {
      font-size: 40px;
    }
    .viewer {
      left: 12px;
      top: calc(12px + env(safe-area-inset-top, 0px));
      font-size: 15px;
      padding: 6px 12px;
    }
  }
</style>
