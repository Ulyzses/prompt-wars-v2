<script lang="ts">
  import { flip } from 'svelte/animate';
  import type { Player } from '$lib/types';
  import { displayName } from '$lib/utils';

  let { roster, scores }: { roster: Player[]; scores: Record<string, number> } = $props();

  // Recognition tiers by player count (specifications.md#leaderboard).
  let topN = $derived(roster.length >= 6 ? 3 : roster.length >= 4 ? 2 : 1);
  const MEDALS = ['gold', 'silver', 'bronze'];

  // Standard competition ranking ("1-2-2-4"): ties share a placement and eat
  // the slots below, so recognition can be cut short (specifications.md#leaderboard).
  let ranked = $derived.by(() => {
    const rows = [...roster]
      .map((p) => ({ ...p, name: displayName(p), score: scores[p.playerId] ?? 0 }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

    let rank = 0;
    let prevScore: number | null = null;
    return rows.map((row, i) => {
      if (row.score !== prevScore) {
        rank = i + 1; // first player at a new score fixes the placement
        prevScore = row.score;
      }
      return { ...row, rank, medal: rank <= topN ? MEDALS[rank - 1] : '' };
    });
  });
</script>

<table class="board">
  <thead>
    <tr>
      <th class="col-rank">#</th>
      <th class="col-player">Player</th>
      <th class="col-score">Score</th>
    </tr>
  </thead>
  <tbody>
    {#each ranked as p (p.playerId)}
      <tr animate:flip={{ duration: 300 }} data-medal={p.medal}>
        <td class="col-rank"><span class="rank">{p.rank}</span></td>
        <td class="col-player">{p.name}</td>
        <td class="col-score">{p.score}</td>
      </tr>
    {/each}
  </tbody>
</table>

<style>
  .board {
    width: 100%;
    border-collapse: collapse;
  }

  th {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.62rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--color-black) 60%, var(--color-white));
    padding: 0.35rem 0.6rem;
    border-bottom: 2px solid var(--color-black);
    text-align: left;
  }

  td {
    padding: 0.45rem 0.6rem;
    border-bottom: 1px solid color-mix(in srgb, var(--color-black) 25%, transparent);
    vertical-align: middle;
  }

  .col-rank {
    width: 2.5rem;
    text-align: center;
  }

  .col-score {
    text-align: right;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .col-player {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .rank {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.5rem;
    padding: 0.05rem 0.3rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.8rem;
    font-weight: 700;
    border: 2px solid var(--color-black);
    background: var(--color-white);
  }

  /* Medal rows: tinted fill + a solid accent bar down the leading edge. */
  tr[data-medal] td:first-child {
    border-left: 4px solid transparent;
  }

  tr[data-medal='gold'] td {
    background: color-mix(in srgb, gold 32%, transparent);
  }
  tr[data-medal='silver'] td {
    background: color-mix(in srgb, silver 32%, transparent);
  }
  tr[data-medal='bronze'] td {
    background: color-mix(in srgb, #cd7f32 32%, transparent);
  }

  tr[data-medal='gold'] td:first-child {
    border-left-color: #d4af37;
  }
  tr[data-medal='silver'] td:first-child {
    border-left-color: #9a9a9a;
  }
  tr[data-medal='bronze'] td:first-child {
    border-left-color: #cd7f32;
  }

  tr[data-medal='gold'] .rank {
    background: #d4af37;
    color: var(--color-black);
    border-color: var(--color-black);
  }
  tr[data-medal='silver'] .rank {
    background: #c0c0c0;
    color: var(--color-black);
  }
  tr[data-medal='bronze'] .rank {
    background: #cd7f32;
    color: var(--color-black);
  }
</style>
