<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import type { SubmitFunction } from '@sveltejs/kit';
  import { MAX_PROMPT_LENGTH } from '$lib/constants';

  type ChatMessage =
    | { role: 'user' | 'system'; text: string; round: number }
    | { role: 'round'; round: number };

  let {
    attackerId,
    defenderId,
    defenderName,
    sessionId,
    roundNumber,
    now,
    timeLeft,
    messages,
    cracked,
    appendMessage,
    broadcastAttack
  }: {
    attackerId: string;
    defenderId: string;
    defenderName: string;
    sessionId: number;
    roundNumber: number;
    now: number;
    timeLeft: number;
    messages: ChatMessage[];
    cracked: boolean;
    appendMessage: (defenderId: string, message: ChatMessage) => void;
    broadcastAttack: (defenderId: string, correct?: boolean) => void;
  } = $props();

  // Per-opponent cooldown between attack prompts (specifications.md#attack-cooldown).
  const COOLDOWN_MS = 5000;
  let cooldownUntil: number = $state(0);
  const cooldownLeft = $derived(Math.max(0, Math.ceil((cooldownUntil - now) / 1000)));

  let responseText: string = $state('');
  let isLoading: boolean = $state(false);

  let chatMessage: string = $state('');

  // Once guessed correctly, lock guessing for this opponent. `cracked` comes
  // from the durable guess feed and so survives a refresh; the local flag
  // covers the optimistic window before that row arrives.
  let guessFeedback: 'correct' | 'incorrect' | null = $state(null);
  let guessedCorrectly: boolean = $state(false);
  const locked = $derived(cracked || guessedCorrectly);

  let log: HTMLDivElement | undefined = $state();

  function scrollToBottom() {
    if (log) log.scrollTop = log.scrollHeight;
  }

  // Divider per round, added up front so empty rounds still show in the transcript.
  $effect(() => {
    const r = roundNumber;
    if (!messages.some((m) => m.role === 'round' && m.round === r)) {
      appendMessage(defenderId, { role: 'round', round: r });
    }
  });

  const submitGuess: SubmitFunction = () => {
    return async ({ result }) => {
      if (result.type === 'success' && result.data?.guess) {
        const g = result.data.guess as { defenderId: string; correct: boolean };
        guessFeedback = g.correct ? 'correct' : 'incorrect';

        broadcastAttack(defenderId, g.correct); // fire a bullet for the guess

        if (g.correct) {
          guessedCorrectly = true;
          // Refresh the top-bar score
          await invalidateAll();
        }
      }
    };
  };

  async function submitMessage(event: Event) {
    event.preventDefault();

    if (!chatMessage.trim() || isLoading || timeLeft <= 0 || cooldownLeft > 0) return;

    cooldownUntil = now + COOLDOWN_MS; // block the next prompt to this opponent
    broadcastAttack(defenderId); // optimistic — fire the bullet on send
    isLoading = true;

    const atkPrompt = chatMessage;

    // Shown up front rather than after the round-trip.
    appendMessage(defenderId, { role: 'user', text: atkPrompt, round: roundNumber });
    chatMessage = '';
    queueMicrotask(scrollToBottom);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          attackerId,
          defenderId,
          sessionId,
          roundNumber,
          atkPrompt
        })
      });

      if (!response.ok || !response.body) {
        throw new Error(`Streaming failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        responseText += decoder.decode(value, { stream: true });
        scrollToBottom();
      }
    } catch (error) {
      console.error('Error during streaming:', error);

      responseText = '[Error during streaming]';
    } finally {
      isLoading = false;

      // Commit the guard's reply and clear the live buffer.
      appendMessage(defenderId, { role: 'system', text: responseText, round: roundNumber });
      responseText = '';
      queueMicrotask(scrollToBottom);
    }
  }
</script>

<article class="atk-card" class:captured={locked}>
  <header class="atk-head">
    <h2 class="atk-name">{defenderName}</h2>
  </header>

  <div class="atk-log" bind:this={log}>
    {#each messages as message, index (index)}
      {#if message.role === 'round'}
        <div class="round-divider">Round {message.round}</div>
      {:else}
        <div class="msg {message.role}">
          <span class="msg-who">{message.role === 'system' ? 'Oracle' : 'You'}</span>
          <span class="msg-text">{message.text}</span>
        </div>
      {/if}
    {/each}

    {#if responseText}
      <div class="msg system">
        <span class="msg-who">Oracle</span>
        <span class="msg-text">{responseText}</span>
      </div>
    {:else if isLoading}
      <div class="msg system pending">
        <span class="msg-who">Oracle</span>
        <span class="msg-text">Thinking…</span>
      </div>
    {/if}

    {#if !messages.some((m) => m.role !== 'round') && !responseText && !isLoading}
      <p class="atk-empty">Open with a message to probe {defenderName}'s oracle.</p>
    {/if}
  </div>

  <form class="atk-compose" onsubmit={submitMessage}>
    <textarea
      id="atkPrompt-{defenderId}"
      name="atkPrompt"
      rows="2"
      maxlength={MAX_PROMPT_LENGTH}
      placeholder="Talk with {defenderName}'s oracle"
      bind:value={chatMessage}
      disabled={timeLeft <= 0}
      required></textarea>

    <div class="atk-meta">
      <span class="counter" class:warn={chatMessage.length >= MAX_PROMPT_LENGTH - 50}>
        {chatMessage.length}/{MAX_PROMPT_LENGTH}
      </span>
    </div>

    <button type="submit" disabled={timeLeft <= 0 || isLoading || cooldownLeft > 0}>
      {cooldownLeft > 0 ? `Wait ${cooldownLeft}s` : isLoading ? 'Thinking…' : 'Chat'}
    </button>
  </form>

  <form class="atk-guess" method="POST" action="?/guess" use:enhance={submitGuess}>
    <input type="hidden" name="attackerId" value={attackerId} />
    <input type="hidden" name="defenderId" value={defenderId} />
    <input type="hidden" name="sessionId" value={sessionId} />
    <input type="hidden" name="roundNumber" value={roundNumber} />

    <div class="guess-row">
      <input
        id="secret-{defenderId}"
        name="secret"
        placeholder="Guess the sigil…"
        disabled={locked}
        required
      />
      <button type="submit" disabled={timeLeft <= 0 || locked}>Guess</button>
    </div>

    <!-- A lock restored from the guess feed has no local feedback to show. -->
    {#if guessFeedback === 'correct' || (locked && !guessFeedback)}
      <p class="feedback correct">Correct — you cracked {defenderName}'s sigil.</p>
    {:else if guessFeedback === 'incorrect'}
      <p class="feedback incorrect">Not quite — keep attacking.</p>
    {/if}
  </form>
</article>

<style>
  .atk-card {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    border: 2px solid var(--color-black);
    background: var(--color-white);
    overflow: hidden;
  }

  .atk-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--color-primary);
    color: var(--color-white);
    border-bottom: 2px solid var(--color-black);
  }

  .atk-card.captured .atk-head {
    background: #f5b301;
    color: var(--color-black);
  }

  .atk-target {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.65rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    opacity: 0.85;
  }

  .atk-name {
    font-size: 1.05rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .atk-log {
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
    max-width: 88%;
    padding: 0.4rem 0.55rem;
    border: 2px solid var(--color-black);
    font-size: 0.85rem;
    line-height: 1.35;
    word-break: break-word;
  }

  .msg.user {
    align-self: flex-end;
    background: var(--color-black);
    color: var(--color-white);
  }

  .msg.system {
    align-self: flex-start;
    background: color-mix(in srgb, var(--color-primary) 14%, var(--color-white));
    border-color: var(--color-primary);
    color: var(--color-black);
  }

  .msg.pending .msg-text {
    opacity: 0.6;
    font-style: italic;
  }

  .msg-who {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.6rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    opacity: 0.7;
  }

  .atk-empty {
    margin: auto;
    text-align: center;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.75rem;
    color: color-mix(in srgb, var(--color-black) 50%, var(--color-white));
  }

  .atk-compose {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.6rem;
    border-top: 2px solid var(--color-black);
  }

  .atk-meta {
    display: flex;
    justify-content: flex-end;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.68rem;
  }

  .counter {
    color: color-mix(in srgb, var(--color-black) 55%, var(--color-white));
    font-variant-numeric: tabular-nums;
  }

  .counter.warn {
    color: #c0392b;
    font-weight: 700;
  }

  .atk-guess {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0 0.6rem 0.6rem;
  }

  .guess-row {
    display: flex;
    gap: 0.4rem;
  }

  .guess-row input {
    flex: 1;
    min-width: 0;
  }

  textarea,
  input {
    padding: 0.45rem;
    border: 2px solid var(--color-black);
    background: var(--color-white);
    color: var(--color-black);
    font: inherit;
    resize: none;
  }

  textarea:focus,
  input:focus {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }

  button {
    cursor: pointer;
    padding: 0.45rem 0.9rem;
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

  .atk-compose button {
    width: 100%;
  }

  button:hover:not(:disabled) {
    background: var(--color-primary);
    color: var(--color-white);
    border-color: var(--color-primary);
  }

  button:disabled,
  input:disabled,
  textarea:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .feedback {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.75rem;
    font-weight: 700;
  }

  .feedback.correct {
    color: var(--color-primary);
  }

  .feedback.incorrect {
    color: #c0392b;
  }
</style>
