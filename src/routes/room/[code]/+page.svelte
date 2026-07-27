<script lang="ts">
  import { enhance } from '$app/forms';
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import type { PageData } from './$types';
  import { GameState, type HistoryEntry, type Player } from '$lib/types';
  import { computeScores, roundPoints, type GuessRow } from '$lib/scoring';
  import { hud } from '$lib/stores/hud.svelte';
  import { displayName } from '$lib/utils';
  import CountdownScreen from '$lib/components/CountdownScreen.svelte';
  import DefenceScreen from '$lib/components/DefenceScreen.svelte';
  import AttackScreen from '$lib/components/AttackScreen.svelte';
  import HistoryLog from '$lib/components/HistoryLog.svelte';
  import SpectatorScreen from '$lib/components/SpectatorScreen.svelte';
  import GameEndScreen from '$lib/components/GameEndScreen.svelte';

  let { data }: { data: PageData } = $props();

  // Configuration Stuff

  // svelte-ignore state_referenced_locally
  let numRounds: number = $state(data.room.numRounds);
  // svelte-ignore state_referenced_locally
  let defTime: number = $state(data.room.defTime);
  // svelte-ignore state_referenced_locally
  let atkTime: number = $state(data.room.atkTime);

  // Live presence — who is currently connected. Used only for the lobby.
  let players = $state<Player[]>([]);

  // This user's lobby choice, re-tracked into presence on change.
  let myRole = $state<'player' | 'spectator'>('player');

  function setRole(role: 'player' | 'spectator') {
    if (myRole === role) return;
    myRole = role;
    channel?.track({
      playerId: data.playerId,
      playerName: data.playerName,
      isHost: data.isHost,
      role: myRole
    });
  }

  // Absent role defaults to 'player'.
  let lobbyPlayers = $derived(players.filter((p) => p.role !== 'spectator'));
  let lobbySpectators = $derived(players.filter((p) => p.role === 'spectator'));

  // Roster frozen at game start; seeded from server so it survives reconnects.
  // svelte-ignore state_referenced_locally
  let roster = $state<Player[]>(data.roster ?? []);

  // Game Proper

  type Round = {
    id: number;
    roundNumber: number;
    attacking: boolean;
    startedAt: string;
    endingOn: string;
  };

  // svelte-ignore state_referenced_locally
  let rounds = $state<Round[]>(
    (data.rounds ?? []).map((r) => ({
      id: r.id,
      roundNumber: r.roundNumber,
      attacking: r.attacking,
      startedAt: r.startedAt ? new Date(r.startedAt).toISOString() : '',
      endingOn: r.endingOn ? new Date(r.endingOn).toISOString() : ''
    }))
  );
  let now = $state(Date.now());

  let currentRound = $derived<Round | null>(
    rounds.find((r) => now >= +new Date(r.startedAt) && now <= +new Date(r.endingOn)) || null
  );

  // Seed the session id from the server load for the same reason.
  // svelte-ignore state_referenced_locally
  let sessionId = $state<number | null>(data.session?.id ?? null);

  // Every correct guess for the session; seeded from server, kept live from
  // `guesses` inserts. Scores (incl. defence bonus) are derived from these.
  // svelte-ignore state_referenced_locally
  let guesses = $state<GuessRow[]>(data.guesses ?? []);

  // Attack rounds paired with their end time, so the derive knows which rounds
  // have finished (and thus earn the defence bonus).
  let attackRounds = $derived(
    rounds
      .filter((r) => r.attacking)
      .map((r) => ({ roundNumber: r.roundNumber, endingOn: r.endingOn }))
  );

  let scores = $derived(computeScores(guesses, roster, attackRounds, now));

  // Spectator-visual events, consumed by id. `correct` fires a bigger bullet.
  let attackEvents = $state<
    { id: number; attackerId: string; defenderId: string; correct?: boolean }[]
  >([]);
  let attackSeq = 0;

  // Chat transcripts, kept here so they survive the attack/defence unmount cycle.
  // Keyed by opponent id; each message tracks its round for grouping.
  type ChatMessage =
    | { role: 'user' | 'system'; text: string; round: number }
    | { role: 'round'; round: number };

  // Rebuild this player's transcripts from the durable log, dividers interleaved
  // at each round change. A pure initialiser rather than a derive, so the
  // invalidateAll() on a correct guess can't clobber optimistic local appends.
  function buildChatHistory(entries: HistoryEntry[]): Record<string, ChatMessage[]> {
    const out: Record<string, ChatMessage[]> = {};

    for (const e of entries) {
      if (e.attackerId !== data.playerId || e.kind !== 'prompt') continue;

      const messages = (out[e.defenderId] ??= []);
      if (!messages.some((m) => m.role === 'round' && m.round === e.round)) {
        messages.push({ role: 'round', round: e.round });
      }
      messages.push({ role: 'user', text: e.text, round: e.round });
      if (e.response) messages.push({ role: 'system', text: e.response, round: e.round });
    }

    return out;
  }

  // svelte-ignore state_referenced_locally
  let chatHistory = $state<Record<string, ChatMessage[]>>(buildChatHistory(data.history ?? []));

  function appendMessage(defenderId: string, message: ChatMessage) {
    chatHistory[defenderId] = [...(chatHistory[defenderId] ?? []), message];
  }

  // Attacks aimed at this player, feeding their history log. Own sends are
  // optimistic in `chatHistory`, so only the incoming side needs a live feed.
  // svelte-ignore state_referenced_locally
  let incoming = $state<HistoryEntry[]>(
    (data.history ?? []).filter((h) => h.defenderId === data.playerId)
  );

  // A fresh session wipes the transcripts from the previous game.
  // svelte-ignore state_referenced_locally
  let lastChatSession = sessionId;
  $effect(() => {
    if (sessionId !== lastChatSession) {
      lastChatSession = sessionId;
      chatHistory = {};
      guesses = [];
      incoming = [];
      attackOrderCache = {};
    }
  });

  // Hoisted so broadcastAttack (passed to AttackScreen) can reach it.
  let channel!: ReturnType<typeof supabase.channel>;

  // Fired on each attack prompt and each guess (correct or not).
  function broadcastAttack(defenderId: string, correct = false) {
    channel?.send({
      type: 'broadcast',
      event: 'attack',
      payload: { attackerId: data.playerId, defenderId, correct }
    });
  }

  // Live guesses feed, re-bound per session. postgres_changes must bind before
  // subscribe(), so a session starting after mount needs a fresh channel.
  let guessesChannel: ReturnType<typeof supabase.channel> | null = null;

  function subscribeGuesses(sid: number) {
    if (guessesChannel) {
      supabase.removeChannel(guessesChannel);
      guessesChannel = null;
    }

    const ch = supabase.channel(`session:${sid}:guesses`);
    ch.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'guesses',
        filter: `session_id=eq.${sid}`
      },
      ({ new: row }) => {
        guesses.push({
          round: row.round_number,
          attackerId: row.attacker_id,
          defenderId: row.defender_id,
          points: row.points
        });
      }
    );
    ch.subscribe();
    guessesChannel = ch;
  }

  $effect(() => {
    if (sessionId != null) subscribeGuesses(sessionId);
  });

  // Live history feed, re-bound per session for the same binding-order reason.
  let historyChannel: ReturnType<typeof supabase.channel> | null = null;

  function subscribeHistory(sid: number) {
    if (historyChannel) {
      supabase.removeChannel(historyChannel);
      historyChannel = null;
    }

    const ch = supabase.channel(`session:${sid}:attacks`);
    ch.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'attacks',
        filter: `session_id=eq.${sid}`
      },
      ({ new: row }) => {
        // Only attacks aimed at this player; the rest are none of their business.
        if (row.defender_id !== data.playerId) return;
        if (incoming.some((h) => h.id === row.id)) return;

        incoming.push({
          id: row.id,
          round: row.round_number,
          attackerId: row.attacker_id,
          defenderId: row.defender_id,
          kind: row.kind,
          text: row.text,
          response: row.response,
          correct: row.correct,
          createdAt: row.created_at
        });
      }
    );
    ch.subscribe();
    historyChannel = ch;
  }

  $effect(() => {
    if (sessionId != null) subscribeHistory(sessionId);
  });

  // Whether the current user is one of the frozen-in participants.
  let isParticipant = $derived(roster.some((p) => p.playerId === data.playerId));

  // The player list shown during the game comes from the durable roster; in the lobby it comes from live presence.
  let displayPlayers = $derived(sessionId ? roster : players);

  async function loadRounds(sessionId: number) {
    const { data: rows } = await supabase
      .from('rounds')
      .select('*')
      .eq('session_id', sessionId)
      .order('round_number', { ascending: true });

    rounds = (rows ?? []).map((r) => ({
      id: r.id,
      roundNumber: r.round_number,
      attacking: r.attacking,
      startedAt: r.started_at,
      endingOn: r.ending_on
    }));
  }

  async function loadRoster(sessionId: number) {
    const { data: rows } = await supabase
      .from('session_players')
      .select('*')
      .eq('session_id', sessionId)
      .order('id', { ascending: true });

    roster = (rows ?? []).map((r) => ({
      playerId: r.player_id,
      playerName: r.player_name,
      isHost: r.player_id === data.room.hostId
    }));
  }

  let gameState = $derived<GameState>(
    !rounds.length
      ? GameState.WAITING
      : !currentRound
        ? now < +new Date(rounds[0].startedAt)
          ? GameState.COUNTDOWN
          : GameState.GAME_END
        : currentRound.attacking
          ? GameState.ATTACK
          : GameState.DEFENCE
  );

  // Drives the top bar's live phase/round/timer; null when not actively playing.
  const timeLeft = $derived(
    currentRound ? Math.max(0, Math.floor((+new Date(currentRound.endingOn) - now) / 1000)) : 0
  );

  $effect(() => {
    if (
      isParticipant &&
      currentRound &&
      (gameState === GameState.ATTACK || gameState === GameState.DEFENCE)
    ) {
      hud.current = {
        phase: gameState === GameState.ATTACK ? 'attack' : 'defence',
        round: currentRound.roundNumber,
        timeLeft
      };
    } else {
      hud.current = null;
    }
  });

  // Attack-phase opponent ordering, frozen per round (specifications.md#attack-phase-player-ordering).
  // Cached by round number so live guesses and the random tie-break don't reshuffle mid-phase.
  let attackOrderCache = $state<Record<number, Player[]>>({});

  function computeAttackOrder(roundNumber: number): Player[] {
    const opponents = roster.filter((p) => p.playerId !== data.playerId);

    // Round 1 (everyone at 0): index-based rotation starting after this player.
    if (roundNumber <= 1) {
      const i = roster.findIndex((p) => p.playerId === data.playerId);
      if (i === -1) return opponents;
      return [...roster.slice(i + 1), ...roster.slice(0, i)];
    }

    // Later rounds: cumulative standing through the previous round, tie-broken
    // by the gain in that round, then randomised.
    const cumulative: Record<string, number> = {};
    for (let rn = 1; rn < roundNumber; rn++) {
      const pts = roundPoints(rn, guesses, roster, true);
      for (const p of opponents)
        cumulative[p.playerId] = (cumulative[p.playerId] ?? 0) + (pts[p.playerId] ?? 0);
    }
    const prevGain = roundPoints(roundNumber - 1, guesses, roster, true);

    return [...opponents].sort(
      (a, b) =>
        (cumulative[b.playerId] ?? 0) - (cumulative[a.playerId] ?? 0) ||
        (prevGain[b.playerId] ?? 0) - (prevGain[a.playerId] ?? 0) ||
        Math.random() - 0.5
    );
  }

  // Compute the order once, the first time we enter each round's attack phase.
  $effect(() => {
    const rn = currentRound?.roundNumber;
    if (rn != null && gameState === GameState.ATTACK && !(rn in attackOrderCache)) {
      attackOrderCache[rn] = computeAttackOrder(rn);
    }
  });

  let orderedOpponents = $derived(
    currentRound
      ? (attackOrderCache[currentRound.roundNumber] ??
          roster.filter((p) => p.playerId !== data.playerId))
      : []
  );

  // Opponents this player has already cracked in the live round. Derived from
  // the durable guess feed, so the lock survives a refresh.
  let crackedDefenders = $derived(
    new Set(
      guesses
        .filter((g) => g.round === currentRound?.roundNumber && g.attackerId === data.playerId)
        .map((g) => g.defenderId)
    )
  );

  // Client-only: "Back to Lobby" drops to WAITING without touching shared state.
  let backToLobby = $state(false);

  // Narrow screens can't fit the history rail beside the grid; it drawers in.
  let railOpen = $state(false);

  // Defence Prompt

  let defPrompt = $state('');

  onMount(() => {
    channel = supabase.channel(`room:${data.room.code}`, {
      config: {
        presence: {
          key: data.playerId
        }
      }
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<Player>();

        // Last entry = most recent track (tabs/re-tracks stack up).
        players = Object.values(state).map((entries) => entries[entries.length - 1]);
      })
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `code=eq.${data.room.code}`
        },
        ({ new: row }) => {
          numRounds = row.num_rounds;
          defTime = row.def_time;
          atkTime = row.atk_time;
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sessions',
          filter: `room_id=eq.${data.room.id}`
        },
        async ({ new: row }) => {
          await loadRounds(row.id); // Fetch the pre-computed rounds
          await loadRoster(row.id); // Fetch the frozen participant roster
          sessionId = row.id;
          backToLobby = false; // A fresh session supersedes any prior game-end
        }
      )
      .on('broadcast', { event: 'attack' }, ({ payload }) => {
        // Feed the spectator visual
        attackEvents.push({
          id: ++attackSeq,
          attackerId: payload.attackerId,
          defenderId: payload.defenderId,
          correct: payload.correct
        });
        if (attackEvents.length > 50) attackEvents = attackEvents.slice(-50);
      });

    channel.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return;

      await channel.track({
        playerId: data.playerId,
        playerName: data.playerName,
        isHost: data.isHost,
        role: myRole
      });
    });

    const tick = setInterval(() => {
      now = Date.now();
    }, 250);

    return () => {
      clearInterval(tick);
      channel.untrack();
      supabase.removeChannel(channel);
      if (guessesChannel) supabase.removeChannel(guessesChannel);
      if (historyChannel) supabase.removeChannel(historyChannel);
      hud.current = null;
    };
  });
</script>

<div class="h-full flex flex-col items-center justify-center gap-4">
  {#if gameState === GameState.WAITING || (gameState === GameState.GAME_END && backToLobby)}
    <div class="lobby-root">
      <div class="lobby-card">
        <header class="lobby-head">
          <div class="lobby-head-id">
            <span class="lobby-tag">Lobby</span>
            <h1 class="lobby-title">{data.room.roomName}</h1>
          </div>
          <div class="lobby-code">
            <span class="lobby-code-label">Room Code</span>
            <span class="lobby-code-value">{data.room.code}</span>
          </div>
        </header>

        <form class="lobby-body" method="POST" use:enhance>
          <section class="lobby-section">
            <div class="section-head">
              <h2 class="section-title">Settings</h2>
              {#if !data.isHost}
                <span class="section-note">Host-controlled</span>
              {/if}
            </div>
            <div class="settings-grid">
              <label class="field">
                <span class="field-label">Rounds</span>
                <input
                  disabled={!data.isHost}
                  name="numRounds"
                  type="number"
                  bind:value={numRounds}
                  min="1"
                  max="10"
                />
              </label>
              <label class="field">
                <span class="field-label">Defence (s)</span>
                <input
                  disabled={!data.isHost}
                  name="defTime"
                  type="number"
                  bind:value={defTime}
                  min="10"
                  max="300"
                />
              </label>
              <label class="field">
                <span class="field-label">Attack (s)</span>
                <input
                  disabled={!data.isHost}
                  name="atkTime"
                  type="number"
                  bind:value={atkTime}
                  min="10"
                  max="600"
                />
              </label>
            </div>
            {#if data.isHost}
              <button class="lobby-btn" formaction="?/config" type="submit">Save settings</button>
            {/if}
          </section>

          {#snippet lobbyRow(p: Player)}
            <li class="player-row">
              <span class="player-name">{displayName(p)}</span>
              <span class="player-badges">
                {#if p.isHost}
                  <span class="badge host">Host</span>
                {/if}
                {#if p.playerId === data.playerId}
                  <span class="badge you">You</span>
                  <button
                    type="button"
                    class="role-switch"
                    onclick={() => setRole(myRole === 'player' ? 'spectator' : 'player')}
                    >{myRole === 'player' ? 'Spectate' : 'Play'}</button
                  >
                {/if}
              </span>
            </li>
          {/snippet}

          <section class="lobby-section">
            <div class="section-head">
              <h2 class="section-title">Players</h2>
              <span class="section-count">{lobbyPlayers.length}</span>
            </div>
            <ul class="player-list">
              {#each lobbyPlayers as p (p.playerId)}
                <input
                  type="hidden"
                  name="players"
                  value={JSON.stringify({ playerId: p.playerId, playerName: p.playerName })}
                />
                {@render lobbyRow(p)}
              {/each}
              {#if !lobbyPlayers.length}
                <li class="empty-row">No players yet</li>
              {/if}
            </ul>
          </section>

          <section class="lobby-section">
            <div class="section-head">
              <h2 class="section-title">Spectators</h2>
              <span class="section-count">{lobbySpectators.length}</span>
            </div>
            <ul class="player-list">
              {#each lobbySpectators as p (p.playerId)}
                {@render lobbyRow(p)}
              {/each}
              {#if !lobbySpectators.length}
                <li class="empty-row">No spectators</li>
              {/if}
            </ul>
          </section>

          <footer class="lobby-foot">
            {#if data.isHost}
              <button
                class="lobby-btn primary"
                formaction="?/start"
                type="submit"
                disabled={!lobbyPlayers.length}>Start Game</button
              >
            {:else}
              <p class="waiting">Waiting for the host to start…</p>
            {/if}
          </footer>
        </form>
      </div>
    </div>
  {:else if gameState === GameState.COUNTDOWN}
    <CountdownScreen {now} startTime={rounds[0].startedAt} />
  {:else if gameState === GameState.DEFENCE || gameState === GameState.ATTACK}
    {#if isParticipant}
      <div class="game-shell">
        <div class="game-main">
          {#if gameState === GameState.DEFENCE}
            <DefenceScreen
              bind:prompt={defPrompt}
              playerId={data.playerId}
              sessionId={sessionId!}
              {now}
              stopTime={currentRound!.endingOn}
            />
          {:else}
            <AttackScreen
              playerId={data.playerId}
              sessionId={sessionId!}
              roundNumber={currentRound!.roundNumber}
              {now}
              stopTime={currentRound!.endingOn}
              opponents={orderedOpponents}
              {chatHistory}
              {crackedDefenders}
              {appendMessage}
              {broadcastAttack}
            />
          {/if}
        </div>

        <aside class="game-rail" class:open={railOpen}>
          <HistoryLog entries={incoming} roster={displayPlayers} />
        </aside>

        <button class="rail-toggle" type="button" onclick={() => (railOpen = !railOpen)}>
          {railOpen ? 'Close' : 'History'}
        </button>
      </div>
    {:else}
      <SpectatorScreen phase={gameState} roster={displayPlayers} {scores} {attackEvents} />
    {/if}
  {:else if gameState === GameState.GAME_END}
    <GameEndScreen roster={displayPlayers} {scores} back={() => (backToLobby = true)} />
  {/if}
</div>

<style>
  button {
    cursor: pointer;
    padding: 0.5rem 1rem;
    margin-top: 1rem;
    border: 2px solid var(--color-black);
    background-color: var(--color-white);
    color: var(--color-black);
    width: 100%;
  }

  button:hover {
    background-color: var(--color-primary);
    color: var(--color-white);
    border-color: var(--color-primary);
    transition:
      background-color 0.2s,
      color 0.2s,
      border-color 0.2s;
  }

  input {
    padding: 0.5rem;
    border: 2px solid var(--color-black);
    background-color: var(--color-white);
    color: var(--color-black);
  }

  /* Game shell — playfield with the history rail alongside it */
  .game-shell {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
    /* Clips the parked off-canvas rail below the breakpoint. */
    overflow: hidden;
  }

  .game-main {
    min-width: 0;
    min-height: 0;
  }

  .game-rail {
    min-width: 0;
    min-height: 0;
    border-left: 2px solid var(--color-black);
  }

  /* Off-canvas above this width; the toggle only exists below it. */
  .rail-toggle {
    display: none;
  }

  @media (max-width: 900px) {
    .game-shell {
      grid-template-columns: minmax(0, 1fr);
    }

    .game-rail {
      position: absolute;
      inset: 0 0 0 auto;
      width: min(340px, 88%);
      background: var(--color-white);
      transform: translateX(100%);
      transition: transform 0.2s;
      z-index: 2;
    }

    .game-rail.open {
      transform: translateX(0);
    }

    .rail-toggle {
      display: block;
      position: absolute;
      right: 0.75rem;
      bottom: 0.75rem;
      width: auto;
      margin-top: 0;
      padding: 0.4rem 0.8rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.65rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      font-weight: 700;
      background: var(--color-black);
      color: var(--color-white);
      z-index: 3;
    }
  }

  /* Lobby */
  .lobby-root {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .lobby-card {
    width: 100%;
    max-width: 680px;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    border: 2px solid var(--color-black);
    background: var(--color-white);
  }

  .lobby-head {
    display: flex;
    align-items: stretch;
    justify-content: space-between;
    background: var(--color-primary);
    color: var(--color-white);
    border-bottom: 2px solid var(--color-black);
  }

  .lobby-head-id {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.1rem;
    padding: 0.6rem 1rem;
    min-width: 0;
  }

  .lobby-tag,
  .lobby-code-label {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.62rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    opacity: 0.8;
  }

  .lobby-title {
    font-size: 1.4rem;
    font-weight: 800;
    line-height: 1.05;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .lobby-code {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: center;
    gap: 0.1rem;
    padding: 0.6rem 1rem;
    background: var(--color-black);
    border-left: 2px solid var(--color-black);
  }

  .lobby-code-value {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 1.4rem;
    font-weight: 800;
    letter-spacing: 0.12em;
  }

  .lobby-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    min-height: 0;
    overflow-y: auto;
  }

  .lobby-section {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    border-bottom: 2px solid var(--color-black);
    padding-bottom: 0.3rem;
  }

  .section-title {
    font-size: 1rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .section-note {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.65rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--color-black) 55%, var(--color-white));
  }

  .section-count {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    min-width: 1.6rem;
    text-align: center;
    border: 2px solid var(--color-black);
    padding: 0 0.3rem;
  }

  .settings-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.6rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .field-label {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.62rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--color-black) 60%, var(--color-white));
  }

  .field input {
    width: 100%;
  }

  .field input:disabled {
    opacity: 0.6;
  }

  .role-switch {
    margin-top: 0;
    width: auto;
    padding: 0.1rem 0.4rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.6rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    font-weight: 700;
    border-style: dashed;
  }

  .player-list {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    max-height: 260px;
    overflow-y: auto;
  }

  .empty-row {
    padding: 0.4rem 0.6rem;
    border: 2px dashed color-mix(in srgb, var(--color-black) 40%, var(--color-white));
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.75rem;
    color: color-mix(in srgb, var(--color-black) 55%, var(--color-white));
  }

  .player-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.4rem 0.6rem;
    border: 2px solid var(--color-black);
    background: var(--color-white);
  }

  .player-name {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .player-badges {
    display: flex;
    gap: 0.3rem;
    flex-shrink: 0;
  }

  .badge {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.6rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    font-weight: 700;
    padding: 0.1rem 0.4rem;
    border: 2px solid var(--color-black);
  }

  .badge.host {
    background: #f5b301;
    color: var(--color-black);
  }

  .badge.you {
    background: var(--color-primary);
    color: var(--color-white);
    border-color: var(--color-primary);
  }

  .lobby-foot {
    display: flex;
    flex-direction: column;
  }

  .lobby-btn {
    margin-top: 0;
  }

  .lobby-btn.primary {
    background: var(--color-primary);
    color: var(--color-white);
    border-color: var(--color-primary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .lobby-btn.primary:hover {
    background: var(--color-black);
    border-color: var(--color-black);
    color: var(--color-white);
  }

  .waiting {
    text-align: center;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.8rem;
    color: color-mix(in srgb, var(--color-black) 60%, var(--color-white));
  }

  @media (max-width: 520px) {
    .settings-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
