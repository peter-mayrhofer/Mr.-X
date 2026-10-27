<!-- Screen 21: Super-Admin – Anmeldung mit Organisator-Passwort (Ersteinrichtung mit dem Setup-Geheimnis), Spiele anlegen,
     Spiel-Admins vergeben (Passwort/Einladungslink), archivieren, löschen. -->
<script module lang="ts">
  export interface GameRow {
    id: string;
    name: string;
    phase?: string | undefined;
    teams?: number | undefined;
  }
</script>

<script lang="ts">
  import { Archive, ArchiveRestore, ArrowRight, KeyRound, Link, LogIn, LogOut, Plus, Trash } from "@lucide/svelte";
  import { GAME_ID, LIMITS, type Template } from "@mrx/shared";
  import AppBar from "../ui/AppBar.svelte";
  import Button from "../ui/Button.svelte";
  import Card from "../ui/Card.svelte";
  import Pill from "../ui/Pill.svelte";
  import BottomSheet from "../ui/BottomSheet.svelte";
  import TextField from "../ui/TextField.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import Modal from "../ui/Modal.svelte";
  import Banner from "../ui/Banner.svelte";
  import { toast } from "../ui/toast.svelte.ts";
  import { ApiError } from "../lib/api.ts";
  import { T } from "../texte.ts";

  interface Props {
    allowed: boolean;
    games: GameRow[];
    onlogin: (password: string) => Promise<void>;
    /** Passwort erstmals (oder neu) festlegen – mit dem Setup-Geheimnis vom Server */
    onsetup: (setupSecret: string, password: string) => Promise<void>;
    onlogout?: () => void;
    oncreate: (v: { gameId: string; name: string; template: Template; adminPassword: string }) => Promise<void>;
    onopen?: (id: string) => void;
    onadminpw: (id: string, pw: string) => Promise<void>;
    inviteUrl: (id: string) => string;
    onarchive?: (id: string) => void;
    onunarchive?: (id: string) => void;
    ondelete?: (id: string) => void;
    onback: () => void;
  }

  let {
    allowed,
    games,
    onlogin,
    onsetup,
    onlogout,
    oncreate,
    onopen,
    onadminpw,
    inviteUrl,
    onarchive,
    onunarchive,
    ondelete,
    onback,
  }: Props = $props();

  const MIN_PW = 10;
  let loginPw = $state("");
  let setupMode = $state(false);
  let setupSecret = $state("");
  let loginBusy = $state(false);
  let loginError = $state<string | undefined>();

  let creating = $state(false);
  let name = $state("");
  let code = $state("");
  let tpl = $state<Template>("linz");
  let pw = $state("");
  let busy = $state(false);
  let error = $state<string | undefined>();
  let pwFor = $state<GameRow | null>(null);
  let newPw = $state("");
  let del = $state<GameRow | null>(null);

  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30);
  const TONE: Record<string, "ok" | "info" | "neutral" | "warn"> = {
    laeuft: "ok",
    vorbereitung: "info",
    archiviert: "neutral",
    beendet: "neutral",
    pause: "warn",
  };
  const phaseLabel = (p: string | undefined) =>
    p && p in T.superadmin.phase ? T.superadmin.phase[p as keyof typeof T.superadmin.phase] : "–";
  const msg = (e: unknown) => (e instanceof ApiError ? (e.reason === "invalid" ? e.message : T.apiFehler[e.reason]) : T.apiFehler.network);

  async function create() {
    busy = true;
    error = undefined;
    try {
      await oncreate({ gameId: code, name: name.trim(), template: tpl, adminPassword: pw });
      toast(T.verwaltung.angelegt(name.trim()), "ok");
      creating = false;
      name = code = pw = "";
    } catch (e) {
      error = msg(e);
    } finally {
      busy = false;
    }
  }

  async function login() {
    loginBusy = true;
    loginError = undefined;
    try {
      if (setupMode) await onsetup(setupSecret.trim(), loginPw);
      else await onlogin(loginPw);
      loginPw = setupSecret = "";
    } catch (e) {
      loginError = msg(e);
    } finally {
      loginBusy = false;
    }
  }

  async function setPw() {
    if (!pwFor) return;
    try {
      await onadminpw(pwFor.id, newPw);
      toast(T.zugang.gespeichert(T.admin.adminPasswort), "ok");
      pwFor = null;
      newPw = "";
    } catch (e) {
      toast(msg(e), "warn");
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

<div class="page">
  <AppBar title={T.superadmin.titel} {onback}>
    {#snippet actions()}
      {#if allowed}<Button size="m" icon={Plus} onclick={() => (creating = true)}>{T.superadmin.neu}</Button>{/if}
    {/snippet}
  </AppBar>
  <div class="body">
    {#if !allowed}
      <Card>
        <form
          class="login"
          onsubmit={(e) => {
            e.preventDefault();
            void login();
          }}
        >
          <p>{T.verwaltung.nurOrganisator}</p>
          {#if setupMode}
            <Banner tone="info">{T.verwaltung.setupHinweis}</Banner>
            <TextField label={T.verwaltung.setupGeheimnis} bind:value={setupSecret} autocomplete="off" autocapitalize="none" />
          {/if}
          <TextField
            label={setupMode ? T.verwaltung.neuesPasswort : T.verwaltung.passwort}
            type="password"
            bind:value={loginPw}
            hint={setupMode ? T.zugang.mindestens(MIN_PW) : undefined}
            error={loginError}
            autocomplete={setupMode ? "new-password" : "current-password"}
          />
          <Button
            type="submit"
            size="l"
            icon={LogIn}
            loading={loginBusy}
            disabled={setupMode ? !setupSecret.trim() || loginPw.length < MIN_PW : !loginPw}
            >{setupMode ? T.verwaltung.festlegen : T.verwaltung.anmelden}</Button
          >
          <button type="button" class="linkish" onclick={() => ((setupMode = !setupMode), (loginError = undefined))}
            >{setupMode ? T.verwaltung.zurueckZumLogin : T.verwaltung.ersteinrichtung}</button
          >
        </form>
      </Card>
    {:else}
      <div class="who">
        <span class="avatar" aria-hidden="true">O</span>{T.superadmin.angemeldet}
        {#if onlogout}<Button size="m" variant="secondary" icon={LogOut} onclick={onlogout}>{T.verwaltung.abmelden}</Button>{/if}
      </div>
      {#each games as g (g.id)}
        <Card>
          <div class="game">
            <div class="info">
              <h2>{g.name}</h2>
              <p class="muted">
                <code>{g.id}</code>{#if g.teams !== undefined}
                  · {g.teams} Teams{/if}
              </p>
              <Pill tone={TONE[g.phase ?? ""] ?? "neutral"} dot>{phaseLabel(g.phase)}</Pill>
            </div>
            <div class="acts">
              {#if onopen}<Button size="m" icon={ArrowRight} onclick={() => onopen(g.id)}>{T.verwaltung.oeffnen}</Button>{/if}
              <Button size="m" variant="secondary" icon={KeyRound} onclick={() => (pwFor = g)}>{T.superadmin.adminZugang}</Button>
              <Button size="m" variant="secondary" icon={Link} onclick={() => copy(inviteUrl(g.id))}>{T.superadmin.einladung}</Button>
              {#if onarchive && g.phase !== "archiviert"}<Button size="m" variant="secondary" icon={Archive} onclick={() => onarchive(g.id)}
                  >{T.superadmin.archivieren}</Button
                >{/if}
              {#if onunarchive && g.phase === "archiviert"}<Button
                  size="m"
                  variant="secondary"
                  icon={ArchiveRestore}
                  onclick={() => onunarchive(g.id)}>{T.superadmin.reaktivieren}</Button
                >{/if}
              {#if ondelete}<Button size="m" variant="danger" icon={Trash} onclick={() => (del = g)}>{T.allgemein.loeschen}</Button>{/if}
            </div>
          </div>
        </Card>
      {:else}
        <p class="muted">{T.verwaltung.leer}</p>
      {/each}
    {/if}
  </div>
</div>

<BottomSheet open={creating} title={T.superadmin.neu} onclose={() => (creating = false)}>
  <div class="form">
    <TextField label={T.superadmin.name} bind:value={name} oninput={() => (code = slug(name))} placeholder="Mister X Linz 2028" />
    <TextField
      label={T.superadmin.code}
      bind:value={code}
      hint="…/#/s/{code || '…'}"
      error={code && !GAME_ID.test(code) ? T.verwaltung.codeUngueltig : undefined}
      autocapitalize="none"
    />
    <Segmented
      label={T.superadmin.vorlage}
      bind:value={tpl}
      options={[
        { value: "linz", label: "Linz Innenstadt" },
        { value: "leer", label: T.verwaltung.leeresFeld },
      ]}
    />
    <TextField
      label={T.staffLogin.adminPasswort}
      type="password"
      bind:value={pw}
      hint={T.zugang.mindestens(LIMITS.adminPw)}
      {error}
      autocomplete="new-password"
    />
  </div>
  {#snippet footer()}
    <Button
      block
      size="l"
      loading={busy}
      disabled={name.trim().length < LIMITS.gameName[0] || !GAME_ID.test(code) || pw.length < LIMITS.adminPw}
      onclick={create}>{T.superadmin.neu}</Button
    >
  {/snippet}
</BottomSheet>

<BottomSheet open={!!pwFor} title="{T.superadmin.adminZugang}: {pwFor?.name ?? ''}" onclose={() => (pwFor = null)}>
  <TextField
    label={T.admin.passwortNeu}
    type="password"
    bind:value={newPw}
    hint={T.zugang.mindestens(LIMITS.adminPw)}
    autocomplete="new-password"
  />
  {#snippet footer()}
    <Button block size="l" disabled={newPw.length < LIMITS.adminPw} onclick={setPw}>{T.allgemein.speichern}</Button>
  {/snippet}
</BottomSheet>

{#if ondelete}
  <Modal
    open={!!del}
    title="{del?.name} {T.allgemein.loeschen}?"
    confirm={T.allgemein.loeschen}
    danger
    onconfirm={() => del && ondelete(del.id)}
    onclose={() => (del = null)}
  >
    {T.verwaltung.loeschenFrage}
  </Modal>
{/if}

<style>
  .page {
    min-height: 100dvh;
  }
  .body {
    display: grid;
    gap: var(--sp-4);
    padding: var(--sp-4) var(--gutter) var(--sp-8);
    max-width: 1000px;
    margin: 0 auto;
  }
  .login {
    display: grid;
    gap: var(--sp-3);
    max-width: 420px;
  }
  .linkish {
    justify-self: start;
    background: none;
    border: 0;
    padding: var(--sp-2) 0;
    color: var(--accent);
    font: inherit;
    text-decoration: underline;
    cursor: pointer;
    min-height: 44px;
  }
  .who {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    color: var(--text-2);
  }
  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--accent);
    color: var(--on-accent);
    font-weight: 800;
  }
  .game {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-4);
    align-items: center;
  }
  .info {
    flex: 1 1 260px;
    display: grid;
    gap: var(--sp-2);
    justify-items: start;
  }
  .acts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
  }
  .form {
    display: grid;
    gap: var(--sp-4);
  }
</style>
