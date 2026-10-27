<!-- Prototyp: Team-Ansicht (Screens 6–11, 22) mit Testdaten statt Datenbank. -->
<script lang="ts">
  import TeamHome, { type Scene, type TeamView } from "../screens/TeamHome.svelte";
  import { clock } from "../lib/clock.svelte.ts";
  import { signal } from "../lib/signal.ts";
  import { go } from "../lib/router.svelte.ts";
  import * as M from "./mock.svelte.ts";

  type Tab = "karte" | "chat" | "regeln" | "mehr";
  interface Props {
    mode?: "jaeger" | "mrx";
    tab?: Tab;
    overlay?: "lock" | "handover-alle" | "handover-neu" | "handover-erwischt" | null;
    variant?: string;
  }
  let { mode = "jaeger", tab = "karte", overlay = null, variant = "" }: Props = $props();

  const my = $derived(mode === "mrx" ? M.MRX : M.ME);
  const myUid = $derived(mode === "mrx" ? "u-km" : "u-ur");
  const cuts = $derived([...M.game.locked, ...(variant === "verkleinerung" ? ["norden"] : [])]);
  const scenes: Record<string, Scene["variant"]> = { "handover-alle": "alle", "handover-neu": "neuMrx", "handover-erwischt": "erwischt" };
  // svelte-ignore state_referenced_locally
  let scene = $state<Scene | null>(
    overlay && overlay in scenes ? { variant: scenes[overlay]!, from: "spallerhof", to: M.MRX, type: "fang", at: clock.now } : null,
  );
  // svelte-ignore state_referenced_locally
  let tabState = $state<Tab>(tab);

  const view = $derived<TeamView>({
    field: M.field,
    config: M.config,
    state: {
      phase: "laeuft",
      mrx: M.MRX,
      mrxSince: M.game.mrxSince,
      startedAt: M.game.startedAt,
      lastReportAt: M.game.lastReportAt,
      nextReportAt: M.game.nextReportAt,
      cuts: Object.fromEntries(cuts.map((c) => [c, M.game.startedAt])),
      rev: 1,
    },
    teams: M.teams,
    myTeamId: my,
    myUid,
    me: M.positions[my]!,
    reports: M.reports,
    lock:
      overlay === "lock" || overlay === "handover-erwischt"
        ? { until: M.locks.bindermichl!, reason: "uebergabe", caught: overlay === "handover-erwischt" }
        : null,
    chat: M.chat,
    dm: M.dm,
    online: variant !== "offline",
    lastDataAt: clock.now - 4 * 60_000,
    distM: M.stats[my]!.distM,
  });
</script>

<TeamHome
  {view}
  bind:tab={tabState}
  bind:scene
  announcement={variant === "durchsage" ? M.chat.find((c) => c.kind === "ann")! : null}
  shrinking={variant === "verkleinerung" ? "norden" : null}
  zoneOverride={variant === "grenze" ? "grenze" : variant === "draussen" ? "draussen" : undefined}
  onsend={(text, ch) => {
    const msg = { id: `p${Date.now()}`, uid: myUid, name: M.teams[my]!.name, teamId: my, kind: "msg" as const, t: clock.now, text };
    (ch === "alle" ? M.chat : M.dm).push(msg);
    signal("nachricht");
  }}
  onlogout={() => go("/prototyp/1")}
/>
