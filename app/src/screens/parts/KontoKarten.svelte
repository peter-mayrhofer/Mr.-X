<!-- Verwaltung (E-84): „Mein Konto“ (Gültigkeit, Code einlösen, Passwort ändern) und für den Eigentümer Gratis-Codes,
     Organisator-Konten und das eigene Eigentümer-Konto. Holt sich seine Daten selbst. -->
<script lang="ts">
  import { Ban, Copy, KeyRound, Plus, Ticket, Trash, UserRound, Users } from "@lucide/svelte";
  import { CODE_MONATE, type CodeEntry, type CodeMonate, type KontoInfo, type KontoListEntry } from "@mrx/shared";
  import Banner from "../../ui/Banner.svelte";
  import BottomSheet from "../../ui/BottomSheet.svelte";
  import Button from "../../ui/Button.svelte";
  import Card from "../../ui/Card.svelte";
  import Modal from "../../ui/Modal.svelte";
  import Pill from "../../ui/Pill.svelte";
  import Segmented from "../../ui/Segmented.svelte";
  import Stepper from "../../ui/Stepper.svelte";
  import TextField from "../../ui/TextField.svelte";
  import { toast } from "../../ui/toast.svelte.ts";
  import { call, fehlerText } from "../../lib/api.ts";
  import { datum } from "../../lib/format.ts";
  import { kontoPasswort } from "../../lib/session.svelte.ts";
  import { T } from "../../texte.ts";

  interface Props {
    /** wer angemeldet ist – für die Zeile oben */
    onwer?: (text: string) => void;
  }
  let { onwer }: Props = $props();

  const K = T.konto;
  const MIN_PW = 10;
  let konto = $state<KontoInfo | null>(null);
  let eigentuemer = $state(false);
  let codes = $state<CodeEntry[]>([]);
  let konten = $state<KontoListEntry[]>([]);

  async function laden() {
    try {
      const i = await call({ action: "kontoInfo" });
      konto = i.konto;
      eigentuemer = i.eigentuemer;
      onwer?.(i.konto ? K.angemeldetAls(i.konto.email) : K.angemeldetEigentuemer);
      if (i.eigentuemer) {
        codes = (await call({ action: "codeListe" })).codes;
        konten = (await call({ action: "kontoListe" })).konten;
      }
    } catch (e) {
      toast(fehlerText(e), "warn");
    }
  }
  $effect(() => void laden());

  async function tu(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast(ok, "ok");
      await laden();
      return true;
    } catch (e) {
      toast(fehlerText(e), "warn");
      return false;
    }
  }
  async function kopieren(s: string) {
    try {
      await navigator.clipboard.writeText(s);
      toast(K.kopiert, "ok");
    } catch {
      toast(K.nichtKopiert, "warn");
    }
  }

  const abgelaufen = $derived(!!konto && konto.bisAt !== null && konto.bisAt < Date.now());
  const gilt = (bisAt: number | null) => (bisAt === null ? K.unbegrenzt : K.gueltigBis(datum(bisAt)));

  // Mein Konto
  let einCode = $state("");
  let pwOffen = $state(false);
  let pwAlt = $state("");
  let pwNeu = $state("");

  // Gratis-Codes
  let max = $state(1);
  let monate = $state<`${CodeMonate}`>("12");

  // Konten
  let pwFuer = $state<KontoListEntry | null>(null);
  let pwSetzen = $state("");
  let loeschen = $state<KontoListEntry | null>(null);

  // Eigentümer-Konto
  let eEmail = $state("");
  let ePw = $state("");
  const hatEigentuemerKonto = $derived(konten.some((k) => k.rolle === "eigentuemer"));
</script>

{#if konto}
  <Card label={K.meinKonto} icon={UserRound}>
    <div class="stack">
      <p><strong>{konto.email}</strong> · {gilt(konto.bisAt)}</p>
      {#if abgelaufen}<Banner tone="warn">{K.abgelaufen}</Banner>{/if}
      <form
        class="reihe"
        onsubmit={async (e) => {
          e.preventDefault();
          if (await tu(() => call({ action: "codeEinloesen", code: einCode }), K.eingeloest)) einCode = "";
        }}
      >
        <TextField label={K.code} bind:value={einCode} autocomplete="off" autocapitalize="characters" placeholder="MRX-…" />
        <Button type="submit" size="m" variant="secondary" icon={Ticket} disabled={!einCode.trim()}>{K.einloesen}</Button>
      </form>
      <Button size="m" variant="secondary" icon={KeyRound} onclick={() => (pwOffen = true)}>{K.passwortAendern}</Button>
    </div>
  </Card>
{/if}

{#if eigentuemer}
  <Card label={K.codes} icon={Ticket}>
    <div class="stack">
      <p class="muted">{K.codesHinweis}</p>
      <Stepper label={K.anzahl} bind:value={max} unit="×" min={1} max={1000} />
      <Segmented
        label={K.laufzeit}
        bind:value={monate}
        options={CODE_MONATE.map((m) => ({ value: `${m}` as const, label: K.monate(m) }))}
      />
      <Button
        size="m"
        icon={Plus}
        onclick={async () => {
          try {
            const { code } = await call({ action: "codeErstellen", max, monate: Number(monate) as CodeMonate });
            toast(K.codeNeu(code), "ok");
            await laden();
          } catch (e) {
            toast(fehlerText(e), "warn");
          }
        }}>{K.codeErstellen}</Button
      >
      <ul class="liste" aria-label={K.codes}>
        {#each codes as c (c.code)}
          <li>
            <code class="gross">{c.code}</code>
            <span class="muted">{K.benutzt(c.benutzt, c.max)} · {K.monate(c.monate)}</span>
            <Pill tone={c.aktiv && c.benutzt < c.max ? "ok" : "neutral"} dot
              >{!c.aktiv ? K.gesperrt : c.benutzt >= c.max ? K.aufgebraucht : K.aktiv}</Pill
            >
            <span class="knoepfe">
              <Button size="m" variant="secondary" icon={Copy} onclick={() => kopieren(c.code)}>{T.zugang.kopieren}</Button>
              <Button
                size="m"
                variant="secondary"
                icon={Ban}
                onclick={() => tu(() => call({ action: "codeSperren", code: c.code, aktiv: !c.aktiv }), K.gespeichert)}
                >{c.aktiv ? K.sperren : K.entsperren}</Button
              >
            </span>
          </li>
        {:else}
          <li class="muted">{K.keineCodes}</li>
        {/each}
      </ul>
    </div>
  </Card>

  <Card label={K.konten} icon={Users}>
    <ul class="liste" aria-label={K.konten}>
      {#each konten as k (k.id)}
        <li>
          <strong>{k.email}</strong>
          <span class="muted">{gilt(k.bisAt)} · {K.spiele(k.spiele)}</span>
          <Pill tone={k.gesperrt ? "warn" : k.rolle === "eigentuemer" ? "info" : "ok"} dot
            >{k.gesperrt ? K.gesperrt : k.rolle === "eigentuemer" ? K.eigentuemer : K.organisator}</Pill
          >
          <span class="knoepfe">
            <Button size="m" variant="secondary" icon={KeyRound} onclick={() => (pwFuer = k)}>{K.neuesPasswort}</Button>
            <Button
              size="m"
              variant="secondary"
              icon={Ban}
              onclick={() => tu(() => call({ action: "kontoSetzen", id: k.id, gesperrt: !k.gesperrt }), K.gespeichert)}
              >{k.gesperrt ? K.entsperren : K.sperren}</Button
            >
            <Button size="m" variant="danger" icon={Trash} onclick={() => (loeschen = k)}>{T.allgemein.loeschen}</Button>
          </span>
        </li>
      {:else}
        <li class="muted">{K.keineKonten}</li>
      {/each}
    </ul>
  </Card>

  {#if !konto && !hatEigentuemerKonto}
    <Card label={K.eigentuemerKonto} icon={UserRound}>
      <form
        class="stack schmal"
        onsubmit={async (e) => {
          e.preventDefault();
          if (await tu(() => call({ action: "eigentuemerAnlegen", email: eEmail, passwort: ePw }), K.eigentuemerAngelegt))
            eEmail = ePw = "";
        }}
      >
        <p class="muted">{K.eigentuemerHinweis}</p>
        <TextField label={K.email} type="email" bind:value={eEmail} autocomplete="off" />
        <TextField label={K.passwort} type="password" bind:value={ePw} hint={T.zugang.mindestens(MIN_PW)} autocomplete="new-password" />
        <Button type="submit" size="m" icon={Plus} disabled={!eEmail.includes("@") || ePw.length < MIN_PW}>{K.eigentuemerKonto}</Button>
      </form>
    </Card>
  {/if}
{/if}

<BottomSheet open={pwOffen} title={K.passwortAendern} onclose={() => (pwOffen = false)}>
  <div class="stack">
    <TextField label={K.passwortAlt} type="password" bind:value={pwAlt} autocomplete="current-password" />
    <TextField label={K.passwortNeu} type="password" bind:value={pwNeu} hint={T.zugang.mindestens(MIN_PW)} autocomplete="new-password" />
  </div>
  {#snippet footer()}
    <Button
      block
      size="l"
      disabled={!pwAlt || pwNeu.length < MIN_PW}
      onclick={async () => {
        if (await tu(() => kontoPasswort(pwAlt, pwNeu), K.passwortGeaendert)) {
          pwOffen = false;
          pwAlt = pwNeu = "";
        }
      }}>{T.allgemein.speichern}</Button
    >
  {/snippet}
</BottomSheet>

<BottomSheet open={!!pwFuer} title="{K.neuesPasswort}: {pwFuer?.email ?? ''}" onclose={() => (pwFuer = null)}>
  <div class="stack">
    <p class="muted">{K.neuesPasswortHinweis}</p>
    <TextField label={K.passwortNeu} type="password" bind:value={pwSetzen} hint={T.zugang.mindestens(MIN_PW)} autocomplete="new-password" />
  </div>
  {#snippet footer()}
    <Button
      block
      size="l"
      disabled={pwSetzen.length < MIN_PW}
      onclick={async () => {
        const k = pwFuer;
        if (k && (await tu(() => call({ action: "kontoSetzen", id: k.id, passwort: pwSetzen }), K.gespeichert))) {
          pwFuer = null;
          pwSetzen = "";
        }
      }}>{T.allgemein.speichern}</Button
    >
  {/snippet}
</BottomSheet>

<Modal
  open={!!loeschen}
  title="{loeschen?.email} {T.allgemein.loeschen}?"
  confirm={T.allgemein.loeschen}
  danger
  onconfirm={() => {
    const k = loeschen;
    if (k) void tu(() => call({ action: "kontoLoeschen", id: k.id }), K.geloescht(k.email));
  }}
  onclose={() => (loeschen = null)}
>
  {K.loeschenFrage}
</Modal>

<style>
  .stack {
    display: grid;
    /* Spalte nie breiter als die Karte: der Laufzeit-Umschalter wischt dann seitlich, statt die Seite zu verbreitern */
    grid-template-columns: minmax(0, 1fr);
    gap: var(--sp-3);
    justify-items: start;
  }
  .stack > :global(*) {
    max-width: 100%;
    min-width: 0;
  }
  .schmal {
    max-width: 420px;
  }
  .reihe {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
    align-items: flex-end;
  }
  .liste {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--sp-3);
    width: 100%;
  }
  .liste li {
    display: flex;
    flex-wrap: wrap;
    overflow-wrap: anywhere;
    gap: var(--sp-2) var(--sp-3);
    align-items: center;
    padding-bottom: var(--sp-3);
    border-bottom: 1px solid var(--line);
  }
  .liste li > :global(*) {
    min-width: 0;
  }
  .liste li:last-child {
    border-bottom: 0;
  }
  .knoepfe {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
    margin-left: auto;
  }
  .gross {
    font-size: 1.05rem;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
</style>
