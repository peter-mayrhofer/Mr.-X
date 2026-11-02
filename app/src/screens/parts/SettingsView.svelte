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
  import { signal } from "../../lib/signal.ts";
  import { prefs } from "../../lib/prefs.svelte.ts";
  import { NATIVE } from "../../lib/native.ts";
  import type { PushState } from "../../lib/push.svelte.ts";
  import { PUSH_KINDS } from "@mrx/shared";
  import Banner from "../../ui/Banner.svelte";
  import { T } from "../../texte.ts";

  interface Props {
    onlogout: () => void;
    /** Push auf diesem Gerät – ohne Angabe wird der Bereich nicht gezeigt (z. B. Großbild) */
    push?: PushState | undefined;
  }

  let { onlogout, push }: Props = $props();

  let choice = $state<ThemeChoice>(theme.choice);
  let confirmOut = $state(false);
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
    <Switch label={T.einstellungen.tonAn} bind:checked={prefs.sound} />
    <Button variant="secondary" size="m" icon={Volume2} onclick={() => signal("uebergabe")}>{T.einstellungen.tonTesten}</Button>
  </Card>

  {#if push}
    <Card label={T.einstellungen.push} icon={Bell}>
      {#if push.status === "an"}
        <!-- Notfälle lassen sich nicht abschalten -->
        {#each PUSH_KINDS.filter((x) => x !== "notfall") as k (k)}
          <Switch label={T.einstellungen.pushArten[k]} checked={push.prefs[k]} onchange={(on) => push.setPref(k, on)} />
        {/each}
      {:else if push.status === "aus"}
        <p class="muted hint">{T.einstellungen.pushAus}</p>
        <Button size="m" icon={Bell} onclick={() => push.enable()}>{T.einstellungen.pushEin}</Button>
      {:else if push.status === "verweigert"}
        <Banner tone="warn">{T.einstellungen.pushVerweigert}</Banner>
      {:else}
        <Banner tone="info">{T.einstellungen.pushNichtMoeglich}</Banner>
      {/if}
    </Card>
  {/if}

  <Card label={T.einstellungen.standort} icon={MapPin}>
    <!-- Hintergrund-Standort gibt es nur in der Android-App -->
    {#if NATIVE}
      <Switch
        label={T.einstellungen.hintergrund}
        hint="Dauer-Benachrichtigung „Mister X läuft – Standort wird geteilt“"
        bind:checked={prefs.background}
      />
    {/if}
    <Switch label={T.einstellungen.wach} bind:checked={prefs.wake} />
  </Card>

  <Card label={T.einstellungen.ueber} icon={Info}>
    <div class="about">
      <Logo height={40} />
      <Logo which="kinderfreunde-ooe" height={30} />
    </div>
    <p class="muted">{T.einstellungen.version} {__APP_VERSION__} · {T.app.voll}</p>
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
