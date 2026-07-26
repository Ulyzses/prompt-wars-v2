import type { Player } from './types';

// A correct guess. `round` is the round number the guess belongs to.
export type GuessRow = {
  round: number;
  attackerId: string;
  defenderId: string;
  points: number;
};

export const DEFENCE_BONUS = 5;

// Points for a correct guess, keyed on how many attackers already cracked this
// defender this round (rank0) and the player count (game-mechanics.md#scoring).
// The tier table has exactly `players - 1` filled slots — the max number of
// attackers who can crack a single defender.
export function pointsForRank(rank0: number, playerCount: number): number {
  const tiers =
    playerCount <= 2
      ? [5]
      : playerCount === 3
        ? [5, 3]
        : playerCount === 4
          ? [5, 3, 2]
          : playerCount === 5
            ? [5, 4, 3, 2]
            : [5, 4, 3, 2]; // 6+ players: 4th and beyond all score 2

  return tiers[rank0] ?? (playerCount >= 6 ? 2 : 0);
}

// Points earned by each player in a single round: guess points to the attackers,
// plus a defence bonus to any roster member whose secret went un-guessed. The
// defence bonus only lands once the round's attack phase has ended.
export function roundPoints(
  round: number,
  guesses: GuessRow[],
  roster: Player[],
  attackEnded: boolean
): Record<string, number> {
  const points: Record<string, number> = {};
  const crackedDefenders = new Set<string>();

  for (const g of guesses) {
    if (g.round !== round) continue;
    points[g.attackerId] = (points[g.attackerId] ?? 0) + g.points;
    crackedDefenders.add(g.defenderId);
  }

  if (attackEnded) {
    for (const p of roster) {
      if (!crackedDefenders.has(p.playerId)) {
        points[p.playerId] = (points[p.playerId] ?? 0) + DEFENCE_BONUS;
      }
    }
  }

  return points;
}

type AttackRound = { roundNumber: number; endingOn: string | Date };

// Total score per player across every round, seeding each roster member at 0.
export function computeScores(
  guesses: GuessRow[],
  roster: Player[],
  attackRounds: AttackRound[],
  now: number
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const p of roster) totals[p.playerId] = 0;

  const roundNumbers = new Set<number>(guesses.map((g) => g.round));
  for (const r of attackRounds) roundNumbers.add(r.roundNumber);

  for (const rn of roundNumbers) {
    const attack = attackRounds.find((r) => r.roundNumber === rn);
    const attackEnded = attack ? +new Date(attack.endingOn) <= now : false;
    for (const [pid, pts] of Object.entries(roundPoints(rn, guesses, roster, attackEnded))) {
      totals[pid] = (totals[pid] ?? 0) + pts;
    }
  }

  return totals;
}
