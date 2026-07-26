<script lang="ts">
  import { GameState, type Player } from '$lib/types';
  import AttackVisual from './AttackVisual.svelte';
  import Leaderboard from './Leaderboard.svelte';

  let {
    phase,
    roster,
    scores,
    attackEvents
  }: {
    phase: GameState;
    roster: Player[];
    scores: Record<string, number>;
    attackEvents: { id: number; attackerId: string; defenderId: string; correct?: boolean }[];
  } = $props();
</script>

<div class="grid h-full min-h-0 w-full grid-cols-2 overflow-hidden">
  <!-- Visual pane: absolutely filled so the SVG letterboxes and never overflows. -->
  <div class="relative min-h-0 min-w-0 border-r-2 border-black">
    <div class="absolute inset-0 p-2">
      <AttackVisual {roster} {attackEvents} active={phase === GameState.ATTACK} />
    </div>
  </div>
  <div class="flex min-h-0 min-w-0 flex-col p-4">
    <div class="mb-2 flex items-baseline justify-between">
      <h2 class="text-xl font-bold">Leaderboard</h2>
      <span class="text-sm text-black">Spectating</span>
    </div>
    <!-- Only the leaderboard may scroll, and only when the roster is long. -->
    <div class="min-h-0 flex-1 overflow-auto">
      <Leaderboard {roster} {scores} />
    </div>
  </div>
</div>
