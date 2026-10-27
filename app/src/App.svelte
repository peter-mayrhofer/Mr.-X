<!--
  Router. Echte App: Start, Beitritt, Schiri/Spielleitung, Spiel, Hilfe, Verwaltung.
  Klick-Prototyp (/prototyp) und Komponenten-Seite (/komponenten) bleiben zum Nachschauen erhalten.
-->
<script lang="ts">
  import { router, match } from "./lib/router.svelte.ts";
  import Toaster from "./ui/Toaster.svelte";
  import Gallery from "./proto/Gallery.svelte";
  import ProtoScreen from "./proto/ProtoScreen.svelte";
  import Components from "./proto/Components.svelte";
  import StartPage from "./pages/StartPage.svelte";
  import JoinPage from "./pages/JoinPage.svelte";
  import StaffPage from "./pages/StaffPage.svelte";
  import AutoJoinPage from "./pages/AutoJoinPage.svelte";
  import GamePage from "./pages/GamePage.svelte";
  import HelpPage from "./pages/HelpPage.svelte";
  import VerwaltungPage from "./pages/VerwaltungPage.svelte";

  const p = $derived(router.path.split("?")[0]);
  const proto = $derived(match("/prototyp/:n"));
  const game = $derived(match("/s/:spiel") ?? match("/beitreten/:spiel"));
  const staff = $derived(match("/staff/:rolle"));
  const viewer = $derived(match("/z/:spiel"));
  const screen = $derived(match("/g/:spiel"));
</script>

<!-- Spiel-Ansicht: Bereichswechsel (?b=…) ohne Neuaufbau, damit die Live-Daten nicht neu geladen werden -->
{#key p === "/spiel" ? p : router.path}
  {#if proto}<ProtoScreen n={Number(proto.n)} />
  {:else if p === "/prototyp"}<Gallery />
  {:else if p === "/komponenten"}<Components />
  {:else if match("/s/:spiel")}<StartPage gameId={game?.spiel} />
  {:else if p === "/beitreten" || match("/beitreten/:spiel")}<JoinPage gameId={game?.spiel} />
  {:else if staff && (staff.rolle === "schiri" || staff.rolle === "admin")}<StaffPage role={staff.rolle} />
  {:else if viewer}<AutoJoinPage role="viewer" gameId={viewer.spiel!} />
  {:else if screen}<AutoJoinPage role="screen" gameId={screen.spiel!} />
  {:else if p === "/spiel"}<GamePage />
  {:else if p === "/hilfe"}<HelpPage />
  {:else if p === "/verwaltung"}<VerwaltungPage />
  {:else}<StartPage />
  {/if}
{/key}
<Toaster />
