<!-- Umschalter (Tabs) für 2–5 Optionen; passt die Reihe nicht, lässt sie sich seitlich wischen (kein Umbruch). -->
<script lang="ts" generics="V extends string">
  interface Props {
    options: { value: V; label: string; badge?: number }[];
    value: V;
    label: string;
    onchange?: (v: V) => void;
  }

  let { options, value = $bindable(), label, onchange }: Props = $props();

  // Sind rechts noch Reiter versteckt, blendet ein Verlauf den Rand aus: man sieht, dass es weitergeht
  let leiste: HTMLDivElement | undefined = $state();
  let mehr = $state(false);
  const messen = () => {
    if (leiste) mehr = leiste.scrollLeft + leiste.clientWidth < leiste.scrollWidth - 2;
  };
  $effect(() => {
    void options;
    messen();
    if (!leiste) return;
    const ro = new ResizeObserver(messen);
    ro.observe(leiste);
    return () => ro.disconnect();
  });
</script>

<div class="seg" class:mehr role="tablist" aria-label={label} bind:this={leiste} onscroll={messen}>
  {#each options as o (o.value)}
    <button
      role="tab"
      aria-selected={value === o.value}
      class:on={value === o.value}
      onclick={(e) => {
        value = o.value;
        onchange?.(o.value);
        // bei vielen Reitern: den gewählten ganz ins Bild holen
        e.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
      }}
    >
      {o.label}
      {#if o.badge}<span class="badge num">{o.badge}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .seg {
    display: flex;
    overflow-x: auto;
    scrollbar-width: none;
    overscroll-behavior-x: contain;
    gap: 4px;
    padding: 4px;
    border-radius: var(--r-m);
    background: var(--surface-2);
    border: var(--border-w) solid var(--line);
  }
  .seg::-webkit-scrollbar {
    display: none;
  }
  .seg.mehr {
    mask-image: linear-gradient(to right, #000 calc(100% - 36px), transparent);
  }
  button {
    flex: 1 0 auto;
    padding: 0 10px;
    white-space: nowrap;
    min-height: var(--touch);
    border: 0;
    border-radius: calc(var(--r-m) - 4px);
    background: transparent;
    color: var(--text-2);
    font-weight: 700;
    font-size: var(--fs-s);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition:
      background-color var(--dur-2) var(--ease-out),
      color var(--dur-1),
      box-shadow var(--dur-2) var(--ease-out);
  }
  @media (hover: hover) {
    button:hover:not(.on) {
      background: var(--hover);
      color: var(--text);
    }
  }
  .on {
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow-1);
  }
  :global([data-theme="sonne"]) .on {
    background: #000;
    color: #fff;
  }
  .badge {
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    border-radius: var(--r-pill);
    background: var(--accent);
    color: var(--on-accent);
    font-size: 14px;
    line-height: 22px;
  }
</style>
