<!-- Regeltext der Spielleitung (shared/regeltext.ts): Absätze, Aufzählungen, fett – nur als Text eingesetzt, nie als HTML. -->
<script lang="ts">
  import { regeltext } from "@mrx/shared";

  let { text }: { text: string } = $props();
  const blocks = $derived(regeltext(text));
</script>

<div class="rich">
  {#each blocks as b, i (i)}
    {#if "liste" in b}
      <ul>
        {#each b.liste as punkt, j (j)}
          <li>
            {#each punkt as x, k (k)}{#if x.fett}<strong>{x.t}</strong>{:else}{x.t}{/if}{/each}
          </li>
        {/each}
      </ul>
    {:else}
      <p>
        {#each b.absatz as zeile, j (j)}{#if j}<br />{/if}{#each zeile as x, k (k)}{#if x.fett}<strong>{x.t}</strong
              >{:else}{x.t}{/if}{/each}{/each}
      </p>
    {/if}
  {/each}
</div>

<style>
  .rich {
    display: grid;
    gap: var(--sp-2);
    overflow-wrap: anywhere;
  }
  ul {
    margin: 0;
    padding-left: 1.3em;
    display: grid;
    gap: var(--sp-1);
  }
  strong {
    font-weight: 800;
  }
</style>
