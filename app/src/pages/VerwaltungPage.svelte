<!-- „/verwaltung“: Super-Admin (Organisator) – Anmeldung mit Passwort, Spiele anlegen, öffnen, Admin-Zugang, archivieren, löschen. -->
<script lang="ts">
  import type { ApiReason, GameListEntry } from "@mrx/shared";
  import SuperAdmin, { type GameRow } from "../screens/SuperAdmin.svelte";
  import { session, startSession, superLogin, superLogout, superSetup } from "../lib/session.svelte.ts";
  import { ApiError, call } from "../lib/api.ts";
  import { go } from "../lib/router.svelte.ts";
  import { toast } from "../ui/toast.svelte.ts";
  import type { Downloads } from "@mrx/shared";
  import { ladeDownloads, meinSystem } from "../lib/downloads.ts";
  import { T } from "../texte.ts";

  let downloads = $state<Downloads>({});
  void ladeDownloads().then((d) => (downloads = d));

  let list = $state<GameListEntry[]>([]);
  async function load() {
    if (!session.superAdmin) return;
    try {
      list = (await call({ action: "listGames" })).games;
    } catch (e) {
      toast(errText(e), "warn");
    }
  }
  $effect(() => {
    if (session.superAdmin) void load();
  });

  const games = $derived<GameRow[]>(
    list.map((g) => ({ id: g.id, name: g.name, phase: g.archived ? "archiviert" : g.phase, teams: g.teams })),
  );
  const nameOf = (id: string) => list.find((g) => g.id === id)?.name ?? id;
  const errText = (e: unknown) =>
    e instanceof ApiError ? (e.reason === "invalid" ? e.message : T.apiFehler[e.reason as ApiReason | "network"]) : T.apiFehler.network;
  async function run(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast(ok, "ok");
    } catch (e) {
      toast(errText(e), "warn");
    }
    await load();
  }
</script>

<SuperAdmin
  system={meinSystem()}
  {downloads}
  allowed={session.superAdmin}
  {games}
  onlogin={superLogin}
  onsetup={superSetup}
  onlogout={superLogout}
  oncreate={async (v) => {
    await call({ action: "createGame", ...v });
    await load();
  }}
  onopen={async (id) => {
    // Organisator tritt ohne Admin-Passwort als Spielleitung bei
    try {
      startSession(id, await call({ action: "join", gameId: id, role: "admin", name: "Organisator" }));
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
