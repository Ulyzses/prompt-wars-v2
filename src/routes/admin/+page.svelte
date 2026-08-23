<script lang="ts">
  import { enhance } from '$app/forms';
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { SETTINGS_CHANNEL } from '$lib/single/constants';
  import type { SubmitFunction } from '@sveltejs/kit';
  import type { PageData } from './$types';

  let { data, form }: { data: PageData; form: { error?: string; saved?: boolean } | null } =
    $props();

  // svelte-ignore state_referenced_locally
  let defPrompt = $state(data.authed ? data.defPrompt : '');
  // svelte-ignore state_referenced_locally
  let duration = $state(data.authed ? data.duration : 180);
  // svelte-ignore state_referenced_locally
  let vocabulary = $state(data.authed ? data.vocabulary : '');

  let wordCount = $derived(vocabulary.split('\n').filter((w) => w.trim()).length);

  let channel: ReturnType<typeof supabase.channel> | null = null;

  onMount(() => {
    if (!data.authed) return;

    channel = supabase.channel(SETTINGS_CHANNEL);
    channel.subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
      channel = null;
    };
  });

  // Idle players sit on the start screen showing a duration; push the new one at
  // them rather than exposing the settings table to the anon key.
  const onSave: SubmitFunction = () => {
    return async ({ result, update }) => {
      if (result.type === 'success') {
        channel?.send({
          type: 'broadcast',
          event: 'settings',
          payload: { duration }
        });
      }
      await update({ reset: false });
    };
  };
</script>

<section class="admin-root">
  <article class="admin-card">
    <header class="admin-head">
      <h1 class="admin-title">Singleplayer Admin</h1>
      <span class="admin-tag">Prompt Wars</span>
    </header>

    {#if !data.authed}
      <form class="admin-body" method="POST" action="?/auth">
        <label class="field">
          <span class="field-label">Password</span>
          <!-- svelte-ignore a11y_autofocus -->
          <input name="password" type="password" autofocus required />
        </label>
        <button type="submit">Unlock</button>
      </form>
    {:else}
      <form class="admin-body" method="POST" action="?/save" use:enhance={onSave}>
        <label class="field">
          <span class="field-label">Defence Prompt</span>
          <textarea name="defPrompt" rows="8" bind:value={defPrompt}></textarea>
        </label>

        <label class="field">
          <span class="field-label">Duration (seconds)</span>
          <input name="duration" type="number" min="10" max="3600" bind:value={duration} required />
        </label>

        <label class="field">
          <span class="field-label">Vocabulary</span>
          <textarea name="vocabulary" rows="8" bind:value={vocabulary}></textarea>
          <span class="field-note"
            >One word per line. {wordCount} word{wordCount === 1 ? '' : 's'} total so far.</span
          >
        </label>

        <button type="submit">Save settings</button>

        {#if form?.error}
          <p class="feedback error">{form.error}</p>
        {:else if form?.saved}
          <p class="feedback ok">Saved. New sessions will use these settings.</p>
        {/if}
      </form>
    {/if}
  </article>
</section>

<style>
  .admin-root {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }

  .admin-card {
    width: 100%;
    max-width: 640px;
    border: 2px solid var(--color-black);
    background: var(--color-white);
  }

  .admin-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.6rem;
    padding: 0.6rem 1rem;
    background: var(--color-primary);
    color: var(--color-white);
    border-bottom: 2px solid var(--color-black);
  }

  .admin-title {
    font-size: 1.25rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .admin-tag {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.65rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    opacity: 0.85;
  }

  .admin-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .field-label {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.65rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--color-black) 65%, var(--color-white));
  }

  .field-note {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.68rem;
    color: color-mix(in srgb, var(--color-black) 55%, var(--color-white));
  }

  textarea,
  input {
    padding: 0.5rem;
    border: 2px solid var(--color-black);
    background: var(--color-white);
    color: var(--color-black);
    font: inherit;
    resize: vertical;
  }

  textarea:focus,
  input:focus {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
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

  .feedback {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.75rem;
    font-weight: 700;
  }

  .feedback.ok {
    color: var(--color-primary);
  }

  .feedback.error {
    color: #c0392b;
  }
</style>
