export type HudInfo = {
  phase: 'defence' | 'attack';
  round: number;
  timeLeft: number;
};

// Written by the room page, read by the layout's top bar for live phase/round/timer.
// Player/room/score come straight from load data instead.
export const hud = $state<{ current: HudInfo | null }>({ current: null });
