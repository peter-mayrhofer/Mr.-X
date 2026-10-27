<!-- Screen 4: Onboarding beim ersten Beitritt (4 kurze Screens). Knöpfe ohne Aktion (z. B. Akku nur in der App) entfallen. -->
<script lang="ts">
  import { BatteryMedium, BellRing, Check, Flag, MapPin, Smartphone } from "@lucide/svelte";
  import Button from "../ui/Button.svelte";
  import Banner from "../ui/Banner.svelte";
  import { T } from "../texte.ts";

  interface Props {
    variant?: string;
    /** Schritt 2–4: die echte Freigabe anfragen */
    actions?: Partial<Record<1 | 2 | 3, () => void | Promise<void>>>;
    ondone: () => void;
  }
  let { variant = "1", actions = {}, ondone }: Props = $props();
  // svelte-ignore state_referenced_locally
  let step = $state(Math.min(4, Math.max(1, Number(variant) || 1)) - 1);
  const ICONS = [Flag, MapPin, BellRing, BatteryMedium];
  const s = $derived(T.onboarding.schritte[step]!);
  const IconC = $derived(ICONS[step]!);

  const next = () => (step < 3 ? step++ : ondone());
  const action = $derived(actions[step as 1 | 2 | 3]);
</script>

<main class="ob">
  <header>
    <div class="dots" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step + 1} aria-label="Schritt {step + 1} von 4">
      {#each [0, 1, 2, 3] as i (i)}<i class:on={i <= step}></i>{/each}
    </div>
    <Button variant="ghost" size="m" onclick={ondone}>{T.onboarding.ueberspringen}</Button>
  </header>

  {#key step}
    <section class="body">
      <div class="art" aria-hidden="true">
        <span class="ring r1"></span><span class="ring r2"></span>
        <span class="ic"><IconC size={72} strokeWidth={2} /></span>
      </div>
      <h1>{s.titel}</h1>
      <p class="text">{s.text}</p>
      <ul>
        {#each s.punkte as p (p)}<li><Check size={22} strokeWidth={3} aria-hidden="true" />{p}</li>{/each}
      </ul>
      {#if "iphone" in s}
        <Banner tone="info" icon={Smartphone}>{s.iphone}</Banner>
      {/if}
      {#if "android" in s}
        <ol class="steps">
          {#each s.android as a, i (a)}<li><span class="n num">{i + 1}</span>{a}</li>{/each}
        </ol>
      {/if}
    </section>
  {/key}

  <footer>
    {#if "knopf" in s && action}
      <Button
        size="xl"
        block
        onclick={async () => {
          await action();
          next();
        }}>{s.knopf}</Button
      >
      <Button variant="ghost" block onclick={next}>{step < 3 ? T.allgemein.weiter : T.onboarding.los}</Button>
    {:else}
      <Button size="xl" block onclick={next}>{T.allgemein.weiter}</Button>
    {/if}
  </footer>
</main>

<style>
  .ob {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    max-width: 560px;
    margin: 0 auto;
    padding: calc(var(--safe-top) + var(--sp-3)) var(--gutter) calc(var(--safe-bottom) + var(--sp-4));
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .dots {
    display: flex;
    gap: 8px;
  }
  .dots i {
    width: 36px;
    height: 6px;
    border-radius: 3px;
    background: var(--surface-3);
    transition: background var(--dur-2);
  }
  .dots i.on {
    background: var(--accent);
  }
  .body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
    padding: var(--sp-6) 0;
    animation: slide var(--dur-3) var(--ease-out);
  }
  @keyframes slide {
    from {
      opacity: 0;
      transform: translateX(24px);
    }
  }
  .art {
    position: relative;
    width: 180px;
    height: 180px;
    margin: 0 auto var(--sp-4);
    display: grid;
    place-items: center;
  }
  .ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid var(--accent-soft);
  }
  .r2 {
    inset: 22px;
    border-color: var(--accent);
    opacity: 0.4;
  }
  .ic {
    width: 116px;
    height: 116px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--accent);
    color: var(--on-accent);
    box-shadow: var(--shadow-2);
  }
  h1 {
    font-size: var(--fs-3xl);
    text-transform: uppercase;
  }
  .text {
    font-size: var(--fs-l);
    color: var(--text-2);
  }
  ul,
  .steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--sp-2);
  }
  ul li {
    display: flex;
    gap: var(--sp-3);
    align-items: center;
    font-weight: 600;
  }
  ul :global(svg) {
    color: var(--ok-text);
    flex: none;
  }
  .steps li {
    display: flex;
    gap: var(--sp-3);
    align-items: center;
    padding: var(--sp-3);
    border-radius: var(--r-m);
    background: var(--surface);
    border: var(--border-w) solid var(--line);
  }
  .n {
    width: 32px;
    height: 32px;
    flex: none;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--text);
    color: var(--bg);
    font-weight: 800;
  }
  footer {
    display: grid;
    gap: var(--sp-2);
  }
</style>
