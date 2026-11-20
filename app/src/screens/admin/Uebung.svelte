<!--
  Übungsspiel (E-78, nur im Probelauf): Computer-Teams anlegen und laufen lassen. Die Schritte rechnet dieser Browser
  (shared/uebung.ts) und schickt alle 5 Sekunden die neuen Standorte. Sie laufen nur, solange diese Seite offen ist.
  Übergaben, Sperren, Sofort-Meldung usw. macht die Spielleitung wie im echten Spiel.
-->
<script lang="ts">
  import { Bot, Pause, Play } from "@lucide/svelte";
  import { botSchritt, feldMitte, versetzt, type Point } from "@mrx/shared";
  import Card from "../../ui/Card.svelte";
  import Button from "../../ui/Button.svelte";
  import Stepper from "../../ui/Stepper.svelte";
  import { toast } from "../../ui/toast.svelte.ts";
  import { fehlerText } from "../../lib/api.ts";
  import { trailOf, type Api, type StaffView } from "../../lib/staff.ts";
  import { T } from "../../texte.ts";

  let { view, api }: { view: StaffView; api: Api } = $props();
  const U = T.uebung;
  const TAKT_MS = 5000;
  /** Meter pro Takt (≈ 3 m/s – zügiges Gehen bis leichtes Laufen) */
  const SCHRITT = 15;

  let anzahl = $state(4);
  let busy = $state(false);
  let laeuft = $state(false);
  const bots = $derived(Object.keys(view.teams).filter((id) => view.teams[id]!.uebung));
  // nur Rechen-Zwischenstand, nichts wird davon angezeigt
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const zustand = new Map<string, { p: Point; richtung: number }>();

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

  function takt() {
    const st = view.state;
    if (st.phase === "pause" || st.phase === "beendet") return;
    const now = Date.now();
    const locked = Object.keys(st.cuts ?? {});
    const ziel = trailOf(view).at(-1) ?? null;
    const jaeger = Object.entries(view.positions)
      .filter(([id]) => id !== st.mrx)
      .map(([, p]) => p);
    const pos: Record<string, { lat: number; lng: number }> = {};
    for (const id of bots) {
      // Wartezeit (Start, nach einem Fang): stehen bleiben wie echte Teams
      if ((view.locks[id]?.until ?? 0) > now) continue;
      const z = zustand.get(id) ?? {
        p: view.positions[id] ?? versetzt(view.field.meet ?? feldMitte(view.field), Math.random() * 360, 50 + Math.random() * 150),
        richtung: Math.random() * 360,
      };
      const r = botSchritt({ ...z, mrx: id === st.mrx, ziel, jaeger, field: view.field, locked, schritt: SCHRITT, zufall: Math.random });
      zustand.set(id, r);
      pos[id] = { lat: r.p.lat, lng: r.p.lng };
    }
    if (Object.keys(pos).length) api({ action: "uebungZug", gameId: view.gameId, pos }).catch(() => {});
  }

  $effect(() => {
    if (!laeuft) return;
    takt();
    const t = setInterval(takt, TAKT_MS);
    return () => clearInterval(t);
  });
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
    <Button size="m" icon={laeuft ? Pause : Play} variant={laeuft ? "secondary" : "primary"} onclick={() => (laeuft = !laeuft)}
      >{laeuft ? U.anhalten : U.loslaufen}</Button
    >
    {#if laeuft}<p class="muted small">{U.laeuft}</p>{/if}
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
