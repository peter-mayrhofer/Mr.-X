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
    font-weight: 600;
    font-size: var(--fs-s);
    min-height: 40px;
    padding: 0 var(--sp-3);
    border-radius: var(--r-pill);
    border: var(--border-w) solid var(--line);
    background: var(--surface);
    color: var(--text-2);
    cursor: pointer;
    transition:
      background-color var(--dur-1),
      color var(--dur-1),
      border-color var(--dur-1),
      transform var(--dur-2) var(--ease-spring);
  }
  @media (hover: hover) {
    button:hover:not(.on) {
      color: var(--text);
      border-color: var(--line-strong);
    }
  }
  button:active {
    transform: scale(0.95);
    transition-duration: 60ms;
  }
  button.on {
    background: var(--text);
    border-color: var(--text);
    color: var(--bg);
  }
</style>
