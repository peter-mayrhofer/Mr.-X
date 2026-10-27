<!-- „/beitreten“ und „/beitreten/:spiel“: Team-Beitritt mit Team-Passwort. -->
<script lang="ts">
  import type { GameInfo } from "@mrx/shared";
  import Join from "../screens/Join.svelte";
  import { session, ensureDevice } from "../lib/session.svelte.ts";
  import { live } from "../lib/live.svelte.ts";
  import { call } from "../lib/api.ts";
  import { go } from "../lib/router.svelte.ts";

  let { gameId }: { gameId?: string | undefined } = $props();
  const info = live<GameInfo>(() => (gameId && session.user ? `games/${gameId}/info` : null));
  $effect(() => {
    if (gameId) void ensureDevice();
  });
</script>

<Join
  gameName={info.value?.name}
  code={gameId ?? ""}
  onsubmit={async (v) => {
    await ensureDevice();
    return call({ action: "join", gameId: gameId ?? v.code, role: "team", name: v.name, secret: v.password, secondDevice: v.secondDevice });
  }}
  onjoined={() => go("/spiel")}
  onback={() => go(gameId ? `/s/${gameId}` : "/")}
/>
