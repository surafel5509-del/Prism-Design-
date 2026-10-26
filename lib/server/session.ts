import { cookies } from 'next/headers';
import crypto from 'node:crypto';

const COOKIE = 'prism_uid';

/** Guest-first identity: an HttpOnly cookie. Swap for Supabase/Clerk sessions in production. */
export function getUserId(): string {
  const jar = cookies();
  const existing = jar.get(COOKIE)?.value;
  if (existing && /^[a-zA-Z0-9_-]{10,64}$/.test(existing)) return existing;
  return 'guest';
}

export function ensureUserId(): string {
  const jar = cookies();
  const existing = jar.get(COOKIE)?.value;
  if (existing && /^[a-zA-Z0-9_-]{10,64}$/.test(existing)) return existing;
  const id = `u_${crypto.randomBytes(12).toString('base64url')}`;
  try {
    jar.set(COOKIE, id, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365, secure: process.env.NODE_ENV === 'production' });
  } catch { /* read-only context */ }
  return id;
}

export function jsonError(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ error: message, ...extra }), { status, headers: { 'content-type': 'application/json' } });
}
