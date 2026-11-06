<!--
  Statusleiste oben (Abschnitt 7.2): in unter 2 Sekunden erfassbar.
  Jäger/Schiri: „Mister X: <Team>“ + Countdown bis zur nächsten Meldung. Mister X: roter Modus „Ihr seid Mister X!“.
-->
<script lang="ts">
  import { Clock3, Satellite, Wifi, WifiOff } from "@lucide/svelte";
  import type { Team } from "@mrx/shared";
  import CountdownRing from "../../ui/CountdownRing.svelte";
  import TeamBadge from "../../ui/TeamBadge.svelte";
  import Pill from "../../ui/Pill.svelte";
  import { clock } from "../../lib/clock.svelte.ts";
  import { dauer, uhr } from "../../lib/format.ts";
  import { T } from "../../texte.ts";

  interface Props {
    mrxTeam: Team;
    isMrx?: boolean;
    nextReportAt: number;
    intervalMs: number;
    startedAt: number;
    online?: boolean;
    lastDataAt?: number;
    gpsAcc?: number | undefined;
    role?: "team" | "schiri" | "admin";
    paused?: boolean;
  }

  let {
    mrxTeam,
    isMrx = false,
    nextReportAt,
    intervalMs,
    startedAt,
    online = true,
    lastDataAt,
    gpsAcc,
    role = "team",
    paused = false,
  }: Props = $props();
  const gps = $derived(gpsAcc === undefined ? T.status.gpsAus : gpsAcc <= 30 ? T.status.gpsGut : T.status.gpsSchwach);
</script>

<section class="status" class:mrx={isMrx} aria-label="Spielstatus">
  <div class="main">
    {#if isMrx}
      <p class="etikett kicker">{T.status.ihrSeidMrx}</p>
      <p class="sub">{T.status.eureMeldung}</p>
    {:else}
      <div class="who">
        <TeamBadge short={mrxTeam.short} color={mrxTeam.color} mrx size={44} />
        <div>
          <p class="etikett kicker">{role === "schiri" ? `${T.status.misterX} · ${T.status.schiri}` : T.status.misterX}</p>
          <p class="team display">{mrxTeam.name}</p>
        </div>
      </div>
    {/if}
    <div class="pills">
      {#if online}
        <Pill tone="ok" icon={Wifi}>{T.status.online}</Pill>
      {:else}
        <Pill tone="danger" icon={WifiOff}>{lastDataAt ? T.status.offlineSeit(uhr(lastDataAt)) : T.status.offline}</Pill>
      {/if}
      {#if role !== "admin"}
        <Pill tone={gpsAcc === undefined ? "danger" : gpsAcc <= 30 ? "neutral" : "warn"} icon={Satellite}>{gps}</Pill>
      {/if}
      <Pill icon={Clock3}><span class="num">{dauer(clock.now - startedAt)}</span></Pill>
    </div>
  </div>
  <div class="count">
    {#if paused}
      <p class="paused display">{T.status.pause}</p>
    {:else}
      <CountdownRing
        until={nextReportAt}
        total={intervalMs}
        size={isMrx ? 104 : 96}
        label={T.status.naechsteMeldung}
        tone={isMrx ? "light" : "accent"}
      />
      {#if !isMrx}<p class="etikett lbl">{T.status.naechsteMeldung}</p>{/if}
    {/if}
  </div>
</section>

<style>
  .status {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--sp-3) var(--sp-3) var(--sp-4);
    border-radius: var(--r-l);
    background: var(--glass);
    border: var(--border-w) solid var(--line);
    box-shadow: var(--shadow-2);
    backdrop-filter: blur(10px);
  }
  .main {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: var(--sp-2);
  }
  .who {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
  }
  .kicker {
    color: var(--accent-text);
    font-size: var(--fs-s);
  }
  .team {
    font-size: var(--fs-2xl);
    line-height: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-1) var(--sp-4);
  }
  .pills :global(.pill) {
    min-height: 0;
    padding: 0;
    border: 0;
    background: none;
  }
  .count {
    display: grid;
    justify-items: center;
    gap: 2px;
  }
  .lbl {
    color: var(--text-2);
  }
  .paused {
    font-size: var(--fs-2xl);
    color: var(--warn-text);
    padding: var(--sp-4);
  }
  .mrx {
    background: var(--accent);
    border-color: #fff;
    color: #fff;
  }
  .mrx .kicker {
    color: #fff;
    font-size: var(--fs-xl);
    line-height: 1;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .mrx .sub {
    font-weight: 600;
  }
  .mrx :global(.pill) {
    color: #fff;
  }
</style>
