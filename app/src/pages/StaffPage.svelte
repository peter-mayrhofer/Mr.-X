<!-- „/staff/schiri“ und „/staff/admin“ (optional ?g=spiel): Schiri-Code bzw. Admin-Passwort. -->
<script lang="ts">
  import StaffLogin from "../screens/StaffLogin.svelte";
  import type { Downloads } from "@mrx/shared";
  import { ladeDownloads, meinSystem } from "../lib/downloads.ts";
  import { startSession } from "../lib/session.svelte.ts";
  import { call } from "../lib/api.ts";
  import { go, query } from "../lib/router.svelte.ts";

  let { role }: { role: "schiri" | "admin" } = $props();
  const gameId = query().get("g") ?? "";
  let downloads = $state<Downloads>({});
  void ladeDownloads().then((d) => (downloads = d));
</script>

<StaffLogin
  {role}
  system={meinSystem()}
  {downloads}
  code={gameId}
  onsubmit={async (v) => {
    const id = v.code.trim().toLowerCase();
    startSession(id, await call({ action: "join", gameId: id, role: v.role, name: v.name, secret: v.secret }));
    go("/spiel");
  }}
  onsuperadmin={() => go("/verwaltung")}
  onback={() => go(gameId ? `/s/${gameId}` : "/")}
/>
