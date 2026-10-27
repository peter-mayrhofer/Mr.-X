<!--
  Interne Komponenten-Seite (statt Storybook, E-18): Design-Tokens und alle Komponenten mit ihren Zuständen.
-->
<script lang="ts">
  import { Flag, Map as MapIcon, Menu, MessageCircle, ScrollText, Send, Sun, Users } from "@lucide/svelte";
  import AppBar from "../ui/AppBar.svelte";
  import Button from "../ui/Button.svelte";
  import IconButton from "../ui/IconButton.svelte";
  import Card from "../ui/Card.svelte";
  import Banner from "../ui/Banner.svelte";
  import Pill from "../ui/Pill.svelte";
  import CountdownRing from "../ui/CountdownRing.svelte";
  import TeamBadge from "../ui/TeamBadge.svelte";
  import TextField from "../ui/TextField.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import TabBar from "../ui/TabBar.svelte";
  import Switch from "../ui/Switch.svelte";
  import Stepper from "../ui/Stepper.svelte";
  import ListItem from "../ui/ListItem.svelte";
  import Skeleton from "../ui/Skeleton.svelte";
  import Modal from "../ui/Modal.svelte";
  import BottomSheet from "../ui/BottomSheet.svelte";
  import MapMarker from "../map/MapMarker.svelte";
  import { toast } from "../ui/toast.svelte.ts";
  import { clock } from "../lib/clock.svelte.ts";
  import { theme, type ThemeChoice } from "../lib/theme.svelte.ts";
  import { go } from "../lib/router.svelte.ts";
  import { T } from "../texte.ts";

  let choice = $state<ThemeChoice>(theme.choice);
  let seg = $state("a");
  let sw = $state(true);
  let step = $state(10);
  let modal = $state(false);
  let sheet = $state(false);
  let tab = $state("karte");
  const start = clock.now;

  const COLORS = [
    ["--rf-rot", "Rote-Falken-Rot (Logo)"],
    ["--rf-blau", "Rote-Falken-Blau (Logo)"],
    ["--kf-rot", "Kinderfreunde-Rot"],
    ["--kf-blau", "Kinderfreunde-Blau"],
    ["--bg", "Hintergrund"],
    ["--surface", "Fläche"],
    ["--surface-2", "Fläche 2"],
    ["--line", "Linie"],
    ["--text", "Text"],
    ["--text-2", "Text 2"],
    ["--accent", "Akzent (Aktion, Mister X)"],
    ["--accent-text", "Akzent-Text"],
    ["--warn", "Warnung"],
    ["--ok", "OK / frei"],
    ["--info", "Info"],
    ["--me", "Eigenes Team"],
  ];
  const SIZES = ["--fs-s", "--fs-m", "--fs-l", "--fs-xl", "--fs-2xl", "--fs-3xl", "--fs-4xl"];
</script>

<div class="page">
  <AppBar title="Komponenten" onback={() => go("/prototyp")} />
  <main>
    <section>
      <h2>Darstellung</h2>
      <Segmented
        label="Darstellung"
        bind:value={choice}
        onchange={(c) => theme.set(c)}
        options={(["auto", "hell", "dunkel", "sonne"] as const).map((c) => ({ value: c, label: T.einstellungen.themes[c] }))}
      />
    </section>

    <section>
      <h2>Farben</h2>
      <div class="swatches">
        {#each COLORS as [v, label] (v)}
          <div class="sw"><span style:background="var({v})"></span><code>{v}</code><small>{label}</small></div>
        {/each}
      </div>
    </section>

    <section>
      <h2>Schrift</h2>
      {#each SIZES as s (s)}
        <p class="display" style:font-size="var({s})">Mister X <code class="tok">{s}</code></p>
      {/each}
      <p>Fließtext Inter 17 px – gut lesbar auch in der Sonne. <span class="num">Ziffern 0123456789</span></p>
      <p class="caps">Akten-Etikett / Großbuchstaben</p>
      <p class="stamp" style:color="var(--accent-text)" style:font-size="40px">Gefangen!</p>
    </section>

    <section>
      <h2>Knöpfe</h2>
      <div class="row">
        <Button icon={Flag}>Primär</Button>
        <Button variant="secondary">Sekundär</Button>
        <Button variant="ghost">Nur Text</Button>
        <Button variant="danger">Gefährlich</Button>
        <Button variant="ok">OK</Button>
        <Button variant="warn">Warnung</Button>
      </div>
      <div class="row">
        <Button size="xl" icon={Flag}>Groß (Daumenzone)</Button>
        <Button size="m">Klein</Button>
        <Button disabled>Deaktiviert</Button>
        <Button loading>Laden</Button>
      </div>
      <div class="row">
        <IconButton icon={Flag} label="Mister X" tone="accent" />
        <IconButton icon={Sun} label="Sonne" />
        <IconButton icon={Sun} label="Sonne aktiv" active />
        <IconButton icon={Send} label="Senden" size="m" tone="plain" />
      </div>
    </section>

    <section>
      <h2>Banner & Marken</h2>
      <div class="stack">
        <Banner tone="info" title="Info">Hinweis mit Icon und Text.</Banner>
        <Banner tone="warn" title="Warnung">Achtung: nur noch 35 m bis zur Grenze.</Banner>
        <Banner tone="danger" title="Gefahr">Ihr seid außerhalb des Spielfelds!</Banner>
        <Banner tone="ok">Gespeichert.</Banner>
        <Banner tone="ann" title="Durchsage">Treffpunkt Hauptplatz.</Banner>
        <Banner tone="mrx" title="Mister X">Ihr seid Mister X!</Banner>
      </div>
      <div class="row">
        <Pill>Neutral</Pill><Pill tone="ok" dot>online</Pill><Pill tone="warn">wartet</Pill><Pill tone="danger" dot>offline</Pill><Pill
          tone="info">Info</Pill
        ><Pill tone="accent">Mister X</Pill>
      </div>
    </section>

    <section>
      <h2>Countdown & Teams</h2>
      <div class="row">
        <CountdownRing until={start + 4 * 60_000} total={10 * 60_000} />
        <CountdownRing until={start + 45_000} total={10 * 60_000} label="dringend" />
        <span class="dark"><CountdownRing until={start + 3 * 60_000} total={5 * 60_000} tone="light" /></span>
        <TeamBadge short="UR" color="#2e86de" />
        <TeamBadge short="KM" color="#7c5cff" mrx />
        <TeamBadge short="AU" color="#00a3a3" locked />
        <TeamBadge short="LE" color="#5d6d7e" offline />
        <TeamBadge short="UR" color="#2e86de" me />
      </div>
      <div class="row markers">
        <MapMarker kind="team" short="AU" color="#00a3a3" name="Auwiesen" />
        <MapMarker kind="me" heading={30} />
        <span class="pad"><MapMarker kind="mrx" label="vor 4 Min" sub="14:32 · Standort vom Schiri" /></span>
        <MapMarker kind="staff" name="Schiri Anna" />
      </div>
    </section>

    <section>
      <h2>Eingaben</h2>
      <div class="stack">
        <TextField label="Teamname" hint="z. B. Ortsgruppe Urfahr" />
        <TextField label="Team-Passwort" type="password" value="falke27" error="Das Passwort stimmt nicht." />
        <Segmented
          label="Beispiel"
          bind:value={seg}
          options={[
            { value: "a", label: "Alle" },
            { value: "b", label: "Spielleitung", badge: 2 },
          ]}
        />
        <Switch label="Töne und Vibration" hint="Hinweistext" bind:checked={sw} />
        <Switch label="Deaktiviert" disabled />
        <Stepper label="Meldeintervall" bind:value={step} unit="Min" min={1} max={30} />
      </div>
    </section>

    <section>
      <h2>Listen, Laden, Dialoge</h2>
      <Card label="Karte mit Etikett" icon={Users}>
        <ListItem title="Auwiesen" subtitle="120 m entfernt" onclick={() => {}} chevron>
          {#snippet lead()}<TeamBadge short="AU" color="#00a3a3" size={40} />{/snippet}
        </ListItem>
        <ListItem title="Ausgewählt" subtitle="selected" selected onclick={() => {}}>
          {#snippet lead()}<TeamBadge short="KM" color="#7c5cff" size={40} />{/snippet}
        </ListItem>
      </Card>
      <div class="stack skel">
        <Skeleton h="56px" r="var(--r-l)" />
        <Skeleton w="70%" />
      </div>
      <div class="row">
        <Button variant="secondary" onclick={() => (modal = true)}>Dialog</Button>
        <Button variant="secondary" onclick={() => (sheet = true)}>Blatt von unten</Button>
        <Button variant="secondary" onclick={() => toast("Übergabe gespeichert", "ok", { label: "Rückgängig", run: () => {} })}
          >Toast</Button
        >
      </div>
    </section>

    <section>
      <h2>Navigation</h2>
      <div class="tabbar">
        <TabBar
          items={[
            { id: "karte", label: "Karte", icon: MapIcon },
            { id: "chat", label: "Chat", icon: MessageCircle, badge: 3 },
            { id: "regeln", label: "Regeln", icon: ScrollText },
            { id: "mehr", label: "Mehr", icon: Menu },
          ]}
          active={tab}
          onselect={(id) => (tab = id)}
        />
      </div>
    </section>
  </main>
</div>

<Modal open={modal} title="Fahne an Auwiesen übergeben?" onconfirm={() => {}} onclose={() => (modal = false)}
  >Gefangen · Wartezeit für 2 Teams</Modal
>
<BottomSheet open={sheet} title="Übergabe" onclose={() => (sheet = false)}>
  <p>Inhalt des Blatts.</p>
  {#snippet footer()}<Button block onclick={() => (sheet = false)}>Fertig</Button>{/snippet}
</BottomSheet>

<style>
  main {
    max-width: 960px;
    margin: 0 auto;
    padding: var(--sp-4) var(--gutter) var(--sp-12);
    display: grid;
    gap: var(--sp-8);
  }
  section {
    display: grid;
    gap: var(--sp-3);
  }
  h2 {
    font-size: var(--fs-2xl);
    border-bottom: var(--border-w) solid var(--line);
    padding-bottom: var(--sp-2);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-3);
    align-items: center;
  }
  .stack {
    display: grid;
    gap: var(--sp-3);
  }
  .swatches {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: var(--sp-3);
  }
  .sw {
    display: grid;
    gap: 2px;
  }
  .sw span {
    height: 56px;
    border-radius: var(--r-m);
    border: var(--border-w) solid var(--line);
  }
  .sw small {
    color: var(--text-2);
    font-size: 14px;
  }
  .tok {
    font-size: 14px;
    font-family: monospace;
    color: var(--text-3);
    font-weight: 400;
  }
  .dark {
    background: var(--rf-rot);
    border-radius: var(--r-m);
    padding: 4px;
  }
  .markers {
    padding: var(--sp-8) var(--sp-4) var(--sp-4);
    background: var(--surface-2);
    border-radius: var(--r-l);
    gap: var(--sp-8);
  }
  .pad {
    padding-top: 40px;
  }
  .skel {
    margin: var(--sp-3) 0;
  }
  .tabbar {
    border-radius: var(--r-l);
    overflow: hidden;
    border: var(--border-w) solid var(--line);
  }
</style>
