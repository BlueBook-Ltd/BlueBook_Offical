import type { CmsPost, MediaItem, PostInput, SessionInfo } from '@shared/types';

const TOKEN_KEY = 'bluebook-cms-token';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function readStoredToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function storeToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage can be disabled; the in-memory token still works for this tab.
  }
}

export function clearStoredToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore.
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(path, { ...options, headers });
  } catch {
    throw new ApiError(0, 'network_error', 'Could not reach the CMS. Check the Worker is running.');
  }

  const data = (await response.json().catch(() => null)) as
    | { error?: { code?: string; message?: string } }
    | null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.error?.code || 'request_failed',
      data?.error?.message || `Request failed (${response.status}).`,
    );
  }

  return data as T;
}

export async function getSession(token?: string): Promise<SessionInfo> {
  const data = await request<{ session: SessionInfo }>('/api/admin/session', {}, token);
  return data.session;
}

export async function listPosts(token?: string): Promise<CmsPost[]> {
  const data = await request<{ posts: CmsPost[] }>('/api/admin/posts', {}, token);
  return data.posts;
}

export async function getPost(slug: string, token?: string): Promise<CmsPost> {
  const data = await request<{ post: CmsPost }>(
    `/api/admin/posts/${encodeURIComponent(slug)}`,
    {},
    token,
  );
  return data.post;
}

export async function createPost(input: PostInput, token?: string): Promise<CmsPost> {
  const data = await request<{ post: CmsPost }>(
    '/api/admin/posts',
    { method: 'POST', body: JSON.stringify(input) },
    token,
  );
  return data.post;
}

export async function updatePost(
  slug: string,
  input: PostInput,
  token?: string,
): Promise<CmsPost> {
  const data = await request<{ post: CmsPost }>(
    `/api/admin/posts/${encodeURIComponent(slug)}`,
    { method: 'PUT', body: JSON.stringify(input) },
    token,
  );
  return data.post;
}

export interface PreviewLink {
  token: string;
  expiresAt: string;
  path: string;
}

/** Signed, 30-minute link that renders this post on the site, draft or not. */
export async function createPreviewLink(slug: string, token?: string): Promise<PreviewLink> {
  return request<PreviewLink>(
    '/api/admin/preview-link',
    { method: 'POST', body: JSON.stringify({ slug }) },
    token,
  );
}

export async function deletePost(slug: string, token?: string): Promise<void> {
  await request<{ ok: true }>(
    `/api/admin/posts/${encodeURIComponent(slug)}`,
    { method: 'DELETE' },
    token,
  );
}

export async function listMedia(
  token?: string,
  cursor?: string | null,
): Promise<{ items: MediaItem[]; cursor: string | null }> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return request<{ items: MediaItem[]; cursor: string | null }>(
    `/api/admin/media${query}`,
    {},
    token,
  );
}

export async function uploadMedia(file: File, token?: string): Promise<MediaItem> {
  const form = new FormData();
  form.set('file', file);
  const data = await request<{ item: MediaItem }>(
    '/api/admin/media',
    { method: 'POST', body: form },
    token,
  );
  return data.item;
}

export async function deleteMedia(key: string, token?: string): Promise<void> {
  const path = key.split('/').map(encodeURIComponent).join('/');
  await request<{ ok: true }>(`/api/admin/media/${path}`, { method: 'DELETE' }, token);
}
