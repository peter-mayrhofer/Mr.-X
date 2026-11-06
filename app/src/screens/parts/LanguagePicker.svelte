<!-- Sprache der Team-Oberfläche wählen (lib/sprache.ts); lädt die App in der neuen Sprache neu -->
<script lang="ts">
  import { SPRACHEN, sprache, setSprache } from "../../lib/sprache.ts";
  import { T } from "../../texte.ts";

  interface Props {
    /** kurze Namen (Startseite) */
    kurz?: boolean;
  }
  let { kurz = false }: Props = $props();
</script>

<div class="sprachen" role="group" aria-label={T.einstellungen.sprache}>
  {#each SPRACHEN as s (s.code)}
    <button
      type="button"
      class:on={s.code === sprache}
      aria-pressed={s.code === sprache}
      lang={s.code === "bks" ? "bs" : s.code}
      onclick={() => s.code !== sprache && setSprache(s.code)}>{kurz && "kurz" in s ? s.kurz : s.name}</button
    >
  {/each}
</div>

<style>
  .sprachen {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
  }
  button {
    font: inherit;
    font-weight: 600;
    min-height: 44px;
    padding: var(--sp-2) var(--sp-3);
    border-radius: var(--r-pill, 999px);
    border: 1px solid var(--border, rgb(128 128 128 / 0.4));
    background: var(--surface, transparent);
    color: var(--text);
    cursor: pointer;
  }
  button.on {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
</style>
