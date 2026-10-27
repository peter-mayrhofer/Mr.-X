<!-- „/staff/schiri“ und „/staff/admin“ (optional ?g=spiel): Schiri-Code bzw. Admin-Passwort. -->
<script lang="ts">
  import StaffLogin from "../screens/StaffLogin.svelte";
  import { ensureDevice } from "../lib/session.svelte.ts";
  import { call } from "../lib/api.ts";
  import { go, query } from "../lib/router.svelte.ts";

  let { role }: { role: "schiri" | "admin" } = $props();
  const gameId = query().get("g") ?? "";
</script>

<StaffLogin
  {role}
  code={gameId}
  onsubmit={async (v) => {
    await ensureDevice();
    await call({ action: "join", gameId: v.code, role: v.role, name: v.name, secret: v.secret });
    go("/spiel");
  }}
  onsuperadmin={() => go("/verwaltung")}
  onback={() => go(gameId ? `/s/${gameId}` : "/")}
/>
