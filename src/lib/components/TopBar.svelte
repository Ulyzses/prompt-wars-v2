<script lang="ts">
  let {
    phase = null,
    round = 0,
    timeLeft = 0,
    score,
    playerName,
    roomName,
    roomCode
  }: {
    phase?: 'defence' | 'attack' | null;
    round?: number;
    timeLeft?: number;
    score: number;
    playerName: string;
    roomName: string;
    roomCode: string;
  } = $props();

  const clock = $derived(`${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`);
  const urgent = $derived(phase != null && timeLeft > 0 && timeLeft <= 10);
  const expired = $derived(phase != null && timeLeft <= 0);
</script>

<header class="hud" class:urgent class:expired>
  {#if phase}
    <div class="seg seg-lead">
      <span class="tag">{phase === 'attack' ? 'Attack Phase' : 'Defence Phase'}</span>
      <span class="headline">Round {round}</span>
    </div>
  {:else}
    <div class="seg seg-lead">
      <span class="tag">Room</span>
      <span class="headline">{roomName}</span>
    </div>
  {/if}

  <div class="seg seg-brand">
    <span class="brand">Prompt Wars</span>
    <span class="context">Playing as {playerName} · {roomCode}</span>
  </div>

  <div class="seg seg-score">
    <span class="mini-label">Score</span>
    <span class="score-value">{score}</span>
  </div>

  {#if phase}
    <div class="seg seg-clock" aria-live="polite">
      <span class="mini-label">{expired ? 'Over' : 'Time'}</span>
      <span class="clock-value">{expired ? "TIME'S UP" : clock}</span>
    </div>
  {/if}
</header>

<style>
  .hud {
    display: flex;
    align-items: stretch;
    width: 100%;
    border-bottom: 2px solid var(--color-black);
    background: var(--color-primary);
    color: var(--color-white);
  }

  .seg {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0.5rem 1rem;
  }

  .seg + .seg {
    border-left: 2px solid var(--color-black);
  }

  .mini-label,
  .tag {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.62rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    opacity: 0.75;
  }

  .seg-lead {
    min-width: 0;
  }

  .headline {
    font-size: 1.45rem;
    font-weight: 800;
    line-height: 1.05;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 16ch;
  }

  .seg-brand {
    flex: 1;
    align-items: center;
    text-align: center;
    gap: 0.1rem;
    min-width: 0;
  }

  .brand {
    font-size: 1.15rem;
    font-weight: 800;
    letter-spacing: 0.01em;
  }

  .context {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.72rem;
    opacity: 0.8;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .seg-score,
  .seg-clock {
    align-items: flex-end;
    background: var(--color-black);
    min-width: 6rem;
  }

  .score-value,
  .clock-value {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 1.5rem;
    font-weight: 800;
    line-height: 1.05;
    font-variant-numeric: tabular-nums;
  }

  .hud.urgent .seg-clock {
    background: #f5b301;
    color: var(--color-black);
    animation: hud-pulse 1s steps(2, jump-none) infinite;
  }

  .hud.expired .seg-clock {
    color: color-mix(in srgb, var(--color-white) 60%, var(--color-black));
  }

  @keyframes hud-pulse {
    50% {
      opacity: 0.68;
    }
  }

  @media (max-width: 720px) {
    .seg-brand {
      display: none;
    }
  }
</style>
