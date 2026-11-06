<!-- Runder Symbol-Knopf (Kartensteuerung, Kopfzeile). label ist Pflicht → Screenreader + Tooltip. -->
<script lang="ts">
  import type { HTMLButtonAttributes } from "svelte/elements";
  import type { Icon } from "./icons.ts";

  interface Props extends HTMLButtonAttributes {
    icon: Icon;
    label: string;
    size?: "m" | "l";
    tone?: "glass" | "accent" | "plain";
    active?: boolean;
  }

  let { icon: IconC, label, size = "l", tone = "glass", active = false, ...rest }: Props = $props();
</script>

<button class="ib {size} {tone}" class:active aria-label={label} title={label} aria-pressed={active || undefined} {...rest}>
  <IconC size={size === "l" ? 26 : 22} strokeWidth={2.3} aria-hidden="true" />
</button>

<style>
  .ib {
    display: grid;
    place-items: center;
    width: var(--touch);
    height: var(--touch);
    border-radius: var(--r-pill);
    border: var(--border-w) solid var(--line);
    cursor: pointer;
    transition: transform var(--dur-1) var(--ease-out);
  }
  .ib:active {
    transform: scale(0.92);
  }
  .l {
    width: var(--touch-l);
    height: var(--touch-l);
  }
  .glass {
    background: var(--glass);
    color: var(--text);
    box-shadow: var(--shadow-1);
    backdrop-filter: blur(8px);
  }
  .plain {
    background: transparent;
    border-color: transparent;
    color: var(--text);
  }
  .accent,
  .active {
    background: var(--accent);
    color: var(--on-accent);
    border-color: var(--accent);
  }
</style>
