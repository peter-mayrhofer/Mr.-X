<!--
  Rahmen für einen Prototyp-Screen: zeigt Screen n mit Variante (?v=…).
  Der Griff am linken Rand öffnet das Prototyp-Menü (Übersicht, vor/zurück, Zustände, Darstellung).
  ?clean blendet den Griff aus (für Screenshots).
-->
<script lang="ts">
  import { BatteryMedium, Bell, ChevronLeft, ChevronRight, LayoutGrid, MapPin, X } from "@lucide/svelte";
  import * as M from "./mock.svelte.ts";
  import { fakeApi, recentHandover, staffView } from "./staffMock.svelte.ts";
  import { go, query } from "../lib/router.svelte.ts";
  import { toast } from "../ui/toast.svelte.ts";
  import { theme, type ThemeChoice } from "../lib/theme.svelte.ts";
  import { T } from "../texte.ts";
  import { SCREENS } from "./registry.ts";
  import Segmented from "../ui/Segmented.svelte";
  import Start from "../screens/Start.svelte";
  import Join from "../screens/Join.svelte";
  import StaffLogin from "../screens/StaffLogin.svelte";
  import Onboarding from "../screens/Onboarding.svelte";
  import Lobby from "../screens/Lobby.svelte";
  import TeamHome from "./ProtoTeam.svelte";
  import Referee from "../screens/Referee.svelte";
  import ProtoAdmin from "./ProtoAdmin.svelte";
  import BigScreen from "../screens/BigScreen.svelte";
  import Results from "../screens/Results.svelte";
  import Archive from "../screens/Archive.svelte";
  import Replay from "../screens/Replay.svelte";
  import SuperAdmin from "../screens/SuperAdmin.svelte";
  import ErrorStates from "../screens/ErrorStates.svelte";

  let { n }: { n: number } = $props();
  const q = query();
  const def = $derived(SCREENS.find((s) => s.n === n) ?? SCREENS[0]!);
  const v = $derived(q.get("v") ?? def.variants?.[0]?.id ?? "");
  const clean = q.has("clean");
  let open = $state(false);
  let choice = $state<ThemeChoice>(theme.choice);

  // svelte-ignore state_referenced_locally
  if (n === 12 && v === "rueckgaengig") recentHandover();
  const to = (k: number, variant = "") => go(`/prototyp/${k}${variant ? `?v=${variant}` : ""}`);
</script>

{#if n === 1}<Start
    game={v === "spiel" ? "Mister X Linz 2027" : undefined}
    links={{
      join: v === "spiel" ? "/prototyp/2?v=spiel" : "/prototyp/2",
      schiri: "/prototyp/3?v=schiri",
      admin: "/prototyp/3?v=admin",
      help: "/prototyp/11",
    }}
  />
{:else if n === 2}<Join
    gameName={v === "spiel" ? "Mister X Linz 2027" : undefined}
    code="linz-2027"
    name={v ? "Urfahr" : ""}
    password={v ? "falke27" : ""}
    initialError={v === "fehler" ? T.apiFehler.wrongSecret : undefined}
    initialExisting={v === "zweit" ? "Urfahr" : undefined}
    onsubmit={async () => {
      await new Promise((r) => setTimeout(r, 600));
      return { status: "joined", role: "team", token: "", uid: "" };
    }}
    onjoined={() => go("/prototyp/4?v=1")}
    onback={() => go("/prototyp/1")}
  />
{:else if n === 3}<StaffLogin
    role={v === "admin" ? "admin" : "schiri"}
    code="linz-2027"
    onsubmit={async ({ role }) => {
      await new Promise((r) => setTimeout(r, 500));
      go(role === "admin" ? "/prototyp/13" : "/prototyp/12");
    }}
    onsuperadmin={() => go("/prototyp/21")}
    onback={() => go("/prototyp/1")}
  />
{:else if n === 4}<Onboarding
    variant={v}
    actions={Object.fromEntries([1, 2, 3].map((i) => [i, () => toast(T.allgemein.prototyp("Freigabe"), "ok")]))}
    ondone={() => go("/prototyp/5")}
  />
{:else if n === 5}<Lobby
    gameName="Mister X Linz 2027"
    myTeam={{ id: M.ME, ...M.teams[M.ME]! }}
    roleLabel={T.warten.rolle.team}
    name={M.teams[M.ME]!.name}
    teams={M.teamIds.map((id) => ({ id, ...M.teams[id]! }))}
    config={M.config}
    startPlanned="14:00"
    checks={[
      { label: `${T.lobby.check.standort}: ${T.lobby.gut}`, ok: true, icon: MapPin },
      { label: T.lobby.check.push, ok: true, icon: Bell },
      { label: `${T.lobby.check.akku} 84 %`, ok: true, icon: BatteryMedium },
    ]}
    onrules={() => go("/prototyp/11")}
    onchat={() => go("/prototyp/10")}
  />
{:else if n === 6}<TeamHome variant={v} />
{:else if n === 7}<TeamHome mode="mrx" variant={v} />
{:else if n === 8}<TeamHome overlay="lock" />
{:else if n === 9}<TeamHome
    mode={v === "neu" ? "mrx" : "jaeger"}
    overlay={v === "neu" ? "handover-neu" : v === "erwischt" ? "handover-erwischt" : "handover-alle"}
  />
{:else if n === 10}<TeamHome tab="chat" />
{:else if n === 11}<TeamHome tab="regeln" />
{:else if n === 12}<Referee
    view={staffView("schiri")}
    api={fakeApi}
    preset={v === "uebergabe" ? "auwiesen" : null}
    onsend={(text) => M.chat.push({ id: `s${Date.now()}`, uid: "s1", name: "Schiri Anna", kind: "msg", t: Date.now(), text })}
    onlogout={() => go("/prototyp/1")}
  />
{:else if n === 13}<ProtoAdmin section={v === "chat" ? "chat" : "live"} />
{:else if n === 14}<ProtoAdmin section="steuerung" variant={v} />
{:else if n === 15}<ProtoAdmin section="teams" variant={v} />
{:else if n === 16}<ProtoAdmin section="zonen" variant={v} />
{:else if n === 17}<ProtoAdmin section="protokoll" />
{:else if n === 18}<BigScreen v={M.bigView(v)} viewer={v === "zuschauer"} />
{:else if n === 19}<Results
    results={M.result}
    teams={M.teams}
    onarchive={() => go("/prototyp/20?v=replay")}
    onscreen={() => go("/prototyp/18")}
  />
{:else if n === 20}{#if v === "replay"}<Replay data={M.archiveData()} onback={() => to(20, "liste")} />{:else}<Archive
      runs={M.archiveRuns}
      onopen={() => to(20, "replay")}
      onback={() => to(13)}
    />{/if}
{:else if n === 21}<SuperAdmin
    allowed
    games={M.games}
    onlogin={async () => {}}
    onsetup={async () => {}}
    oncreate={async () => {}}
    onopen={() => go("/prototyp/13")}
    onadminpw={async () => {}}
    inviteUrl={(id) => `${location.origin}/#/staff/admin?g=${id}`}
    onarchive={(id) => toast(`${id} archiviert`, "ok")}
    ondelete={(id) => toast(`${id} gelöscht`, "ok")}
    onback={() => go("/prototyp/3?v=admin")}
  />
{:else if n === 22}<TeamHome tab="mehr" />
{:else}<ErrorStates
    variant={v}
    onaction={() =>
      v === "entfernt" ? go("/prototyp/1") : v === "nichtGefunden" ? go("/prototyp/2") : toast(T.allgemein.prototyp(T.fehler.erneut))}
  />
{/if}

{#if !clean}
  <button class="handle" onclick={() => (open = true)} aria-label="Prototyp-Menü öffnen" title="Prototyp-Menü">
    <span>{n}</span>
  </button>
{/if}

{#if open}
  <button class="scrim" aria-label={T.allgemein.schliessen} onclick={() => (open = false)}></button>
  <aside class="drawer" aria-label="Prototyp-Menü">
    <header>
      <strong class="display">Prototyp · {n}/23</strong>
      <button class="x" onclick={() => (open = false)} aria-label={T.allgemein.schliessen}><X size={24} /></button>
    </header>
    <h2>{def.title}</h2>
    <p class="muted">{def.who} – {def.desc}</p>
    {#if def.variants}
      <p class="caps lbl">Zustand</p>
      <div class="vars">
        {#each def.variants as x (x.id)}
          <button class:on={x.id === v} onclick={() => to(n, x.id)}>{x.label}</button>
        {/each}
      </div>
    {/if}
    <p class="caps lbl">Darstellung</p>
    <Segmented
      label="Darstellung"
      bind:value={choice}
      onchange={(c) => theme.set(c)}
      options={(["auto", "hell", "dunkel", "sonne"] as const).map((c) => ({ value: c, label: T.einstellungen.themes[c] }))}
    />
    <nav>
      <button disabled={n <= 1} onclick={() => to(n - 1)}><ChevronLeft size={22} />Zurück</button>
      <button onclick={() => go("/prototyp")}><LayoutGrid size={22} />Übersicht</button>
      <button disabled={n >= 23} onclick={() => to(n + 1)}>Weiter<ChevronRight size={22} /></button>
    </nav>
  </aside>
{/if}

<style>
  .handle {
    position: fixed;
    left: 0;
    top: 50%;
    z-index: 90;
    width: 28px;
    height: 64px;
    translate: 0 -50%;
    border: 2px solid #fff;
    border-left: 0;
    border-radius: 0 12px 12px 0;
    background: #6b2bd9;
    color: #fff;
    font-weight: 800;
    font-size: 14px;
    cursor: pointer;
    opacity: 0.75;
    box-shadow: 0 2px 8px rgb(0 0 0 / 0.4);
  }
  .handle:hover {
    opacity: 1;
  }
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 91;
    border: 0;
    background: rgb(0 0 0 / 0.5);
  }
  .drawer {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 92;
    width: min(360px, 90vw);
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    padding: var(--sp-4);
    background: var(--surface);
    border-right: 4px solid #6b2bd9;
    overflow-y: auto;
    animation: slide var(--dur-2) var(--ease-out);
  }
  @keyframes slide {
    from {
      translate: -100% 0;
    }
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #8c5cff;
  }
  .x {
    width: var(--touch);
    height: var(--touch);
    border: 0;
    background: none;
    color: var(--text);
    cursor: pointer;
  }
  .lbl {
    color: var(--text-2);
    margin-top: var(--sp-2);
  }
  .vars {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
  }
  .vars button {
    min-height: 44px;
    padding: 0 var(--sp-3);
    border-radius: var(--r-pill);
    border: 2px solid var(--line);
    background: var(--surface-2);
    color: var(--text);
    font-weight: 700;
    cursor: pointer;
  }
  .vars button.on {
    border-color: #8c5cff;
    background: #8c5cff;
    color: #fff;
  }
  nav {
    margin-top: auto;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: var(--sp-2);
  }
  nav button {
    min-height: var(--touch);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    border-radius: var(--r-m);
    border: var(--border-w) solid var(--line);
    background: var(--surface-2);
    color: var(--text);
    font-weight: 700;
    cursor: pointer;
  }
  nav button:disabled {
    opacity: 0.4;
  }
</style>
