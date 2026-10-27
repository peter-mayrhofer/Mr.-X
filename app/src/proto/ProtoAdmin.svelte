<!-- Prototyp: Spielleitung (Screens 13–17) mit Testdaten und nachgespieltem Spiel-Server. -->
<script lang="ts">
  import AdminShell, { type Section } from "../screens/admin/AdminShell.svelte";
  import AdminLive from "../screens/admin/AdminLive.svelte";
  import AdminChat from "../screens/admin/AdminChat.svelte";
  import AdminControl from "../screens/admin/AdminControl.svelte";
  import AdminTeams from "../screens/admin/AdminTeams.svelte";
  import AdminLog from "../screens/admin/AdminLog.svelte";
  import ZoneEditor from "../screens/admin/ZoneEditor.svelte";
  import type { Field } from "@mrx/shared";
  import { go } from "../lib/router.svelte.ts";
  import { toast } from "../ui/toast.svelte.ts";
  import { T } from "../texte.ts";
  import { clock } from "../lib/clock.svelte.ts";
  import * as M from "./mock.svelte.ts";
  import { fakeApi, staffView } from "./staffMock.svelte.ts";

  let { section, variant = "" }: { section: Section; variant?: string } = $props();
  const view = $derived(staffView("admin", section === "steuerung" && variant === "vorStart" ? "vorbereitung" : M.game.phase));
  const LINKS: Record<Section, string> = {
    live: "/prototyp/13",
    steuerung: "/prototyp/14",
    teams: "/prototyp/15",
    zonen: "/prototyp/16",
    protokoll: "/prototyp/17",
    chat: "/prototyp/13?v=chat",
    grossbild: "/prototyp/18",
    archiv: "/prototyp/20?v=liste",
  };
  let seen = $state<Record<string, number>>({});
  // Fehlerzustand vorführen: zwei Eckpunkte vertauscht → Linie kreuzt sich
  function broken(): Field {
    const f = structuredClone($state.snapshot(M.field)) as Field;
    [f.base[40], f.base[60]] = [f.base[60]!, f.base[40]!];
    return f;
  }
</script>

<AdminShell {section} gameName={view.gameName} phase={view.state.phase} link={(id) => LINKS[id]} unread={3}>
  {#if section === "live"}<AdminLive {view} api={fakeApi} />
  {:else if section === "chat"}<AdminChat
      {view}
      {seen}
      onthread={(t) => (seen[t] = clock.now)}
      onsend={(text, ch, teamId) => {
        const msg = { id: `a${Date.now()}`, uid: "adm", name: "Peter", kind: "msg" as const, t: clock.now, text };
        if (ch === "alle") M.chat.push(msg);
        else if (teamId === "urfahr") M.dm.push(msg);
      }}
    />
  {:else if section === "steuerung"}<AdminControl {view} api={fakeApi} onstarted={() => go("/prototyp/13")} />
  {:else if section === "teams"}<AdminTeams
      {view}
      api={fakeApi}
      {variant}
      joinUrl="https://mr-x-ooe-neu.web.app/#/s/linz-2027"
      screenUrl={(k) => `https://mr-x-ooe-neu.web.app/#/g/linz-2027?k=${k}`}
    />
  {:else if section === "zonen"}<ZoneEditor
      initial={variant === "fehler" ? broken() : M.field}
      onsave={async () => toast(T.allgemein.prototyp(T.allgemein.speichern))}
    />
  {:else}<AdminLog audit={M.audit} />
  {/if}
</AdminShell>
