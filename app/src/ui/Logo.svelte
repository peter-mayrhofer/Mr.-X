<!-- Logos der Roten Falken / Kinderfreunde, auf dunklem Grund automatisch die Negativ-Version. -->
<script lang="ts">
  import { theme } from "../lib/theme.svelte.ts";

  interface Props {
    which?: "rote-falken" | "kinderfreunde-ooe";
    height?: number;
    onDark?: boolean;
  }

  let { which = "rote-falken", height = 44, onDark }: Props = $props();
  const dark = $derived(onDark ?? theme.active === "dunkel");
  const alt = $derived(which === "rote-falken" ? "Rote Falken" : "Die Kinderfreunde Oberösterreich");
</script>

<img src="{import.meta.env.BASE_URL}logos/{which}{dark ? '-negativ' : ''}.png" {alt} style:height="{height}px" />

<style>
  img {
    width: auto;
    display: block;
  }
</style>
