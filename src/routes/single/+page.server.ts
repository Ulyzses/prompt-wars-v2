import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { singleAttacks, singleSessions } from '$lib/server/db/single';
import {
  getCurrentDefPrompt,
  getSettings,
  isPastDeadline,
  parseVocabulary
} from '$lib/server/single';
import { eq, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

const MAX_NAME_LENGTH = 40;
const MAX_CONTACT_LENGTH = 120;

async function loadOwnSession(sessionId: number, playerId: string) {
  const [session] = await db.select().from(singleSessions).where(eq(singleSessions.id, sessionId));
  return session && session.playerId === playerId ? session : null;
}

export const load: PageServerLoad = async () => {
  const [settings, defPrompt] = await Promise.all([getSettings(), getCurrentDefPrompt()]);

  return {
    duration: settings.duration,
    configured: !!defPrompt && parseVocabulary(settings.vocabulary).length > 0
  };
};

export const actions = {
  start: async ({ locals }) => {
    const [settings, defPrompt] = await Promise.all([getSettings(), getCurrentDefPrompt()]);
    const words = parseVocabulary(settings.vocabulary);

    if (!defPrompt || !words.length)
      return fail(400, { error: 'The game has not been configured yet' });

    const secret = words[Math.floor(Math.random() * words.length)];

    const [session] = await db
      .insert(singleSessions)
      .values({
        playerId: locals.playerId,
        secret,
        defPromptId: defPrompt.id,
        duration: settings.duration
      })
      .returning({ id: singleSessions.id, duration: singleSessions.duration });

    return { started: { id: session.id, duration: session.duration } };
  },
  guess: async ({ request, locals }) => {
    const data = await request.formData();

    const sessionId = Number(data.get('sessionId'));
    const guess = ((data.get('guess') as string) ?? '').trim();
    const elapsedMs = Number(data.get('elapsedMs'));

    if (!guess) return fail(400, { error: 'Guess cannot be empty' });

    const session = await loadOwnSession(sessionId, locals.playerId);
    if (!session) return fail(404, { error: 'Session not found' });
    if (session.solved) return fail(400, { error: 'This run is already over' });
    if (isPastDeadline(session.startedAt, session.duration))
      return fail(400, { error: 'Time is up' });

    if (guess.toLowerCase() !== session.secret.toLowerCase()) {
      return { guess: { correct: false as const } };
    }

    // The browser owns the clock, so its number is what gets ranked — but it
    // can't claim a time outside the run it was given.
    const limit = session.duration * 1000;
    const solveMs = Number.isFinite(elapsedMs)
      ? Math.min(Math.max(Math.round(elapsedMs), 0), limit)
      : limit;

    const [{ prompts }] = await db
      .select({ prompts: sql<number>`count(*)::int` })
      .from(singleAttacks)
      .where(eq(singleAttacks.sessionId, session.id));

    await db
      .update(singleSessions)
      .set({ solved: true, solveMs })
      .where(eq(singleSessions.id, session.id));

    return { guess: { correct: true as const, secret: session.secret, solveMs, prompts } };
  },
  submit: async ({ request, locals }) => {
    const data = await request.formData();

    const sessionId = Number(data.get('sessionId'));
    const playerName = ((data.get('playerName') as string) ?? '').trim();
    const contact = ((data.get('contact') as string) ?? '').trim();

    if (!playerName) return fail(400, { error: 'Name is required' });
    if (playerName.length > MAX_NAME_LENGTH)
      return fail(400, { error: `Name cannot exceed ${MAX_NAME_LENGTH} characters` });
    if (contact.length > MAX_CONTACT_LENGTH)
      return fail(400, { error: `Contact cannot exceed ${MAX_CONTACT_LENGTH} characters` });

    const session = await loadOwnSession(sessionId, locals.playerId);
    if (!session) return fail(404, { error: 'Session not found' });
    if (!session.solved) return fail(400, { error: 'This run was not solved' });
    if (session.submittedAt) return fail(400, { error: 'Already submitted' });

    await db
      .update(singleSessions)
      .set({ playerName, contact: contact || null, submittedAt: new Date() })
      .where(eq(singleSessions.id, session.id));

    throw redirect(303, `/single/leaderboard?p=${session.id}`);
  }
} satisfies Actions;
