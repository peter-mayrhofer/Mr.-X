<!--
  Übergabe-Moment (Abschnitt 7.3/8.5): alle sehen „Gefangen! Die Fahne geht an …“,
  das neue Mister-X-Team „Ihr seid jetzt Mister X!“, das alte „Erwischt!“.
-->
<script lang="ts">
  import { ArrowRight, Flag } from "@lucide/svelte";
  import { fade } from "svelte/transition";
  import type { Team } from "@mrx/shared";
  import Button from "../../ui/Button.svelte";
  import TeamBadge from "../../ui/TeamBadge.svelte";
  import CountdownRing from "../../ui/CountdownRing.svelte";
  import { T } from "../../texte.ts";

  interface Props {
    variant: "alle" | "neuMrx" | "erwischt";
    from: Team;
    to: Team;
    type?: "fang" | "strafe";
    waitMin: number;
    at: number;
    onclose: () => void;
  }

  let { variant, from, to, type = "fang", waitMin, at, onclose }: Props = $props();
  const stempel = $derived(variant === "erwischt" ? T.uebergabe.erwischt : type === "strafe" ? T.uebergabe.strafe : T.uebergabe.gefangen);
</script>

<div
  class="scene {variant}"
  role="alertdialog"
  aria-modal="true"
  aria-label={variant === "neuMrx" ? T.uebergabe.ihrSeidMrx : T.uebergabe.gefangen}
  transition:fade={{ duration: 200 }}
>
  {#if variant === "neuMrx"}
    <div class="flagwrap" aria-hidden="true"><Flag size={140} strokeWidth={1.6} /></div>
    <h1 class="display big">{T.uebergabe.ihrSeidMrx}</h1>
    <p class="lead">{T.uebergabe.vorsprung(waitMin)}</p>
    <CountdownRing until={at + waitMin * 60_000} total={waitMin * 60_000} size={150} tone="light" label={T.uebergabe.vorsprungKurz} />
    <Button variant="secondary" size="xl" onclick={onclose}>{T.allgemein.ok}</Button>
  {:else}
    <!-- --len: lange Wörter (z. B. „YAKALANDINIZ!“) werden kleiner, damit sie auf schmale Handys passen -->
    <p class="stamp-wrap" style:--len={stempel.length}>
      <span class="stamp" class:yellow={variant === "erwischt"}>{stempel}</span>
    </p>
    <div class="handover" aria-hidden="true">
      <TeamBadge short={from.short} color={from.color} size={72} />
      <span class="fly"><Flag size={40} strokeWidth={2.4} /></span>
      <ArrowRight size={36} />
      <TeamBadge short={to.short} color={to.color} size={88} mrx />
    </div>
    <h1 class="display">{T.uebergabe.fahneAn(to.name)}</h1>
    {#if variant === "erwischt"}<p class="lead">{T.uebergabe.erwischtText(waitMin)}</p>{/if}
    <Button size="xl" variant={variant === "erwischt" ? "warn" : "primary"} onclick={onclose}>{T.allgemein.ok}</Button>
  {/if}
</div>

<style>
  .scene {
    position: fixed;
    inset: 0;
    z-index: var(--z-overlay);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--sp-6);
    padding: var(--sp-6);
    text-align: center;
    background: radial-gradient(circle at 50% 40%, var(--nacht-700), var(--nacht-950) 70%);
    color: #fff;
  }
  .neuMrx {
    background: radial-gradient(circle at 50% 35%, #e0302a, var(--mrx-rot) 45%, var(--rot-700));
  }
  h1 {
    font-size: var(--fs-3xl);
    max-width: 16ch;
  }
  .big {
    font-size: clamp(48px, 13vw, 88px);
    text-transform: uppercase;
    line-height: 0.95;
    animation: pop 500ms var(--ease-out) both;
  }
  .lead {
    font-size: var(--fs-xl);
    font-weight: 700;
  }
  .flagwrap {
    animation: wave 1.2s var(--ease-in-out) infinite alternate;
    transform-origin: 20% 90%;
  }
  @keyframes wave {
    from {
      transform: rotate(-6deg) skewY(-3deg);
    }
    to {
      transform: rotate(4deg) skewY(3deg);
    }
  }
  .stamp-wrap {
    font-size: min(clamp(56px, 16vw, 110px), calc(150vw / var(--len, 9)));
    color: var(--rot-400);
  }
  .stamp {
    animation: stamp 450ms var(--ease-out) both;
  }
  .stamp.yellow {
    color: var(--gelb-400);
  }
  @keyframes stamp {
    from {
      transform: scale(2.4) rotate(-14deg);
      opacity: 0;
    }
    to {
      transform: scale(1) rotate(-4deg);
      opacity: 1;
    }
  }
  @keyframes pop {
    from {
      transform: scale(0.6);
      opacity: 0;
    }
  }
  .handover {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--sp-4);
  }
  .fly {
    position: absolute;
    left: 10px;
    top: -36px;
    color: #fff;
    animation: fly 1.1s 300ms var(--ease-in-out) both;
  }
  @keyframes fly {
    0% {
      transform: translate(0, 0) rotate(-20deg);
    }
    50% {
      transform: translate(80px, -50px) rotate(10deg);
    }
    100% {
      transform: translate(170px, 0) rotate(0);
      opacity: 0;
    }
  }
</style>
