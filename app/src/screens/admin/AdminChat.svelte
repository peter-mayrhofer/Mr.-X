<!-- Chat der Spielleitung (Abschnitt 7.5): Gruppenchat + Postfach mit Ungelesen-Zählern pro Team, Moderation. -->
<script lang="ts">
  import ChatView from "../parts/ChatView.svelte";
  import type { StaffView } from "../../lib/staff.ts";

  interface Props {
    view: StaffView;
    /** zuletzt gelesen pro Team (Zeitstempel) */
    seen: Record<string, number>;
    onthread: (teamId: string) => void;
    onsend: (text: string, channel: "alle" | "dm", teamId?: string) => void;
  }
  let { view, seen, onthread, onsend }: Props = $props();

  const inbox = $derived(
    Object.entries(view.dm)
      .filter(([, list]) => list.length)
      .map(([teamId, list]) => ({
        teamId,
        unread: list.filter((m) => m.teamId === teamId && m.t > (seen[teamId] ?? 0)).length,
        last: list.at(-1)!.text,
        t: list.at(-1)!.t,
      }))
      .sort((a, b) => b.t - a.t),
  );
</script>

<div class="chatwrap">
  <ChatView group={view.chat} teams={view.teams} myUid={view.myUid} admin {inbox} dmOf={(t) => view.dm[t] ?? []} {onthread} {onsend} />
</div>

<style>
  .chatwrap {
    position: absolute;
    inset: 0;
    max-width: 820px;
    margin: 0 auto;
  }
</style>
