<script lang="ts">
  import type { PageData } from './$types';
  import { hud } from '$lib/stores/hud.svelte';
  import { nameOrId } from '$lib/utils';
  import TopBar from '$lib/components/TopBar.svelte';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data, children }: { data: PageData; children: any } = $props();
</script>

<!-- Branded top bar across every state; shows live phase/round/timer during active play. -->
<div class="flex h-screen w-full flex-col">
  <TopBar
    phase={hud.current?.phase ?? null}
    round={hud.current?.round}
    timeLeft={hud.current?.timeLeft}
    score={data.score}
    playerName={nameOrId(data.playerName, data.playerId)}
    roomName={data.room.roomName}
    roomCode={data.room.code}
  />
  <div class="min-h-0 flex-1">
    {@render children()}
  </div>
</div>
