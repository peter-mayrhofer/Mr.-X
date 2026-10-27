<!--
  Schiri und Spielleitung im Spiel (Meilenstein 6). Schiri: Warteraum → Schiri-Ansicht (sendet den eigenen Standort mit
  Namen) → Auswertung. Spielleitung: Bereiche Live, Steuerung, Teams & Zugänge, Chat, Protokoll (Adresse #/spiel?b=…).
-->
<script lang="ts">
  import type { Member, Results as ResultsT, Team } from "@mrx/shared";
  import Referee from "../screens/Referee.svelte";
  import Lobby from "../screens/Lobby.svelte";
  import Results from "../screens/Results.svelte";
  import AdminShell, { type Section } from "../screens/admin/AdminShell.svelte";
  import AdminLive from "../screens/admin/AdminLive.svelte";
  import AdminChat from "../screens/admin/AdminChat.svelte";
  import AdminControl from "../screens/admin/AdminControl.svelte";
  import AdminTeams from "../screens/admin/AdminTeams.svelte";
  import AdminLog from "../screens/admin/AdminLog.svelte";
  import ZoneEditor from "../screens/admin/ZoneEditor.svelte";
  import { GameData, pokeWhenDue, sendMessage } from "../lib/game.svelte.ts";
  import { gps, keepAwake, sendPosition, startGps } from "../lib/gps.svelte.ts";
  import { live } from "../lib/live.svelte.ts";
  import { prefs } from "../lib/prefs.svelte.ts";
  import { PushState } from "../lib/push.svelte.ts";
  import { clock } from "../lib/clock.svelte.ts";
  import { signal } from "../lib/signal.ts";
  import { call } from "../lib/api.ts";
  import { leaveGame } from "../lib/session.svelte.ts";
  import { go, query, router } from "../lib/router.svelte.ts";
  import type { StaffView } from "../lib/staff.ts";
  import { toast } from "../ui/toast.svelte.ts";
  import { T } from "../texte.ts";

  interface Props {
    g: string;
    uid: string;
    member: Member;
    gameName: string;
  }
  let { g, uid, member, gameName }: Props = $props();

  const isAdmin = $derived(member.role === "admin");
  const game = new GameData();
  $effect(() => game.watch(g, { chat: true, live: true, admin: isAdmin }));
  // Schiris: Push wie Teams (Meldungen, Übergaben, Durchsagen); die Spielleitung sitzt meist am Laptop
  const push = new PushState();
  $effect(() => (isAdmin ? undefined : push.watch(g, uid)));
  const phase = $derived(game.state?.phase);

  // Schiri: Standort mit Namen (Karte der anderen Schiris, Ersatz-Standort für Mister X)
  $effect(() => {
    if (!isAdmin) startGps();
  });
  sendPosition(
    () => (!isAdmin && phase && phase !== "beendet" ? `games/${g}/staffPos/${uid}` : null),
    () => uid,
    () => ({ name: member.name }),
  );
  keepAwake(() => !isAdmin && prefs.wake && (phase === "laeuft" || phase === "pause"));
  pokeWhenDue(
    () => g,
    () => game.state,
  );

  // Spielleitung: neue Direktnachrichten melden, gelesen-Stand pro Team
  let seen = $state<Record<string, number>>({});
  const opened = clock.now;
  const unread = $derived(
    Object.entries(game.dmAll).reduce(
      (n, [t, list]) => n + list.filter((m) => m.teamId === t && m.t > Math.max(seen[t] ?? 0, opened)).length,
      0,
    ),
  );
  let lastUnread = 0;
  $effect(() => {
    if (unread > lastUnread) signal("nachricht");
    lastUnread = unread;
  });

  const view = $derived<StaffView | null>(
    game.loaded
      ? {
          gameId: g,
          gameName,
          field: game.field!,
          config: game.config!,
          state: game.state!,
          teams: game.teams,
          positions: game.positions,
          staff: game.staff,
          reports: game.reports,
          handovers: game.handovers,
          locks: game.locks,
          pauses: game.pauses,
          chat: game.chat,
          dm: game.dmAll,
          members: game.members,
          audit: game.audit,
          myUid: uid,
          myName: member.name,
          me: isAdmin ? null : gps.pos,
          follows: !!member.followsFlag,
          online: game.online,
          lastDataAt: game.lastDataAt,
        }
      : null,
  );

  const archive = live<{ results: ResultsT; teams: Record<string, Team> }>(() =>
    phase === "beendet" && game.state?.run ? `games/${g}/archive/${game.state.run}` : null,
  );

  const SECTIONS: Section[] = ["live", "steuerung", "teams", "zonen", "chat", "protokoll"];
  const asked = $derived(query(router.path).get("b") as Section | null);
  const section = $derived<Section>(asked && SECTIONS.includes(asked) ? asked : phase === "vorbereitung" ? "steuerung" : "live");
  const link = (id: Section) => (SECTIONS.includes(id) ? `/spiel?b=${id}` : null);
  const base = `${location.origin}${location.pathname}`;

  async function send(text: string, ch: "alle" | "dm", teamId?: string) {
    try {
      await sendMessage(g, { uid, name: member.name }, text, ch === "dm" ? { dm: teamId } : {});
    } catch {
      toast(T.chat.zuSchnell, "warn");
    }
  }
  async function logout() {
    await leaveGame();
    go("/");
  }
</script>

{#if !view}
  <div class="wait" aria-busy="true" aria-label={T.allgemein.laden}></div>
{:else if !isAdmin}
  {#if phase === "vorbereitung"}
    <Lobby
      {gameName}
      roleLabel={T.warten.rolle.schiri}
      name={member.name}
      teams={Object.entries(game.teams).map(([id, t]) => ({ id, ...t }))}
      config={view.config}
      onrules={() => go("/hilfe")}
      onlogout={logout}
    />
  {:else if phase === "beendet" && archive.value}
    <Results results={archive.value.results} teams={archive.value.teams} />
  {:else}
    <Referee {view} api={call} {push} onsend={(text) => send(text, "alle")} onlogout={logout} />
  {/if}
{:else}
  <AdminShell {section} {gameName} phase={view.state.phase} {link} {unread} onlogout={logout}>
    {#if section === "live" && phase === "beendet" && archive.value}
      <Results results={archive.value.results} teams={archive.value.teams} />
    {:else if section === "live"}
      <AdminLive {view} api={call} />
    {:else if section === "steuerung"}
      <AdminControl {view} api={call} onstarted={() => go("/spiel?b=live")} onstopped={() => go("/spiel?b=live")} />
    {:else if section === "teams"}
      <AdminTeams {view} api={call} joinUrl="{base}#/s/{g}" screenUrl={(k) => `${base}#/g/${g}?k=${k}`} />
    {:else if section === "zonen"}
      <ZoneEditor
        initial={view.field}
        readonly={phase === "laeuft" || phase === "pause"}
        onsave={async (field) => {
          await call({ action: "setField", gameId: g, field });
        }}
      />
    {:else if section === "chat"}
      <AdminChat {view} {seen} onthread={(t) => (seen[t] = clock.now)} onsend={send} />
    {:else}
      <AdminLog audit={view.audit} />
    {/if}
  </AdminShell>
{/if}

<style>
  .wait {
    min-height: 100dvh;
  }
</style>
