import { createHash, timingSafeEqual } from 'node:crypto';
import { ADMIN_PASSWORD } from '$env/static/private';
import type { Cookies } from '@sveltejs/kit';

export const ADMIN_COOKIE = 'singleAdmin';

// The cookie carries a hash of the password rather than the password itself.
const token = createHash('sha256').update(ADMIN_PASSWORD).digest('hex');

function equals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function checkPassword(input: string): boolean {
  return equals(createHash('sha256').update(input).digest('hex'), token);
}

export function isAdmin(cookies: Cookies): boolean {
  const cookie = cookies.get(ADMIN_COOKIE);
  return !!cookie && equals(cookie, token);
}

export function grantAdmin(cookies: Cookies): void {
  cookies.set(ADMIN_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 12
  });
}
