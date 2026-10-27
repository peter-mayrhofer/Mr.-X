<!--
  Wartezeit (Abschnitt 7.2): bildschirmfüllend, großer Countdown, nicht übersehbar.
  Warnband-Rahmen in Gelb/Schwarz; „Karte ansehen“ blendet kurz aus, ein Band bleibt oben sichtbar.
-->
<script lang="ts">
  import { Hand, Map } from "@lucide/svelte";
  import { fade } from "svelte/transition";
  import Button from "../../ui/Button.svelte";
  import { clock } from "../../lib/clock.svelte.ts";
  import { mmss, uhr } from "../../lib/format.ts";
  import { T } from "../../texte.ts";

  interface Props {
    until: number;
    total: number;
    reason?: "uebergabe" | "start" | "alterMrx";
  }

  let { until, total, reason = "uebergabe" }: Props = $props();
  let peek = $state(false);
  const left = $derived(Math.max(0, until - clock.now));
  const text = $derived(
    reason === "start" ? T.wartezeit.grundStart : reason === "alterMrx" ? T.wartezeit.grundAlterMrx : T.wartezeit.grund,
  );
</script>

{#if left > 0}
  {#if peek}
    <button class="strip" onclick={() => (peek = false)} transition:fade={{ duration: 150 }}>
      <Hand size={22} aria-hidden="true" />
      <span>{T.wartezeit.titel}</span>
      <span class="num">{mmss(left)}</span>
    </button>
  {:else}
    <div class="lock" role="alertdialog" aria-modal="true" aria-label={T.wartezeit.titel} transition:fade={{ duration: 200 }}>
      <div class="inner">
        <span class="icon"><Hand size={64} strokeWidth={2.2} aria-hidden="true" /></span>
        <h1 class="caps title">{T.wartezeit.titel}</h1>
        <p class="time num" role="timer">{mmss(left)}</p>
        <div class="bar" aria-hidden="true"><i style:width="{(1 - left / total) * 100}%"></i></div>
        <p class="why">{text}</p>
        <p class="when">{T.wartezeit.weiterUm(uhr(until))}</p>
        <Button variant="secondary" icon={Map} onclick={() => (peek = true)}>{T.wartezeit.karte}</Button>
      </div>
    </div>
  {/if}
{/if}

<style>
  .lock {
    position: fixed;
    inset: 0;
    z-index: var(--z-overlay);
    display: grid;
    place-items: center;
    padding: 14px;
    background: repeating-linear-gradient(-45deg, #ffc531 0 28px, #111 28px 56px);
  }
  .inner {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--sp-4);
    padding: var(--sp-6);
    border-radius: var(--r-l);
    background: var(--bg);
    text-align: center;
  }
  .icon {
    display: grid;
    place-items: center;
    width: 112px;
    height: 112px;
    border-radius: 50%;
    background: var(--warn);
    color: var(--on-warn);
  }
  .title {
    font-size: var(--fs-3xl);
    line-height: 1;
  }
  .time {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: clamp(96px, 30vw, 180px);
    line-height: 0.9;
  }
  .bar {
    width: min(100%, 360px);
    height: 12px;
    border-radius: 6px;
    background: var(--surface-2);
    overflow: hidden;
  }
  .bar i {
    display: block;
    height: 100%;
    background: var(--warn);
    transition: width 1s linear;
  }
  .why {
    font-size: var(--fs-l);
    max-width: 30ch;
  }
  .when {
    color: var(--text-2);
  }
  .strip {
    position: fixed;
    top: calc(var(--safe-top) + 8px);
    left: 50%;
    translate: -50% 0;
    z-index: var(--z-overlay);
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    min-height: var(--touch-l);
    padding: 0 var(--sp-5);
    border: 3px solid #111;
    border-radius: var(--r-pill);
    background: var(--warn);
    color: #111;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: var(--fs-xl);
    text-transform: uppercase;
    box-shadow: var(--shadow-2);
    cursor: pointer;
  }
</style>
