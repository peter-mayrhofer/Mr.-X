<!--
  Chat (Abschnitt 7.5): Gruppenchat + Direktkanal zur Spielleitung. System-Meldungen klar abgesetzt,
  Standort-Meldungen antippbar (→ Karte), Durchsagen hervorgehoben. Nur Text + Emojis, max. 300 Zeichen.
  Admin: Postfach mit Ungelesen-Zählern pro Team.
-->
<script lang="ts">
  import { tick } from "svelte";
  import { ArrowDown, Flag, Info, MapPin, Megaphone, Play, Send, Shrink } from "@lucide/svelte";
  import type { ChatMessage, Team } from "@mrx/shared";
  import Segmented from "../../ui/Segmented.svelte";
  import TeamBadge from "../../ui/TeamBadge.svelte";
  import ListItem from "../../ui/ListItem.svelte";
  import IconButton from "../../ui/IconButton.svelte";
  import { uhr, vor } from "../../lib/format.ts";
  import { clock } from "../../lib/clock.svelte.ts";
  import { T } from "../../texte.ts";

  type Msg = ChatMessage & { id: string };
  interface Props {
    group: Msg[];
    direct: Msg[];
    teams: Record<string, Team>;
    myUid: string;
    admin?: boolean;
    inbox?: { teamId: string; unread: number; last: string; t: number }[];
    tab?: "alle" | "dm";
    onreport?: (reportId: string) => void;
    onsend: (text: string, channel: "alle" | "dm") => void;
  }

  let { group, direct, teams, myUid, admin = false, inbox = [], tab = $bindable("alle"), onreport, onsend }: Props = $props();
  const MAX = 300;
  let text = $state("");
  let box: HTMLDivElement | undefined = $state();
  let atBottom = $state(true);
  let unseen = $state(0);
  let dmTeam = $state<string | null>(null);

  const list = $derived(tab === "alle" ? group : direct);
  const showInbox = $derived(admin && tab === "dm" && !dmTeam);
  const unreadDm = $derived(admin ? inbox.reduce((s, i) => s + i.unread, 0) : 0);

  const sysIcon = (m: Msg) =>
    m.reportId
      ? MapPin
      : /verkleinert|gesperrt/i.test(m.text)
        ? Shrink
        : /gefangen|Übergabe|Fahne/i.test(m.text)
          ? Flag
          : /gestartet/i.test(m.text)
            ? Play
            : Info;

  function scrollDown() {
    box?.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
    unseen = 0;
  }

  let prev = 0;
  $effect(() => {
    const n = list.length;
    void tick().then(() => {
      if (n > prev && prev > 0 && !atBottom) unseen += n - prev;
      else box?.scrollTo({ top: box.scrollHeight });
      prev = n;
    });
  });

  function send(e: SubmitEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onsend(t, tab);
    text = "";
    atBottom = true;
  }
</script>

<div class="chat">
  <div class="head">
    <Segmented
      label="Chat-Kanal"
      bind:value={tab}
      options={[
        { value: "alle", label: T.chat.alle },
        { value: "dm", label: admin ? T.chat.postfach : T.chat.spielleitung, badge: unreadDm },
      ]}
      onchange={() => (dmTeam = null)}
    />
  </div>

  {#if showInbox}
    <div class="inbox">
      {#each inbox as it (it.teamId)}
        {@const team = teams[it.teamId]!}
        <ListItem title={team.name} subtitle="{it.last} · {vor(it.t, clock.now)}" onclick={() => (dmTeam = it.teamId)} chevron>
          {#snippet lead()}<TeamBadge short={team.short} color={team.color} size={40} />{/snippet}
          {#snippet trail()}{#if it.unread}<span class="unread num">{it.unread}</span>{/if}{/snippet}
        </ListItem>
      {/each}
    </div>
  {:else}
    <div
      class="msgs"
      bind:this={box}
      onscroll={() => {
        if (!box) return;
        atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
        if (atBottom) unseen = 0;
      }}
      role="log"
      aria-live="polite"
    >
      {#each list as m (m.id)}
        {#if m.kind === "ann"}
          <article class="ann">
            <header><Megaphone size={22} aria-hidden="true" /><span class="caps">{T.chat.durchsage}</span><time>{uhr(m.t)}</time></header>
            <p>{m.text}</p>
          </article>
        {:else if m.kind === "sys"}
          {@const IconC = sysIcon(m)}
          <article class="sys">
            <IconC size={20} aria-hidden="true" />
            <div>
              <p>{m.text}</p>
              <time>{uhr(m.t)}</time>
              {#if m.reportId && onreport}
                <button class="jump" onclick={() => onreport(m.reportId!)}>{T.chat.aufKarte} ›</button>
              {/if}
            </div>
          </article>
        {:else}
          {@const mine = m.uid === myUid}
          {@const team = m.teamId ? teams[m.teamId] : undefined}
          <article class="msg" class:mine>
            {#if !mine}
              {#if team}<TeamBadge short={team.short} color={team.color} size={34} />{:else}<span class="staffdot" aria-hidden="true"
                  >SL</span
                >{/if}
            {/if}
            <div class="bubble">
              {#if !mine}<strong>{m.name}</strong>{/if}
              <p>{m.text}</p>
              <time>{uhr(m.t)}</time>
            </div>
          </article>
        {/if}
      {:else}
        <p class="empty">{T.chat.leer}</p>
      {/each}
    </div>

    {#if unseen > 0}
      <button class="newpill" onclick={scrollDown}><ArrowDown size={20} aria-hidden="true" />{T.chat.neu} ({unseen})</button>
    {/if}

    <form class="composer" onsubmit={send}>
      <label class="sr-only" for="chat-input">{T.chat.platzhalter}</label>
      <input id="chat-input" bind:value={text} maxlength={MAX} placeholder={T.chat.platzhalter} autocomplete="off" enterkeyhint="send" />
      {#if text.length > MAX - 50}<span class="count num">{T.chat.zeichen(text.length, MAX)}</span>{/if}
      <IconButton icon={Send} label={T.chat.senden} tone="accent" type="submit" disabled={!text.trim()} />
    </form>
  {/if}
</div>

<style>
  .chat {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .head {
    padding: var(--sp-3) var(--gutter);
  }
  .msgs,
  .inbox {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--sp-2) var(--gutter) var(--sp-4);
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    overscroll-behavior: contain;
  }
  .inbox {
    gap: 2px;
  }
  .unread {
    min-width: 28px;
    height: 28px;
    padding: 0 8px;
    border-radius: var(--r-pill);
    background: var(--accent);
    color: var(--on-accent);
    font-weight: 800;
    display: grid;
    place-items: center;
  }
  time {
    font-size: 14px;
    color: var(--text-3);
  }
  .msg {
    display: flex;
    align-items: flex-end;
    gap: var(--sp-2);
    max-width: 88%;
  }
  .msg.mine {
    align-self: flex-end;
  }
  .bubble {
    padding: var(--sp-2) var(--sp-3);
    border-radius: var(--r-m) var(--r-m) var(--r-m) 4px;
    background: var(--surface-2);
    border: var(--border-w) solid var(--line);
  }
  .bubble strong {
    font-size: var(--fs-s);
    color: var(--text-2);
  }
  .mine .bubble {
    border-radius: var(--r-m) var(--r-m) 4px var(--r-m);
    background: var(--me);
    border-color: var(--me);
    color: #fff;
  }
  .mine time {
    color: rgb(255 255 255 / 0.8);
  }
  .staffdot {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    flex: none;
    background: var(--text);
    color: var(--bg);
    font-family: var(--font-display);
    font-weight: 800;
  }
  .sys {
    align-self: center;
    width: min(100%, 520px);
    display: flex;
    gap: var(--sp-3);
    padding: var(--sp-3);
    border-radius: var(--r-m);
    background: var(--info-soft);
    border: var(--border-w) dashed var(--info);
    color: var(--text);
  }
  .sys > :global(svg) {
    flex: none;
    color: var(--info-text);
    margin-top: 2px;
  }
  .sys p {
    font-weight: 600;
  }
  .jump {
    display: block;
    margin-top: var(--sp-1);
    min-height: 40px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--info-text);
    font-weight: 800;
    cursor: pointer;
  }
  .ann {
    padding: var(--sp-4);
    border-radius: var(--r-m);
    background: var(--accent);
    color: var(--on-accent);
    box-shadow: var(--shadow-1);
  }
  .ann header {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    margin-bottom: var(--sp-2);
  }
  .ann time {
    margin-left: auto;
    color: rgb(255 255 255 / 0.85);
  }
  .ann p {
    font-size: var(--fs-l);
    font-weight: 700;
  }
  .empty {
    text-align: center;
    color: var(--text-3);
    margin-top: var(--sp-8);
  }
  .newpill {
    position: absolute;
    left: 50%;
    bottom: 84px;
    translate: -50% 0;
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    min-height: var(--touch);
    padding: 0 var(--sp-4);
    border: 0;
    border-radius: var(--r-pill);
    background: var(--accent);
    color: var(--on-accent);
    font-weight: 800;
    box-shadow: var(--shadow-2);
    cursor: pointer;
  }
  .composer {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--gutter) var(--sp-3);
    border-top: var(--border-w) solid var(--line);
    background: var(--surface);
  }
  .composer input {
    flex: 1;
    min-width: 0;
    min-height: var(--touch-l);
    padding: 0 var(--sp-4);
    border-radius: var(--r-pill);
    border: var(--border-strong) solid var(--line);
    background: var(--bg);
    font-size: var(--fs-m);
  }
  .composer input:focus {
    outline: none;
    border-color: var(--focus);
  }
  .count {
    font-size: 14px;
    color: var(--text-3);
  }
</style>
