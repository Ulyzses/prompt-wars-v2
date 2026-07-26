import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { fail, redirect } from '@sveltejs/kit';
import { rooms } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

function generateRoomCode(length = 6): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    code += chars[randomIndex];
  }

  return code;
}

export const actions = {
  create: async ({ request, locals, cookies }) => {
    const data = await request.formData();

    const playerName = data.get('playerName')?.toString().trim();
    const roomName = data.get('roomName')?.toString().trim();

    if (!playerName) return fail(400, { error: 'Player name is required' });
    if (!roomName) return fail(400, { error: 'Room name is required' });

    // Persist player name in a cookie for later retrieval
    cookies.set('playerName', playerName, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365 // 1 year
    });

    let code = generateRoomCode();

    while (true) {
      const existingRoom = await db.query.rooms.findFirst({
        where: eq(rooms.code, code)
      });

      if (!existingRoom) break;

      code = generateRoomCode();
    }

    await db.insert(rooms).values({
      code,
      roomName,
      hostId: locals.playerId
    });

    throw redirect(303, `/room/${code}`);
  },
  join: async ({ request, cookies }) => {
    const data = await request.formData();

    const playerName = data.get('playerName')?.toString().trim();
    const roomId = data.get('roomId')?.toString().trim();

    if (!playerName) return fail(400, { error: 'Player name is required' });
    if (!roomId) return fail(400, { error: 'Room ID is required' });

    // Persist player name in a cookie for later retrieval
    cookies.set('playerName', playerName, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365 // 1 year
    });

    const room = await db.query.rooms.findFirst({
      where: eq(rooms.code, roomId)
    });

    if (!room)
      return fail(404, {
        error: 'Room not found',
        values: { roomId }
      });

    throw redirect(303, `/room/${room.code}`);
  }
} satisfies Actions;

export const load: PageServerLoad = async ({ locals }) => {
  return {
    playerName: locals.playerName
  };
};
