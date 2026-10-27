<!-- Umschalter (Tabs) für 2–4 Optionen. -->
<script lang="ts" generics="V extends string">
  interface Props {
    options: { value: V; label: string; badge?: number }[];
    value: V;
    label: string;
    onchange?: (v: V) => void;
  }

  let { options, value = $bindable(), label, onchange }: Props = $props();
</script>

<div class="seg" role="tablist" aria-label={label}>
  {#each options as o (o.value)}
    <button
      role="tab"
      aria-selected={value === o.value}
      class:on={value === o.value}
      onclick={() => {
        value = o.value;
        onchange?.(o.value);
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
    flex-wrap: wrap;
    gap: 4px;
    padding: 4px;
    border-radius: var(--r-m);
    background: var(--surface-2);
    border: var(--border-w) solid var(--line);
  }
  button {
    flex: 1 1 auto;
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
    transition: background var(--dur-1);
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
