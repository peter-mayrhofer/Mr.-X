<!--
  Marker auf der Karte. kind:
  team = Abzeichen (+ Name), me = eigener Standort (blau, Richtungspfeil), mrx = letzte Meldung (rot, Fahne, pulsierend),
  staff = Schiri.
-->
<script module lang="ts">
  export interface MarkerProps {
    kind: "team" | "me" | "mrx" | "staff";
    short?: string;
    color?: string;
    name?: string;
    label?: string;
    sub?: string;
    mrx?: boolean;
    locked?: boolean;
    offline?: boolean;
    heading?: number;
    /** neue Meldung → Radar-Ping */
    ping?: number;
    big?: boolean;
  }
</script>

<script lang="ts">
  import { Flag, Navigation2, ShieldCheck } from "@lucide/svelte";
  import TeamBadge from "../ui/TeamBadge.svelte";

  let p: MarkerProps = $props();
</script>

{#if p.kind === "team"}
  <div class="team" class:big={p.big}>
    <TeamBadge short={p.short ?? "?"} color={p.color ?? "#555"} size={p.big ? 52 : 38} mrx={p.mrx} locked={p.locked} offline={p.offline} />
    {#if p.name}<span class="name" class:mrx={p.mrx}>{p.name}</span>{/if}
  </div>
{:else if p.kind === "me"}
  <div class="me" role="img" aria-label={p.label}>
    {#if p.heading !== undefined}
      <span class="heading" style:rotate="{p.heading}deg"
        ><Navigation2 size={30} fill="currentColor" strokeWidth={1} aria-hidden="true" /></span
      >
    {/if}
    <span class="dot"></span>
  </div>
{:else if p.kind === "mrx"}
  <div class="mrx-pin">
    {#key p.ping}<span class="ping" aria-hidden="true"></span>{/key}
    <span class="pulse" aria-hidden="true"></span>
    <span class="flag"><Flag size={26} strokeWidth={2.6} aria-hidden="true" /></span>
    {#if p.label}
      <span class="tag">
        <strong>{p.label}</strong>
        {#if p.sub}<small>{p.sub}</small>{/if}
      </span>
    {/if}
  </div>
{:else}
  <div class="staff" title={p.name}>
    <ShieldCheck size={20} strokeWidth={2.6} aria-hidden="true" />
    {#if p.name}<span class="name">{p.name}</span>{/if}
  </div>
{/if}

<style>
  .team {
    display: grid;
    justify-items: center;
    gap: 2px;
  }
  .name {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 15px;
    padding: 1px 6px;
    border-radius: 6px;
    background: var(--glass);
    color: var(--text);
    white-space: nowrap;
    box-shadow: var(--shadow-1);
  }
  .name.mrx {
    background: var(--mrx-rot);
    color: #fff;
  }
  .big .name {
    font-size: 20px;
  }
  .me {
    position: relative;
    width: 26px;
    height: 26px;
    display: grid;
    place-items: center;
  }
  .dot {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--me);
    border: 3px solid #fff;
    box-shadow:
      0 0 0 2px var(--me),
      0 2px 6px rgb(0 0 0 / 0.4);
  }
  .heading {
    position: absolute;
    inset: -16px;
    display: grid;
    place-items: start center;
    color: var(--me);
  }
  .mrx-pin {
    position: relative;
    width: 48px;
    height: 48px;
    display: grid;
    place-items: center;
  }
  .flag {
    position: relative;
    z-index: 1;
    width: 46px;
    height: 46px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--mrx-rot);
    color: #fff;
    border: 3px solid #fff;
    box-shadow: 0 2px 10px rgb(0 0 0 / 0.5);
  }
  .pulse,
  .ping {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 3px solid var(--mrx-rot);
  }
  .pulse {
    animation: pulse 2s var(--ease-out) infinite;
  }
  .ping {
    border-width: 4px;
    animation: ping 1.6s var(--ease-out) 3;
  }
  @keyframes pulse {
    from {
      transform: scale(1);
      opacity: 0.9;
    }
    to {
      transform: scale(2.4);
      opacity: 0;
    }
  }
  @keyframes ping {
    from {
      transform: scale(1);
      opacity: 1;
    }
    to {
      transform: scale(6);
      opacity: 0;
    }
  }
  .tag {
    position: absolute;
    left: 50%;
    bottom: calc(100% + 6px);
    translate: -50% 0;
    display: grid;
    justify-items: center;
    padding: 4px 10px;
    border-radius: 10px;
    background: var(--mrx-rot);
    color: #fff;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgb(0 0 0 / 0.4);
    font-family: var(--font-display);
    line-height: 1.1;
  }
  .tag strong {
    font-size: 18px;
  }
  .tag small {
    font-size: 14px;
    opacity: 0.9;
  }
  .staff {
    display: grid;
    justify-items: center;
    gap: 2px;
    color: #fff;
  }
  .staff > :global(svg) {
    width: 30px;
    height: 30px;
    padding: 5px;
    border-radius: 50%;
    background: #333d47;
    border: 2px solid #fff;
  }
</style>
