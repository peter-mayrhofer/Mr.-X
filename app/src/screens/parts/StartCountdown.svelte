<!-- Spielstart-Inszenierung: 3 – 2 – 1 – LOS! (Abschnitt 8.5) -->
<script lang="ts">
  import { onMount } from "svelte";
  import { signal } from "../../lib/signal.ts";

  let { ondone }: { ondone: () => void } = $props();
  const STEPS = ["3", "2", "1", "Los!"];
  let i = $state(0);

  onMount(() => {
    signal("meldung");
    const t = setInterval(() => {
      if (i < STEPS.length - 1) {
        i++;
        if (i === STEPS.length - 1) signal("ende");
      } else {
        clearInterval(t);
        ondone();
      }
    }, 850);
    return () => clearInterval(t);
  });
</script>

<div class="cd" role="alert" aria-live="assertive">
  {#key i}<span class="n display" class:go={i === STEPS.length - 1}>{STEPS[i]}</span>{/key}
</div>

<style>
  .cd {
    position: fixed;
    inset: 0;
    z-index: var(--z-overlay);
    display: grid;
    place-items: center;
    background: var(--nacht-950);
    color: #fff;
  }
  .n {
    font-size: clamp(160px, 50vw, 360px);
    animation: zoom 850ms var(--ease-out) both;
  }
  .go {
    color: var(--rot-400);
    text-transform: uppercase;
    font-size: clamp(110px, 30vw, 240px);
  }
  @keyframes zoom {
    from {
      transform: scale(2);
      opacity: 0;
    }
    60% {
      opacity: 1;
    }
    to {
      transform: scale(0.9);
    }
  }
</style>
