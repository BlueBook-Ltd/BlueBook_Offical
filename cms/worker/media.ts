import type { Env, R2Object } from './env';
import { corsHeaders, HttpError } from './http';
import type { MediaItem } from '../shared/types';
import { slugify } from '../shared/slug';
import { countMediaReferences } from './posts';

const MAX_BYTES = 25 * 1024 * 1024;
const MEDIA_PREFIX = '/media/';

function requireBucket(env: Env) {
  if (!env.MEDIA) {
    throw new HttpError(
      501,
      'media_not_configured',
      'R2 media storage is not configured. Create the bluebook-cms-media bucket and bind it as MEDIA.',
    );
  }
  return env.MEDIA;
}

function mimeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    avif: 'image/avif',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
  };
  return map[ext] || 'application/octet-stream';
}

function extensionFor(name: string, contentType: string): string {
  const fromName = name.includes('.') ? name.split('.').pop()?.toLowerCase() : '';
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return `.${fromName}`;
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/avif': '.avif',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
  };
  return map[contentType] || '';
}

function mediaKey(name: string, contentType: string): string {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const base = slugify(name.replace(/\.[^.]+$/, '')) || 'asset';
  return `${year}/${month}/${crypto.randomUUID()}-${base.slice(0, 60)}${extensionFor(name, contentType)}`;
}

function publicUrl(key: string): string {
  return `${MEDIA_PREFIX}${key.split('/').map(encodeURIComponent).join('/')}`;
}

function toItem(object: R2Object): MediaItem {
  return {
    key: object.key,
    url: publicUrl(object.key),
    name: object.customMetadata?.originalName || object.key.split('/').pop() || object.key,
    size: object.size,
    uploaded: new Date(object.uploaded).toISOString(),
    contentType: object.httpMetadata?.contentType || mimeFromName(object.key),
  };
}

function keyFromUrl(url: URL): string {
  let key: string;
  try {
    key = decodeURIComponent(url.pathname.slice(MEDIA_PREFIX.length));
  } catch {
    throw new HttpError(400, 'invalid_media_key', 'Media key is not valid.');
  }
  if (!key || key.includes('..') || key.startsWith('/')) {
    throw new HttpError(400, 'invalid_media_key', 'Media key is not valid.');
  }
  return key;
}

export async function handlePublicMedia(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  if (!env.MEDIA) return new Response('Not found', { status: 404 });

  const object = await env.MEDIA.get(keyFromUrl(url));
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || mimeFromName(object.key));
  headers.set('Content-Length', String(object.size));
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Content-Type-Options', 'nosniff');
  const filename = (object.customMetadata?.originalName || object.key.split('/').pop() || 'asset')
    .replace(/["\\]/g, '');
  headers.set('Content-Disposition', `inline; filename="${filename}"`);
  if (object.etag) headers.set('ETag', object.etag);

  const cors = corsHeaders(request, env);
  cors.forEach((value, key) => headers.set(key, value));

  return new Response(request.method === 'HEAD' ? null : object.body, { status: 200, headers });
}

export async function listMedia(
  env: Env,
  cursor?: string,
): Promise<{ items: MediaItem[]; cursor: string | null }> {
  const bucket = requireBucket(env);
  const result = await bucket.list({
    limit: 60,
    cursor: cursor || undefined,
    include: ['httpMetadata', 'customMetadata'],
  });
  return {
    items: result.objects.map(toItem),
    cursor: result.truncated ? result.cursor ?? null : null,
  };
}

export async function uploadMedia(request: Request, env: Env): Promise<MediaItem> {
  const bucket = requireBucket(env);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new HttpError(400, 'invalid_form', 'Upload must be multipart/form-data.');
  }

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    throw new HttpError(400, 'missing_file', 'Choose an image or video file to upload.');
  }
  if (file.size > MAX_BYTES) {
    throw new HttpError(413, 'file_too_large', 'File is larger than 25 MB.');
  }

  const contentType = file.type || mimeFromName(file.name);
  if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
    throw new HttpError(415, 'unsupported_file', 'Only images and videos can be uploaded.');
  }

  const key = mediaKey(file.name || 'asset', contentType);
  const object = await bucket.put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType,
      cacheControl: 'public, max-age=31536000, immutable',
    },
    customMetadata: {
      originalName: file.name || key.split('/').pop() || 'asset',
    },
  });

  // Keep the legacy `media` table in sync so uploads made from the new editor
  // sit next to the records the original CMS wrote.
  await env.DB.prepare(
    `INSERT INTO media (id, r2_key, url, mime, bytes, width, height, alt, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?)`,
  )
    .bind(crypto.randomUUID(), key, publicUrl(key), contentType, object.size, new Date().toISOString())
    .run();

  return toItem(object);
}

export async function deleteMedia(env: Env, key: string): Promise<void> {
  const bucket = requireBucket(env);
  if (!key || key.includes('..')) {
    throw new HttpError(400, 'invalid_media_key', 'Media key is not valid.');
  }

  const row = await env.DB.prepare('SELECT id, url FROM media WHERE r2_key = ?')
    .bind(key)
    .first<{ id: string; url: string }>();

  const references = await countMediaReferences(env, {
    id: row?.id ?? '',
    key,
    url: row?.url ?? publicUrl(key),
  });
  if (references > 0) {
    throw new HttpError(
      409,
      'media_in_use',
      `This file is still used as the cover of ${references} post(s). Change the cover first.`,
    );
  }

  await bucket.delete(key);
  if (row) {
    await env.DB.prepare('DELETE FROM media WHERE id = ?').bind(row.id).run();
  }
}
