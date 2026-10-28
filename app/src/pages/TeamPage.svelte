<!--
  Alles für ein Team-Handy (Meilenstein 5): Onboarding, Warteraum, Spiel (Karte, Spur, Countdown, Wartezeit, Chat),
  Auswertung. Sendet den eigenen Standort, solange das Spiel nicht beendet ist, und meldet Ereignisse mit Ton/Vibration.
-->
<script lang="ts">
  import { BatteryMedium, Bell, MapPin } from "@lucide/svelte";
  import type { Member, Results as ResultsT, Team } from "@mrx/shared";
  import TeamHome, { type Scene, type TeamView } from "../screens/TeamHome.svelte";
  import Lobby from "../screens/Lobby.svelte";
  import Onboarding from "../screens/Onboarding.svelte";
  import Results from "../screens/Results.svelte";
  import ChatView from "../screens/parts/ChatView.svelte";
  import AppBar from "../ui/AppBar.svelte";
  import { GameData, sendMessage, type Msg } from "../lib/game.svelte.ts";
  import { gps, keepAwake, sendPosition, startGps, stopGps } from "../lib/gps.svelte.ts";
  import { remote } from "../lib/remote.svelte.ts";
  import { call } from "../lib/api.ts";
  import { prefs } from "../lib/prefs.svelte.ts";
  import { PushState } from "../lib/push.svelte.ts";
  import { battery, NATIVE } from "../lib/native.ts";
  import { clock } from "../lib/clock.svelte.ts";
  import { signal } from "../lib/signal.ts";
  import { leaveGame } from "../lib/session.svelte.ts";
  import { go } from "../lib/router.svelte.ts";
  import { toast } from "../ui/toast.svelte.ts";
  import { T } from "../texte.ts";

  interface Props {
    g: string;
    uid: string;
    member: Member;
    gameName: string;
  }
  let { g, uid, member, gameName }: Props = $props();

  const game = new GameData();
  const teamId = $derived(member.teamId ?? "");
  $effect(() => game.watch());
  const push = new PushState();
  $effect(() => push.watch(g, uid));

  const phase = $derived(game.state?.phase);
  let tab = $state<"karte" | "chat" | "regeln" | "mehr">("karte");
  let scene = $state<Scene | null>(null);
  let announcement = $state<Msg | null>(null);
  let shrinking = $state<string | null>(null);
  let chatOnly = $state(false);

  // Standort: ab dem Beitritt (Spielleitung sieht im Warteraum, ob GPS klappt), nach dem Ende nie mehr (Datenschutz)
  // GPS (in der Android-App samt Dauer-Benachrichtigung) nur, solange gespielt wird; beim Verlassen beenden.
  // Nur am Spielende neu auswerten, nicht bei jedem Phasenwechsel: Ein Neustart beim Spielbeginn bei gesperrtem
  // Handy hieße, den Vordergrund-Dienst aus dem Hintergrund neu zu starten – das verbietet Android ab Version 12.
  const ended = $derived(phase === "beendet");
  $effect(() => {
    if (!prefs.onboarded || ended) return;
    startGps(prefs.background);
    return () => stopGps();
  });
  sendPosition(() => !!teamId && !!phase && phase !== "beendet");
  keepAwake(() => prefs.wake && (phase === "laeuft" || phase === "pause"));

  // ---- Ereignisse: nur was nach dem Öffnen passiert, bekommt Ton/Vibration bzw. eine Szene ----
  let opened = $state(0);
  $effect(() => {
    if (game.loaded && !opened) opened = clock.now - 2000;
  });
  function onNew<X extends { id: string }>(items: () => X[], time: (x: X) => number, cb: (x: X) => void) {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- reine Buchführung, soll keine Effekte auslösen
    const done = new Set<string>();
    $effect(() => {
      const list = items();
      if (!opened) return;
      for (const x of list)
        if (!done.has(x.id)) {
          done.add(x.id);
          if (time(x) > opened) cb(x);
        }
    });
  }

  onNew(
    () => game.reports,
    (r) => r.t,
    (r) => {
      if (r.kind !== "uebergabe") signal("meldung");
    },
  );
  onNew(
    () => game.handovers,
    (h) => h.at,
    (h) => {
      if (h.type === "start") return void signal(h.to === teamId ? "mrx" : "wartezeit");
      const variant = h.to === teamId ? "neuMrx" : h.from === teamId ? "erwischt" : "alle";
      scene = { variant, from: h.from ?? "", to: h.to, type: h.type, at: h.at };
      signal(variant === "neuMrx" ? "mrx" : "uebergabe");
    },
  );
  // Rückgängig: Szene schließen und erklären
  onNew(
    () => game.handovers.filter((h) => h.undoneAt),
    (h) => h.undoneAt!,
    (h) => {
      if (scene?.at === h.at) scene = null;
      toast(T.uebergabe.zurueck, "info");
    },
  );
  onNew(
    () => game.chat,
    (m) => m.t,
    (m) => {
      if (m.kind === "ann") {
        announcement = m;
        signal("durchsage");
        setTimeout(() => announcement?.id === m.id && (announcement = null), 60_000);
      } else if (m.kind === "msg" && m.uid !== uid) signal("nachricht");
    },
  );
  onNew(
    () => game.dm,
    (m) => m.t,
    (m) => m.uid !== uid && signal("nachricht"),
  );
  onNew(
    () => game.cutLog,
    (c) => c.t,
    (c) => {
      if (!c.locked) return void toast(T.verkleinerung.frei(game.field?.cuts[c.cut]?.short ?? c.cut), "info");
      shrinking = c.cut;
      signal("verkleinerung");
      setTimeout(() => shrinking === c.cut && (shrinking = null), 20_000);
    },
  );
  let warnCount = 0;
  $effect(() => {
    const n = Object.keys(game.state?.warnCuts ?? {}).length;
    if (n > warnCount) signal("verkleinerung");
    warnCount = n;
  });
  let wasPhase: string | undefined;
  $effect(() => {
    if (phase === "beendet" && wasPhase && wasPhase !== "beendet") signal("ende");
    wasPhase = phase;
  });

  const lock = $derived.by(() => {
    const l = game.locks[teamId];
    if (!l) return null;
    const lastH = game.handovers.filter((h) => !h.undoneAt).at(-1);
    return { ...l, caught: l.reason === "uebergabe" && lastH?.from === teamId };
  });
  let lockSignaled = 0;
  $effect(() => {
    if (lock && lock.until > clock.now && lock.until !== lockSignaled && opened) {
      lockSignaled = lock.until;
      if (!scene) signal("wartezeit");
    }
  });

  const view = $derived<TeamView | null>(
    game.loaded
      ? {
          field: game.field!,
          config: game.config!,
          state: game.state!,
          teams: game.teams,
          myTeamId: teamId,
          myUid: uid,
          me: gps.pos,
          reports: game.reports,
          lock,
          chat: game.chat,
          dm: game.dm,
          online: game.online,
          lastDataAt: game.lastDataAt,
          distM: game.stats[teamId]?.distM ?? 0,
        }
      : null,
  );

  const archive = remote(
    () => (phase === "beendet" && game.state?.run ? game.state.run : null),
    async (run) => (await call({ action: "archiveGet", gameId: g, run })).archive as { results: ResultsT; teams: Record<string, Team> },
  );

  async function send(text: string, ch: "alle" | "dm") {
    try {
      await sendMessage(g, { uid, name: member.name, teamId }, text, ch === "dm" ? { dm: teamId } : {});
    } catch {
      toast(T.chat.zuSchnell, "warn");
    }
  }
  async function logout() {
    await leaveGame();
    go("/");
  }

  const checks = $derived([
    {
      label: `${T.lobby.check.standort}: ${gps.pos ? T.lobby.gut : gps.error === "denied" ? T.lobby.nichtErlaubt : T.lobby.sucht}`,
      ok: !!gps.pos,
      icon: MapPin,
    },
    { label: `${T.lobby.check.push}: ${push.status === "an" ? T.lobby.gut : T.lobby.aus}`, ok: push.status === "an", icon: Bell },
    ...(gps.battery !== undefined ? [{ label: `${T.lobby.check.akku} ${gps.battery} %`, ok: gps.battery > 30, icon: BatteryMedium }] : []),
  ]);
</script>

{#if !prefs.onboarded}
  <Onboarding
    actions={{
      1: () => startGps(prefs.background),
      2: async () => void (await push.enable()),
      ...(NATIVE ? { 3: () => battery.request() } : {}),
    }}
    ondone={() => {
      prefs.onboarded = true;
      startGps(prefs.background);
    }}
  />
{:else if !view || !game.config || (phase === "beendet" && game.state?.run && !archive.loaded)}
  <div class="wait" aria-busy="true" aria-label={T.allgemein.laden}></div>
{:else if chatOnly && (phase === "vorbereitung" || phase === "beendet")}
  <!-- Chat vor dem Start und nach dem Ende (z. B. Treffpunkt-Durchsage) -->
  <div class="pane">
    <AppBar title={T.tabs.chat} onback={() => (chatOnly = false)} />
    <ChatView group={game.chat} direct={game.dm} teams={game.teams} myUid={uid} onsend={send} />
  </div>
{:else if phase === "vorbereitung"}
  <Lobby
    {gameName}
    myTeam={game.teams[teamId] ? { id: teamId, ...game.teams[teamId] } : undefined}
    roleLabel={T.warten.rolle.team}
    name={member.name}
    teams={Object.entries(game.teams).map(([id, t]) => ({ id, ...t }))}
    config={game.config}
    {checks}
    onrules={() => go("/hilfe")}
    onchat={() => (chatOnly = true)}
    onlogout={logout}
  />
{:else if phase === "beendet" && archive.value}
  <Results
    results={archive.value.results}
    teams={archive.value.teams}
    onarchive={() => go("/archiv")}
    done={{ label: T.tabs.chat, onclick: () => (chatOnly = true) }}
    onleave={logout}
  />
{:else}
  <TeamHome {view} bind:tab bind:scene {announcement} {shrinking} {push} onsend={send} onlogout={logout} />
{/if}

<style>
  .wait {
    min-height: 100dvh;
  }
  .pane {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }
</style>
