<!-- Screen 5: Warteraum vor Spielstart. -->
<script lang="ts">
  import { BatteryMedium, Bell, Check, MapPin, MessageCircle, ScrollText } from "@lucide/svelte";
  import Card from "../ui/Card.svelte";
  import Button from "../ui/Button.svelte";
  import TeamBadge from "../ui/TeamBadge.svelte";
  import Pill from "../ui/Pill.svelte";
  import Logo from "../ui/Logo.svelte";
  import { ICONS } from "../ui/icons.ts";
  import { go } from "../lib/router.svelte.ts";
  import { T } from "../texte.ts";
  import * as M from "../proto/mock.svelte.ts";

  const me = M.teams[M.ME]!;
  const quick = T.regeln.liste(M.config).filter((r) => ["Fangen", "Übergabe", "Meldungen"].includes(r.titel));
</script>

<main class="lobby">
  <header>
    <Logo height={36} />
    <p class="caps">Mister X Linz 2027</p>
  </header>

  <section class="hero">
    <TeamBadge short={me.short} color={me.color} size={96} me />
    <h1>{T.lobby.angemeldet}</h1>
    <p class="name display">{me.name}</p>
    <div class="wait" role="status">
      <span class="dotpulse" aria-hidden="true"></span>
      <span class="caps">{T.lobby.warten}</span>
      <span class="muted">· {T.lobby.startGeplant("14:00")}</span>
    </div>
  </section>

  <div class="checks">
    <Pill tone="ok" icon={MapPin}>{T.lobby.check.standort}: {T.lobby.gut}</Pill>
    <Pill tone="ok" icon={Bell}>{T.lobby.check.push} <Check size={16} aria-hidden="true" /></Pill>
    <Pill tone="neutral" icon={BatteryMedium}>{T.lobby.check.akku} 84 %</Pill>
  </div>

  <Card label={T.lobby.teams(M.teamIds.length)}>
    <ul class="teams">
      {#each M.teamIds as id (id)}
        {@const t = M.teams[id]!}
        <li><TeamBadge short={t.short} color={t.color} size={44} me={id === M.ME} /><span>{t.name}</span></li>
      {/each}
    </ul>
  </Card>

  <Card label={T.lobby.regelnKurz}>
    <ul class="rules">
      {#each quick as r (r.titel)}
        {@const IconC = ICONS[r.icon]!}
        <li>
          <IconC size={24} aria-hidden="true" />
          <div>
            <strong>{r.titel}</strong>
            <p class="muted">{r.text}</p>
          </div>
        </li>
      {/each}
    </ul>
  </Card>

  <div class="actions">
    <Button variant="secondary" icon={ScrollText} onclick={() => go("/prototyp/11")}>{T.lobby.alleRegeln}</Button>
    <Button variant="secondary" icon={MessageCircle} onclick={() => go("/prototyp/10")}>{T.tabs.chat}</Button>
  </div>
</main>

<style>
  .lobby {
    display: grid;
    gap: var(--sp-4);
    max-width: 640px;
    margin: 0 auto;
    padding: calc(var(--safe-top) + var(--sp-4)) var(--gutter) calc(var(--safe-bottom) + var(--sp-6));
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: var(--text-2);
  }
  .hero {
    display: grid;
    justify-items: center;
    gap: var(--sp-2);
    text-align: center;
    padding: var(--sp-4) 0;
  }
  h1 {
    font-size: var(--fs-3xl);
    text-transform: uppercase;
    margin-top: var(--sp-2);
  }
  .name {
    font-size: var(--fs-2xl);
    color: var(--accent-text);
  }
  .wait {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    flex-wrap: wrap;
    justify-content: center;
    margin-top: var(--sp-2);
  }
  .dotpulse {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--warn);
    animation: blink 1.2s ease-in-out infinite;
  }
  @keyframes blink {
    50% {
      opacity: 0.25;
    }
  }
  .checks {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
    justify-content: center;
  }
  .teams {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: var(--sp-3);
  }
  .teams li {
    display: grid;
    justify-items: center;
    gap: 4px;
    text-align: center;
    font-size: var(--fs-s);
    font-weight: 600;
  }
  .rules {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--sp-3);
  }
  .rules li {
    display: flex;
    gap: var(--sp-3);
  }
  .rules :global(svg) {
    color: var(--accent-text);
    flex: none;
  }
  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-3);
  }
</style>
