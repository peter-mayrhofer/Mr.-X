<!-- „/hilfe“: Spielregeln & Hilfe, mit den Werten des eigenen Spiels (sonst Standardwerte). -->
<script lang="ts">
  import { DEFAULT_CONFIG, type Config } from "@mrx/shared";
  import AppBar from "../ui/AppBar.svelte";
  import RulesView from "../screens/parts/RulesView.svelte";
  import { session } from "../lib/session.svelte.ts";
  import { live } from "../lib/live.svelte.ts";
  import { T } from "../texte.ts";

  const cfg = live<Config>(() => (session.gameId ? `games/${session.gameId}/config` : null));
</script>

<AppBar title={T.regeln.titel} onback={() => history.back()} />
<RulesView config={cfg.value ?? DEFAULT_CONFIG} />
