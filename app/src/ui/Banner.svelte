<!--
  Hinweis-Leiste. Nie nur Farbe: immer Icon + Text.
  ann = Durchsage (auffällig rot), mrx = Mister-X-Modus.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { Info, Megaphone, TriangleAlert, OctagonX, CircleCheck, Flag } from "@lucide/svelte";
  import type { Icon } from "./icons.ts";

  type Tone = "info" | "warn" | "danger" | "ok" | "ann" | "mrx";
  interface Props {
    tone?: Tone;
    title?: string;
    icon?: Icon;
    children?: Snippet;
    action?: Snippet;
    live?: boolean;
  }

  const DEFAULT: Record<Tone, Icon> = { info: Info, warn: TriangleAlert, danger: OctagonX, ok: CircleCheck, ann: Megaphone, mrx: Flag };
  let { tone = "info", title, icon, children, action, live = false }: Props = $props();
  const IconC = $derived(icon ?? DEFAULT[tone]);
</script>

<div class="banner {tone}" role={live ? (tone === "danger" || tone === "ann" ? "alert" : "status") : undefined}>
  <IconC size={26} strokeWidth={2.4} aria-hidden="true" />
  <div class="body">
    {#if title}<strong class="title">{title}</strong>{/if}
    {#if children}<div class="text">{@render children()}</div>{/if}
  </div>
  {#if action}<div class="action">{@render action()}</div>{/if}
</div>

<style>
  .banner {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--sp-4);
    border-radius: var(--r-m);
    border: var(--border-strong) solid transparent;
    box-shadow: var(--shadow-1);
  }
  .body {
    flex: 1;
    min-width: 0;
  }
  .title {
    display: block;
    font-family: var(--font-display);
    font-size: var(--fs-l);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    line-height: 1.1;
  }
  .text {
    font-size: var(--fs-s);
  }
  .info {
    background: var(--surface);
    border-color: var(--info);
    color: var(--text);
  }
  .info > :global(svg) {
    color: var(--info-text);
  }
  .warn {
    background: var(--warn);
    color: var(--on-warn);
  }
  .danger,
  .ann,
  .mrx {
    background: var(--accent);
    color: var(--on-accent);
  }
  .ann {
    border-color: #fff;
    outline: 3px solid var(--accent);
  }
  .ok {
    background: var(--ok);
    color: #fff;
  }
</style>
