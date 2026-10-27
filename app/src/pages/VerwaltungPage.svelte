<!-- „/verwaltung“: Super-Admin (Organisator) – Google-Login, Spiele anlegen, öffnen, Admin-Zugang, archivieren, löschen. -->
<script lang="ts">
  import { onValue, ref } from "firebase/database";
  import type { ApiReason, GameInfo } from "@mrx/shared";
  import SuperAdmin, { type GameRow } from "../screens/SuperAdmin.svelte";
  import { session, signInSuperAdmin } from "../lib/session.svelte.ts";
  import { live } from "../lib/live.svelte.ts";
  import { db } from "../lib/firebase.ts";
  import { ApiError, call } from "../lib/api.ts";
  import { go } from "../lib/router.svelte.ts";
  import { toast } from "../ui/toast.svelte.ts";
  import { T } from "../texte.ts";

  const email = $derived(session.user?.email ?? null);
  const index = live<Record<string, { name: string; createdAt: number; archived?: boolean }>>(() =>
    session.superAdmin ? "gameIndex" : null,
  );
  let phases = $state<Record<string, string>>({});
  let teamCount = $state<Record<string, number>>({});

  // Phase und Anzahl Teams je Spiel live dazulesen
  $effect(() => {
    const ids = Object.keys(index.value ?? {});
    const offs = ids.flatMap((id) => [
      onValue(ref(db, `games/${id}/info`), (s) => (phases[id] = (s.val() as GameInfo | null)?.phase ?? "")),
      onValue(ref(db, `games/${id}/teams`), (s) => (teamCount[id] = s.size)),
    ]);
    return () => offs.forEach((o) => o());
  });

  const games = $derived<GameRow[]>(
    Object.entries(index.value ?? {})
      .sort((a, b) => b[1].createdAt - a[1].createdAt)
      .map(([id, g]) => ({ id, name: g.name, phase: g.archived ? "archiviert" : phases[id], teams: teamCount[id] })),
  );
  const nameOf = (id: string) => index.value?.[id]?.name ?? id;
  const errText = (e: unknown) =>
    e instanceof ApiError ? (e.reason === "invalid" ? e.message : T.apiFehler[e.reason as ApiReason | "network"]) : T.apiFehler.network;
  async function run(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast(ok, "ok");
    } catch (e) {
      toast(errText(e), "warn");
    }
  }
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
  onopen={async (id) => {
    // Organisator tritt ohne Admin-Passwort als Spielleitung bei
    try {
      await call({ action: "join", gameId: id, role: "admin", name: (email ?? "Organisator").split("@")[0]!.slice(0, 30).padEnd(2, "-") });
      go("/spiel");
    } catch (e) {
      toast(errText(e), "warn");
    }
  }}
  onadminpw={async (id, pw) => {
    await call({ action: "setSecret", gameId: id, kind: "adminPw", value: pw });
  }}
  inviteUrl={(id) => `${location.origin}${location.pathname}#/staff/admin?g=${id}`}
  onarchive={(id) => run(() => call({ action: "archiveGame", gameId: id, archived: true }), T.superadmin.archiviert(nameOf(id)))}
  onunarchive={(id) => run(() => call({ action: "archiveGame", gameId: id, archived: false }), T.superadmin.reaktiviert(nameOf(id)))}
  ondelete={(id) => {
    const name = nameOf(id);
    void run(() => call({ action: "deleteGame", gameId: id }), T.superadmin.geloescht(name));
  }}
  onback={() => go("/")}
/>
