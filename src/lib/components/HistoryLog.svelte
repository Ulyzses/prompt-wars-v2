<script lang="ts">
  import type { HistoryEntry, Player } from '$lib/types';
  import { displayName } from '$lib/utils';

  let {
    entries,
    roster
  }: {
    entries: HistoryEntry[];
    roster: Player[];
  } = $props();

  function attackerName(attackerId: string): string {
    const player = roster.find((p) => p.playerId === attackerId);
    return player ? displayName(player) : attackerId;
  }

  let log: HTMLDivElement | undefined = $state();

  // Follow the feed as attacks land, the same way the attack transcripts do.
  $effect(() => {
    if (log && entries.length) log.scrollTop = log.scrollHeight;
  });
</script>

<section class="hist-root">
  <header class="hist-head">
    <h2 class="hist-title">History</h2>
    <span class="hist-sub">Attacks on you</span>
  </header>

  <div class="hist-log" bind:this={log}>
    {#each entries as entry, index (entry.id)}
      {#if index === 0 || entries[index - 1].round !== entry.round}
        <div class="round-divider">Round {entry.round}</div>
      {/if}

      {#if entry.kind === 'guess'}
        <div class="guess" class:correct={entry.correct}>
          <span class="guess-who">{attackerName(entry.attackerId)} guessed</span>
          <span class="guess-word">{entry.text}</span>
          <span class="guess-badge">{entry.correct ? 'Correct' : 'Wrong'}</span>
        </div>
      {:else}
        <div class="msg attack">
          <span class="msg-who">{attackerName(entry.attackerId)}</span>
          <span class="msg-text">{entry.text}</span>
        </div>
        <div class="msg guard" class:empty={!entry.response}>
          <span class="msg-who">Your Guard</span>
          <span class="msg-text">{entry.response ?? 'No reply'}</span>
        </div>
      {/if}
    {/each}

    {#if !entries.length}
      <p class="hist-empty">No attacks on you yet.</p>
    {/if}
  </div>
</section>

<style>
  .hist-root {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--color-white);
  }

  .hist-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--color-black);
    color: var(--color-white);
    border-bottom: 2px solid var(--color-black);
  }

  .hist-title {
    font-size: 1.05rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .hist-sub {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.62rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    opacity: 0.75;
  }

  .hist-log {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.6rem;
    background: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 9px,
      color-mix(in srgb, var(--color-black) 3%, transparent) 9px,
      color-mix(in srgb, var(--color-black) 3%, transparent) 10px
    );
  }

  .round-divider {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0.25rem 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.65rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--color-black) 55%, var(--color-white));
  }

  .round-divider::before,
  .round-divider::after {
    content: '';
    flex: 1;
    height: 2px;
    background: color-mix(in srgb, var(--color-black) 25%, transparent);
  }

  .msg {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    max-width: 92%;
    padding: 0.4rem 0.55rem;
    border: 2px solid var(--color-black);
    font-size: 0.85rem;
    line-height: 1.35;
    word-break: break-word;
  }

  .msg.attack {
    align-self: flex-start;
    background: var(--color-black);
    color: var(--color-white);
  }

  .msg.guard {
    align-self: flex-end;
    background: color-mix(in srgb, var(--color-primary) 14%, var(--color-white));
    border-color: var(--color-primary);
    color: var(--color-black);
  }

  .msg.guard.empty .msg-text {
    opacity: 0.6;
    font-style: italic;
  }

  .msg-who {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.6rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    opacity: 0.7;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .guess {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.3rem;
    padding: 0.35rem 0.55rem;
    border: 2px dashed color-mix(in srgb, var(--color-black) 45%, var(--color-white));
    font-size: 0.8rem;
  }

  .guess.correct {
    border-style: solid;
    border-color: #f5b301;
    background: color-mix(in srgb, #f5b301 18%, var(--color-white));
  }

  .guess-who {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.62rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--color-black) 60%, var(--color-white));
  }

  .guess-word {
    font-weight: 800;
    word-break: break-word;
  }

  .guess-badge {
    margin-left: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.58rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-weight: 700;
    color: #c0392b;
  }

  .guess.correct .guess-badge {
    color: var(--color-black);
  }

  .hist-empty {
    margin: auto;
    text-align: center;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.75rem;
    color: color-mix(in srgb, var(--color-black) 50%, var(--color-white));
  }
</style>
