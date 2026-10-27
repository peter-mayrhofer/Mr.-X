<!-- Screen 14: Spielsteuerung & Regeln – Start/Auslosen, Zufallsende, Pause, Notstopp, Regeln live, Verkleinerung. -->
<script lang="ts">
  import { Dices, Eye, OctagonX, Pause, Play, Shrink, SlidersHorizontal, Timer } from "@lucide/svelte";
  import { nextReportAfterIntervalChange } from "@mrx/shared";
  import GameMap from "../../map/GameMap.svelte";
  import StartCountdown from "../parts/StartCountdown.svelte";
  import Card from "../../ui/Card.svelte";
  import Button from "../../ui/Button.svelte";
  import Stepper from "../../ui/Stepper.svelte";
  import Pill from "../../ui/Pill.svelte";
  import Modal from "../../ui/Modal.svelte";
  import TeamBadge from "../../ui/TeamBadge.svelte";
  import { toast } from "../../ui/toast.svelte.ts";
  import { clock } from "../../lib/clock.svelte.ts";
  import { dauer, uhr } from "../../lib/format.ts";
  import { go } from "../../lib/router.svelte.ts";
  import { T } from "../../texte.ts";
  import * as M from "../../proto/mock.svelte.ts";

  let { vorStart = false }: { vorStart?: boolean } = $props();

  let interval = $state(M.config.intervalMin);
  let head = $state(M.config.headStartMin);
  let wait = $state(M.config.waitMin);
  let radius = $state(M.config.radiusM);
  let endMin = $state(M.config.endMinH);
  let endMax = $state(M.config.endMaxH);
  let locked = $state([...M.game.locked]);
  let previewCut = $state<string | null>(null);
  let ask = $state<null | "stop" | "reveal" | "start" | { cut: string; lock: boolean }>(null);
  let revealed = $state<number | null>(null);
  let startMrx = $state<string | null>(null);
  let drawing = $state(false);
  let counting = $state(false);

  const changed = $derived(
    interval !== M.config.intervalMin || head !== M.config.headStartMin || wait !== M.config.waitMin || radius !== M.config.radiusM,
  );
  const nextPreview = $derived(nextReportAfterIntervalChange(M.game.lastReportAt, interval, clock.now));
  const cuts = Object.entries(M.field.cuts).sort((a, b) => a[1].order - b[1].order);

  // Auslosen mit Animation: Hervorhebung läuft über die Teams und bleibt zufällig stehen
  function draw() {
    drawing = true;
    let n = 0;
    const steps = 18 + Math.floor(Math.random() * M.teamIds.length);
    const t = setInterval(() => {
      startMrx = M.teamIds[n++ % M.teamIds.length]!;
      if (n >= steps) {
        clearInterval(t);
        drawing = false;
      }
    }, 90);
  }

  function apply() {
    M.config.intervalMin = interval;
    M.config.headStartMin = head;
    M.config.waitMin = wait;
    M.config.radiusM = radius;
    toast("Regeln geändert – alle wurden informiert", "ok");
  }
</script>

<div class="grid">
  {#if vorStart}
    <Card label={T.admin.spielStarten} icon={Play} tone="accent">
      <p class="caps sub">{T.admin.startMrx}</p>
      <div class="pick" role="radiogroup" aria-label={T.admin.startMrx}>
        {#each M.teamIds as id (id)}
          {@const t = M.teams[id]!}
          <button role="radio" aria-checked={startMrx === id} class:on={startMrx === id} disabled={drawing} onclick={() => (startMrx = id)}>
            <TeamBadge short={t.short} color={t.color} size={40} mrx={startMrx === id} />
            <span>{t.name}</span>
          </button>
        {/each}
      </div>
      <div class="row">
        <Button variant="secondary" icon={Dices} loading={drawing} onclick={draw}>{T.admin.auslosen}</Button>
      </div>
      <div class="steppers">
        <Stepper label="{T.admin.zufallsende} frühestens" bind:value={endMin} unit="h" min={1} max={endMax} step={0.5} />
        <Stepper label="{T.admin.zufallsende} spätestens" bind:value={endMax} unit="h" min={endMin} max={8} step={0.5} />
      </div>
      <Button size="xl" block icon={Play} disabled={!startMrx || drawing} onclick={() => (ask = "start")}>{T.admin.spielStarten}</Button>
    </Card>
  {:else}
    <Card label="Spielstatus" icon={Timer}>
      <div class="status">
        <Pill tone="ok" dot>läuft seit {uhr(M.game.startedAt)}</Pill>
        <span class="num big">{dauer(clock.now - M.game.startedAt)}</span>
      </div>
      <div class="row">
        <Button variant="secondary" icon={Pause} onclick={() => toast(T.allgemein.prototyp(T.admin.pause))}>{T.admin.pause}</Button>
        <Button variant="danger" icon={OctagonX} onclick={() => (ask = "stop")}>{T.admin.notstopp}</Button>
      </div>
    </Card>

    <Card label={T.admin.zufallsende} icon={Eye}>
      <p class="end">{T.admin.endeZwischen(uhr(M.game.endFrom), uhr(M.game.endTo))}</p>
      {#if revealed}
        <p class="reveal">Geplantes Ende: <b class="num">{uhr(revealed)}</b> <Pill tone="warn">im Protokoll vermerkt</Pill></p>
      {:else}
        <Pill tone="info">{T.admin.geheim}</Pill>
        <div class="row"><Button variant="secondary" size="m" icon={Eye} onclick={() => (ask = "reveal")}>{T.admin.aufdecken}</Button></div>
      {/if}
    </Card>
  {/if}

  <Card label={T.admin.regelnLive} icon={SlidersHorizontal}>
    <div class="steppers">
      <Stepper
        label={T.admin.intervall}
        bind:value={interval}
        unit={T.allgemein.min}
        min={1}
        max={30}
        hint={vorStart ? undefined : T.admin.vorschauMeldung(uhr(nextPreview))}
      />
      <Stepper label={T.admin.vorsprung} bind:value={head} unit={T.allgemein.min} min={0} max={30} />
      <Stepper label={T.admin.wartezeit} bind:value={wait} unit={T.allgemein.min} min={0} max={20} />
      <Stepper label={T.admin.umkreis} bind:value={radius} unit="m" min={25} max={1000} step={25} />
    </div>
    <p class="muted small">{T.admin.aenderungMeldung}</p>
    <Button block disabled={!changed} onclick={apply}>Übernehmen</Button>
  </Card>

  <Card label={T.admin.bereiche} icon={Shrink}>
    <div class="cuts">
      <div class="mini">
        <GameMap
          field={M.field}
          {locked}
          preview={previewCut ? [previewCut] : []}
          interactive={false}
          padding={{ top: 12, bottom: 12, left: 12, right: 12 }}
          label="Vorschau Spielfeld"
        />
      </div>
      <ul>
        {#each cuts as [id, c] (id)}
          {@const isLocked = locked.includes(id)}
          <li onmouseenter={() => (previewCut = id)} onmouseleave={() => (previewCut = null)}>
            <span class="dot" style:background={c.color} aria-hidden="true"></span>
            <div class="cn">
              <strong>{c.short}</strong>
              {#if isLocked}<Pill tone="danger">{T.karte.gesperrt}</Pill>{:else}<Pill>frei</Pill>{/if}
            </div>
            <Button
              size="m"
              variant={isLocked ? "secondary" : "danger"}
              onfocus={() => (previewCut = id)}
              onclick={() => (ask = { cut: id, lock: !isLocked })}>{isLocked ? T.admin.freigeben : T.admin.sperren}</Button
            >
          </li>
        {/each}
      </ul>
    </div>
  </Card>
</div>

<Modal
  open={ask === "stop"}
  title={T.admin.notstopp}
  confirm={T.admin.notstopp}
  danger
  onconfirm={() => go("/prototyp/19")}
  onclose={() => (ask = null)}
>
  {T.admin.notstoppFrage}
</Modal>
<Modal
  open={ask === "reveal"}
  title={T.admin.aufdecken}
  confirm={T.admin.aufdecken}
  onconfirm={() => (revealed = M.game.endFrom + 37 * 60_000)}
  onclose={() => (ask = null)}
>
  Der geheime Zeitpunkt wird angezeigt und im Protokoll vermerkt. Teams sehen ihn nicht.
</Modal>
<Modal
  open={ask === "start"}
  title="{T.admin.spielStarten}?"
  confirm={T.admin.spielStarten}
  onconfirm={() => (counting = true)}
  onclose={() => (ask = null)}
>
  {startMrx ? M.teams[startMrx]!.name : ""} ist Mister X und hat {head} Min Vorsprung. Ende zufällig zwischen {endMin} und {endMax} h.
</Modal>
{#if ask && typeof ask === "object"}
  {@const id = ask.cut}
  {@const c = M.field.cuts[id]!}
  {@const lock = ask.lock}
  <Modal
    open
    title={lock ? `Der ${c.short} wird gesperrt!` : `${c.short} wieder freigeben?`}
    confirm={lock ? T.admin.sperren : T.admin.freigeben}
    danger={lock}
    onconfirm={() => {
      locked = lock ? [...locked, id] : locked.filter((x) => x !== id);
      toast(lock ? `${c.short} gesperrt – alle wurden informiert` : `${c.short} freigegeben`, "ok");
    }}
    onclose={() => (ask = null)}
  >
    {T.admin.aenderungMeldung}
  </Modal>
{/if}
{#if counting}<StartCountdown ondone={() => go("/prototyp/13")} />{/if}

<style>
  .grid {
    display: grid;
    gap: var(--sp-4);
    padding: var(--sp-4) var(--gutter) var(--sp-8);
    max-width: 1200px;
    margin: 0 auto;
  }
  @media (min-width: 1000px) {
    .grid {
      grid-template-columns: 1fr 1fr;
      align-items: start;
      padding: var(--sp-6);
    }
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
    margin-top: var(--sp-3);
  }
  .status {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .big {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: var(--fs-3xl);
  }
  .end {
    font-size: var(--fs-xl);
    font-weight: 700;
    margin-bottom: var(--sp-2);
  }
  .reveal {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    flex-wrap: wrap;
  }
  .steppers {
    display: grid;
    gap: var(--sp-2);
    margin: var(--sp-2) 0 var(--sp-3);
  }
  .small {
    font-size: var(--fs-s);
    margin-bottom: var(--sp-3);
  }
  .sub {
    color: var(--text-2);
    margin-bottom: var(--sp-2);
  }
  .pick {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: var(--sp-2);
  }
  .pick button {
    display: grid;
    justify-items: center;
    gap: 4px;
    min-height: 84px;
    padding: var(--sp-2);
    border-radius: var(--r-m);
    border: 2px solid var(--line);
    background: var(--surface);
    color: var(--text);
    font-weight: 600;
    cursor: pointer;
  }
  .pick button.on {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .cuts {
    display: grid;
    gap: var(--sp-3);
  }
  .mini {
    position: relative;
    height: 220px;
    border-radius: var(--r-m);
    overflow: hidden;
    border: var(--border-w) solid var(--line);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--sp-2);
  }
  li {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
  }
  .dot {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    flex: none;
  }
  .cn {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    flex-wrap: wrap;
  }
</style>
