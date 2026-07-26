export enum MenuAction {
  CREATE = 'create',
  JOIN = 'join'
}

export enum GameState {
  WAITING = 'waiting',
  COUNTDOWN = 'countdown',
  DEFENCE = 'defence',
  ATTACK = 'attack',
  GAME_END = 'game_end'
}

export type Player = {
  playerId: string;
  playerName: string;
  isHost: boolean;
  // Lobby choice. Absent (e.g. from the frozen DB roster) means 'player'.
  role?: 'player' | 'spectator';
};

export type Session = {
  id: number;
  roomId: number;
  numRounds: number;
  defTime: number;
  atkTime: number;
  createdAt: string;
  updatedAt: string;
};
// TODO: ended here

export type Round = {
  id: number;
  roundNumber: number;
  attacking: boolean;
  startedAt: string;
  endingOn: string;
};
