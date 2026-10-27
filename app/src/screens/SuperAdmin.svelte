<!-- Screen 21: Super-Admin – Spiele anlegen, Spiel-Admins vergeben, archivieren, löschen. -->
<script lang="ts">
  import { Archive, KeyRound, Link, Plus, Trash, ArrowRight } from "@lucide/svelte";
  import AppBar from "../ui/AppBar.svelte";
  import Button from "../ui/Button.svelte";
  import Card from "../ui/Card.svelte";
  import Pill from "../ui/Pill.svelte";
  import BottomSheet from "../ui/BottomSheet.svelte";
  import TextField from "../ui/TextField.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import Modal from "../ui/Modal.svelte";
  import { toast } from "../ui/toast.svelte.ts";
  import { go } from "../lib/router.svelte.ts";
  import { T } from "../texte.ts";
  import * as M from "../proto/mock.svelte.ts";

  let creating = $state(false);
  let name = $state("");
  let code = $state("");
  let tpl = $state<"linz" | "leer">("linz");
  let pw = $state("");
  let del = $state<string | null>(null);
  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  const TONE = { laeuft: "ok", vorbereitung: "info", archiviert: "neutral", beendet: "neutral", pause: "warn" } as const;
</script>

<div class="page">
  <AppBar title={T.superadmin.titel} onback={() => go("/prototyp/3?v=admin")}>
    {#snippet actions()}<Button size="m" icon={Plus} onclick={() => (creating = true)}>{T.superadmin.neu}</Button>{/snippet}
  </AppBar>
  <div class="body">
    <p class="who"><span class="avatar" aria-hidden="true">M</span>{T.superadmin.angemeldet("mr.x.rf.ooe@gmail.com")}</p>
    {#each M.games as g (g.id)}
      {@const phase = g.phase as keyof typeof TONE}
      <Card>
        <div class="game">
          <div class="info">
            <h2>{g.name}</h2>
            <p class="muted"><code>{g.id}</code> · {g.teams} Teams · {g.admins} Admins</p>
            <Pill tone={TONE[phase]} dot>{T.superadmin.phase[phase]}</Pill>
          </div>
          <div class="acts">
            <Button size="m" icon={ArrowRight} onclick={() => go("/prototyp/13")}>Öffnen</Button>
            <Button size="m" variant="secondary" icon={KeyRound} onclick={() => toast("Neues Admin-Passwort festgelegt", "ok")}
              >{T.superadmin.adminZugang}</Button
            >
            <Button size="m" variant="secondary" icon={Link} onclick={() => toast("Einladungslink kopiert", "ok")}
              >{T.superadmin.einladung}</Button
            >
            {#if g.phase !== "archiviert"}<Button
                size="m"
                variant="secondary"
                icon={Archive}
                onclick={() => toast(`${g.name} archiviert`, "ok")}>{T.superadmin.archivieren}</Button
              >{/if}
            <Button size="m" variant="danger" icon={Trash} onclick={() => (del = g.name)}>{T.allgemein.loeschen}</Button>
          </div>
        </div>
      </Card>
    {/each}
  </div>
</div>

<BottomSheet open={creating} title={T.superadmin.neu} onclose={() => (creating = false)}>
  <div class="form">
    <TextField label={T.superadmin.name} bind:value={name} oninput={() => (code = slug(name))} placeholder="Mister X Linz 2028" />
    <TextField label={T.superadmin.code} bind:value={code} hint="mr-x-ooe.web.app/#/s/{code || '…'}" />
    <Segmented
      label={T.superadmin.vorlage}
      bind:value={tpl}
      options={[
        { value: "linz", label: "Linz Innenstadt" },
        { value: "leer", label: "Leer" },
      ]}
    />
    <TextField
      label={T.staffLogin.adminPasswort}
      type="password"
      bind:value={pw}
      hint="mind. 8 Zeichen – an die Spielleitung weitergeben"
      autocomplete="new-password"
    />
  </div>
  {#snippet footer()}
    <Button
      block
      size="l"
      disabled={!name || !code || pw.length < 8}
      onclick={() => {
        creating = false;
        toast(`${name} angelegt`, "ok");
      }}>{T.superadmin.neu}</Button
    >
  {/snippet}
</BottomSheet>

<Modal
  open={!!del}
  title="{del} löschen?"
  confirm={T.allgemein.loeschen}
  danger
  onconfirm={() => toast(`${del} gelöscht`, "ok")}
  onclose={() => (del = null)}
>
  Alle Daten dieses Spiels inkl. Archiv werden endgültig gelöscht.
</Modal>

<style>
  .page {
    min-height: 100dvh;
  }
  .body {
    display: grid;
    gap: var(--sp-4);
    padding: var(--sp-4) var(--gutter) var(--sp-8);
    max-width: 1000px;
    margin: 0 auto;
  }
  .who {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    color: var(--text-2);
  }
  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--accent);
    color: var(--on-accent);
    font-weight: 800;
  }
  .game {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-4);
    align-items: center;
  }
  .info {
    flex: 1 1 260px;
    display: grid;
    gap: var(--sp-2);
    justify-items: start;
  }
  .acts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
  }
  .form {
    display: grid;
    gap: var(--sp-4);
  }
</style>
