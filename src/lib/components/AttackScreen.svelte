<script lang="ts">
  import type { Player } from '$lib/types';
  import { displayName } from '$lib/utils';
  import AttackPlayer from './AttackPlayer.svelte';

  type ChatMessage =
    | { role: 'user' | 'system'; text: string; round: number }
    | { role: 'round'; round: number };

  let {
    playerId,
    sessionId,
    roundNumber,
    now,
    stopTime,
    opponents,
    chatHistory,
    appendMessage,
    broadcastAttack
  }: {
    playerId: string;
    sessionId: number;
    roundNumber: number;
    now: number;
    stopTime: string;
    opponents: Player[];
    chatHistory: Record<string, ChatMessage[]>;
    appendMessage: (defenderId: string, message: ChatMessage) => void;
    broadcastAttack: (defenderId: string, correct?: boolean) => void;
  } = $props();

  const timeLeft = $derived(Math.max(0, Math.floor((new Date(stopTime).getTime() - now) / 1000)));

  // Opponents arrive pre-ordered and pre-filtered from the parent.
  // Max 4 columns, rows evened out (5 opponents => 2x3, not a lopsided 2x4).
  const rows = $derived(Math.max(1, Math.ceil(opponents.length / 4)));
  const cols = $derived(Math.max(1, Math.ceil(opponents.length / rows)));
</script>

<div class="attack-grid" style="--cols: {cols}; --rows: {rows};">
  {#each opponents as player (player.playerId)}
    <AttackPlayer
      attackerId={playerId}
      defenderId={player.playerId}
      defenderName={displayName(player)}
      {sessionId}
      {roundNumber}
      {now}
      {timeLeft}
      messages={chatHistory[player.playerId] ?? []}
      {appendMessage}
      {broadcastAttack}
    />
  {/each}
</div>

<style>
  .attack-grid {
    width: 100%;
    height: 100%;
    padding: 0.75rem;
    display: grid;
    grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
    grid-template-rows: repeat(var(--rows), minmax(300px, 1fr));
    gap: 0.75rem;
    align-items: stretch;
    overflow-y: auto;
  }

  @media (max-width: 900px) {
    .attack-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-template-rows: none;
      grid-auto-rows: minmax(300px, 1fr);
    }
  }

  @media (max-width: 600px) {
    .attack-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
