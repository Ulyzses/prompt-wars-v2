import { openai, model } from '$lib/openai';
import { db } from '$lib/server/db';
import { singleAttacks, singleDefPrompts, singleSessions } from '$lib/server/db/single';
import { isPastDeadline } from '$lib/server/single';
import { MAX_PROMPT_LENGTH } from '$lib/constants';
import { COOLDOWN_MS } from '$lib/single/constants';
import { error, isHttpError } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';

import type { RequestHandler } from './$types';

// Slack for the round trip, so a client honouring the cooldown is never refused.
const COOLDOWN_SLACK_MS = 250;

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const data = await request.json();

    const sessionId = Number(data.sessionId);
    const atkPrompt = data.atkPrompt as string;

    if (!atkPrompt) throw error(400, 'atkPrompt is required');
    if (atkPrompt.length > MAX_PROMPT_LENGTH)
      throw error(400, `atkPrompt cannot exceed ${MAX_PROMPT_LENGTH} characters`);

    const [session] = await db
      .select({
        id: singleSessions.id,
        playerId: singleSessions.playerId,
        secret: singleSessions.secret,
        duration: singleSessions.duration,
        startedAt: singleSessions.startedAt,
        solved: singleSessions.solved,
        defPrompt: singleDefPrompts.prompt
      })
      .from(singleSessions)
      .innerJoin(singleDefPrompts, eq(singleDefPrompts.id, singleSessions.defPromptId))
      .where(eq(singleSessions.id, sessionId));

    if (!session || session.playerId !== locals.playerId) throw error(404, 'Session not found');
    if (session.solved) throw error(400, 'This run is already over');

    // The countdown is the browser's, but an abandoned tab shouldn't be able to
    // keep talking to the guard forever.
    if (isPastDeadline(session.startedAt, session.duration)) throw error(400, 'Time is up');

    const [last] = await db
      .select({ createdAt: singleAttacks.createdAt })
      .from(singleAttacks)
      .where(eq(singleAttacks.sessionId, session.id))
      .orderBy(desc(singleAttacks.id))
      .limit(1);

    if (last && Date.now() - last.createdAt.getTime() < COOLDOWN_MS - COOLDOWN_SLACK_MS) {
      throw error(429, 'Still on cooldown');
    }

    const responseStream = await openai.responses.create({
      model,
      instructions: `The special word is ${session.secret}.`,
      input: `${session.defPrompt}\n\n${atkPrompt}`,
      max_output_tokens: 500,
      store: false,
      stream: true,
      temperature: 1
    });

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let reply = '';

        try {
          for await (const event of responseStream) {
            if (event.type === 'response.output_text.delta') {
              reply += event.delta;
              controller.enqueue(encoder.encode(event.delta));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        } finally {
          // Written whole, and counted as one prompt against the tiebreaker.
          await db.insert(singleAttacks).values({
            sessionId: session.id,
            prompt: atkPrompt,
            response: reply || null
          });
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked'
      }
    });
  } catch (err) {
    if (isHttpError(err)) throw err;
    console.error('Error handling singleplayer chat request:', err);
    throw error(500, 'Internal Server Error');
  }
};
