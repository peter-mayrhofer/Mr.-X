<!--
  Spieltag-Checkliste (E-74) in der Steuerung, solange das Spiel noch nicht läuft: Was die App selbst sieht, wird
  automatisch abgehakt (Spielfeld, Team-Passwort, Teams, Standorte, Akku, Schiri, Fahnen-Tracker). Der Rest
  (Großbild, Regeln erklärt …) zum Abhaken – gemerkt nur auf diesem Gerät. Nichts davon sperrt den Start.
-->
<script lang="ts">
  import { Circle, CircleCheck, ClipboardCheck } from "@lucide/svelte";
  import { PROTOKOLL } from "@mrx/shared";
  import Card from "../../ui/Card.svelte";
  import Pill from "../../ui/Pill.svelte";
  import { clock } from "../../lib/clock.svelte.ts";
  import { isOffline, type StaffView } from "../../lib/staff.ts";
  import { T } from "../../texte.ts";

  let { view }: { view: StaffView } = $props();
  const C = T.checkliste;
  const AKKU = 30;

  const name = (id: string) => view.teams[id]?.name ?? "?";
  const teams = $derived(Object.keys(view.teams));
  const members = $derived(Object.values(view.members));
  const ohneStandort = $derived(teams.filter((id) => isOffline(view.positions[id], clock.now)));
  const akkuLeer = $derived(teams.filter((id) => (view.positions[id]?.battery ?? 100) < AKKU));
  const fahne = $derived(Object.values(view.devices).filter((d) => d.assign === "fahne"));

  const auto = $derived([
    { ok: view.field.base.length >= 4, text: C.spielfeld },
    // ponytail: ob das Team-Passwort gesetzt ist, steht nur im Protokoll („Neue Runde“ löscht beides) – oder ein Team ist schon da
    { ok: teams.length > 0 || view.audit.some((e) => e.action === PROTOKOLL.teamPwFestgelegt), text: C.teamPw },
    { ok: teams.length >= 2, text: C.teams(teams.length) },
    { ok: teams.length > 0 && !ohneStandort.length, text: C.standorte, offen: ohneStandort.map(name).join(", ") },
    {
      ok: teams.length > 0 && !akkuLeer.length,
      text: C.akku(AKKU),
      offen: akkuLeer.map((id) => `${name(id)} (${view.positions[id]?.battery} %)`).join(", "),
    },
    { ok: members.some((m) => m.role === "schiri"), text: C.schiri },
    { ok: members.some((m) => m.role === "schiri" && m.followsFlag), text: C.begleitung },
    ...(fahne.length ? [{ ok: fahne.some((d) => !isOffline(d.pos, clock.now)), text: C.fahne }] : []),
  ]);

  // von Hand abgehakt: nur in diesem Browser, je Spiel (die Steuerung gehört immer zu einem Spiel)
  // svelte-ignore state_referenced_locally
  const KEY = `mrx.checkliste.${view.gameId}`;
  let haken = $state<boolean[]>(lesen());
  function lesen(): boolean[] {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? "[]") as boolean[];
    } catch {
      return [];
    }
  }
  function setze(i: number, on: boolean) {
    haken[i] = on;
    try {
      localStorage.setItem(KEY, JSON.stringify(haken));
    } catch {
      /* privates Fenster: dann eben nur bis zum Neuladen */
    }
  }

  const erledigt = $derived(auto.filter((a) => a.ok).length + C.manuell.filter((_, i) => haken[i]).length);
  const gesamt = $derived(auto.length + C.manuell.length);
</script>

<Card label={C.titel} icon={ClipboardCheck}>
  {#snippet action()}<Pill tone={erledigt === gesamt ? "ok" : "neutral"}>{C.stand(erledigt, gesamt)}</Pill>{/snippet}
  <ul class="list">
    {#each auto as a (a.text)}
      <li class:ok={a.ok}>
        {#if a.ok}<CircleCheck size={20} aria-hidden="true" />{:else}<Circle size={20} aria-hidden="true" />{/if}
        <span>
          <span class="sr-only">{a.ok ? C.erledigt : C.offen}:</span>
          {a.text}
          {#if !a.ok && a.offen}<small class="muted">{a.offen}</small>{/if}
        </span>
      </li>
    {/each}
    {#each C.manuell as text, i (text)}
      <li class:ok={haken[i]}>
        <label>
          <input type="checkbox" checked={!!haken[i]} onchange={(e) => setze(i, e.currentTarget.checked)} />
          <span>{text}</span>
        </label>
      </li>
    {/each}
  </ul>
  <p class="muted small">{C.hinweis}</p>
</Card>

<style>
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--sp-2);
  }
  li {
    display: flex;
    gap: var(--sp-2);
    align-items: flex-start;
    color: var(--text-2);
  }
  li.ok {
    color: var(--text);
  }
  li.ok :global(svg) {
    color: var(--ok);
  }
  li small {
    display: block;
  }
  label {
    display: flex;
    gap: var(--sp-2);
    align-items: flex-start;
    cursor: pointer;
  }
  input {
    width: 20px;
    height: 20px;
    margin: 0;
    flex: none;
    accent-color: var(--ok);
  }
  .small {
    margin: var(--sp-3) 0 0;
    font-size: 14px;
  }
</style>
