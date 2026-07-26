<script lang="ts">
  let { now, startTime }: { now: number; startTime: string } = $props();

  const secs = $derived(Math.max(0, Math.ceil((new Date(startTime).getTime() - now) / 1000)));
  const urgent = $derived(secs > 0 && secs <= 3);
  const go = $derived(secs <= 0);
</script>

<section class="cd-root">
  <div class="cd-card" class:urgent class:go>
    <span class="cd-tag">Get Ready</span>
    <div class="cd-number" aria-live="polite">{go ? 'GO' : secs}</div>
    <p class="cd-msg">{go ? 'Round 1 begins' : 'The first round is about to begin'}</p>
  </div>
</section>

<style>
  .cd-root {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .cd-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    min-width: 300px;
    padding: 2rem 3rem;
    border: 2px solid var(--color-black);
    background: var(--color-white);
  }

  .cd-tag {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.72rem;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--color-black) 60%, var(--color-white));
  }

  .cd-number {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: clamp(5rem, 18vh, 9rem);
    font-weight: 800;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    color: var(--color-primary);
  }

  .cd-card.urgent .cd-number {
    color: #f5b301;
    animation: cd-pop 1s steps(1, jump-none) infinite;
  }

  .cd-card.go .cd-number {
    color: var(--color-white);
    background: var(--color-primary);
    padding: 0 1.5rem;
  }

  .cd-msg {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.8rem;
    letter-spacing: 0.04em;
    color: color-mix(in srgb, var(--color-black) 60%, var(--color-white));
  }

  @keyframes cd-pop {
    50% {
      opacity: 0.45;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cd-card.urgent .cd-number {
      animation: none;
    }
  }
</style>
