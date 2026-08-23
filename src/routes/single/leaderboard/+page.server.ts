import { db } from '$lib/server/db';
import { singleAttacks, singleSessions } from '$lib/server/db/single';
import { and, asc, eq, isNotNull, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

// Ranked on solve time at 0.1s granularity, then on prompts used
// (specifications.md#singpleplayer-variant).
const deciseconds = sql<number>`${singleSessions.solveMs} / 100`;
const promptCount = sql<number>`count(${singleAttacks.id})::int`;

export const load: PageServerLoad = async ({ url }) => {
  const highlight = Number(url.searchParams.get('p')) || null;

  const rows = await db
    .select({
      id: singleSessions.id,
      name: singleSessions.playerName,
      solveMs: singleSessions.solveMs,
      prompts: promptCount
    })
    .from(singleSessions)
    .leftJoin(singleAttacks, eq(singleAttacks.sessionId, singleSessions.id))
    .where(
      and(
        eq(singleSessions.solved, true),
        isNotNull(singleSessions.submittedAt),
        isNotNull(singleSessions.solveMs)
      )
    )
    .groupBy(singleSessions.id)
    .orderBy(asc(deciseconds), asc(promptCount), asc(singleSessions.id));

  // Competition ranking: an identical time-and-prompts pair shares a place, and
  // the next entry skips the places consumed by the tie.
  let rank = 0;
  let previous: string | null = null;

  const entries = rows.map((row, index) => {
    const key = `${Math.floor((row.solveMs ?? 0) / 100)}:${row.prompts}`;
    if (key !== previous) {
      rank = index + 1;
      previous = key;
    }

    return {
      id: row.id,
      name: row.name ?? '',
      solveMs: row.solveMs ?? 0,
      prompts: row.prompts,
      rank
    };
  });

  return { entries, highlight };
};
