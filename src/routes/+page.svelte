<script lang="ts">
  import { MenuAction } from '$lib/types';

  let { form } = $props();

  let action: MenuAction | null = $state(null);
  let playerName: string = $state('');
  let error: string = $state('');

  // For create
  let roomName: string = $state('');

  // For join
  let roomId: string = $state('');

  function changeAction(newAction: MenuAction | null) {
    if (newAction) {
      if (!playerName) {
        error = 'Player name is required';
        return;
      } else {
        error = '';
      }
    }
    action = newAction;
  }
</script>

<div class="p-8 border-2 shadow-xl bg-white border-black w-xl">
  <h1 class="text-3xl font-bold mb-4 text-primary">Prompt Wars</h1>

  <form method="POST">
    {#if !action}
      <label for="playerName">Player Name:</label>
      <input id="playerName" name="playerName" type="text" bind:value={playerName} />
      <button onclick={() => changeAction(MenuAction.CREATE)} type="button">Create Room</button>
      <button onclick={() => changeAction(MenuAction.JOIN)} type="button">Join Room</button>
    {:else if action === MenuAction.CREATE}
      <input hidden id="playerName" name="playerName" type="text" bind:value={playerName} />

      <label for="roomName">Room Name:</label>
      <input id="roomName" name="roomName" type="text" bind:value={roomName} />

      <button formaction="?/create" type="submit">Create</button>

      <button onclick={() => changeAction(null)} type="button">Back</button>
    {:else if action === MenuAction.JOIN}
      <input hidden id="playerName" name="playerName" type="text" bind:value={playerName} />

      <label for="roomId">Room Code:</label>
      <input id="roomId" name="roomId" type="text" bind:value={roomId} />

      <button formaction="?/join" type="submit">Join</button>

      <button onclick={() => changeAction(null)} type="button">Back</button>
    {/if}
  </form>

  {#if error || form?.error}
    <p class="text-red-500 mt-4">{error || form?.error}</p>
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

  label {
    margin-top: 1rem;
  }

  form {
    display: flex;
    flex-direction: column;
  }
</style>
