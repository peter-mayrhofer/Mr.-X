<!--
  Router. Echte App: Start, Beitritt, Schiri/Spielleitung, Spiel, Hilfe, Verwaltung.
  Klick-Prototyp (/prototyp) und Komponenten-Seite (/komponenten) bleiben zum Nachschauen erhalten.
-->
<script lang="ts">
  import { router, match } from "./lib/router.svelte.ts";
  import Toaster from "./ui/Toaster.svelte";
  import UpdateBanner from "./screens/parts/UpdateBanner.svelte";
  import StartPage from "./pages/StartPage.svelte";
  import JoinPage from "./pages/JoinPage.svelte";
  import StaffPage from "./pages/StaffPage.svelte";
  import AutoJoinPage from "./pages/AutoJoinPage.svelte";
  import GamePage from "./pages/GamePage.svelte";
  import HelpPage from "./pages/HelpPage.svelte";
  import { session } from "./lib/session.svelte.ts";
  import { go } from "./lib/router.svelte.ts";
  import { T } from "./texte.ts";

  const p = $derived(router.path.split("?")[0]);
  const proto = $derived(match("/prototyp/:n"));
  const game = $derived(match("/s/:spiel") ?? match("/beitreten/:spiel"));
  const staff = $derived(match("/staff/:rolle"));
  const viewer = $derived(match("/z/:spiel"));
  const screen = $derived(match("/g/:spiel"));
  const archiveRun = $derived(match("/archiv/:lauf"));

  // Seitenwechsel blendet weich ein. Nur die Deckkraft: nichts verschiebt sich, feste Leisten bleiben an ihrem Platz.
  const seite = $derived(p === "/spiel" ? p : router.path);
  $effect(() => {
    void seite;
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
      document.getElementById("app")?.animate({ opacity: [0, 1] }, { duration: 220, easing: "ease-out" });
  });
</script>

<!-- Spiel-Ansicht: Bereichswechsel (?b=…) ohne Neuaufbau, damit die Live-Daten nicht neu geladen werden -->
{#key seite}
  <!-- Prototyp, Verwaltung, Archiv, Großbild: erst bei Bedarf geladen -->
  {#if proto}{#await import("./proto/ProtoScreen.svelte") then { default: ProtoScreen }}<ProtoScreen n={Number(proto.n)} />{/await}
  {:else if p === "/prototyp"}{#await import("./proto/Gallery.svelte") then { default: Gallery }}<Gallery />{/await}
  {:else if p === "/komponenten"}{#await import("./proto/Components.svelte") then { default: Components }}<Components />{/await}
  {:else if match("/s/:spiel")}<StartPage gameId={game?.spiel} />
  {:else if p === "/beitreten" || match("/beitreten/:spiel")}<JoinPage gameId={game?.spiel} />
  {:else if staff && (staff.rolle === "schiri" || staff.rolle === "admin")}<StaffPage role={staff.rolle} />
  {:else if viewer}<AutoJoinPage role="viewer" gameId={viewer.spiel!} />
  {:else if screen}<AutoJoinPage role="screen" gameId={screen.spiel!} />
  {:else if p === "/spiel"}<GamePage />
  {:else if p === "/hilfe"}<HelpPage />
  {:else if p === "/archiv" || archiveRun}
    {#await import("./pages/ArchivePage.svelte") then { default: ArchivePage }}<ArchivePage run={archiveRun?.lauf} />{/await}
  {:else if p === "/grossbild"}
    <!-- Spielleitung/Schiri zeigt das Großbild direkt auf diesem Gerät (z. B. Laptop am Beamer) -->
    {#if session.view && (session.role === "admin" || session.role === "schiri")}
      {#await import("./pages/ScreenPage.svelte") then { default: ScreenPage }}
        <ScreenPage
          gameName={session.view.info.name}
          onleave={() => go("/spiel")}
          leaveLabel={T.grossbild.zurueck}
          onarchive={() => go("/archiv")}
        />
      {/await}
    {:else}<GamePage />{/if}
  {:else if p === "/verwaltung"}{#await import("./pages/VerwaltungPage.svelte") then { default: VerwaltungPage }}<VerwaltungPage />{/await}
  {:else}<StartPage />
  {/if}
{/key}
<Toaster />
<UpdateBanner />
