<!-- Offene Notfälle für Spielleitung und Schiris: nicht zu übersehen, mit Ort (Google Maps) und „Erledigt“. -->
<script lang="ts">
  import { ExternalLink, LifeBuoy } from "@lucide/svelte";
  import type { Alert, Team } from "@mrx/shared";
  import Button from "../../ui/Button.svelte";
  import { clock } from "../../lib/clock.svelte.ts";
  import { uhr, vor } from "../../lib/format.ts";
  import type { Keyed } from "../../lib/game.svelte.ts";
  import { T } from "../../texte.ts";

  interface Props {
    alerts: Keyed<Alert>[];
    teams: Record<string, Team>;
    ondone: (id: string) => void;
  }
  let { alerts, teams, ondone }: Props = $props();
  const open = $derived(alerts.filter((a) => !a.done));
  const maps = (a: Alert) => `https://www.google.com/maps/search/?api=1&query=${a.lat!.toFixed(6)},${a.lng!.toFixed(6)}`;
</script>

{#if open.length}
  <div class="bar" role="alert">
    {#each open as a (a.id)}
      <div class="alert">
        <LifeBuoy size={30} aria-hidden="true" />
        <div class="txt">
          <strong class="display">{T.notfall.alarm(teams[a.teamId]?.name ?? "?")}</strong>
          <span>{T.notfall.seit(vor(a.t, clock.now))} · {uhr(a.t)}</span>
        </div>
        <div class="act">
          {#if a.lat !== undefined && a.lng !== undefined}
            <a class="maps" href={maps(a)} target="_blank" rel="noopener noreferrer"
              ><ExternalLink size={18} aria-hidden="true" />{T.notfall.karte}</a
            >
          {:else}
            <span class="muted">{T.notfall.ohneOrt}</span>
          {/if}
          <Button size="m" variant="secondary" onclick={() => ondone(a.id)}>{T.notfall.erledigt}</Button>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .bar {
    display: grid;
    gap: var(--sp-2);
    padding: var(--sp-2);
  }
  .alert {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--sp-4);
    border-radius: var(--r-m);
    background: var(--accent);
    color: var(--on-accent);
    box-shadow: var(--shadow-2);
    animation: pulse 1.2s ease-in-out infinite alternate;
  }
  @keyframes pulse {
    to {
      box-shadow:
        0 0 0 6px var(--accent-soft),
        var(--shadow-2);
    }
  }
  .txt {
    flex: 1;
    display: grid;
    min-width: 0;
  }
  .txt strong {
    font-size: var(--fs-xl);
  }
  .act {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
    align-items: center;
  }
  .maps {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-1);
    min-height: var(--touch);
    padding: 0 var(--sp-3);
    border-radius: var(--r-m);
    background: rgb(0 0 0 / 0.2);
    color: var(--on-accent);
    font-weight: 700;
  }
</style>
