<script lang="ts">
  import { enhance } from '$app/forms';
  import type { SubmitFunction } from '@sveltejs/kit';
  import { supabase } from '$lib/supabase';
  import { MAX_PROMPT_LENGTH as MAX } from '$lib/constants';

  let {
    prompt = $bindable(''),
    playerId,
    sessionId,
    now,
    stopTime
  }: {
    prompt: string;
    playerId: string;
    sessionId: number;
    now: number;
    stopTime: string;
  } = $props();

  const timeLeft = $derived(Math.max(0, Math.floor((new Date(stopTime).getTime() - now) / 1000)));

  let saving: boolean = $state(false);
  let saved: boolean = $state(false);

  // Load existing defence prompt if it exists
  $effect(() => {
    supabase
      .from('def_prompts')
      .select('prompt')
      .eq('session_id', sessionId)
      .eq('player_id', playerId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching defence prompt:', error);
          return;
        }

        prompt = data?.prompt ?? '';
      });
  });

  const onSave: SubmitFunction = () => {
    saving = true;
    saved = false;
    return async ({ result, update }) => {
      await update({ reset: false });
      saving = false;
      saved = result.type === 'success';
    };
  };
</script>

<section class="def-root">
  <article class="def-card">
    <header class="def-head">
      <h2 class="def-title">Set your Defence Prompt</h2>
    </header>

    <form class="def-form" method="POST" action="?/defend" use:enhance={onSave}>
      <input type="hidden" name="playerId" value={playerId} />
      <input type="hidden" name="sessionId" value={sessionId} />

      <label class="sr-only" for="prompt">Defence prompt</label>
      <textarea
        id="prompt"
        name="prompt"
        maxlength={MAX}
        placeholder="Write your defence prompt here. Maximum of 500 characters."
        required
        bind:value={prompt}
        oninput={() => (saved = false)}></textarea>

      <div class="def-meta">
        <span class="counter" class:warn={prompt.length >= MAX - 50}>{prompt.length}/{MAX}</span>
        {#if saved}
          <span class="saved">✓ Saved</span>
        {/if}
      </div>

      <button type="submit" disabled={timeLeft <= 0 || saving}>
        {timeLeft <= 0 ? "Time's up" : saving ? 'Saving…' : 'Save Prompt'}
      </button>
    </form>
  </article>
</section>

<style>
  .def-root {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .def-card {
    width: 100%;
    max-width: 640px;
    border: 2px solid var(--color-black);
    background: var(--color-white);
    display: flex;
    flex-direction: column;
  }

  .def-head {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    padding: 0.6rem 1rem;
    background: var(--color-primary);
    color: var(--color-white);
    border-bottom: 2px solid var(--color-black);
  }

  .def-title {
    font-size: 1.15rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .def-form {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 1rem;
  }

  textarea {
    width: 100%;
    min-height: 260px;
    padding: 0.6rem;
    border: 2px solid var(--color-black);
    background: var(--color-white);
    color: var(--color-black);
    font: inherit;
    resize: vertical;
  }

  textarea:focus {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }

  .def-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 1.1rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.72rem;
  }

  .counter {
    color: color-mix(in srgb, var(--color-black) 55%, var(--color-white));
    font-variant-numeric: tabular-nums;
  }

  .counter.warn {
    color: #c0392b;
    font-weight: 700;
  }

  .saved {
    color: var(--color-primary);
    font-weight: 700;
  }

  button {
    cursor: pointer;
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

  button:hover:not(:disabled) {
    background: var(--color-primary);
    color: var(--color-white);
    border-color: var(--color-primary);
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
