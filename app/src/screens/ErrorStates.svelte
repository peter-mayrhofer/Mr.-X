<!-- Screen 23: Fehler- und Offline-Zustände – freundlich, mit Lösungsvorschlag. -->
<script lang="ts">
  import { LogIn, MapPinOff, RefreshCw, SatelliteDish, SearchX, WifiOff } from "@lucide/svelte";
  import Button from "../ui/Button.svelte";
  import Skeleton from "../ui/Skeleton.svelte";
  import { go } from "../lib/router.svelte.ts";
  import { toast } from "../ui/toast.svelte.ts";
  import { T } from "../texte.ts";

  let { variant = "offline" }: { variant?: string } = $props();
  const F = T.fehler;
  const MAP = {
    offline: { icon: WifiOff, ...F.offline, tone: "warn" },
    keinGps: { icon: SatelliteDish, ...F.keinGps, tone: "warn" },
    verweigert: { icon: MapPinOff, ...F.verweigert, tone: "danger" },
    nichtGefunden: { icon: SearchX, ...F.nichtGefunden, tone: "info" },
    entfernt: { icon: LogIn, ...F.entfernt, tone: "info" },
  } as const;
  const v = $derived(MAP[(variant in MAP ? variant : "offline") as keyof typeof MAP]);
  const IconC = $derived(v.icon);
</script>

<main class="err {v.tone}">
  <div class="art" aria-hidden="true"><IconC size={72} strokeWidth={2} /></div>
  <h1>{v.titel}</h1>
  <p class="text">{v.text}</p>

  {#if "schritte" in v}
    <ol>
      {#each v.schritte as s, i (s)}<li><span class="n num">{i + 1}</span>{s}</li>{/each}
    </ol>
  {/if}

  {#if variant === "offline"}
    <div class="skel" aria-label="Letzte bekannte Daten werden angezeigt">
      <Skeleton h="56px" r="var(--r-l)" />
      <Skeleton h="180px" r="var(--r-l)" />
      <Skeleton w="60%" h="20px" />
    </div>
  {/if}

  <div class="actions">
    {#if "knopf" in v}
      <Button
        size="xl"
        block
        icon={variant === "entfernt" ? LogIn : RefreshCw}
        onclick={() =>
          variant === "entfernt"
            ? go("/prototyp/1")
            : variant === "nichtGefunden"
              ? go("/prototyp/2")
              : toast(T.allgemein.prototyp(v.knopf))}>{v.knopf}</Button
      >
    {:else}
      <Button size="xl" block variant="secondary" icon={RefreshCw} onclick={() => toast(T.allgemein.prototyp("Neu verbinden"))}
        >Erneut versuchen</Button
      >
    {/if}
  </div>
</main>

<style>
  .err {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--sp-4);
    padding: var(--sp-8) var(--gutter);
    max-width: 520px;
    margin: 0 auto;
    text-align: center;
  }
  .art {
    width: 140px;
    height: 140px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    margin-bottom: var(--sp-2);
    background: var(--info-soft);
    color: var(--info-text);
  }
  .warn .art {
    background: var(--warn-soft);
    color: var(--warn-text);
  }
  .danger .art {
    background: var(--accent-soft);
    color: var(--accent-text);
  }
  h1 {
    text-transform: uppercase;
  }
  .text {
    font-size: var(--fs-l);
    color: var(--text-2);
  }
  ol {
    list-style: none;
    padding: 0;
    margin: 0;
    width: 100%;
    display: grid;
    gap: var(--sp-2);
    text-align: left;
  }
  li {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-3);
    border-radius: var(--r-m);
    background: var(--surface);
    border: var(--border-w) solid var(--line);
  }
  .n {
    width: 32px;
    height: 32px;
    flex: none;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--text);
    color: var(--bg);
    font-weight: 800;
  }
  .skel {
    width: 100%;
    display: grid;
    gap: var(--sp-3);
    opacity: 0.8;
  }
  .actions {
    width: 100%;
    margin-top: var(--sp-4);
  }
</style>
