<!-- Screen 14: Spielsteuerung & Regeln – Start/Auslosen, Zufallsende, Pause, Notstopp, Regeln live, Verkleinerung. -->
<script lang="ts">
  import { BookOpenText, Dices, Eye, OctagonX, Pause, Play, Shrink, SlidersHorizontal, Timer, Trophy } from "@lucide/svelte";
  import { LIMITS, nextReportAfterIntervalChange, type ApiReason, type Config } from "@mrx/shared";
  import GameMap from "../../map/GameMap.svelte";
  import StartCountdown from "../parts/StartCountdown.svelte";
  import Card from "../../ui/Card.svelte";
  import Button from "../../ui/Button.svelte";
  import Stepper from "../../ui/Stepper.svelte";
  import Pill from "../../ui/Pill.svelte";
  import RichText from "../../ui/RichText.svelte";
  import Modal from "../../ui/Modal.svelte";
  import TeamBadge from "../../ui/TeamBadge.svelte";
  import { toast } from "../../ui/toast.svelte.ts";
  import { clock } from "../../lib/clock.svelte.ts";
  import { dauer, uhr } from "../../lib/format.ts";
  import { ApiError } from "../../lib/api.ts";
  import type { Api, StaffView } from "../../lib/staff.ts";
  import { T } from "../../texte.ts";

  interface Props {
    view: StaffView;
    api: Api;
    /** nach dem Start (Countdown fertig) bzw. nach dem Notstopp */
    onstarted?: () => void;
    onstopped?: () => void;
  }
  let { view, api, onstarted, onstopped }: Props = $props();

  type Rule = "intervalMin" | "headStartMin" | "waitMin" | "radiusM" | "endMinH" | "endMaxH";
  // Entwurf: nur geänderte Werte, angezeigt wird sonst der aktuelle Wert vom Server
  let draft = $state<Partial<Pick<Config, Rule>>>({});
  const val = (k: Rule) => draft[k] ?? view.config[k];
  const bind = (k: Rule) => [() => val(k), (v: number) => (draft[k] = v)] as const;
  const [gInterval, sInterval] = bind("intervalMin");
  const [gHead, sHead] = bind("headStartMin");
  const [gWait, sWait] = bind("waitMin");
  const [gRadius, sRadius] = bind("radiusM");
  const [gEndMin, sEndMin] = bind("endMinH");
  const [gEndMax, sEndMax] = bind("endMaxH");

  let previewCut = $state<string | null>(null);
  let ask = $state<null | "stop" | "reveal" | "start" | { cut: string; lock: boolean }>(null);
  let revealed = $state<number | null>(null);
  let startMrx = $state<string | null>(null);
  let drawing = $state(false);
  let counting = $state(false);
  let busy = $state(false);

  const st = $derived(view.state);
  const g = $derived(view.gameId);
  const teamIds = $derived(Object.keys(view.teams));
  const before = $derived(st.phase === "vorbereitung");
  const running = $derived(st.phase === "laeuft" || st.phase === "pause");
  const locked = $derived(Object.keys(st.cuts ?? {}));
  const RULES: Rule[] = ["intervalMin", "headStartMin", "waitMin", "radiusM"];
  const changed = $derived(RULES.filter((k) => draft[k] !== undefined && draft[k] !== view.config[k]));
  const nextPreview = $derived(st.lastReportAt ? nextReportAfterIntervalChange(st.lastReportAt, val("intervalMin"), clock.now) : null);
  const cuts = $derived(Object.entries(view.field.cuts).sort((a, b) => a[1].order - b[1].order));
  const fieldReady = $derived(view.field.base.length >= 3);

  const errText = (e: unknown) =>
    e instanceof ApiError ? (e.reason === "invalid" ? e.message : T.apiFehler[e.reason as ApiReason | "network"]) : T.apiFehler.network;
  async function run<R>(fn: () => Promise<R>, okText?: string): Promise<R | undefined> {
    busy = true;
    try {
      const r = await fn();
      if (okText) toast(okText, "ok");
      return r;
    } catch (e) {
      toast(errText(e), "warn");
      return undefined;
    } finally {
      busy = false;
    }
  }

  // eigene Regeln der Spielleitung (Abschnitt 7.11): Entwurf, bis „Speichern“
  let rulesDraft = $state<string | null>(null);
  const rulesText = $derived(rulesDraft ?? view.config.rulesText ?? "");
  async function saveRules() {
    if (await run(() => api({ action: "setConfig", gameId: g, config: { rulesText } }), T.admin.regeltextGespeichert)) rulesDraft = null;
  }

  async function apply() {
    const patch = Object.fromEntries(changed.map((k) => [k, draft[k]]));
    if (await run(() => api({ action: "setConfig", gameId: g, config: patch }), T.admin.regelnGeaendert)) draft = {};
  }

  /** Hervorhebung läuft über die Teams und bleibt beim Ergebnis stehen (Auslosen macht der Server, Abschnitt 7.7) */
  function animateTo(result: string): Promise<void> {
    drawing = true;
    return new Promise((done) => {
      let n = 0;
      const target = teamIds.indexOf(result);
      const steps = teamIds.length * 2 + (target < 0 ? 0 : target) + 1;
      const t = setInterval(() => {
        startMrx = teamIds[n++ % teamIds.length]!;
        if (n >= steps) {
          clearInterval(t);
          startMrx = result;
          drawing = false;
          done();
        }
      }, 90);
    });
  }

  async function start() {
    const endPatch = Object.fromEntries(
      (["endMinH", "endMaxH", "headStartMin"] as const).filter((k) => draft[k] !== undefined).map((k) => [k, draft[k]]),
    );
    if (Object.keys(endPatch).length && !(await run(() => api({ action: "setConfig", gameId: g, config: endPatch })))) return;
    const r = await run(() => api({ action: "startGame", gameId: g, mrx: startMrx ?? "random" }));
    if (!r) return;
    draft = {};
    if (startMrx === "random" || !startMrx) await animateTo(r.mrx);
    counting = true;
  }
</script>

<div class="grid">
  {#if before}
    <Card label={T.admin.spielStarten} icon={Play} tone="accent">
      {#if !fieldReady}<p class="warnline">{T.admin.feldFehlt}</p>{/if}
      {#if teamIds.length < 2}<p class="warnline">{T.admin.zuWenigTeams}</p>{/if}
      <p class="caps sub">{T.admin.startMrx}</p>
      <div class="pick" role="radiogroup" aria-label={T.admin.startMrx}>
        {#each teamIds as id (id)}
          {@const t = view.teams[id]!}
          <button role="radio" aria-checked={startMrx === id} class:on={startMrx === id} disabled={drawing} onclick={() => (startMrx = id)}>
            <TeamBadge short={t.short} color={t.color} size={40} mrx={startMrx === id} />
            <span>{t.name}</span>
          </button>
        {/each}
      </div>
      <div class="row">
        <Button
          variant={startMrx === "random" ? "primary" : "secondary"}
          icon={Dices}
          loading={drawing}
          onclick={() => (startMrx = "random")}>{T.admin.auslosen}</Button
        >
      </div>
      <div class="steppers">
        <Stepper label={T.admin.endeFrueh} bind:value={gEndMin, sEndMin} unit="h" min={0.5} max={val("endMaxH")} step={0.5} />
        <Stepper label={T.admin.endeSpaet} bind:value={gEndMax, sEndMax} unit="h" min={val("endMinH")} max={12} step={0.5} />
      </div>
      <Button
        size="xl"
        block
        icon={Play}
        disabled={!startMrx || drawing || busy || !fieldReady || teamIds.length < 2}
        onclick={() => (ask = "start")}>{T.admin.spielStarten}</Button
      >
    </Card>
  {:else if running}
    <Card label={T.admin.spielstatus} icon={Timer}>
      <div class="status">
        {#if st.phase === "pause"}<Pill tone="warn" dot>{T.status.pause}</Pill>{:else}<Pill tone="ok" dot
            >{T.admin.laeuftSeit(uhr(st.startedAt ?? clock.now))}</Pill
          >{/if}
        <span class="num big">{dauer(clock.now - (st.startedAt ?? clock.now))}</span>
      </div>
      <div class="row">
        {#if st.phase === "pause"}
          <Button variant="secondary" icon={Play} disabled={busy} onclick={() => run(() => api({ action: "resume", gameId: g }))}
            >{T.admin.fortsetzen}</Button
          >
        {:else}
          <Button variant="secondary" icon={Pause} disabled={busy} onclick={() => run(() => api({ action: "pause", gameId: g }))}
            >{T.admin.pause}</Button
          >
        {/if}
        <Button variant="danger" icon={OctagonX} onclick={() => (ask = "stop")}>{T.admin.notstopp}</Button>
      </div>
    </Card>

    <Card label={T.admin.zufallsende} icon={Eye}>
      {#if st.startedAt}
        <p class="end">
          {T.admin.endeZwischen(uhr(st.startedAt + view.config.endMinH * 3_600_000), uhr(st.startedAt + view.config.endMaxH * 3_600_000))}
        </p>
      {/if}
      {#if revealed}
        <p class="reveal">{T.admin.geplantesEnde} <b class="num">{uhr(revealed)}</b> <Pill tone="warn">{T.admin.imProtokoll}</Pill></p>
      {:else}
        <Pill tone="info">{T.admin.geheim}</Pill>
        <div class="row"><Button variant="secondary" size="m" icon={Eye} onclick={() => (ask = "reveal")}>{T.admin.aufdecken}</Button></div>
      {/if}
    </Card>
  {:else}
    <Card label={T.admin.spielstatus} icon={Timer}>
      <Pill dot>{T.superadmin.phase.beendet}</Pill>
      <p class="muted">{T.admin.beendetHinweis}</p>
      {#if onstopped}
        <div class="row"><Button variant="secondary" size="m" icon={Trophy} onclick={onstopped}>{T.admin.auswertungZeigen}</Button></div>
      {/if}
    </Card>
  {/if}

  {#if before || running}
    <Card label={T.admin.regelnLive} icon={SlidersHorizontal}>
      <div class="steppers">
        <Stepper
          label={T.admin.intervall}
          bind:value={gInterval, sInterval}
          unit={T.allgemein.min}
          min={1}
          max={30}
          hint={running && nextPreview ? T.admin.vorschauMeldung(uhr(nextPreview)) : undefined}
        />
        {#if before}<Stepper label={T.admin.vorsprung} bind:value={gHead, sHead} unit={T.allgemein.min} min={0} max={30} />{/if}
        <Stepper label={T.admin.wartezeit} bind:value={gWait, sWait} unit={T.allgemein.min} min={0} max={20} />
        <Stepper label={T.admin.umkreis} bind:value={gRadius, sRadius} unit="m" min={25} max={1000} step={25} />
      </div>
      {#if running}<p class="muted small">{T.admin.aenderungMeldung}</p>{/if}
      <Button block disabled={!changed.length || busy} onclick={apply}>{T.admin.uebernehmen}</Button>
    </Card>

    <Card label={T.admin.regeltext} icon={BookOpenText}>
      <label class="rules" for="rules-text">{T.admin.regeltextFeld}</label>
      <textarea
        id="rules-text"
        rows="6"
        maxlength={LIMITS.rulesText}
        value={rulesText}
        oninput={(e) => (rulesDraft = e.currentTarget.value)}
        aria-describedby="rules-hint"></textarea>
      <p id="rules-hint" class="muted small">
        {T.admin.regeltextHinweis} · {T.admin.regeltextZeichen(rulesText.length, LIMITS.rulesText)}
      </p>
      {#if rulesText.trim()}
        <div class="preview" role="group" aria-label={T.admin.regeltextVorschau}><RichText text={rulesText} /></div>
      {/if}
      <Button block disabled={rulesDraft === null || busy} onclick={saveRules}>{T.allgemein.speichern}</Button>
    </Card>

    <Card label={T.admin.bereiche} icon={Shrink}>
      <div class="cuts">
        <div class="mini">
          <GameMap
            field={view.field}
            {locked}
            preview={previewCut ? [previewCut] : []}
            interactive={false}
            padding={{ top: 12, bottom: 12, left: 12, right: 12 }}
            label={T.admin.vorschauFeld}
          />
        </div>
        <ul>
          {#each cuts as [id, c] (id)}
            {@const isLocked = locked.includes(id)}
            <li onmouseenter={() => (previewCut = id)} onmouseleave={() => (previewCut = null)}>
              <span class="dot" style:background={c.color} aria-hidden="true"></span>
              <div class="cn">
                <strong>{c.short}</strong>
                {#if isLocked}<Pill tone="danger">{T.karte.gesperrt}</Pill>{:else}<Pill>{T.admin.frei}</Pill>{/if}
              </div>
              <Button
                size="m"
                variant={isLocked ? "secondary" : "danger"}
                onfocus={() => (previewCut = id)}
                onclick={() => (ask = { cut: id, lock: !isLocked })}>{isLocked ? T.admin.freigeben : T.admin.sperren}</Button
              >
            </li>
          {:else}
            <li class="muted">{T.admin.keineBereiche}</li>
          {/each}
        </ul>
      </div>
    </Card>
  {/if}
</div>

<Modal
  open={ask === "stop"}
  title={T.admin.notstopp}
  confirm={T.admin.notstopp}
  danger
  onconfirm={async () => {
    if (await run(() => api({ action: "stopGame", gameId: g }))) onstopped?.();
  }}
  onclose={() => (ask = null)}
>
  {T.admin.notstoppFrage}
</Modal>
<Modal
  open={ask === "reveal"}
  title={T.admin.aufdecken}
  confirm={T.admin.aufdecken}
  onconfirm={async () => {
    const r = await run(() => api({ action: "revealEnd", gameId: g }));
    if (r) revealed = r.endAt;
  }}
  onclose={() => (ask = null)}
>
  {T.admin.aufdeckenText}
</Modal>
<Modal open={ask === "start"} title="{T.admin.spielStarten}?" confirm={T.admin.spielStarten} onconfirm={start} onclose={() => (ask = null)}>
  {startMrx === "random" ? T.admin.startAusgelost : T.admin.startMit(view.teams[startMrx ?? ""]?.name ?? "")}
  {T.admin.startDetails(val("headStartMin"), val("endMinH"), val("endMaxH"))}
</Modal>
{#if ask && typeof ask === "object"}
  {@const id = ask.cut}
  {@const c = view.field.cuts[id]!}
  {@const lock = ask.lock}
  <Modal
    open
    title={lock ? T.verkleinerung.titel(c.short) : T.admin.freigebenFrage(c.short)}
    confirm={lock ? T.admin.sperren : T.admin.freigeben}
    danger={lock}
    onconfirm={() =>
      run(
        () => api({ action: "setCut", gameId: g, cutId: id, locked: lock }),
        lock ? T.admin.gesperrtOk(c.short) : T.verkleinerung.frei(c.short),
      )}
    onclose={() => (ask = null)}
  >
    {T.admin.aenderungMeldung}
  </Modal>
{/if}
{#if counting}<StartCountdown
    ondone={() => {
      counting = false;
      onstarted?.();
    }}
  />{/if}

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
  .warnline {
    color: var(--warn-text);
    font-weight: 700;
    margin-bottom: var(--sp-2);
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
  .rules {
    display: block;
    font-weight: 600;
    font-size: var(--fs-s);
    margin-bottom: var(--sp-1);
  }
  textarea {
    width: 100%;
    padding: var(--sp-3) var(--sp-4);
    border-radius: var(--r-m);
    border: var(--border-strong) solid var(--line);
    background: var(--surface);
    color: var(--text);
    font: inherit;
    resize: vertical;
  }
  textarea:focus-visible {
    border-color: var(--focus);
    outline: none;
  }
  .preview {
    margin: var(--sp-2) 0 var(--sp-3);
    padding: var(--sp-3) var(--sp-4);
    border-radius: var(--r-m);
    background: var(--surface-2);
    border-left: 4px solid var(--info);
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
