<script lang="ts">
  import { enhance } from '$app/forms';
  import type { SubmitFunction } from '@sveltejs/kit';
  import { MAX_PROMPT_LENGTH } from '$lib/constants';
  import { COOLDOWN_MS } from '$lib/single/constants';

  type ChatMessage = { role: 'user' | 'guard'; text: string };
  type Win = { secret: string; solveMs: number; prompts: number };

  let {
    sessionId,
    now,
    elapsedMs,
    timeLeft,
    onWin
  }: {
    sessionId: number;
    now: number;
    elapsedMs: number;
    timeLeft: number;
    onWin: (win: Win) => void;
  } = $props();

  let messages = $state<ChatMessage[]>([]);
  let chatMessage = $state('');
  let responseText = $state('');
  let isLoading = $state(false);
  let guessFeedback: 'incorrect' | null = $state(null);

  let cooldownUntil = $state(0);
  const cooldownLeft = $derived(Math.max(0, Math.ceil((cooldownUntil - now) / 1000)));

  let log: HTMLDivElement | undefined = $state();

  function scrollToBottom() {
    if (log) log.scrollTop = log.scrollHeight;
  }

  const submitGuess: SubmitFunction = () => {
    return async ({ result }) => {
      if (result.type !== 'success' || !result.data?.guess) return;

      const guess = result.data.guess as { correct: boolean } & Win;
      if (guess.correct) {
        onWin({ secret: guess.secret, solveMs: guess.solveMs, prompts: guess.prompts });
      } else {
        guessFeedback = 'incorrect';
      }
    };
  };

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;

    event.preventDefault();
    submitMessage(event);
  }

  async function submitMessage(event: Event) {
    event.preventDefault();

    if (!chatMessage.trim() || isLoading || timeLeft <= 0 || cooldownLeft > 0) return;

    cooldownUntil = now + COOLDOWN_MS;
    isLoading = true;

    const atkPrompt = chatMessage;
    messages.push({ role: 'user', text: atkPrompt });
    chatMessage = '';
    queueMicrotask(scrollToBottom);

    try {
      const response = await fetch('/api/single/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, atkPrompt })
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
    } catch (err) {
      console.error('Error during streaming:', err);
      responseText = '[Error during streaming]';
    } finally {
      isLoading = false;
      messages.push({ role: 'guard', text: responseText });
      responseText = '';
      queueMicrotask(scrollToBottom);
    }
  }
</script>

<article class="chat-card">
  <header class="chat-head">
    <h2 class="chat-name">The Guard</h2>
    <span class="chat-tag">Prompt Wars</span>
  </header>

  <div class="chat-log" bind:this={log}>
    {#each messages as message, index (index)}
      <div class="msg {message.role}">
        <span class="msg-who">{message.role === 'guard' ? 'Guard' : 'You'}</span>
        <span class="msg-text">{message.text}</span>
      </div>
    {/each}

    {#if responseText}
      <div class="msg guard">
        <span class="msg-who">Guard</span>
        <span class="msg-text">{responseText}</span>
      </div>
    {:else if isLoading}
      <div class="msg guard pending">
        <span class="msg-who">Guard</span>
        <span class="msg-text">Thinking…</span>
      </div>
    {/if}

    {#if !messages.length && !responseText && !isLoading}
      <p class="chat-empty">Open with a message to probe the guard.</p>
    {/if}
  </div>

  <form class="chat-compose" onsubmit={submitMessage}>
    <div class="chat-input">
      <textarea
        id="single-prompt"
        name="atkPrompt"
        rows="2"
        maxlength={MAX_PROMPT_LENGTH}
        placeholder="Talk with the guard"
        bind:value={chatMessage}
        disabled={timeLeft <= 0}
        onkeydown={onKeydown}
        required></textarea>

      <button class="send" type="submit" disabled={timeLeft <= 0 || isLoading || cooldownLeft > 0}>
        {cooldownLeft > 0 ? `${cooldownLeft}s` : isLoading ? '…' : 'Send'}
      </button>
    </div>

    <div class="chat-meta">
      <span class="hint">Shift + Enter to create a newline</span>
      <span class="counter" class:warn={chatMessage.length >= MAX_PROMPT_LENGTH - 50}>
        {chatMessage.length}/{MAX_PROMPT_LENGTH}
      </span>
    </div>
  </form>

  <form
    class="chat-guess"
    method="POST"
    action="?/guess"
    use:enhance={submitGuess}
    oninput={() => (guessFeedback = null)}
  >
    <input type="hidden" name="sessionId" value={sessionId} />
    <input type="hidden" name="elapsedMs" value={elapsedMs} />

    <div class="guess-row">
      <input id="single-guess" name="guess" placeholder="Guess the special word…" required />
      <button type="submit" disabled={timeLeft <= 0}>Guess</button>
    </div>

    {#if guessFeedback === 'incorrect'}
      <p class="feedback incorrect">Not quite — keep attacking.</p>
    {/if}
  </form>
</article>

<style>
  .chat-card {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 720px;
    height: 100%;
    min-height: 0;
    border: 2px solid var(--color-black);
    background: var(--color-white);
    overflow: hidden;
  }

  .chat-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--color-primary);
    color: var(--color-white);
    border-bottom: 2px solid var(--color-black);
  }

  .chat-name {
    font-size: 1.05rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .chat-tag {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.65rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    opacity: 0.85;
  }

  .chat-log {
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

  .msg.guard {
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

  .chat-empty {
    margin: auto;
    text-align: center;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.75rem;
    color: color-mix(in srgb, var(--color-black) 50%, var(--color-white));
  }

  .chat-compose {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.6rem;
    border-top: 2px solid var(--color-black);
  }

  .chat-meta {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.68rem;
  }

  .hint {
    color: color-mix(in srgb, var(--color-black) 45%, var(--color-white));
  }

  .counter {
    color: color-mix(in srgb, var(--color-black) 55%, var(--color-white));
    font-variant-numeric: tabular-nums;
  }

  .counter.warn {
    color: #c0392b;
    font-weight: 700;
  }

  .chat-guess {
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

  .chat-input {
    position: relative;
    display: flex;
    border: 2px solid var(--color-black);
    background: var(--color-white);
  }

  .chat-input:focus-within {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }

  .chat-input textarea {
    flex: 1;
    min-width: 0;
    margin-right: 3.9rem;
    border: none;
  }

  .chat-input textarea:focus {
    outline: none;
  }

  .send {
    position: absolute;
    right: 0.3rem;
    bottom: 0.3rem;
    min-width: 3.2rem;
    padding: 0.15rem 0.4rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.62rem;
    font-variant-numeric: tabular-nums;
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

  .feedback.incorrect {
    color: #c0392b;
  }
</style>
