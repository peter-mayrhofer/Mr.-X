<!-- „/beitreten“ und „/beitreten/:spiel“: Team-Beitritt mit Team-Passwort. -->
<script lang="ts">
  import Join from "../screens/Join.svelte";
  import { startSession } from "../lib/session.svelte.ts";
  import { remote } from "../lib/remote.svelte.ts";
  import { call } from "../lib/api.ts";
  import { go } from "../lib/router.svelte.ts";

  let { gameId }: { gameId?: string | undefined } = $props();
  const info = remote(
    () => gameId ?? null,
    (id) => call({ action: "gameInfo", gameId: id }),
  );
</script>

<Join
  gameName={info.value?.name}
  code={gameId ?? ""}
  onsubmit={async (v) => {
    const id = (gameId ?? v.code).trim().toLowerCase();
    const r = await call({ action: "join", gameId: id, role: "team", name: v.name, secret: v.password, secondDevice: v.secondDevice });
    startSession(id, r);
    return r;
  }}
  onjoined={() => go("/spiel")}
  onback={() => go(gameId ? `/s/${gameId}` : "/")}
/>
