<!-- Kleines Mister-X-Logo (Läufer mit Fahne und Schriftzug), auf dunklem Grund automatisch die helle Version. -->
<script lang="ts">
  import { theme } from "../lib/theme.svelte.ts";

  interface Props {
    height?: number;
    onDark?: boolean;
  }

  let { height = 44, onDark }: Props = $props();
  const dark = $derived(onDark ?? theme.active === "dunkel");
</script>

<!-- width/height = Bildgröße: der Browser kennt das Seitenverhältnis vor dem Laden, nichts verrutscht -->
<img
  src="{import.meta.env.BASE_URL}logos/mister-x{dark ? '-negativ' : ''}.png"
  alt="Mister X"
  width="393"
  height="176"
  style:height="{height}px"
/>

<style>
  img {
    width: auto;
    display: block;
  }
</style>
