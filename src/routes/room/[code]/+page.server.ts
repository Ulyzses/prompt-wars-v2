import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
  rooms,
  rounds,
  sessions,
  defPrompts,
  secrets,
  sessionPlayers,
  guesses,
  attacks
} from '$lib/server/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { all } from '@wordlist/english-eff/all';
import { RandomWords } from '@wordlist/random';
import { pointsForRank } from '$lib/scoring';
import { MAX_PROMPT_LENGTH } from '$lib/constants';

const random = new RandomWords(all);

async function generateRandomSecret(length = 6): Promise<string> {
  let secret = '';

  while (secret.length != length) {
    const words = await random.generate(1);
    secret = words[0];
  }

  return secret;
}

export const actions = {
  config: async ({ request, params }) => {
    const data = await request.formData();

    const numRounds = Number(data.get('numRounds'));
    const defTime = Number(data.get('defTime'));
    const atkTime = Number(data.get('atkTime'));

    // Perform validation
    if (!numRounds || numRounds <= 0)
      return fail(400, { error: 'Number of rounds must be a positive integer' });
    if (!defTime || defTime <= 0)
      return fail(400, { error: 'Defender time must be a positive integer' });
    if (!atkTime || atkTime <= 0)
      return fail(400, { error: 'Attacker time must be a positive integer' });

    // Update the room configuration in the database

    // Assert first that there is a valid room code from layout load
    const code = params.code;
    if (!code) return fail(400, { error: 'Room code is required' });

    const result = await db
      .update(rooms)
      .set({ numRounds, defTime, atkTime })
      .where(eq(rooms.code, code))
      .returning();

    if (result.length === 0) {
      return fail(404, { error: 'Room not found' });
    }

    return { success: true };
  },
  start: async ({ request, params }) => {
    // Assert first that there is a valid room code from layout load
    const code = params.code;
    if (!code) return fail(400, { error: 'Room code is required' });

    const room = await db.query.rooms.findFirst({
      where: eq(rooms.code, code)
    });

    if (!room) {
      return fail(404, { error: 'Room not found' });
    }

    // Reject starting if the room already has a session still in progress.
    const latestSession = await db.query.sessions.findFirst({
      where: eq(sessions.roomId, room.id),
      orderBy: (sessions, { desc }) => [desc(sessions.createdAt)]
    });

    if (latestSession) {
      const lastRound = await db.query.rounds.findFirst({
        where: eq(rounds.sessionId, latestSession.id),
        orderBy: (rounds, { desc }) => [desc(rounds.endingOn)]
      });

      if (lastRound?.endingOn && lastRound.endingOn.getTime() > Date.now()) {
        return fail(400, { error: 'A game is already in progress' });
      }
    }

    // Parse the roster of players present at start
    const form = await request.formData();
    const rosterMap = new Map<string, { playerId: string; playerName: string }>();
    for (const raw of form.getAll('players') as string[]) {
      try {
        const p = JSON.parse(raw) as { playerId: string; playerName: string };
        if (p?.playerId)
          rosterMap.set(p.playerId, { playerId: p.playerId, playerName: p.playerName ?? '' });
      } catch {
        // Ignore malformed roster entries
      }
    }
    const roster = [...rosterMap.values()];

    if (roster.length === 0) {
      return fail(400, { error: 'Cannot start a game with no players' });
    }

    // Create a new session for the room
    const session = await db
      .insert(sessions)
      .values({
        roomId: room.id,
        numRounds: room.numRounds,
        defTime: room.defTime,
        atkTime: room.atkTime
      })
      .returning();

    if (session.length === 0) {
      return fail(500, { error: 'Failed to create game session' });
    }

    const sessionId = session[0].id;

    // Precompute all rounds; the client picks the current one from the timestamps.
    // 5.5s head start lets clients prepare (5s + 500ms slack for latency).
    const startTime = new Date(Date.now() + 5500);

    const roundsData = [];

    const defTimeMs = room.defTime * 1000;
    const atkTimeMs = room.atkTime * 1000;
    const roundDuration = defTimeMs + atkTimeMs;

    let lastRoundEndTime = startTime;
    for (let i = 1; i <= room.numRounds; i++) {
      roundsData.push(
        {
          sessionId,
          roundNumber: i,
          attacking: false, // Start with defence phase
          startedAt: lastRoundEndTime,
          endingOn: new Date(lastRoundEndTime.getTime() + defTimeMs) // Defence time first
        },
        {
          sessionId,
          roundNumber: i,
          attacking: true, // Then attack phase
          startedAt: new Date(lastRoundEndTime.getTime() + defTimeMs), // Attack starts right after defence ends
          endingOn: new Date(lastRoundEndTime.getTime() + roundDuration)
        }
      );

      // Update lastRoundEndTime for the next iteration
      lastRoundEndTime = new Date(lastRoundEndTime.getTime() + roundDuration);
    }

    // Insert all rounds into the database
    await db.insert(rounds).values(roundsData);

    // Freeze the participant roster for this session
    await db
      .insert(sessionPlayers)
      .values(roster.map((p) => ({ sessionId, playerId: p.playerId, playerName: p.playerName })));

    // Create all secrets for each round in advance
    const secretsData: {
      sessionId: number;
      roundNumber: number;
      playerId: string;
      secret: string;
    }[] = [];
    for (let i = 1; i <= room.numRounds; i++) {
      for (const { playerId } of roster) {
        const secret = await generateRandomSecret();
        secretsData.push({ sessionId, roundNumber: i, playerId, secret });
      }
    }

    await db.insert(secrets).values(secretsData);

    return { success: true };
  },
  defend: async ({ request }) => {
    const data = await request.formData();

    const playerId = data.get('playerId') as string;
    const sessionId = Number(data.get('sessionId'));
    const prompt = data.get('prompt') as string;

    // Perform validation
    if (!playerId) return fail(400, { error: 'Player ID is required' });
    if (!sessionId || sessionId <= 0)
      return fail(400, { error: 'Session ID must be a positive integer' });
    if (!prompt || prompt.trim() === '') return fail(400, { error: 'Prompt cannot be empty' });
    if (prompt.length > MAX_PROMPT_LENGTH)
      return fail(400, { error: `Prompt cannot exceed ${MAX_PROMPT_LENGTH} characters` });

    // Upsert the defence prompt into the database
    const result = await db
      .insert(defPrompts)
      .values({
        sessionId,
        playerId,
        prompt
      })
      .onConflictDoUpdate({
        target: [defPrompts.sessionId, defPrompts.playerId],
        set: {
          prompt,
          updatedAt: new Date()
        }
      })
      .returning();

    if (result.length === 0) {
      return fail(500, { error: 'Failed to save defence prompt' });
    }

    return { success: true };
  },
  guess: async ({ request }) => {
    const data = await request.formData();

    const attackerId = data.get('attackerId') as string;
    const defenderId = data.get('defenderId') as string;
    const sessionId = Number(data.get('sessionId'));
    const roundNumber = Number(data.get('roundNumber'));
    const guess = ((data.get('secret') as string) ?? '').trim();

    // Perform validation
    if (!attackerId || !defenderId) return fail(400, { error: 'Missing player identifiers' });
    if (attackerId === defenderId) return fail(400, { error: 'Cannot guess your own secret' });
    if (!sessionId || sessionId <= 0)
      return fail(400, { error: 'Session ID must be a positive integer' });
    if (!roundNumber || roundNumber <= 0)
      return fail(400, { error: 'Round number must be a positive integer' });
    if (!guess) return fail(400, { error: 'Guess cannot be empty' });

    // Look up the defender's secret for this session and round
    const secret = await db.query.secrets.findFirst({
      where: (secrets, { and, eq }) =>
        and(
          eq(secrets.sessionId, sessionId),
          eq(secrets.roundNumber, roundNumber),
          eq(secrets.playerId, defenderId)
        )
    });

    if (!secret)
      return fail(404, { error: 'Secret not found for the given session, round, and player' });

    // Case-insensitive, trimmed comparison
    const correct = guess.toLowerCase() === secret.secret.toLowerCase();

    // Every guess reaches the defender's history log, correct or not
    await db.insert(attacks).values({
      sessionId,
      roundNumber,
      attackerId,
      defenderId,
      kind: 'guess',
      text: guess,
      correct
    });

    // Incorrect guesses are not penalised
    if (!correct) {
      return { guess: { defenderId, correct: false } };
    }

    // Tier the points by this attacker's rank in the race to crack this
    // defender: rank0 = correct guesses already landed on them this round.
    // Read-then-insert isn't transactional; a simultaneous crack of the same
    // defender could share a tier, which we accept at this scale.
    const [{ count: playerCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sessionPlayers)
      .where(eq(sessionPlayers.sessionId, sessionId));

    const [{ count: rank0 }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(guesses)
      .where(
        and(
          eq(guesses.sessionId, sessionId),
          eq(guesses.roundNumber, roundNumber),
          eq(guesses.defenderId, defenderId)
        )
      );

    const points = pointsForRank(Number(rank0), Number(playerCount));

    // Counts once per opponent per round; a repeat correct submit is a no-op
    await db
      .insert(guesses)
      .values({
        sessionId,
        roundNumber,
        attackerId,
        defenderId,
        points
      })
      .onConflictDoNothing({
        target: [guesses.sessionId, guesses.roundNumber, guesses.attackerId, guesses.defenderId]
      });

    return { guess: { defenderId, correct: true } };
  }
} satisfies Actions;
