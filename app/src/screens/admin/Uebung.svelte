<!--
  Übungsspiel (E-78, nur im Probelauf): Computer-Teams anlegen und laufen lassen. Die Schritte rechnet dieser Browser
  (lib/uebung.svelte.ts) und schickt alle 5 Sekunden die neuen Standorte – auch während man in „Live“ zuschaut.
  Übergaben, Sperren, Sofort-Meldung usw. macht die Spielleitung wie im echten Spiel.
-->
<script lang="ts">
  import { Bot, Pause, Play } from "@lucide/svelte";
  import Card from "../../ui/Card.svelte";
  import Button from "../../ui/Button.svelte";
  import Stepper from "../../ui/Stepper.svelte";
  import { toast } from "../../ui/toast.svelte.ts";
  import { fehlerText } from "../../lib/api.ts";
  import { uebung } from "../../lib/uebung.svelte.ts";
  import type { Api, StaffView } from "../../lib/staff.ts";
  import { T } from "../../texte.ts";

  let { view, api }: { view: StaffView; api: Api } = $props();
  const U = T.uebung;

  let anzahl = $state(4);
  let busy = $state(false);
  const bots = $derived(Object.keys(view.teams).filter((id) => view.teams[id]!.uebung));

  async function anlegen() {
    busy = true;
    try {
      const { neu } = await api({ action: "uebungTeams", gameId: view.gameId, anzahl });
      toast(U.angelegt(neu), "ok");
    } catch (e) {
      toast(fehlerText(e), "warn");
    } finally {
      busy = false;
    }
  }
</script>

<Card label={U.titel} icon={Bot}>
  <p class="muted small">{U.hinweis}</p>
  {#if view.state.phase === "vorbereitung"}
    <div class="row">
      <Stepper label={U.anzahl} bind:value={anzahl} unit="" min={1} max={8} />
      <Button size="m" variant="secondary" icon={Bot} loading={busy} onclick={anlegen}>{U.anlegen}</Button>
    </div>
  {/if}
  {#if bots.length}
    <p class="small">{U.vorhanden(bots.map((id) => view.teams[id]!.name).join(", "))}</p>
    <Button
      size="m"
      icon={uebung.laeuft ? Pause : Play}
      variant={uebung.laeuft ? "secondary" : "primary"}
      onclick={() => (uebung.laeuft = !uebung.laeuft)}>{uebung.laeuft ? U.anhalten : U.loslaufen}</Button
    >
    {#if uebung.laeuft}<p class="muted small">{U.laeuft}</p>{/if}
  {/if}
</Card>

<style>
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-3);
    align-items: center;
    margin: var(--sp-3) 0;
  }
  .small {
    font-size: 14px;
  }
</style>
