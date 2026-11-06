<!--
  Übergabe-Ablauf (Abschnitt 7.4) für Schiri und Spielleitung: Team wählen (nach Nähe sortiert) → Art → Vorschau, wer
  warten muss → Bestätigen. Der Server prüft alles noch einmal (nur wenn Mister X noch derselbe ist, E-25).
-->
<script lang="ts">
  import { Flag, Hourglass } from "@lucide/svelte";
  import { distanceM, type ApiReason } from "@mrx/shared";
  import BottomSheet from "../../ui/BottomSheet.svelte";
  import Segmented from "../../ui/Segmented.svelte";
  import ListItem from "../../ui/ListItem.svelte";
  import TeamBadge from "../../ui/TeamBadge.svelte";
  import Pill from "../../ui/Pill.svelte";
  import Modal from "../../ui/Modal.svelte";
  import Button from "../../ui/Button.svelte";
  import { toast } from "../../ui/toast.svelte.ts";
  import { clock } from "../../lib/clock.svelte.ts";
  import { meter, vor } from "../../lib/format.ts";
  import { signal } from "../../lib/signal.ts";
  import { ApiError } from "../../lib/api.ts";
  import { isOffline, lockPreview, requestId, type Api, type StaffView } from "../../lib/staff.ts";
  import { T } from "../../texte.ts";

  interface Props {
    view: StaffView;
    api: Api;
    open: boolean;
    preset?: string | null;
  }
  let { view, api, open = $bindable(), preset = null }: Props = $props();

  // svelte-ignore state_referenced_locally
  let pick = $state<string | null>(preset);
  let kind = $state<"fang" | "strafe">("fang");
  let confirm = $state(false);
  let busy = $state(false);

  const unknown = { name: "–", short: "?", color: "#888" };
  const team = (id: string | null | undefined) => (id && view.teams[id]) || unknown;
  const mrx = $derived(view.state.mrx ?? null);
  const anchor = $derived((mrx ? view.positions[mrx] : undefined) ?? view.me);
  const byDistance = $derived(
    Object.keys(view.teams)
      .filter((id) => id !== mrx)
      .map((id) => {
        const p = view.positions[id];
        return { id, d: p && anchor ? distanceM(p, anchor) : Infinity, offline: isOffline(p, clock.now) };
      })
      .sort((a, b) => a.d - b.d),
  );
  const preview = $derived(pick ? lockPreview(view, pick, clock.now) : []);

  async function doHandover() {
    if (!pick || !mrx) return;
    busy = true;
    try {
      const r = await api({ action: "handover", gameId: view.gameId, to: pick, type: kind, expectedMrx: mrx, requestId: requestId() });
      signal("uebergabe");
      const names = r.locked.map((id) => team(id).name).join(", ");
      toast(`${T.schiri.gespeichert}${names ? ` · ${T.schiri.vorschau(view.config.waitMin)} ${names}` : ""}`, "ok");
      open = false;
      pick = null;
    } catch (e) {
      toast(e instanceof ApiError && e.reason !== "invalid" ? T.apiFehler[e.reason as ApiReason | "network"] : T.apiFehler.network, "warn");
    } finally {
      busy = false;
    }
  }
</script>

<BottomSheet {open} title={T.schiri.uebergabe} onclose={() => (open = false)}>
  <h3 class="step"><span class="n">1</span>{T.schiri.schritt1}</h3>
  <p class="muted small">{T.schiri.schritt1Hinweis}</p>
  <div class="picklist">
    {#each byDistance as x (x.id)}
      {@const t = team(x.id)}
      {@const p = view.positions[x.id]}
      <ListItem
        title={t.name}
        subtitle={x.offline ? `${T.schiri.keinStandort}${p ? ` · ${vor(p.t, clock.now)}` : ""}` : T.schiri.entfernt(meter(x.d))}
        selected={pick === x.id}
        onclick={() => (pick = x.id)}
      >
        {#snippet lead()}<TeamBadge short={t.short} color={t.color} size={44} offline={x.offline} />{/snippet}
        {#snippet trail()}{#if (view.locks[x.id]?.until ?? 0) > clock.now}<Pill tone="warn" icon={Hourglass}>{T.schiri.wartet}</Pill
            >{/if}{/snippet}
      </ListItem>
    {/each}
  </div>
  <h3 class="step"><span class="n">2</span>{T.schiri.schritt2}</h3>
  <Segmented
    label={T.schiri.schritt2}
    bind:value={kind}
    options={[
      { value: "fang", label: T.schiri.fang },
      { value: "strafe", label: T.schiri.strafe },
    ]}
  />
  {#if pick}
    <div class="preview">
      <p class="caps">{T.schiri.vorschau(view.config.waitMin)}</p>
      <div class="chips">
        {#each preview as id (id)}
          {@const t = team(id)}
          <span class="chip"><TeamBadge short={t.short} color={t.color} size={28} locked />{t.name}</span>
        {/each}
      </div>
    </div>
  {/if}
  {#snippet footer()}
    <Button size="xl" block icon={Flag} disabled={!pick || busy} loading={busy} onclick={() => (confirm = true)}
      >{pick ? T.schiri.bestaetigen(team(pick).name) : T.schiri.schritt1}</Button
    >
  {/snippet}
</BottomSheet>

<Modal
  open={confirm}
  title={pick ? T.schiri.bestaetigen(team(pick).name) + "?" : ""}
  confirm={T.allgemein.bestaetigen}
  onconfirm={doHandover}
  onclose={() => (confirm = false)}
>
  {kind === "fang" ? T.schiri.fang : T.schiri.strafe} · {T.schiri.vorschau(view.config.waitMin)}
  {preview.map((id) => team(id).name).join(", ") || "–"}
</Modal>

<style>
  .step {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    margin-top: var(--sp-3);
  }
  .n {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--accent);
    color: var(--on-accent);
    font-size: 18px;
  }
  .small {
    font-size: var(--fs-s);
    margin-bottom: var(--sp-2);
  }
  .picklist {
    display: grid;
    gap: 2px;
    margin-bottom: var(--sp-3);
  }
  .preview {
    margin-top: var(--sp-4);
    padding: var(--sp-3);
    border-radius: var(--r-m);
    background: var(--warn-soft);
    border: 2px solid var(--warn);
  }
  .preview .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-3);
    margin-top: var(--sp-2);
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex: none;
    font-weight: 600;
  }
</style>
