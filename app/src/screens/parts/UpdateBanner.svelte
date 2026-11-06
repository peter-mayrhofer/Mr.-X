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
  import { API_URL } from "../../lib/server.ts";
  import { T } from "../../texte.ts";

  let neu = $state(false);
  let spaeter = $state(false);

  onMount(() => {
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

{#if neu && !spaeter}
  <div class="upd">
    <Banner tone="info" icon={Download} title={T.update.titel} live>
      {T.update.text}
      {#snippet action()}
        <div class="btns">
          <a class="go" href={`${API_URL}/mister-x.apk`}>{T.update.installieren}</a>
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
  }
  .later {
    background: transparent;
    border: 1px solid currentColor;
    color: inherit;
    cursor: pointer;
  }
</style>
