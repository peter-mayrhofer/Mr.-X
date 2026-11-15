<!--
  „/posten/:spiel/:code“: Bonus-Posten einlösen (E-75). Kommt vom QR-Scanner im Spiel (oder der Kamera-App, wenn das
  Team im selben Browser angemeldet ist). Zeigt Richtung und ungefähre Entfernung zu Mister X – oder warum nicht.
-->
<script lang="ts">
  import { QrCode } from "@lucide/svelte";
  import type { PostenErgebnis } from "@mrx/shared";
  import AppBar from "../ui/AppBar.svelte";
  import Card from "../ui/Card.svelte";
  import Button from "../ui/Button.svelte";
  import Skeleton from "../ui/Skeleton.svelte";
  import { session } from "../lib/session.svelte.ts";
  import { ApiError, call, fehlerText } from "../lib/api.ts";
  import { go } from "../lib/router.svelte.ts";
  import { T } from "../texte.ts";

  let { gameId, code }: { gameId: string; code: string } = $props();
  const P = T.posten;

  let ergebnis = $state<PostenErgebnis | null>(null);
  let fehler = $state<string | null>(null);

  $effect(() => {
    if (!session.ready) return;
    if (session.gameId !== gameId || session.role !== "team") {
      fehler = P.nichtImSpiel;
      return;
    }
    call({ action: "posten", gameId, code })
      .then((r) => (ergebnis = r))
      .catch((e: unknown) => {
        fehler =
          e instanceof ApiError && e.reason === "wrongPhase"
            ? P.nurImSpiel
            : e instanceof ApiError && e.reason === "invalid"
              ? P.ungueltig
              : fehlerText(e);
      });
  });

  function text(r: PostenErgebnis): string {
    switch (r.status) {
      case "hinweis":
        return r.m === 0 ? P.ganzNah : P.hinweis(r.m, P.richtungen[r.richtung] ?? "");
      case "schon":
        return P.schon;
      case "weit":
        return P.weit(r.m);
      case "keinStandort":
        return P.keinStandort;
      case "mrx":
        return P.mrx;
      case "keinMrx":
        return P.keinMrx;
    }
  }
  const zurueck = () => go(session.gameId === gameId ? "/spiel" : "/");
</script>

<main class="posten">
  <AppBar title={P.titel} onback={zurueck} />
  <div class="inhalt">
    {#if ergebnis || fehler}
      <Card label={ergebnis?.name ?? P.titel} icon={QrCode} tone={ergebnis?.status === "hinweis" ? "accent" : undefined}>
        <p class="text" role="status">{ergebnis ? text(ergebnis) : fehler}</p>
        {#if ergebnis?.status === "hinweis"}<p class="muted">{P.nurIhr}</p>{/if}
      </Card>
      <Button block onclick={zurueck}>{P.zurueck}</Button>
    {:else}
      <div aria-busy="true" aria-label={T.allgemein.laden}><Skeleton h="40vh" r="var(--r-l)" /></div>
    {/if}
  </div>
</main>

<style>
  .posten {
    min-height: 100dvh;
    background: var(--bg);
  }
  .inhalt {
    display: grid;
    gap: var(--sp-4);
    max-width: 560px;
    margin: 0 auto;
    padding: var(--sp-5) var(--gutter);
  }
  .text {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    line-height: 1.35;
    text-align: center;
  }
  .muted {
    margin: var(--sp-2) 0 0;
    text-align: center;
  }
</style>
