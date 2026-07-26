<script lang="ts">
  import type { Player } from '$lib/types';
  import { displayName } from '$lib/utils';
  import Leaderboard from './Leaderboard.svelte';

  let {
    roster,
    scores,
    back
  }: { roster: Player[]; scores: Record<string, number>; back: () => void } = $props();

  // Winner(s): everyone sharing the top score, but only if anyone actually scored.
  let winners = $derived.by(() => {
    const withScores = roster.map((p) => ({ p, score: scores[p.playerId] ?? 0 }));
    const top = withScores.reduce((m, w) => Math.max(m, w.score), 0);
    return top > 0 ? withScores.filter((w) => w.score === top) : [];
  });

  let winnerNames = $derived(winners.map((w) => displayName(w.p)));
  let winnerScore = $derived(winners[0]?.score ?? 0);
</script>

<section class="end-root">
  <article class="end-card">
    <header class="end-head">
      <h1 class="end-title">Final Standings</h1>
      <span class="end-tag">Game Over</span>
    </header>

    <div class="end-body">
      {#if winners.length}
        <div class="champion">
          <span class="champion-label">
            {winners.length > 1 ? `${winners.length}-way tie` : 'Winner'}
          </span>
          <span class="champion-name">
            {winnerNames.length <= 3 ? winnerNames.join(', ') : `${winnerNames.length} players`}
          </span>
          <span class="champion-score">{winnerScore} pts</span>
        </div>
      {:else}
        <div class="champion champion--none">
          <span class="champion-label">No points scored</span>
        </div>
      {/if}

      <div class="board-wrap">
        <Leaderboard {roster} {scores} />
      </div>
    </div>

    <button class="end-back" type="button" onclick={back}>Back to Lobby</button>
  </article>
</section>

<style>
  .end-root {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .end-card {
    width: 100%;
    max-width: 620px;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    border: 2px solid var(--color-black);
    background: var(--color-white);
  }

  .end-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.6rem;
    padding: 0.6rem 1rem;
    background: var(--color-primary);
    color: var(--color-white);
    border-bottom: 2px solid var(--color-black);
  }

  .end-title {
    font-size: 1.25rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .end-tag {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.65rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    opacity: 0.85;
  }

  .end-body {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    min-height: 0;
    overflow: hidden;
  }

  .champion {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 0.85rem;
    border: 2px solid var(--color-black);
    background: color-mix(in srgb, #f5b301 30%, var(--color-white));
  }

  .champion--none {
    background: color-mix(in srgb, var(--color-black) 6%, var(--color-white));
    color: color-mix(in srgb, var(--color-black) 60%, var(--color-white));
  }

  .champion-label {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.62rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    opacity: 0.75;
  }

  .champion-name {
    flex: 1;
    min-width: 0;
    font-size: 1.1rem;
    font-weight: 800;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .champion-score {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .board-wrap {
    min-height: 0;
    overflow-y: auto;
    border: 2px solid var(--color-black);
  }

  .end-back {
    cursor: pointer;
    margin: 0 1rem 1rem;
    padding: 0.55rem 1rem;
    border: 2px solid var(--color-black);
    background: var(--color-white);
    color: var(--color-black);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    transition:
      background-color 0.15s,
      color 0.15s,
      border-color 0.15s;
  }

  .end-back:hover {
    background: var(--color-primary);
    color: var(--color-white);
    border-color: var(--color-primary);
  }
</style>
