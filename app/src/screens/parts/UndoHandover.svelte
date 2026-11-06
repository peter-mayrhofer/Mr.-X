<!-- „Rückgängig“ für die letzte Übergabe – nur solange die Frist läuft (Standard 2 Min), mit Rückfrage. -->
<script lang="ts">
  import { Undo2 } from "@lucide/svelte";
  import type { ApiReason } from "@mrx/shared";
  import Button from "../../ui/Button.svelte";
  import Modal from "../../ui/Modal.svelte";
  import { toast } from "../../ui/toast.svelte.ts";
  import { clock } from "../../lib/clock.svelte.ts";
  import { mmss } from "../../lib/format.ts";
  import { ApiError } from "../../lib/api.ts";
  import { undoable, type Api, type StaffView } from "../../lib/staff.ts";
  import { T } from "../../texte.ts";

  let { view, api }: { view: StaffView; api: Api } = $props();
  let ask = $state(false);
  const h = $derived(undoable(view, clock.now));

  async function undo() {
    if (!h) return;
    try {
      await api({ action: "undo", gameId: view.gameId, handoverId: h.id });
      toast(T.uebergabe.zurueck, "info");
    } catch (e) {
      toast(e instanceof ApiError && e.reason !== "invalid" ? T.apiFehler[e.reason as ApiReason | "network"] : T.apiFehler.network, "warn");
    }
  }
</script>

{#if h}
  <Button variant="secondary" block icon={Undo2} onclick={() => (ask = true)}
    >{T.schiri.rueckgaengigNoch(mmss(h.at + view.config.undoMin * 60_000 - clock.now))}</Button
  >
{/if}
<Modal
  open={ask}
  title={T.schiri.rueckgaengigFrage(view.teams[h?.to ?? ""]?.name ?? "–")}
  confirm={T.schiri.rueckgaengig}
  danger
  onconfirm={undo}
  onclose={() => (ask = false)}
/>
