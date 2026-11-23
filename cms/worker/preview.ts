import type { Env } from './env';
import { HttpError } from './http';

/**
 * Draft previews.
 *
 * The CMS is the only place that ever sees the secret. It signs a short-lived
 * token for one slug, the editor opens the site with `?preview=<token>`, and
 * the site's Worker passes the token straight through to
 * `GET /api/preview/<slug>`, which verifies it here. Nothing is stored, and a
 * leaked link stops working after `TTL_MS`.
 */

const TTL_MS = 30 * 60 * 1000;

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    new TextEncoder().encode(message),
  );
  return base64url(new Uint8Array(signature));
}

function previewKey(env: Env): string {
  const value = (env.PREVIEW_SECRET || env.ADMIN_TOKEN || '').trim();
  if (!value) {
    throw new HttpError(
      503,
      'preview_not_configured',
      'Set PREVIEW_SECRET (or ADMIN_TOKEN) to enable draft previews.',
    );
  }
  return value;
}

export async function createPreviewToken(
  env: Env,
  slug: string,
): Promise<{ token: string; expiresAt: string }> {
  const key = previewKey(env);
  const expires = Date.now() + TTL_MS;
  const signature = await hmac(key, `${slug}.${expires}`);
  return { token: `${expires}.${signature}`, expiresAt: new Date(expires).toISOString() };
}

export async function verifyPreviewToken(
  env: Env,
  slug: string,
  token: string,
): Promise<boolean> {
  const [expiresRaw, signature] = (token || '').split('.');
  const expires = Number(expiresRaw);
  if (!signature || !Number.isFinite(expires) || Date.now() > expires) return false;

  const expected = await hmac(previewKey(env), `${slug}.${expires}`);
  if (expected.length !== signature.length) return false;

  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  }
  return difference === 0;
}
