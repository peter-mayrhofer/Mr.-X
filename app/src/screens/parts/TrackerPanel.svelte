<!--
  Tracker (Meilenstein 11): externe Geräte – GPS-Tracker in der Fahne oder alte Handys mit „Traccar Client“ – anlegen,
  einem Team oder der Fahne zuordnen, Einrichtung anzeigen. Der Tracker der Fahne ist die erste Standortquelle für
  Mister-X-Meldungen; ein Team-Tracker hat Vorrang vor dem Handy des Teams.
-->
<script lang="ts">
  import { BatteryFull, BatteryLow, Copy, Flag, Plus, Radio, Settings2, Trash } from "@lucide/svelte";
  import type { Device, Team } from "@mrx/shared";
  import Pill from "../../ui/Pill.svelte";
  import Button from "../../ui/Button.svelte";
  import IconButton from "../../ui/IconButton.svelte";
  import TextField from "../../ui/TextField.svelte";
  import BottomSheet from "../../ui/BottomSheet.svelte";
  import Modal from "../../ui/Modal.svelte";
  import { toast } from "../../ui/toast.svelte.ts";
  import { clock } from "../../lib/clock.svelte.ts";
  import { vor } from "../../lib/format.ts";
  import { FRESH_MS } from "@mrx/shared";
  import { T } from "../../texte.ts";

  interface Props {
    gameId: string;
    devices: Record<string, Device>;
    teams: Record<string, Team>;
    /** Adresse für den Traccar Client, z. B. https://…/tracker */
    serverUrl: string;
    onadd: (name: string) => Promise<{ device: string; key: string }>;
    onassign: (device: string, assign: string | null) => Promise<void>;
    onremove: (device: string) => Promise<void>;
    onkey: (device: string) => Promise<string>;
  }
  let { gameId, devices, teams, serverUrl, onadd, onassign, onremove, onkey }: Props = $props();

  let name = $state("");
  let busy = $state(false);
  let setup = $state<{ name: string; id: string } | null>(null);
  let del = $state<{ id: string; name: string } | null>(null);
  const list = $derived(Object.entries(devices).sort(([, a], [, b]) => a.createdAt - b.createdAt));
  const teamList = $derived(Object.entries(teams).sort(([, a], [, b]) => a.name.localeCompare(b.name, "de")));

  async function add() {
    busy = true;
    try {
      const r = await onadd(name.trim());
      setup = { name: name.trim(), id: `${gameId}.${r.key}` };
      name = "";
    } catch {
      toast(T.apiFehler.network, "warn");
    } finally {
      busy = false;
    }
  }
  async function show(id: string, n: string) {
    try {
      setup = { name: n, id: `${gameId}.${await onkey(id)}` };
    } catch {
      toast(T.apiFehler.network, "warn");
    }
  }
  async function copy(s: string) {
    try {
      await navigator.clipboard.writeText(s);
      toast(T.zugang.kopiert, "ok");
    } catch {
      toast(T.zugang.nichtKopiert, "warn");
    }
  }
</script>

<div class="wrap">
  <p class="muted">{T.tracker.erklaerung}</p>
  <div class="list">
    {#each list as [id, d] (id)}
      {@const fresh = !!d.pos && clock.now - d.pos.t <= FRESH_MS}
      <article class="dev">
        <div class="head">
          <span class="ic"
            >{#if d.assign === "fahne"}<Flag size={24} aria-hidden="true" />{:else}<Radio size={24} aria-hidden="true" />{/if}</span
          >
          <div class="txt">
            <h3>{d.name}</h3>
            <p class="muted">{d.pos ? `${T.admin.zuletzt} ${vor(d.pos.t, clock.now)}` : T.tracker.nochNichts}</p>
          </div>
          <span class="pills">
            {#if fresh}<Pill tone="ok" dot>{T.tracker.sendet}</Pill>{:else}<Pill tone="neutral" dot>{T.tracker.still}</Pill>{/if}
            {#if d.pos?.battery !== undefined}<Pill
                tone={d.pos.battery < 20 ? "danger" : "neutral"}
                icon={d.pos.battery < 20 ? BatteryLow : BatteryFull}><span class="num">{d.pos.battery} %</span></Pill
              >{/if}
          </span>
        </div>
        <div class="acts">
          <label class="sel">
            <span>{T.tracker.zuordnung}</span>
            <select
              value={d.assign ?? ""}
              aria-label={T.tracker.zuordnungFuer(d.name)}
              onchange={async (e) => {
                const v = e.currentTarget.value;
                try {
                  await onassign(id, v || null);
                  toast(T.tracker.zugeordnet(d.name, v === "fahne" ? T.tracker.fahne : v ? (teams[v]?.name ?? "") : T.tracker.frei), "ok");
                } catch {
                  toast(T.apiFehler.network, "warn");
                }
              }}
            >
              <option value="">{T.tracker.frei}</option>
              <option value="fahne">{T.tracker.fahne}</option>
              {#each teamList as [tid, t] (tid)}<option value={tid}>{t.name}</option>{/each}
            </select>
          </label>
          <IconButton icon={Settings2} label={T.tracker.einrichtungFuer(d.name)} size="m" tone="plain" onclick={() => show(id, d.name)} />
          <IconButton
            icon={Trash}
            label={T.admin.entfernenWer(d.name)}
            size="m"
            tone="plain"
            onclick={() => (del = { id, name: d.name })}
          />
        </div>
      </article>
    {:else}
      <p class="muted">{T.tracker.keine}</p>
    {/each}
  </div>
  <form
    class="add"
    onsubmit={(e) => {
      e.preventDefault();
      void add();
    }}
  >
    <TextField label={T.tracker.name} bind:value={name} placeholder={T.tracker.namePlatzhalter} />
    <Button type="submit" icon={Plus} loading={busy} disabled={!name.trim()}>{T.tracker.hinzufuegen}</Button>
  </form>
</div>

<BottomSheet open={!!setup} title="{T.tracker.einrichtung}: {setup?.name ?? ''}" onclose={() => (setup = null)}>
  {#if setup}
    <ol class="steps">
      <li>{T.tracker.schritt1}</li>
      <li>
        {T.tracker.schritt2}
        <span class="val"
          ><code>{setup.id}</code><IconButton
            icon={Copy}
            label={T.zugang.kopieren}
            size="m"
            tone="plain"
            onclick={() => copy(setup!.id)}
          /></span
        >
      </li>
      <li>
        {T.tracker.schritt3}
        <span class="val"
          ><code>{serverUrl}</code><IconButton
            icon={Copy}
            label={T.zugang.kopieren}
            size="m"
            tone="plain"
            onclick={() => copy(serverUrl)}
          /></span
        >
      </li>
      <li>{T.tracker.schritt4}</li>
      <li>{T.tracker.schritt5}</li>
    </ol>
    <p class="muted">{T.tracker.geheim}</p>
  {/if}
</BottomSheet>

<Modal
  open={!!del}
  title="{del?.name} {T.allgemein.loeschen}?"
  confirm={T.allgemein.loeschen}
  danger
  onconfirm={async () => {
    const d = del;
    del = null;
    if (d) await onremove(d.id).catch(() => toast(T.apiFehler.network, "warn"));
  }}
  onclose={() => (del = null)}
>
  {T.tracker.loeschenFrage}
</Modal>

<style>
  .wrap {
    display: grid;
    gap: var(--sp-4);
  }
  .list {
    display: grid;
    gap: var(--sp-2);
  }
  .dev {
    display: grid;
    gap: var(--sp-2);
    padding: var(--sp-3);
    border: var(--border-w) solid var(--line);
    border-radius: var(--r-l);
    background: var(--surface);
  }
  .head,
  .acts {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-2) var(--sp-3);
  }
  .txt {
    flex: 1 1 140px;
    min-width: 0;
  }
  h3 {
    font-size: var(--fs-m);
  }
  .sel {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    flex: 1 1 160px;
  }
  .sel span {
    color: var(--text-2);
    font-size: var(--fs-s);
  }
  .muted {
    color: var(--text-2);
  }
  .ic {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--accent-soft);
    color: var(--accent-text);
  }
  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-1);
  }
  select {
    flex: 1;
    min-height: 44px;
    min-width: 0;
    padding: 0 var(--sp-2);
    border: var(--border-w) solid var(--line);
    border-radius: var(--r-m);
    background: var(--surface);
    color: var(--text);
    font: inherit;
  }
  .add {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
    align-items: end;
  }
  .add :global(.field) {
    flex: 1 1 220px;
  }
  .steps {
    display: grid;
    gap: var(--sp-3);
    padding-left: 1.2em;
  }
  .val {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    margin-top: var(--sp-1);
  }
  code {
    padding: 4px 8px;
    border-radius: var(--r-s);
    background: var(--surface-2);
    word-break: break-all;
    font-size: var(--fs-s);
  }
</style>
