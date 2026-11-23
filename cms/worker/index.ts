import type { Env } from './env';
import { authenticate } from './auth';
import {
  createPost,
  deletePost,
  ensureSchema,
  getOne,
  getPublished,
  listAll,
  listPublished,
  updatePost,
  validatePostInput,
} from './posts';
import { deleteMedia, handlePublicMedia, listMedia, uploadMedia } from './media';
import {
  corsHeaders,
  error,
  harden,
  HttpError,
  json,
  methodNotAllowed,
  readJsonBody,
} from './http';
import { isArticleChannel, type ArticleChannel } from '../shared/types';

const PUBLIC_PREFIX = '/api/posts';
const ADMIN_PREFIX = '/api/admin';
const MEDIA_PREFIX = '/media/';

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new HttpError(400, 'invalid_path', 'Invalid URL path.');
  }
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

async function publicPosts(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(request, env, 'GET');

  if (url.pathname === PUBLIC_PREFIX) {
    const rawChannel = url.searchParams.get('channel');
    let channel: ArticleChannel | undefined;
    if (rawChannel) {
      if (!isArticleChannel(rawChannel)) {
        throw new HttpError(400, 'invalid_channel', 'Channel must be news or culture.');
      }
      channel = rawChannel;
    }
    const posts = await listPublished(env, channel);
    return json(request, env, posts, 200, {
      'Cache-Control': 'public, max-age=30, stale-while-revalidate=300',
    });
  }

  const slug = trimSlashes(decode(url.pathname.slice(PUBLIC_PREFIX.length)));
  if (!slug) throw new HttpError(404, 'not_found', 'Post not found.');
  const post = await getPublished(env, slug);
  if (!post) throw new HttpError(404, 'not_found', 'Post not found.');
  return json(request, env, post, 200, {
    'Cache-Control': 'public, max-age=30, stale-while-revalidate=300',
  });
}

async function admin(request: Request, env: Env, url: URL): Promise<Response> {
  const auth = await authenticate(request, env);
  if (!auth.ok) return error(request, env, 401, 'unauthorized', auth.message);

  if (url.pathname === `${ADMIN_PREFIX}/session` && request.method === 'GET') {
    return json(request, env, { session: auth.session });
  }

  await ensureSchema(env);

  if (url.pathname === `${ADMIN_PREFIX}/posts`) {
    if (request.method === 'GET') {
      return json(request, env, { posts: await listAll(env) });
    }
    if (request.method === 'POST') {
      const input = validatePostInput(await readJsonBody(request));
      const post = await createPost(env, input);
      return json(request, env, { post }, 201);
    }
    return methodNotAllowed(request, env, 'GET, POST');
  }

  if (url.pathname.startsWith(`${ADMIN_PREFIX}/posts/`)) {
    const slug = trimSlashes(decode(url.pathname.slice(`${ADMIN_PREFIX}/posts/`.length)));
    if (!slug) throw new HttpError(404, 'not_found', 'Post not found.');

    if (request.method === 'GET') {
      const post = await getOne(env, slug);
      if (!post) throw new HttpError(404, 'not_found', 'Post not found.');
      return json(request, env, { post });
    }
    if (request.method === 'PUT') {
      const input = validatePostInput(await readJsonBody(request), slug);
      return json(request, env, { post: await updatePost(env, slug, input) });
    }
    if (request.method === 'DELETE') {
      await deletePost(env, slug);
      return json(request, env, { ok: true });
    }
    return methodNotAllowed(request, env, 'GET, PUT, DELETE');
  }

  if (url.pathname === `${ADMIN_PREFIX}/media`) {
    if (request.method === 'GET') {
      return json(request, env, await listMedia(env, url.searchParams.get('cursor') || undefined));
    }
    if (request.method === 'POST') {
      const item = await uploadMedia(request, env);
      return json(request, env, { item }, 201);
    }
    return methodNotAllowed(request, env, 'GET, POST');
  }

  if (url.pathname.startsWith(`${ADMIN_PREFIX}/media/`)) {
    if (request.method !== 'DELETE') return methodNotAllowed(request, env, 'DELETE');
    const key = trimSlashes(decode(url.pathname.slice(`${ADMIN_PREFIX}/media/`.length)));
    await deleteMedia(env, key);
    return json(request, env, { ok: true });
  }

  throw new HttpError(404, 'not_found', 'Admin endpoint not found.');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    try {
      if (url.pathname === '/api/health') {
        return json(request, env, { ok: true, service: 'bluebook-cms' });
      }
      if (url.pathname === PUBLIC_PREFIX || url.pathname.startsWith(`${PUBLIC_PREFIX}/`)) {
        return await publicPosts(request, env, url);
      }
      if (url.pathname === ADMIN_PREFIX || url.pathname.startsWith(`${ADMIN_PREFIX}/`)) {
        return await admin(request, env, url);
      }
      if (url.pathname.startsWith(MEDIA_PREFIX)) {
        return await handlePublicMedia(request, env, url);
      }
      if (url.pathname.startsWith('/api/')) {
        throw new HttpError(404, 'not_found', 'API endpoint not found.');
      }

      if (request.method === 'GET' || request.method === 'HEAD') {
        return harden(await env.ASSETS.fetch(request));
      }
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    } catch (err) {
      if (err instanceof HttpError) {
        return error(request, env, err.status, err.code, err.message);
      }
      console.error('Unhandled CMS error', err);
      return error(request, env, 500, 'internal_error', 'Unexpected server error.');
    }
  },
};
