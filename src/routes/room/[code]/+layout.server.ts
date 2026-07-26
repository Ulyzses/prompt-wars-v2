import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { rooms, sessions, rounds, sessionPlayers, guesses } from '$lib/server/db/schema';
import type { Player } from '$lib/types';
import { computeScores, type GuessRow } from '$lib/scoring';
import { eq } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, locals }) => {
  // Get room
  const room = await db.query.rooms.findFirst({
    where: eq(rooms.code, params.code)
  });

  if (!room) throw error(404, 'Room not found');

  // Fetch the latest session for the room
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.roomId, room.id),
    orderBy: (sessions, { desc }) => [desc(sessions.updatedAt)]
  });

  // Get the rounds and frozen participant roster for the latest session if it exists

  const existingRounds = [];
  const roster: Player[] = [];

  // Every correct guess for the session; the client derives live scores from these.
  let guessList: GuessRow[] = [];

  // This player's total score, including the defence bonus; seeds the top bar.
  let score = 0;

  if (session) {
    const roundRows = await db.query.rounds.findMany({
      where: eq(rounds.sessionId, session.id),
      orderBy: (rounds, { asc }) => [asc(rounds.roundNumber), asc(rounds.endingOn)]
    });

    const mappedRounds = (roundRows ?? []).map((r) => ({
      id: r.id,
      roundNumber: r.roundNumber,
      attacking: r.attacking,
      startedAt: r.startedAt,
      endingOn: r.endingOn
    }));

    existingRounds.push(...mappedRounds);

    const rosterRows = await db.query.sessionPlayers.findMany({
      where: eq(sessionPlayers.sessionId, session.id),
      orderBy: (sessionPlayers, { asc }) => [asc(sessionPlayers.id)]
    });

    roster.push(
      ...(rosterRows ?? []).map((r) => ({
        playerId: r.playerId,
        playerName: r.playerName,
        isHost: r.playerId === room.hostId
      }))
    );

    const guessRows = await db.query.guesses.findMany({
      where: eq(guesses.sessionId, session.id)
    });

    guessList = guessRows.map((g) => ({
      round: g.roundNumber,
      attackerId: g.attackerId,
      defenderId: g.defenderId,
      points: g.points
    }));

    const attackRounds = mappedRounds
      .filter((r) => r.attacking)
      .map((r) => ({ roundNumber: r.roundNumber, endingOn: r.endingOn ?? new Date(0) }));

    score = computeScores(guessList, roster, attackRounds, Date.now())[locals.playerId] ?? 0;
  }

  return {
    playerId: locals.playerId,
    playerName: locals.playerName,
    room: {
      id: room.id,
      code: room.code,
      roomName: room.roomName,
      hostId: room.hostId,
      numRounds: room.numRounds,
      defTime: room.defTime,
      atkTime: room.atkTime
    },
    session: session ?? null,
    rounds: existingRounds,
    roster,
    score,
    guesses: guessList,
    isHost: room.hostId === locals.playerId
  };
};
