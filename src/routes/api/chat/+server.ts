import { openai, model } from '$lib/openai';
import { db } from '$lib/server/db';
import { attacks } from '$lib/server/db/schema';
import { error, isHttpError } from '@sveltejs/kit';
import { MAX_PROMPT_LENGTH } from '$lib/constants';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const data = await request.json();

    const attackerId = data.attackerId as string;
    const defenderId = data.defenderId as string;
    const sessionId = Number(data.sessionId);
    const roundNumber = Number(data.roundNumber);
    const atkPrompt = data.atkPrompt as string;

    // Validate the prompts
    if (!atkPrompt) {
      throw error(400, 'atkPrompt is required');
    }

    if (atkPrompt.length > MAX_PROMPT_LENGTH) {
      throw error(400, `atkPrompt cannot exceed ${MAX_PROMPT_LENGTH} characters`);
    }

    // Checked because every exchange is now logged and shown to the defender
    if (!attackerId || !defenderId) {
      throw error(400, 'attackerId and defenderId are required');
    }

    if (attackerId === defenderId) {
      throw error(400, 'Cannot attack your own guard');
    }

    const attacker = await db.query.sessionPlayers.findFirst({
      where: (sessionPlayers, { and, eq }) =>
        and(eq(sessionPlayers.sessionId, sessionId), eq(sessionPlayers.playerId, attackerId))
    });

    if (!attacker) {
      throw error(403, 'Attacker is not a participant in this session');
    }

    // Get the secret from the database
    const secret = await db.query.secrets.findFirst({
      where: (secrets, { and, eq }) =>
        and(
          eq(secrets.sessionId, sessionId),
          eq(secrets.roundNumber, roundNumber),
          eq(secrets.playerId, defenderId)
        )
    });

    if (!secret) {
      throw error(404, 'Secret not found for the given session, round, and player');
    }

    // Get the defender's prompt from the database
    const defPrompt = await db.query.defPrompts.findFirst({
      where: (defPrompts, { and, eq }) =>
        and(eq(defPrompts.sessionId, sessionId), eq(defPrompts.playerId, defenderId))
    });

    // Get OpenAI stream
    let inputText = defPrompt ? `${defPrompt.prompt}\n\n` : '';
    inputText += atkPrompt;

    const responseStream = await openai.responses.create({
      model,
      instructions: `The sigil is ${secret.secret}.`,
      input: inputText,
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
              const textChunk = event.delta;
              reply += textChunk;
              controller.enqueue(encoder.encode(textChunk));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        } finally {
          // Logged once the reply is whole so the defender's history gets a
          // complete exchange; a failed stream still records the attempt.
          await db.insert(attacks).values({
            sessionId,
            roundNumber,
            attackerId,
            defenderId,
            kind: 'prompt',
            text: atkPrompt,
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
    if (isHttpError(err)) throw err; // preserve validation statuses (400/404)
    console.error('Error handling chat request:', err);
    throw error(500, 'Internal Server Error');
  }
};
