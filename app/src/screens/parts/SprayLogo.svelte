<!-- Spray-Logo: Mister X sprüht „MISTER X“ an die Wand und bleibt in der Siegerpose stehen (E-61).
     Spielt einmal (15 s); bei „weniger Bewegung“ steht gleich das fertige Bild da. -->
<script lang="ts">
  import { onMount } from "svelte";
  import { bild, DAUER, H, LETTERS, RED, SEGS, W } from "../../lib/sprayLogo.ts";

  let t = $state(0);
  const b = $derived(bild(t));
  const R = $derived(b.R);
  const basis = import.meta.env.BASE_URL;
  const pl = (pts: [number, number][]) => pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");

  onMount(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      t = DAUER;
      return;
    }
    let start = 0,
      id = 0;
    const tick = (now: number) => {
      start ||= now;
      t = Math.min(DAUER, (now - start) / 1000);
      if (t < DAUER) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  });
</script>

{#snippet dose(x: number, y: number, rot: number, s: number, rot2: boolean)}
  {#if s > 0.001}
    <g transform="translate({x} {y}) rotate({rot}) scale({s})">
      <rect x="-12" y="-47" width="24" height="13" rx="4" fill="#8f9aa8" />
      <rect x="-4" y="-55" width="11" height="9" rx="2" fill={rot2 ? "#fff" : RED} />
      <rect
        x="-16"
        y="-37"
        width="32"
        height="62"
        rx="7"
        fill={rot2 ? RED : "#e9edf2"}
        stroke={rot2 ? "none" : "#0d1826"}
        stroke-width="3"
      />
      <rect x="-16" y="-14" width="32" height="7" fill={rot2 ? "#fff" : RED} />
    </g>
  {/if}
{/snippet}

<svg class="spray" viewBox="80 0 1460 640" role="img" aria-label="Mister X">
  <defs>
    <!-- helles Design: weiße Schrift wird nachtblau, das rote X bleibt rot -->
    <filter id="mrx-dunkel" color-interpolation-filters="sRGB">
      <feColorMatrix values="1 -0.95 0 0 0  0 0.09 0 0 0  0 0 0.15 0 0  0 0 0 1 0" />
    </filter>
    {#each SEGS as sg, i (i)}
      {#if sg.draw}<clipPath id="mrx-c{i}"><polygon points={sg.clip} /></clipPath>{/if}
    {/each}
    <mask id="mrx-spray" maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
      {#each SEGS as sg, i (i)}
        {#if sg.draw && b.striche[i]! > 0}
          <g clip-path="url(#mrx-c{i})">
            <path
              d={sg.d}
              stroke="#fff"
              stroke-width="60"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
              pathLength="1"
              stroke-dasharray="{b.striche[i]} 2"
            />
          </g>
        {/if}
      {/each}
      {#each LETTERS as [a, e], i (i)}
        {#if b.fertig[i]}<rect x={a - 6} y="262" width={e - a + 12} height="134" fill="#fff" />{/if}
      {/each}
      {#each b.tropfen as dr, i (i)}
        {#if dr.e > 0}<rect x={dr.a - 1.5} y="394" width={dr.b - dr.a + 3} height={(dr.y - 394 + 6) * dr.e} fill="#fff" />{/if}
      {/each}
    </mask>
  </defs>
  <g>
    <!-- Schriftzug, freigelegt vom Sprühstrahl -->
    <image class="schrift" href="{basis}logos/mister-x-schrift.png" x="590" y="262" width="930" height="188" mask="url(#mrx-spray)" />
    {#each b.tropfen as dr, i (i)}
      {#if dr.e > 0 && dr.e < 1 && dr.b - dr.a >= 4}
        {@const rr = Math.min(5.5, (dr.b - dr.a) / 2 + 0.5)}
        <circle
          cx={(dr.a + dr.b) / 2}
          cy={394 + (dr.y - 394) * dr.e}
          r={rr * (1 + 0.25 * (1 - dr.e))}
          fill={dr.letter === 6 ? RED : "currentColor"}
          opacity={dr.e < 0.8 ? 1 : (1 - (dr.e - 0.8) / 0.2) ** 3}
        />
      {/if}
    {/each}
    {#if R.drop && R.drop.o > 0}<g opacity={R.drop.o}>{@render dose(R.drop.pos[0], R.drop.pos[1] + 2, R.drop.rot, 1, false)}</g>{/if}

    <g transform="translate({R.xw} 0) scale({R.face} 1) translate({-R.x} 0)">
      <!-- Fahne -->
      <g transform="translate({R.lH[0]} {R.lH[1]}) rotate({R.pole})">
        <line x1="0" y1="34" x2="0" y2="-150" stroke="currentColor" stroke-width="10" stroke-linecap="round" />
        <circle cx="0" cy="-154" r="10" fill="currentColor" />
        <g transform="translate(-5 -142) skewY({b.flaggeSchwung}) scale(1 {b.flaggeDehnung})">
          <g transform="translate(-103.5 0) scale({R.face >= 0 ? 1 : -1} 1) translate(103.5 0)">
            <image href="{basis}logos/mister-x-fahne.png" x="-207" y="0" width="207" height="135" />
          </g>
        </g>
      </g>
      <!-- Figur -->
      <g stroke="currentColor" stroke-width="38" stroke-linecap="round" stroke-linejoin="round" fill="none">
        <polyline points={pl([R.S, R.lE, R.lH])} />
        {#each R.legs as l, i (i)}<polyline points={pl([R.hip, l.J, l.E, [l.E[0] + 26, l.E[1]]])} />{/each}
        <line x1={R.hip[0]} y1={R.hip[1]} x2={R.S[0]} y2={R.S[1]} stroke-width="42" />
      </g>
      <circle cx={R.head[0]} cy={R.head[1]} r="52" fill="currentColor" />
      <g transform="translate({R.head[0]} {R.head[1]}) rotate({(R.headA - 160) * 0.6})">
        <rect x="-80" y="-15" width="160" height="30" rx="3" fill={RED} transform="rotate(45)" />
        <rect x="-80" y="-15" width="160" height="30" rx="3" fill={RED} transform="rotate(-45)" />
      </g>
      {@render dose(R.rArm.E[0], R.rArm.E[1], R.canRot, R.canS, R.swapped)}
      <polyline
        points={pl([R.S, R.rArm.J, R.rArm.E])}
        stroke="currentColor"
        stroke-width="38"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      />
    </g>

    <!-- Sprühnebel -->
    {#if R.sprayOn > 0.01}
      {@const farbe = R.letter === 6 ? RED : "currentColor"}
      <circle cx={R.tg[0]} cy={R.tg[1]} r="34" fill={farbe} opacity={0.1 * R.sprayOn} />
      <circle cx={R.tg[0]} cy={R.tg[1]} r="20" fill={farbe} opacity={0.14 * R.sprayOn} />
      {#each b.nebel as d, i (i)}<circle cx={d.x} cy={d.y} r={d.r} fill={farbe} opacity={d.o} />{/each}
    {/if}
  </g>
</svg>

<style>
  .spray {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 1460 / 640;
    color: var(--text);
  }
  .schrift {
    filter: url(#mrx-dunkel);
  }
  :global([data-theme="dunkel"]) .schrift {
    filter: none;
  }
</style>
