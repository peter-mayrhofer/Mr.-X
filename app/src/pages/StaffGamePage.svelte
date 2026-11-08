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
  import AlertsBar from "../screens/parts/AlertsBar.svelte";
  import { warnungen } from "../lib/warnungen.ts";
  import { GameData, sendMessage } from "../lib/game.svelte.ts";
  import { gps, keepAwake, sendPosition, startGps, stopGps } from "../lib/gps.svelte.ts";
  import { remote } from "../lib/remote.svelte.ts";
  import { prefs } from "../lib/prefs.svelte.ts";
  import { PushState } from "../lib/push.svelte.ts";
  import { clock } from "../lib/clock.svelte.ts";
  import { signal } from "../lib/signal.ts";
  import { call } from "../lib/api.ts";
  import { API_URL } from "../lib/server.ts";
  import { leaveGame } from "../lib/session.svelte.ts";
  import { go, query, router } from "../lib/router.svelte.ts";
  import type { StaffView } from "../lib/staff.ts";
  import { toast } from "../ui/toast.svelte.ts";
  import { DESKTOP } from "../lib/native.ts";
  import { grossbildOeffnen, meldenImHintergrund } from "../lib/desktop.ts";
  import { T } from "../texte.ts";

  const M = T.melden;

  interface Props {
    g: string;
    uid: string;
    member: Member;
    gameName: string;
  }
  let { g, uid, member, gameName }: Props = $props();

  const isAdmin = $derived(member.role === "admin");
  const game = new GameData();
  $effect(() => game.watch());
  // Schiris: Push wie Teams (Meldungen, Übergaben, Durchsagen); die Spielleitung sitzt meist am Laptop
  const push = new PushState();
  $effect(() => (isAdmin ? undefined : push.watch(g, uid)));
  const phase = $derived(game.state?.phase);

  // Schiri: Standort mit Namen (Karte der anderen Schiris, Ersatz-Standort für Mister X).
  // Nur am Spielende neu auswerten (wie TeamPage: kein Neustart des Vordergrund-Dienstes bei gesperrtem Handy)
  const ended = $derived(phase === "beendet");
  $effect(() => {
    if (isAdmin || ended) return;
    startGps(prefs.background);
    return () => stopGps();
  });
  sendPosition(() => !isAdmin && !!phase && phase !== "beendet");
  keepAwake(() => !isAdmin && prefs.wake && (phase === "laeuft" || phase === "pause"));

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
    if (unread > lastUnread) {
      signal("nachricht");
      // Desktop-App: Benachrichtigung mit der neuesten ungelesenen Nachricht (nur wenn das Fenster hinten liegt)
      const neu = Object.values(game.dmAll)
        .flat()
        .filter((m) => m.teamId && m.t > opened)
        .sort((a, b) => b.t - a.t)[0];
      if (isAdmin && neu) meldenImHintergrund(M.nachrichtTitel, M.nachricht(game.teams[neu.teamId!]?.name ?? neu.name, neu.text));
    }
    lastUnread = unread;
  });

  // Notfälle: jeder neue einmal laut (Spielleitung und Schiris)
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- reine Buchführung
  const alarmed = new Set<string>();
  let alertsReady = false;
  $effect(() => {
    const open = game.alerts.filter((a) => !a.done);
    if (!game.loaded) return;
    for (const a of open)
      if (!alarmed.has(a.id)) {
        alarmed.add(a.id);
        if (alertsReady) {
          signal("warnung");
          if (isAdmin) meldenImHintergrund(M.notfallTitel, M.notfall(game.teams[a.teamId]?.name ?? "?"));
        }
      }
    alertsReady = true;
  });
  const sosDone = async (id: string) => {
    try {
      await call({ action: "sosDone", gameId: g, id });
      toast(T.notfall.erledigtOk, "ok");
    } catch {
      toast(T.apiFehler.network, "warn");
    }
  };

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
          devices: game.devices,
          reports: game.reports,
          handovers: game.handovers,
          locks: game.locks,
          pauses: game.pauses,
          chat: game.chat,
          dm: game.dmAll,
          members: game.members,
          audit: game.audit,
          alerts: game.alerts,
          myUid: uid,
          myName: member.name,
          me: isAdmin ? null : gps.pos,
          follows: !!member.followsFlag,
          online: game.online,
          lastDataAt: game.lastDataAt,
        }
      : null,
  );

  // Spielleitung: neue Warnungen (Funkstille, Akku, Sperrgebiet, Mister X an der Grenze) einmal melden
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- reine Buchführung
  const warned = new Set<string>();
  let warnReady = false;
  $effect(() => {
    if (!isAdmin || !view) return;
    const list = warnungen(view, clock.now);
    const fresh: string[] = [];
    for (const w of list)
      if (!warned.has(w.key)) {
        warned.add(w.key);
        if (warnReady) {
          toast(w.text, "warn");
          fresh.push(w.text);
        }
      }
    // erledigte Warnungen dürfen später wieder melden
    for (const k of [...warned]) if (!list.some((w) => w.key === k)) warned.delete(k);
    if (fresh.length) {
      signal("warnung");
      // Desktop-App: auch gemeldete Übergaben zur Prüfung (E-54) sind Warnungen
      meldenImHintergrund(M.warnungTitel, fresh.length === 1 ? fresh[0]! : M.warnungen(fresh.length));
    }
    warnReady = true;
  });

  const archive = remote(
    () => (phase === "beendet" && game.state?.run ? game.state.run : null),
    async (run) => (await call({ action: "archiveGet", gameId: g, run })).archive as { results: ResultsT; teams: Record<string, Team> },
  );

  const SECTIONS: Section[] = ["live", "steuerung", "teams", "zonen", "chat", "protokoll"];
  const asked = $derived(query(router.path).get("b") as Section | null);
  const section = $derived<Section>(asked && SECTIONS.includes(asked) ? asked : phase === "vorbereitung" ? "steuerung" : "live");
  // Großbild und Archiv sind eigene Seiten (Vollbild bzw. auch für Teams erreichbar)
  const link = (id: Section) =>
    id === "grossbild" ? "/grossbild" : id === "archiv" ? "/archiv" : SECTIONS.includes(id) ? `/spiel?b=${id}` : null;
  // Links für QR-Codes: immer die öffentliche Adresse (in der Android-App ist location „localhost“)
  const base = API_URL ? `${API_URL}/` : `${location.origin}${location.pathname}`;

  // Desktop-App: Großbild in eigenem Vollbild-Fenster (zweiter Bildschirm); es teilt die Sitzung (localStorage) mit diesem Fenster
  async function beamer() {
    const ort = await grossbildOeffnen(`${base}#/grossbild`);
    toast(ort === "beamer" ? T.grossbild.beamerOk : ort ? T.grossbild.beamerGleich : T.grossbild.beamerFehler, ort ? "ok" : "warn");
  }

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
    <Results results={archive.value.results} teams={archive.value.teams} onarchive={() => go("/archiv")} onleave={logout} />
  {:else}
    <Referee {view} api={call} {push} onsend={(text) => send(text, "alle")} onlogout={logout} />
    <div class="alerts-fixed"><AlertsBar alerts={game.alerts} teams={game.teams} ondone={sosDone} /></div>
  {/if}
{:else}
  <AdminShell {section} {gameName} phase={view.state.phase} trial={!!view.config.trial} {link} {unread} onlogout={logout}>
    <AlertsBar alerts={game.alerts} teams={game.teams} ondone={sosDone} />
    {#if section === "live" && phase === "beendet" && archive.value}
      <Results
        results={archive.value.results}
        teams={archive.value.teams}
        onarchive={() => go("/archiv")}
        onscreen={() => go("/grossbild")}
      />
    {:else if section === "live"}
      <AdminLive {view} api={call} />
    {:else if section === "steuerung"}
      <AdminControl {view} api={call} onstarted={() => go("/spiel?b=live")} onstopped={() => go("/spiel?b=live")} />
    {:else if section === "teams"}
      <AdminTeams
        {view}
        api={call}
        joinUrl="{base}#/s/{g}"
        screenUrl={(k) => `${base}#/g/${g}?k=${k}`}
        onbeamer={DESKTOP ? beamer : undefined}
      />
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
  .alerts-fixed {
    position: fixed;
    top: var(--safe-top);
    left: 0;
    right: 0;
    z-index: calc(var(--z-ui) + 5);
  }
</style>
