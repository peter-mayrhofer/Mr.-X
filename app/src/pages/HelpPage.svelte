<!-- „/hilfe“: Spielregeln & Hilfe, mit den Werten des eigenen Spiels (sonst Standardwerte). -->
<script lang="ts">
  import { DEFAULT_CONFIG } from "@mrx/shared";
  import AppBar from "../ui/AppBar.svelte";
  import AmbientBackdrop from "../ui/AmbientBackdrop.svelte";
  import RulesView from "../screens/parts/RulesView.svelte";
  import { session } from "../lib/session.svelte.ts";
  import { T } from "../texte.ts";

  const cfg = $derived(session.view?.config);
</script>

<AmbientBackdrop />
<AppBar title={T.regeln.titel} onback={() => history.back()} />
<main><RulesView config={cfg ?? DEFAULT_CONFIG} /></main>
