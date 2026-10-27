<!-- „/verwaltung“: Super-Admin (Organisator) – Google-Login, Spiele anlegen, Admin-Zugang vergeben. -->
<script lang="ts">
  import { onValue, ref } from "firebase/database";
  import type { GameInfo } from "@mrx/shared";
  import SuperAdmin, { type GameRow } from "../screens/SuperAdmin.svelte";
  import { session, signInSuperAdmin } from "../lib/session.svelte.ts";
  import { live } from "../lib/live.svelte.ts";
  import { db } from "../lib/firebase.ts";
  import { call } from "../lib/api.ts";
  import { go } from "../lib/router.svelte.ts";
  import { toast } from "../ui/toast.svelte.ts";
  import { T } from "../texte.ts";

  const email = $derived(session.user?.email ?? null);
  const index = live<Record<string, { name: string; createdAt: number }>>(() => (session.superAdmin ? "gameIndex" : null));
  let phases = $state<Record<string, string>>({});

  // Phase je Spiel live dazulesen
  $effect(() => {
    const ids = Object.keys(index.value ?? {});
    const offs = ids.map((id) => onValue(ref(db, `games/${id}/info`), (s) => (phases[id] = (s.val() as GameInfo | null)?.phase ?? "")));
    return () => offs.forEach((o) => o());
  });

  const games = $derived<GameRow[]>(
    Object.entries(index.value ?? {})
      .sort((a, b) => b[1].createdAt - a[1].createdAt)
      .map(([id, g]) => ({ id, name: g.name, phase: phases[id] })),
  );
</script>

<SuperAdmin
  {email}
  allowed={session.superAdmin}
  {games}
  onlogin={async () => {
    try {
      await signInSuperAdmin();
    } catch {
      toast(T.apiFehler.network, "warn");
    }
  }}
  oncreate={async (v) => {
    await call({ action: "createGame", ...v });
  }}
  onadminpw={async (id, pw) => {
    await call({ action: "setSecret", gameId: id, kind: "adminPw", value: pw });
  }}
  inviteUrl={(id) => `${location.origin}${location.pathname}#/staff/admin?g=${id}`}
  onback={() => go("/")}
/>
