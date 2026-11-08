<!--
  Android-App: Die APK bringt ihre Web-App mit. Ist auf dem Server ein neuerer Stand, fehlen der App neue Funktionen →
  Hinweis mit Link zur neuen APK (öffnet sich im Browser des Handys zum Herunterladen). Im Browser nie (dort aktualisiert
  sich die Web-App selbst).
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { Download } from "@lucide/svelte";
  import { appVeraltet } from "@mrx/shared";
  import Banner from "../../ui/Banner.svelte";
  import { NATIVE, serverBuild } from "../../lib/native.ts";
  import { neueDesktopVersion } from "../../lib/downloads.ts";
  import { imBrowserOeffnen } from "../../lib/desktop.ts";
  import { API_URL } from "../../lib/server.ts";
  import { T } from "../../texte.ts";

  /** Prototyp/Galerie: den Desktop-Hinweis fest zeigen */
  let { vorschau = false }: { vorschau?: boolean } = $props();
  let neu = $state(false);
  let spaeter = $state(false);
  // Desktop-App (docs/DESKTOP-APP.md): Adresse des neuen Installers, wenn der Server eine andere Hüllen-Version hat
  // svelte-ignore state_referenced_locally
  let installer = $state<string | null>(vorschau ? "/download/Mister-X-Setup.exe" : null);

  onMount(() => {
    if (vorschau) return;
    void neueDesktopVersion().then((u) => (installer = u));
    if (!NATIVE) return;
    const check = async () => {
      neu = appVeraltet(__BUILD__, await serverBuild());
    };
    void check();
    // beim Zurückkehren in die App nochmal prüfen (das Spiel läuft lange, ein Update kann zwischendurch kommen)
    const vis = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  });
</script>

{#if (neu || installer) && !spaeter}
  <div class="upd">
    <Banner tone="info" icon={Download} title={installer ? T.update.desktopTitel : T.update.titel} live>
      {installer ? T.update.desktopText : T.update.text}
      {#snippet action()}
        <div class="btns">
          {#if installer}
            <button type="button" class="go" onclick={() => void imBrowserOeffnen(installer!)}>{T.update.desktopLaden}</button>
          {:else}
            <a class="go" href={`${API_URL}/mister-x.apk`}>{T.update.installieren}</a>
          {/if}
          <button type="button" class="later" onclick={() => (spaeter = true)}>{T.update.spaeter}</button>
        </div>
      {/snippet}
    </Banner>
  </div>
{/if}

<style>
  .upd {
    position: fixed;
    left: var(--gutter);
    right: var(--gutter);
    bottom: calc(var(--safe-bottom) + 84px);
    z-index: var(--z-toast, 60);
    max-width: 560px;
    margin: 0 auto;
    box-shadow: var(--shadow-l, 0 10px 30px rgb(0 0 0 / 0.3));
    border-radius: var(--r-m);
  }
  .btns {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    align-items: stretch;
  }
  .go,
  .later {
    font: inherit;
    font-weight: 700;
    border-radius: var(--r-s, 10px);
    padding: var(--sp-2) var(--sp-3);
    text-align: center;
    text-decoration: none;
    white-space: nowrap;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .go {
    background: var(--accent);
    color: #fff;
    border: 0;
    cursor: pointer;
  }
  .later {
    background: transparent;
    border: 1px solid currentColor;
    color: inherit;
    cursor: pointer;
  }
</style>
