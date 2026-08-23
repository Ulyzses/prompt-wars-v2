import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { singleDefPrompts, singleSettings } from '$lib/server/db/single';
import { checkPassword, grantAdmin, isAdmin } from '$lib/server/single/admin';
import { SETTINGS_ID, getCurrentDefPrompt, getSettings, parseVocabulary } from '$lib/server/single';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
  if (!isAdmin(cookies)) return { authed: false as const };

  const [settings, defPrompt] = await Promise.all([getSettings(), getCurrentDefPrompt()]);

  return {
    authed: true as const,
    defPrompt: defPrompt?.prompt ?? '',
    duration: settings.duration,
    vocabulary: settings.vocabulary
  };
};

export const actions = {
  auth: async ({ request, cookies }) => {
    const data = await request.formData();
    const password = (data.get('password') as string) ?? '';

    // A wrong password is a dead end, not a retry loop.
    if (!checkPassword(password)) throw redirect(303, '/single');

    grantAdmin(cookies);
    throw redirect(303, '/admin');
  },
  save: async ({ request, cookies }) => {
    if (!isAdmin(cookies)) throw redirect(303, '/single');

    const data = await request.formData();
    const prompt = ((data.get('defPrompt') as string) ?? '').trim();
    const duration = Number(data.get('duration'));
    const words = parseVocabulary((data.get('vocabulary') as string) ?? '');

    if (!Number.isInteger(duration) || duration <= 0)
      return fail(400, { error: 'Duration must be a positive whole number of seconds' });

    // A new history row only when the text actually changed, so re-saving the
    // other fields doesn't pile up duplicates.
    const current = await getCurrentDefPrompt();
    if (!current || current.prompt !== prompt) {
      await db.insert(singleDefPrompts).values({ prompt });
    }

    const vocabulary = words.join('\n');

    await db
      .insert(singleSettings)
      .values({ id: SETTINGS_ID, duration, vocabulary })
      .onConflictDoUpdate({
        target: singleSettings.id,
        set: { duration, vocabulary, updatedAt: new Date() }
      });

    return { saved: true, duration, words: words.length };
  }
} satisfies Actions;
