<!-- Schalter (nativer Checkbox mit role=switch). -->
<script lang="ts">
  interface Props {
    label: string;
    hint?: string;
    checked?: boolean;
    disabled?: boolean;
    onchange?: (checked: boolean) => void;
  }

  let { label, hint, checked = $bindable(false), disabled = false, onchange }: Props = $props();
</script>

<label class="row" class:disabled>
  <span class="txt">
    <span>{label}</span>
    {#if hint}<small>{hint}</small>{/if}
  </span>
  <input type="checkbox" role="switch" bind:checked {disabled} onchange={() => onchange?.(checked)} />
</label>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    min-height: var(--touch-l);
    cursor: pointer;
  }
  .txt {
    flex: 1;
    display: grid;
  }
  small {
    color: var(--text-3);
    font-size: var(--fs-s);
  }
  .disabled {
    opacity: 0.5;
  }
  input {
    appearance: none;
    flex: none;
    width: 56px;
    height: 32px;
    border-radius: var(--r-pill);
    background: var(--surface-3);
    border: var(--border-w) solid var(--line-strong);
    position: relative;
    cursor: pointer;
    transition: background var(--dur-2);
  }
  input::after {
    content: "";
    position: absolute;
    top: 3px;
    left: 3px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.4);
    transition: translate var(--dur-2) var(--ease-out);
  }
  input:checked {
    background: var(--ok);
    border-color: var(--ok);
  }
  input:checked::after {
    translate: 24px 0;
  }
</style>
