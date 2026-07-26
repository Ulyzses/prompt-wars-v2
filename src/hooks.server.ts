import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  let playerId = event.cookies.get('playerId');

  if (!playerId) {
    // Mint a new player ID and set it as a cookie
    playerId = crypto.randomUUID();
    event.cookies.set('playerId', playerId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365 // 1 year
    });
  }

  event.locals.playerId = playerId;
  event.locals.playerName = event.cookies.get('playerName') ?? '';

  return resolve(event);
};
