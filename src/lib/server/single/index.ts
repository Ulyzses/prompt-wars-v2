import { db } from '$lib/server/db';
import { singleDefPrompts, singleSettings } from '$lib/server/db/single';
import { desc, eq } from 'drizzle-orm';

export const DEFAULT_DURATION = 180;

// The settings row is a singleton.
export const SETTINGS_ID = 1;

export type SingleSettings = {
  duration: number;
  vocabulary: string;
};

export async function getSettings(): Promise<SingleSettings> {
  const [row] = await db
    .select({ duration: singleSettings.duration, vocabulary: singleSettings.vocabulary })
    .from(singleSettings)
    .where(eq(singleSettings.id, SETTINGS_ID));

  return row ?? { duration: DEFAULT_DURATION, vocabulary: '' };
}

// The newest history row; what a session started right now would be played against.
export async function getCurrentDefPrompt(): Promise<{ id: number; prompt: string } | null> {
  const [row] = await db
    .select({ id: singleDefPrompts.id, prompt: singleDefPrompts.prompt })
    .from(singleDefPrompts)
    .orderBy(desc(singleDefPrompts.id))
    .limit(1);

  return row ?? null;
}

export function parseVocabulary(raw: string): string[] {
  return raw
    .split('\n')
    .map((word) => word.trim())
    .filter(Boolean);
}

// The browser owns the clock, so the server only guards the outer edge: work
// arriving well past the deadline is refused rather than trusted.
export const DEADLINE_GRACE_MS = 5000;

export function isPastDeadline(startedAt: Date, duration: number): boolean {
  return Date.now() > startedAt.getTime() + duration * 1000 + DEADLINE_GRACE_MS;
}
