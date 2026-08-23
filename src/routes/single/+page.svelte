<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { SETTINGS_CHANNEL } from '$lib/single/constants';
  import GuardChat from '$lib/components/single/GuardChat.svelte';
  import ResultModal from '$lib/components/single/ResultModal.svelte';
  import type { SubmitFunction } from '@sveltejs/kit';
  import type { PageData } from './$types';

  type Win = { secret: string; solveMs: number; prompts: number };

  let { data, form }: { data: PageData; form: { error?: string } | null } = $props();

  // svelte-ignore state_referenced_locally
  let duration = $state(data.duration);
  let session = $state<{ id: number; duration: number } | null>(null);
  let phase = $state<'idle' | 'playing' | 'won' | 'lost'>('idle');
  let win = $state<Win | null>(null);
  let startError = $state('');

  // The browser owns the clock for the whole run; a reload forfeits it.
  let startedAt = $state(0);
  let now = $state(Date.now());

  const elapsedMs = $derived(session ? now - startedAt : 0);
  const timeLeftMs = $derived(session ? Math.max(0, session.duration * 1000 - elapsedMs) : 0);
  const timeLeft = $derived(Math.ceil(timeLeftMs / 1000));

  const clock = $derived.by(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  });

  // 100ms keeps the reported solve time at the granularity the board ranks on.
  $effect(() => {
    if (phase !== 'playing') return;

    const tick = setInterval(() => (now = Date.now()), 100);
    return () => clearInterval(tick);
  });

  $effect(() => {
    if (phase === 'playing' && timeLeftMs <= 0) phase = 'lost';
  });

  const onStart: SubmitFunction = () => {
    return async ({ result }) => {
      if (result.type === 'failure') {
        startError = (result.data?.error as string) ?? 'Could not start the session';
        return;
      }

      if (result.type !== 'success' || !result.data?.started) return;

      startError = '';
      session = result.data.started as { id: number; duration: number };
      startedAt = Date.now();
      now = startedAt;
      phase = 'playing';
    };
  };

  function onWin(result: Win) {
    win = result;
    phase = 'won';
  }

  async function backToStart() {
    session = null;
    win = null;
    phase = 'idle';
    await invalidateAll();
    duration = data.duration;
  }

  onMount(() => {
    // Admin saves push the new duration here; the settings table itself stays
    // closed to the anon key.
    const channel = supabase.channel(SETTINGS_CHANNEL);

    channel.on('broadcast', { event: 'settings' }, ({ payload }) => {
      if (typeof payload?.duration === 'number') duration = payload.duration;
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  });
</script>

<section class="single-root" class:playing={phase !== 'idle'}>
  {#if phase === 'idle'}
    <article class="start-card">
      <header class="start-head">
        <h1 class="start-title">Prompt Wars</h1>
        <span class="start-tag">Singleplayer</span>
      </header>

      <div class="start-body">
        <p class="brief">
          One guard stands between you and a hidden special word. Talk your way past its defence and
          name the word before the clock runs out.
        </p>

        <div class="duration">
          <span class="duration-label">Time limit</span>
          <span class="duration-value">{duration}s</span>
        </div>

        {#if data.configured}
          <form method="POST" action="?/start" use:enhance={onStart}>
            <button type="submit">Start</button>
          </form>
        {:else}
          <p class="notice">The game hasn't been configured yet. Check back shortly.</p>
        {/if}

        {#if startError}
          <p class="notice error">{startError}</p>
        {/if}

        <a class="board-link" href={resolve('/single/leaderboard')}>View leaderboard</a>
      </div>
    </article>
  {:else}
    <header class="hud">
      <span class="hud-label">Time left</span>
      <span class="hud-clock" class:low={timeLeft <= 15}>{clock}</span>
    </header>

    <div class="chat-wrap">
      <GuardChat sessionId={session!.id} {now} {elapsedMs} {timeLeft} {onWin} />
    </div>

    {#if phase === 'won' || phase === 'lost'}
      <ResultModal
        sessionId={session!.id}
        win={phase === 'won' ? win : null}
        error={form?.error}
        onBack={backToStart}
      />
    {/if}
  {/if}
</section>

<style>
  .single-root {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
  }

  .single-root.playing {
    height: 100vh;
  }

  .start-card {
    width: 100%;
    max-width: 480px;
    border: 2px solid var(--color-black);
    background: var(--color-white);
  }

  .start-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.6rem;
    padding: 0.6rem 1rem;
    background: var(--color-primary);
    color: var(--color-white);
    border-bottom: 2px solid var(--color-black);
  }

  .start-title {
    font-size: 1.25rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .start-tag {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.65rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    opacity: 0.85;
  }

  .start-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }

  .brief {
    font-size: 0.95rem;
    line-height: 1.45;
  }

  .duration {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.6rem 0.85rem;
    border: 2px solid var(--color-black);
    background: color-mix(in srgb, var(--color-primary) 12%, var(--color-white));
  }

  .duration-label {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.62rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    opacity: 0.75;
  }

  .duration-value {
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .notice {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.75rem;
    color: color-mix(in srgb, var(--color-black) 60%, var(--color-white));
  }

  .notice.error {
    color: #c0392b;
    font-weight: 700;
  }

  .board-link {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.7rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    text-decoration: underline;
    text-align: center;
    color: var(--color-primary);
  }

  .hud {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.4rem 0.85rem;
    border: 2px solid var(--color-black);
    background: var(--color-black);
    color: var(--color-white);
  }

  .hud-label {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.62rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    opacity: 0.75;
  }

  .hud-clock {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 1.1rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .hud-clock.low {
    color: #f5b301;
  }

  .chat-wrap {
    flex: 1;
    min-height: 0;
    width: 100%;
    display: flex;
    justify-content: center;
  }

  form {
    display: flex;
    flex-direction: column;
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

  button:hover {
    background: var(--color-primary);
    color: var(--color-white);
    border-color: var(--color-primary);
  }
</style>
