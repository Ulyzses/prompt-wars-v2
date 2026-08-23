<script lang="ts">
  import { enhance } from '$app/forms';
  import { formatSolveTime } from '$lib/single/format';

  type Win = { secret: string; solveMs: number; prompts: number };

  let {
    sessionId,
    win,
    error,
    onBack
  }: {
    sessionId: number;
    win: Win | null;
    error?: string;
    onBack: () => void;
  } = $props();
</script>

<div class="modal-backdrop">
  <article class="modal-card">
    {#if win}
      <header class="modal-head">
        <h2 class="modal-title">Word Cracked</h2>
        <span class="modal-tag">Solved</span>
      </header>

      <div class="modal-body">
        <dl class="stats">
          <div class="stat">
            <dt>Special Word</dt>
            <dd class="stat-word">{win.secret}</dd>
          </div>
          <div class="stat">
            <dt>Time</dt>
            <dd>{formatSolveTime(win.solveMs)}</dd>
          </div>
          <div class="stat">
            <dt>Prompts</dt>
            <dd>{win.prompts}</dd>
          </div>
        </dl>

        <form class="submit-form" method="POST" action="?/submit" use:enhance>
          <input type="hidden" name="sessionId" value={sessionId} />

          <label class="field">
            <span class="field-label">Name</span>
            <!-- svelte-ignore a11y_autofocus -->
            <input name="playerName" maxlength="40" autofocus required />
          </label>

          <label class="field">
            <span class="field-label">Contact (optional)</span>
            <input name="contact" maxlength="120" placeholder="Email, phone, or handle" />
          </label>

          <button type="submit">Submit to leaderboard</button>

          {#if error}
            <p class="feedback error">{error}</p>
          {/if}
        </form>
      </div>
    {:else}
      <header class="modal-head">
        <h2 class="modal-title">Time's Up</h2>
        <span class="modal-tag">Unsolved</span>
      </header>

      <div class="modal-body">
        <p class="thanks">Thank you for trying. The guard held the line this time.</p>
        <button type="button" onclick={onBack}>Back to start</button>
      </div>
    {/if}
  </article>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: color-mix(in srgb, var(--color-black) 55%, transparent);
  }

  .modal-card {
    width: 100%;
    max-width: 460px;
    border: 2px solid var(--color-black);
    background: var(--color-white);
  }

  .modal-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.6rem;
    padding: 0.6rem 1rem;
    background: var(--color-primary);
    color: var(--color-white);
    border-bottom: 2px solid var(--color-black);
  }

  .modal-title {
    font-size: 1.25rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .modal-tag {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.65rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    opacity: 0.85;
  }

  .modal-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.5rem;
    border: 2px solid var(--color-black);
    background: color-mix(in srgb, #f5b301 22%, var(--color-white));
  }

  .stat dt {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.6rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    opacity: 0.7;
  }

  .stat dd {
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .stat-word {
    text-transform: uppercase;
  }

  .submit-form,
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .field-label {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.62rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--color-black) 65%, var(--color-white));
  }

  .thanks {
    font-size: 0.95rem;
    line-height: 1.4;
  }

  input {
    padding: 0.45rem;
    border: 2px solid var(--color-black);
    background: var(--color-white);
    color: var(--color-black);
    font: inherit;
  }

  input:focus {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }

  button {
    cursor: pointer;
    padding: 0.5rem 1rem;
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

  button:hover {
    background: var(--color-primary);
    color: var(--color-white);
    border-color: var(--color-primary);
  }

  .feedback {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.75rem;
    font-weight: 700;
  }

  .feedback.error {
    color: #c0392b;
  }
</style>
