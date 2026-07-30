export type HudInfo = {
  phase: 'defence' | 'attack';
  round: number;
  timeLeft: number;
};

// Written by the room page, read by the layout's top bar for live phase/round/timer.
// Player/room come straight from load data instead. `score` is live because the
// load-data score only refreshes on invalidateAll(), which a defender never fires.
export const hud = $state<{ current: HudInfo | null; score: number | null }>({
  current: null,
  score: null
});
