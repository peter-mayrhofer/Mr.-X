<!-- Knopf „QR-Code scannen“: öffnet die Kamera in der App und führt mit dem Zugangs-Code gleich auf die richtige Seite. -->
<script lang="ts">
  import { ScanQrCode } from "@lucide/svelte";
  import Button from "../../ui/Button.svelte";
  import QrScanner from "./QrScanner.svelte";
  import { go } from "../../lib/router.svelte.ts";
  import { T } from "../../texte.ts";

  let { variant = "secondary", block = true }: { variant?: "primary" | "secondary"; block?: boolean } = $props();
  let open = $state(false);
</script>

<Button {variant} {block} icon={ScanQrCode} type="button" onclick={() => (open = true)}>{T.qr.knopf}</Button>
{#if open}
  <QrScanner
    onroute={(route) => {
      open = false;
      go(route);
    }}
    onclose={() => (open = false)}
  />
{/if}
