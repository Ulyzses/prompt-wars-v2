<script lang="ts">
  import { resolve } from '$app/paths';
  import { formatSolveTime } from '$lib/single/format';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let mine = $derived(data.entries.find((e) => e.id === data.highlight) ?? null);

  function reveal(node: HTMLElement, active: boolean) {
    if (!active) return;

    requestAnimationFrame(() => {
      const scroller = node.closest('.board-scroll');
      if (!scroller) return;

      const row = node.getBoundingClientRect();
      const box = scroller.getBoundingClientRect();
      scroller.scrollTop += row.top - box.top - (box.height - row.height) / 2;
    });
  }
</script>

<section class="board-root">
  <article class="board-card">
    <header class="board-head">
      <h1 class="board-title">Leaderboard</h1>
      <span class="board-tag">Singleplayer</span>
    </header>

    {#if mine}
      <div class="you-strip">
        <span class="you-label">Your placement</span>
        <span class="you-rank">#{mine.rank}</span>
        <span class="you-stats">
          {formatSolveTime(mine.solveMs)} · {mine.prompts} prompt{mine.prompts === 1 ? '' : 's'}
        </span>
      </div>
    {/if}

    <div class="board-scroll">
      {#if data.entries.length}
        <table>
          <thead>
            <tr>
              <th class="col-rank">#</th>
              <th>Name</th>
              <th class="col-num">Time</th>
              <th class="col-num">Prompts</th>
            </tr>
          </thead>
          <tbody>
            {#each data.entries as entry (entry.id)}
              <tr
                class:you={entry.id === data.highlight}
                class:gold={entry.rank === 1}
                class:silver={entry.rank === 2}
                class:bronze={entry.rank === 3}
                use:reveal={entry.id === data.highlight}
              >
                <td class="col-rank">{entry.rank}</td>
                <td class="col-name">{entry.name}</td>
                <td class="col-num">{formatSolveTime(entry.solveMs)}</td>
                <td class="col-num">{entry.prompts}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <p class="board-empty">No one has cracked the special word yet.</p>
      {/if}
    </div>

    <footer class="board-foot">
      <a class="play-again" href={resolve('/single')}>Play again</a>
    </footer>
  </article>
</section>

<style>
  .board-root {
    width: 100%;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .board-card {
    width: 100%;
    max-width: 620px;
    height: 100%;
    display: flex;
    flex-direction: column;
    border: 2px solid var(--color-black);
    background: var(--color-white);
    overflow: hidden;
  }

  .board-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.6rem;
    padding: 0.6rem 1rem;
    background: var(--color-primary);
    color: var(--color-white);
    border-bottom: 2px solid var(--color-black);
  }

  .board-title {
    font-size: 1.25rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .board-tag {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.65rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    opacity: 0.85;
  }

  .you-strip {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    padding: 0.55rem 1rem;
    border-bottom: 2px solid var(--color-black);
    background: color-mix(in srgb, #f5b301 30%, var(--color-white));
  }

  .you-label {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.62rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    opacity: 0.75;
  }

  .you-rank {
    font-size: 1.1rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .you-stats {
    margin-left: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.72rem;
  }

  .board-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }

  thead th {
    position: sticky;
    top: 0;
    z-index: 1;
    padding: 0.45rem 0.75rem;
    background: var(--color-black);
    color: var(--color-white);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.62rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    text-align: left;
  }

  tbody td {
    padding: 0.45rem 0.75rem;
    border-bottom: 1px solid color-mix(in srgb, var(--color-black) 18%, transparent);
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  .col-rank {
    width: 3rem;
    font-variant-numeric: tabular-nums;
    font-weight: 800;
  }

  .col-name {
    max-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .col-num {
    width: 6rem;
    text-align: right;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-variant-numeric: tabular-nums;
  }

  tbody tr.gold {
    background: color-mix(in srgb, #f5b301 26%, var(--color-white));
  }

  tbody tr.silver {
    background: color-mix(in srgb, #b8b8b8 26%, var(--color-white));
  }

  tbody tr.bronze {
    background: color-mix(in srgb, #cd7f32 22%, var(--color-white));
  }

  tbody tr.you {
    background: color-mix(in srgb, var(--color-primary) 14%, var(--color-white));
  }

  tbody tr.you td {
    font-weight: 800;
  }

  .board-foot {
    position: sticky;
    bottom: 0;
    padding: 0.75rem 1rem;
    border-top: 2px solid var(--color-black);
    background: var(--color-white);
  }

  .play-again {
    display: block;
    padding: 0.55rem 1rem;
    border: 2px solid var(--color-black);
    background: var(--color-white);
    color: var(--color-black);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    text-align: center;
    transition:
      background-color 0.15s,
      color 0.15s,
      border-color 0.15s;
  }

  .play-again:hover {
    background: var(--color-primary);
    color: var(--color-white);
    border-color: var(--color-primary);
  }
</style>
