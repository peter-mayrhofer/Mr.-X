<!--
  Großbild (Rolle Großbild, oder Spielleitung/Schiri über „/grossbild“) und Zuschauer: Live-Ansicht ohne Bedienung,
  nach dem Spielende die Auswertung. Was angezeigt werden darf, entscheidet der Server (Zuschauer: keine Positionen).
-->
<script lang="ts">
  import { results } from "@mrx/shared";
  import BigScreen, { type BigView } from "../screens/BigScreen.svelte";
  import Results from "../screens/Results.svelte";
  import { GameData } from "../lib/game.svelte.ts";
  import { keepAwake } from "../lib/gps.svelte.ts";
  import { T } from "../texte.ts";

  interface Props {
    gameName: string;
    viewer?: boolean;
    /** Zuschauer: abmelden; Spielleitung: zurück */
    onleave?: () => void;
    leaveLabel?: string;
    onarchive?: () => void;
  }
  let { gameName, viewer = false, onleave, leaveLabel, onarchive }: Props = $props();

  const game = new GameData();
  $effect(() => game.watch());
  keepAwake(() => !viewer);

  const v = $derived<BigView | null>(
    game.loaded
      ? {
          gameName,
          field: game.field!,
          intervalMin: game.config!.intervalMin,
          state: game.state!,
          teams: game.teams,
          positions: viewer ? undefined : game.positions,
          reports: game.reports,
          handovers: game.handovers,
          locks: game.locks,
          pauses: game.pauses,
          cutLog: game.cutLog,
          stats: game.stats,
          chat: viewer ? undefined : game.chat,
        }
      : null,
  );
  // Auswertung aus denselben Daten wie am Server (auch Zuschauer, die das Archiv nicht lesen dürfen)
  const res = $derived(
    v && v.state.phase === "beendet" && v.state.startedAt && v.state.endedAt
      ? results({
          handovers: v.handovers,
          startedAt: v.state.startedAt,
          endedAt: v.state.endedAt,
          pauses: v.pauses,
          distM: Object.fromEntries(Object.entries(v.stats).map(([t, s]) => [t, s.distM])),
        })
      : null,
  );
</script>

{#if res && v}
  <Results
    results={res}
    teams={v.teams}
    {onarchive}
    done={onleave ? { label: leaveLabel ?? T.warten.abmelden, onclick: onleave } : undefined}
  />
{:else if v}
  <BigScreen {v} {viewer} {onleave} {leaveLabel} />
{:else}
  <div class="wait" aria-busy="true" aria-label={T.allgemein.laden}></div>
{/if}

<style>
  .wait {
    min-height: 100dvh;
    background: var(--nacht-950);
  }
</style>
