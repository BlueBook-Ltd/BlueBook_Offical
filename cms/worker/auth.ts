import type { Env } from './env';
import type { SessionInfo } from '../shared/types';

export type AuthResult =
  | { ok: true; session: SessionInfo }
  | { ok: false; message: string };

function allowedEmails(env: Env): string[] {
  return (env.ACCESS_ALLOWED_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function digest(value: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return new Uint8Array(hash);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Two ways in:
 *  - Cloudflare Access email header, restricted by ACCESS_ALLOWED_EMAILS.
 *  - `Authorization: Bearer <ADMIN_TOKEN>` for local dev and emergency access.
 */
export async function authenticate(request: Request, env: Env): Promise<AuthResult> {
  const accessEmail = (request.headers.get('Cf-Access-Authenticated-User-Email') || '')
    .trim()
    .toLowerCase();
  const emails = allowedEmails(env);
  if (accessEmail && emails.includes(accessEmail)) {
    return { ok: true, session: { mode: 'access', email: accessEmail } };
  }

  const header = request.headers.get('Authorization') || '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  const expected = (env.ADMIN_TOKEN || '').trim();
  if (token && expected) {
    const [actualDigest, expectedDigest] = await Promise.all([digest(token), digest(expected)]);
    if (timingSafeEqual(actualDigest, expectedDigest)) {
      return { ok: true, session: { mode: 'token', email: null } };
    }
  }

  if (!expected && emails.length === 0) {
    return {
      ok: false,
      message:
        'Admin access is not configured. Set the ADMIN_TOKEN secret, or add ACCESS_ALLOWED_EMAILS for Cloudflare Access.',
    };
  }

  return { ok: false, message: 'Invalid or missing admin credentials.' };
}
