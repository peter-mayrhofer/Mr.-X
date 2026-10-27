<!-- Einstellungen (Screen 22): Darstellung, Ton/Vibration, Push-Arten, Standort, Bildschirm, Abmelden. -->
<script lang="ts">
  import { Bell, LogOut, MapPin, Palette, Volume2, Info } from "@lucide/svelte";
  import Card from "../../ui/Card.svelte";
  import Segmented from "../../ui/Segmented.svelte";
  import Switch from "../../ui/Switch.svelte";
  import Button from "../../ui/Button.svelte";
  import Modal from "../../ui/Modal.svelte";
  import Logo from "../../ui/Logo.svelte";
  import { theme, type ThemeChoice } from "../../lib/theme.svelte.ts";
  import { setMuted, signal } from "../../lib/signal.ts";
  import { T } from "../../texte.ts";

  let { onlogout }: { onlogout: () => void } = $props();

  let choice = $state<ThemeChoice>(theme.choice);
  let sound = $state(true);
  let wake = $state(true);
  let bg = $state(true);
  const push = $state(Object.fromEntries(Object.keys(T.einstellungen.pushArten).map((k) => [k, true])) as Record<string, boolean>);
  let confirmOut = $state(false);

  $effect(() => setMuted(!sound));
</script>

<div class="settings">
  <Card label={T.einstellungen.darstellung} icon={Palette}>
    <Segmented
      label={T.einstellungen.darstellung}
      bind:value={choice}
      onchange={(v) => theme.set(v)}
      options={(["auto", "hell", "dunkel", "sonne"] as const).map((v) => ({ value: v, label: T.einstellungen.themes[v] }))}
    />
    <p class="muted hint">{T.einstellungen.sonneHinweis}</p>
  </Card>

  <Card label={T.einstellungen.ton} icon={Volume2}>
    <Switch label={T.einstellungen.tonAn} bind:checked={sound} />
    <Button variant="secondary" size="m" icon={Volume2} onclick={() => signal("uebergabe")}>{T.einstellungen.tonTesten}</Button>
  </Card>

  <Card label={T.einstellungen.push} icon={Bell}>
    {#each Object.entries(T.einstellungen.pushArten) as [k, label] (k)}
      <Switch {label} bind:checked={push[k]} />
    {/each}
  </Card>

  <Card label={T.einstellungen.standort} icon={MapPin}>
    <Switch label={T.einstellungen.hintergrund} hint="Dauer-Benachrichtigung „Mister X läuft – Standort wird geteilt“" bind:checked={bg} />
    <Switch label={T.einstellungen.wach} bind:checked={wake} />
  </Card>

  <Card label={T.einstellungen.ueber} icon={Info}>
    <div class="about">
      <Logo height={40} />
      <Logo which="kinderfreunde-ooe" height={30} />
    </div>
    <p class="muted">{T.einstellungen.version} 2.0.0-prototyp · {T.app.voll}</p>
    <p class="muted">{T.datenschutz.kurz}</p>
  </Card>

  <Button variant="danger" block icon={LogOut} onclick={() => (confirmOut = true)}>{T.einstellungen.abmelden}</Button>
</div>

<Modal
  open={confirmOut}
  title={T.einstellungen.abmelden}
  confirm={T.einstellungen.abmelden}
  danger
  onconfirm={onlogout}
  onclose={() => (confirmOut = false)}
>
  {T.einstellungen.abmeldenFrage}
</Modal>

<style>
  .settings {
    display: grid;
    gap: var(--sp-4);
    padding: var(--sp-4) var(--gutter) var(--sp-8);
  }
  .hint {
    margin-top: var(--sp-2);
    font-size: var(--fs-s);
  }
  .about {
    display: flex;
    align-items: center;
    gap: var(--sp-5);
    flex-wrap: wrap;
    margin-bottom: var(--sp-3);
  }
</style>
