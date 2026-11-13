<!--
  Zugänge eines Spiels (Teil von Screen 15): Team-Passwort, Schiri-Code, Admin-Passwort neu festlegen
  (gehasht gespeichert → nur neu setzen, nicht auslesen, E-06), drei Druckblätter (Teams, Schiris, Spielleitung) mit
  QR-Code, Spiel-Code und Passwort, Großbild-Link. Optional „Neue Runde vorbereiten“.
  Das Passwort für ein Blatt kennt die App nur, wenn es gerade hier festgelegt wurde (Arbeitsspeicher) – sonst wird es
  beim Drucken eingetippt und vom Server geprüft. Gespeichert wird es nirgends.
-->
<script lang="ts">
  import { tick } from "svelte";
  import { renderSVG } from "uqr";
  import { Award, CircleCheck, Copy, KeyRound, Monitor, Printer, RefreshCw, ShieldCheck, Trash, TriangleAlert } from "@lucide/svelte";
  import { LIMITS, type SecretKind, type Team } from "@mrx/shared";
  import Card from "../../ui/Card.svelte";
  import Button from "../../ui/Button.svelte";
  import TextField from "../../ui/TextField.svelte";
  import Modal from "../../ui/Modal.svelte";
  import PrintSheet from "./PrintSheet.svelte";
  import Urkunden from "./Urkunden.svelte";
  import { toast } from "../../ui/toast.svelte.ts";
  import { ApiError } from "../../lib/api.ts";
  import { druck, druckeUrkunden, merke } from "../../lib/druck.svelte.ts";
  import { T } from "../../texte.ts";

  type Role = "team" | "schiri" | "admin";
  interface Props {
    gameName: string;
    /** Spiel-Link …/#/s/<code> – daraus Adresse und Spiel-Code */
    joinUrl: string;
    /** Großbild-Link wird erst auf Anfrage geholt (enthält den Schlüssel) */
    loadScreenUrl: () => Promise<string>;
    onsave: (kind: SecretKind, value: string | null) => Promise<void>;
    /** stimmt das eingetippte Passwort? (Server, nur Prüfsumme); fehlt im Prototyp → ungeprüft */
    checkSecret?: (kind: SecretKind, value: string) => Promise<boolean>;
    onreset?: () => void;
    /** nur Desktop-App: Großbild im Vollbild auf dem Beamer öffnen (ohne Angabe kein Knopf) */
    onbeamer?: () => void;
    /** Teams des Spiels: Urkunden (ein Blatt pro Team) */
    teams?: Record<string, Team>;
  }

  let { gameName, joinUrl, loadScreenUrl, onsave, checkSecret, onreset, onbeamer, teams = {} }: Props = $props();
  let urkunden = $state(false);
  const teamZahl = $derived(Object.keys(teams).length);
  const values = $state<Record<SecretKind, string>>({ teamPw: "", schiriCode: "", adminPw: "" });
  let busy = $state<SecretKind | null>(null);
  let screenUrl = $state<string | null>(null);
  let confirmDelete = $state(false);
  let confirmReset = $state(false);
  // Druck: welches Blatt, Passwort-Abfrage
  let printing = $state<Role | null>(null);
  let ask = $state<Role | null>(null);
  let askValue = $state("");
  let askError = $state<string | undefined>();
  let keepOpen = false;

  const MIN: Record<SecretKind, number> = { teamPw: LIMITS.teamPw, schiriCode: LIMITS.schiriCode, adminPw: LIMITS.adminPw };
  const LABEL: Record<SecretKind, string> = {
    teamPw: T.admin.teamPasswort,
    schiriCode: T.admin.schiriCode,
    adminPw: T.admin.adminPasswort,
  };
  const KIND: Record<Role, SecretKind> = { team: "teamPw", schiri: "schiriCode", admin: "adminPw" };
  const ROLES: Role[] = ["team", "schiri", "admin"];
  const D = T.druck;

  /** Spiel-Code: letzter Teil des Spiel-Links …/#/s/<code>; Adresse: alles vor „#“ */
  const code = $derived(joinUrl.split("/").pop() ?? "");
  const base = $derived(joinUrl.split("#")[0]);
  // QR-Codes führen nur zur passenden Anmeldung mit Spiel-Code – Name und Passwort tippt man selbst
  const urls = $derived<Record<Role, string>>({
    team: `${base}#/beitreten/${code}`,
    schiri: `${base}#/staff/schiri?g=${code}`,
    admin: `${base}#/staff/admin?g=${code}`,
  });
  const known = $derived(druck.pw[code] ?? {});
  const qr = (s: string) => renderSVG(s, { border: 2, whiteColor: "#fff", blackColor: "#000" });

  async function save(kind: SecretKind, value: string | null) {
    busy = kind;
    try {
      await onsave(kind, value);
      merke(code, kind, value);
      values[kind] = "";
      toast(value === null ? T.zugang.geloescht(LABEL[kind]) : T.zugang.gespeichert(LABEL[kind]), value === null ? "warn" : "ok");
    } catch (e) {
      toast(e instanceof ApiError ? (e.reason === "invalid" ? e.message : T.apiFehler[e.reason]) : T.apiFehler.network, "warn");
    } finally {
      busy = null;
    }
  }

  async function doPrint(role: Role) {
    printing = role;
    await tick();
    print();
  }
  /** Drucken: Passwort bekannt → gleich; sonst einmal eintippen (der Server prüft, ob es stimmt) */
  function startPrint(role: Role) {
    if (known[KIND[role]]) return void doPrint(role);
    ask = role;
    askValue = "";
    askError = undefined;
  }
  async function confirmPrint() {
    const role = ask!;
    const value = askValue;
    try {
      if (checkSecret && !(await checkSecret(KIND[role], value))) {
        askError = role === "team" && !value ? D.keinTeamPw : D.falsch;
        return;
      }
      merke(code, KIND[role], value);
      ask = null;
      await doPrint(role);
    } catch (e) {
      askError = e instanceof ApiError ? T.apiFehler[e.reason] : T.apiFehler.network;
    }
  }

  async function copy(s: string) {
    try {
      await navigator.clipboard.writeText(s);
      toast(T.zugang.kopiert, "ok");
    } catch {
      toast(T.zugang.nichtKopiert, "warn");
    }
  }
</script>

<div class="grid">
  {#each ["teamPw", "schiriCode", "adminPw"] as const as kind (kind)}
    <Card label={LABEL[kind]} icon={kind === "schiriCode" ? ShieldCheck : KeyRound}>
      <p class="muted small">{kind === "teamPw" ? T.zugang.teamPwHinweis : T.zugang.nichtAnzeigbar}</p>
      <TextField
        label={T.admin.passwortNeu}
        type={kind === "adminPw" ? "password" : "text"}
        bind:value={values[kind]}
        autocomplete={kind === "adminPw" ? "new-password" : "off"}
        hint={T.zugang.mindestens(MIN[kind])}
      />
      <div class="row">
        <Button size="m" loading={busy === kind} disabled={values[kind].length < MIN[kind]} onclick={() => save(kind, values[kind])}
          >{T.allgemein.speichern}</Button
        >
        {#if kind === "teamPw"}
          <Button size="m" variant="danger" icon={Trash} onclick={() => (confirmDelete = true)}>{T.allgemein.loeschen}</Button>
        {/if}
      </div>
    </Card>
  {/each}

  <Card label={D.karte} icon={Printer}>
    <p class="muted small">{D.hinweis}</p>
    <TextField label={D.telefon} hint={D.telefonHinweis} type="tel" bind:value={druck.tel} autocomplete="off" />
    <ul class="sheets">
      {#each ROLES as role (role)}
        <li>
          <!-- eslint-disable-next-line svelte/no-at-html-tags -- SVG aus eigenem Link (uqr) -->
          <div class="mini">{@html qr(urls[role])}</div>
          <div class="txt">
            <strong>{D.blatt[role]}</strong>
            {#if known[KIND[role]]}
              <span class="ok"><CircleCheck size={16} aria-hidden="true" />{D.bekannt}</span>
            {:else}
              <span class="muted">{D.eingeben}</span>
            {/if}
          </div>
          <Button size="m" variant="secondary" icon={Printer} onclick={() => startPrint(role)}>{D.drucken}</Button>
        </li>
      {/each}
    </ul>
    <div class="row">
      <Button size="m" variant="ghost" icon={Copy} onclick={() => copy(urls.team)}>{T.zugang.kopieren}</Button>
    </div>
  </Card>

  <Card label={T.urkunde.knopf} icon={Award}>
    <p class="muted small">{T.urkunde.hinweis(teamZahl)}</p>
    <Button
      size="m"
      variant="secondary"
      icon={Printer}
      disabled={!teamZahl}
      onclick={() =>
        druckeUrkunden(
          async () => {
            urkunden = true;
            await tick();
          },
          () => (urkunden = false),
        )}>{T.urkunde.knopf}</Button
    >
  </Card>

  <Card label={T.admin.grossbildLink} icon={Monitor}>
    {#if onbeamer}
      <div class="row beamer">
        <Button size="m" icon={Monitor} onclick={onbeamer}>{T.grossbild.beamer}</Button>
      </div>
    {/if}
    {#if screenUrl}
      <div class="qr">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -- SVG aus eigenem Link (uqr) -->
        <div class="code">{@html qr(screenUrl)}</div>
        <div class="qrtext">
          <code>{screenUrl}</code>
          <div class="row">
            <Button size="m" variant="secondary" icon={Copy} onclick={() => copy(screenUrl!)}>{T.zugang.kopieren}</Button>
          </div>
        </div>
      </div>
    {:else}
      <p class="muted small">{T.zugang.grossbildHinweis}</p>
      <Button size="m" variant="secondary" icon={Monitor} onclick={async () => (screenUrl = await loadScreenUrl())}
        >{T.zugang.grossbildZeigen}</Button
      >
    {/if}
  </Card>

  {#if onreset}
    <Card label={T.admin.neueRunde} icon={TriangleAlert} tone="warn">
      <p class="small">{T.admin.neueRundeText}</p>
      <Button variant="danger" icon={RefreshCw} onclick={() => (confirmReset = true)}>{T.admin.neueRunde}</Button>
    </Card>
  {/if}
</div>

{#if urkunden}<Urkunden {gameName} {teams} />{/if}

<!-- Druckansicht (nur beim Drucken sichtbar); Beispiel: docs/flyer-beispiel.pdf -->
<PrintSheet
  role={printing ?? "team"}
  {gameName}
  {code}
  url={urls[printing ?? "team"]}
  secret={known[KIND[printing ?? "team"]] ?? ""}
  tel={druck.tel.trim()}
/>

<Modal
  open={!!ask}
  title={ask ? D.frage(D.blatt[ask]) : ""}
  confirm={D.drucken}
  onconfirm={() => {
    // der Dialog schließt nach „Drucken“ von selbst – erst schließen, wenn das Passwort stimmt
    keepOpen = true;
    void confirmPrint();
  }}
  onclose={() => {
    if (keepOpen) keepOpen = false;
    else ask = null;
  }}
>
  <p class="small">{D.frageText}</p>
  {#if ask}
    <TextField
      label={D.geheim[ask]}
      type={ask === "admin" ? "password" : "text"}
      bind:value={askValue}
      error={askError}
      autocomplete="off"
    />
  {/if}
</Modal>
<Modal
  open={confirmDelete}
  title="{T.admin.teamPasswort} {T.allgemein.loeschen}?"
  confirm={T.allgemein.loeschen}
  danger
  onconfirm={() => save("teamPw", null)}
  onclose={() => (confirmDelete = false)}
>
  {T.zugang.loeschenFrage}
</Modal>
{#if onreset}
  <Modal
    open={confirmReset}
    title="{T.admin.neueRunde}?"
    confirm={T.admin.neueRunde}
    danger
    onconfirm={onreset}
    onclose={() => (confirmReset = false)}
  >
    {T.admin.neueRundeText}
  </Modal>
{/if}

<style>
  .grid {
    display: grid;
    gap: var(--sp-4);
  }
  @media (min-width: 900px) {
    .grid {
      grid-template-columns: 1fr 1fr;
      align-items: start;
    }
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
    margin-top: var(--sp-3);
  }
  .small {
    font-size: var(--fs-s);
    margin-bottom: var(--sp-3);
  }
  .beamer {
    margin: 0 0 var(--sp-3);
  }
  .sheets {
    list-style: none;
    margin: var(--sp-3) 0 0;
    padding: 0;
    display: grid;
    gap: var(--sp-3);
  }
  .sheets li {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
  }
  .mini {
    width: 56px;
    height: 56px;
    flex: none;
    border-radius: var(--r-s);
    overflow: hidden;
  }
  .mini :global(svg),
  .code :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }
  .txt {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 2px;
  }
  .txt span {
    font-size: var(--fs-s);
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .ok {
    color: var(--ok-text);
    font-weight: 600;
  }
  .qr {
    display: flex;
    gap: var(--sp-4);
    align-items: center;
    flex-wrap: wrap;
  }
  .code {
    width: 140px;
    height: 140px;
    flex: none;
    border-radius: var(--r-s);
    overflow: hidden;
  }
  .qrtext {
    flex: 1;
    min-width: 200px;
  }
  code {
    word-break: break-all;
    font-size: var(--fs-s);
  }
</style>
