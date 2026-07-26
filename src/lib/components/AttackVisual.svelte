<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { Player } from '$lib/types';
  import { displayName } from '$lib/utils';

  let {
    roster,
    attackEvents,
    active = true
  }: {
    roster: Player[];
    attackEvents: { id: number; attackerId: string; defenderId: string; correct?: boolean }[];
    active?: boolean;
  } = $props();

  const CENTER = 50,
    R = 38,
    PR = 6,
    BULLET_R = 1.1,
    BULLET_R_HIT = 1.9;
  const HIT_COLOR = '#f5b301'; // correct-guess bullets pop against the green primary
  const SPEED = 0.06; // units per ms — constant velocity across the ring
  const TRAIL = 0.18; // trail length as a fraction of the path

  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Ring positions keyed by playerId, starting at 12 o'clock going clockwise.
  let layout = $derived.by(() => {
    const n = roster.length || 1;
    const map: Record<string, { x: number; y: number; name: string }> = {};
    roster.forEach((p, i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
      map[p.playerId] = {
        x: CENTER + R * Math.cos(a),
        y: CENTER + R * Math.sin(a),
        name: displayName(p)
      };
    });
    return map;
  });

  type Bullet = {
    id: number;
    to: string;
    correct: boolean;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    start: number;
    dur: number;
  };
  let bullets = $state<Bullet[]>([]);
  let flashes = $state<Record<string, number>>({}); // playerId -> glow expiry (muzzle/hit)
  let renderNow = $state(0);

  let raf: number | null = null;
  let lastEvent = 0,
    lastBullet = 0;

  function spawn(attackerId: string, defenderId: string, correct: boolean) {
    const a = layout[attackerId],
      d = layout[defenderId];
    if (!a || !d) return;
    const dx = d.x - a.x,
      dy = d.y - a.y,
      len = Math.hypot(dx, dy) || 1;
    const ux = dx / len,
      uy = dy / len;
    bullets.push({
      id: ++lastBullet,
      to: defenderId,
      correct,
      x0: a.x + ux * PR,
      y0: a.y + uy * PR, // edge-to-edge: leave the rim, land on the rim
      x1: d.x - ux * PR,
      y1: d.y - uy * PR,
      start: performance.now(),
      dur: reduce ? 150 : Math.min(1200, Math.max(300, len / SPEED))
    });
    flashes[attackerId] = performance.now() + 220; // muzzle flash
    start();
  }

  function start() {
    if (raf != null) return;
    const loop = (t: number) => {
      renderNow = t;
      for (const b of bullets) if (t - b.start >= b.dur) flashes[b.to] = t + 220; // hit flash on arrival
      bullets = bullets.filter((b) => t - b.start < b.dur);
      for (const k in flashes) if (flashes[k] < t) delete flashes[k];
      if (!bullets.length && !Object.keys(flashes).length) {
        raf = null;
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }

  // Consume any events not yet seen (handles multiple in one tick).
  $effect(() => {
    for (const e of attackEvents) {
      if (e.id > lastEvent) {
        lastEvent = e.id;
        spawn(e.attackerId, e.defenderId, e.correct ?? false);
      }
    }
  });

  onDestroy(() => {
    if (raf != null) cancelAnimationFrame(raf);
  });
</script>

<svg
  viewBox="0 0 100 100"
  preserveAspectRatio="xMidYMid meet"
  class="block h-full w-full"
  class:dim={!active}
>
  {#each roster as p (p.playerId)}
    {@const pos = layout[p.playerId]}
    {#if pos}
      {@const lit = (flashes[p.playerId] ?? 0) > renderNow}
      <circle cx={pos.x} cy={pos.y} r={PR} class="player" class:lit />
      <text x={pos.x} y={pos.y + PR + 4} text-anchor="middle" class="label">{pos.name}</text>
    {/if}
  {/each}

  {#each bullets as b (b.id)}
    {@const p = b.dur ? Math.min(1, (renderNow - b.start) / b.dur) : 1}
    {@const hx = b.x0 + (b.x1 - b.x0) * p}
    {@const hy = b.y0 + (b.y1 - b.y0) * p}
    {@const tp = Math.max(0, p - TRAIL)}
    {@const tx = b.x0 + (b.x1 - b.x0) * tp}
    {@const ty = b.y0 + (b.y1 - b.y0) * tp}
    {@const color = b.correct ? HIT_COLOR : 'var(--color-primary)'}
    {#if !reduce}
      <defs>
        <linearGradient
          id="trail-{b.id}"
          gradientUnits="userSpaceOnUse"
          x1={tx}
          y1={ty}
          x2={hx}
          y2={hy}
        >
          <stop offset="0%" stop-color={color} stop-opacity="0" />
          <stop offset="100%" stop-color={color} stop-opacity="0.85" />
        </linearGradient>
      </defs>
      <line
        x1={tx}
        y1={ty}
        x2={hx}
        y2={hy}
        stroke="url(#trail-{b.id})"
        stroke-width={b.correct ? 2.6 : 2}
        stroke-linecap="round"
      />
    {/if}
    <circle cx={hx} cy={hy} r={b.correct ? BULLET_R_HIT : BULLET_R} fill={color} />
  {/each}
</svg>

<style>
  svg.dim {
    opacity: 0.5;
    transition: opacity 0.4s;
  }

  .player {
    fill: var(--color-white);
    stroke: var(--color-black);
    stroke-width: 1;
    transition: fill 0.15s;
  }

  .player.lit {
    fill: var(--color-primary);
  }

  .label {
    font-size: 3px;
    fill: var(--color-black);
  }
</style>
