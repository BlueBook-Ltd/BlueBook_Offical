import type { D1PreparedStatement, Env } from './env';
import { HttpError } from './http';
import {
  isArticleChannel,
  type ArticleChannel,
  type CmsPost,
  type PostInput,
} from '../shared/types';
import { fallbackSlug, isValidSlug, slugify } from '../shared/slug';

/**
 * The production D1 database already contains the original bluebook-cms
 * schema: `posts` stores Markdoc in `content_md`, publication in
 * `status/publish_at/published_at`, and tags in `tags` + `post_tags`.
 * This layer maps that schema onto the public `CmsPost` contract instead of
 * creating a second, incompatible posts table.
 */
interface PostRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content_md: string;
  channels: string;
  status: string;
  publish_at: string | null;
  published_at: string | null;
  featured: number;
  read_time: number | null;
  ratio: string;
  cover_media_id: string | null;
  cover_url: string | null;
  updated_at: string;
}

const COLUMNS =
  'id, slug, title, excerpt, content_md, channels, status, publish_at, published_at, featured, read_time, ratio, cover_media_id, cover_url, updated_at';

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS posts (
    id             TEXT PRIMARY KEY,
    slug           TEXT NOT NULL UNIQUE,
    title          TEXT NOT NULL,
    excerpt        TEXT NOT NULL DEFAULT '',
    content_md     TEXT NOT NULL DEFAULT '',
    content_plain  TEXT NOT NULL DEFAULT '',
    channels       TEXT NOT NULL DEFAULT '["news"]',
    status         TEXT NOT NULL DEFAULT 'draft',
    locale         TEXT NOT NULL DEFAULT 'en',
    publish_at     TEXT,
    published_at   TEXT,
    featured       INTEGER NOT NULL DEFAULT 0,
    read_time      INTEGER,
    ratio          TEXT NOT NULL DEFAULT '4 / 5',
    cover_media_id TEXT,
    cover_url      TEXT,
    author_id      TEXT,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tags (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS post_tags (
    post_id  TEXT NOT NULL,
    tag_slug TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (post_id, tag_slug)
  )`,
  `CREATE TABLE IF NOT EXISTS media (
    id         TEXT PRIMARY KEY,
    r2_key     TEXT NOT NULL UNIQUE,
    url        TEXT NOT NULL,
    mime       TEXT NOT NULL,
    bytes      INTEGER NOT NULL,
    width      INTEGER,
    height     INTEGER,
    alt        TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS post_revisions (
    id         TEXT PRIMARY KEY,
    post_id    TEXT NOT NULL,
    snapshot   TEXT NOT NULL,
    author_id  TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id           TEXT PRIMARY KEY,
    email        TEXT NOT NULL UNIQUE,
    name         TEXT,
    role         TEXT NOT NULL DEFAULT 'editor',
    created_at   TEXT NOT NULL,
    last_seen_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS posts_publish_at ON posts (publish_at) WHERE status = 'scheduled'`,
  'CREATE INDEX IF NOT EXISTS posts_status_published_at ON posts (status, published_at DESC)',
  'CREATE INDEX IF NOT EXISTS post_tags_tag ON post_tags (tag_slug)',
  'CREATE INDEX IF NOT EXISTS post_revisions_post ON post_revisions (post_id, created_at DESC)',
];

let schemaPromise: Promise<void> | null = null;

/** Idempotent schema bootstrap for local dev and fresh databases. */
export function ensureSchema(env: Env): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      for (const statement of SCHEMA_STATEMENTS) {
        await env.DB.prepare(statement).run();
      }
    })().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

function parseChannels(value: string): ArticleChannel[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return ['news'];
    const channels = parsed.filter(isArticleChannel);
    return channels.length ? channels : ['news'];
  } catch {
    return ['news'];
  }
}

function parseTagNames(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function publishStamp(row: PostRow): string | null {
  return row.published_at || row.publish_at;
}

function rowToPost(row: PostRow, tags: string[], includeContent: boolean): CmsPost {
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    content: includeContent ? row.content_md : '',
    channels: parseChannels(row.channels),
    publishDate: publishStamp(row)?.slice(0, 10) ?? null,
    draft: row.status !== 'published',
    featured: Boolean(row.featured),
    readTime: row.read_time,
    ratio: row.ratio || '4 / 5',
    tags,
    coverImage: row.cover_url,
    updatedAt: row.updated_at,
  };
}

async function tagsFor(env: Env, postIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (postIds.length === 0) return map;
  const placeholders = postIds.map(() => '?').join(', ');
  const { results } = await env.DB.prepare(
    `SELECT pt.post_id, t.name
     FROM post_tags pt
     JOIN tags t ON t.slug = pt.tag_slug
     WHERE pt.post_id IN (${placeholders})
     ORDER BY pt.post_id, pt.position`,
  )
    .bind(...postIds)
    .all<{ post_id: string; name: string }>();
  for (const row of results) {
    const list = map.get(row.post_id) || [];
    list.push(row.name);
    map.set(row.post_id, list);
  }
  return map;
}

async function getRow(env: Env, slug: string): Promise<PostRow | null> {
  return env.DB.prepare(`SELECT ${COLUMNS} FROM posts WHERE slug = ?`)
    .bind(slug)
    .first<PostRow>();
}

export async function listPublished(env: Env, channel?: ArticleChannel): Promise<CmsPost[]> {
  await ensureSchema(env);
  const now = new Date().toISOString();
  const { results } = await env.DB.prepare(
    `SELECT ${COLUMNS} FROM posts
     WHERE status IN ('published', 'scheduled')
       AND COALESCE(published_at, publish_at) IS NOT NULL
       AND COALESCE(published_at, publish_at) <= ?
     ORDER BY featured DESC, COALESCE(published_at, publish_at) DESC, updated_at DESC`,
  )
    .bind(now)
    .all<PostRow>();

  const tags = await tagsFor(env, results.map((row) => row.id));
  const posts = results.map((row) => rowToPost(row, tags.get(row.id) ?? [], false));
  return channel ? posts.filter((post) => post.channels.includes(channel)) : posts;
}

export async function getPublished(env: Env, slug: string): Promise<CmsPost | null> {
  await ensureSchema(env);
  const now = new Date().toISOString();
  const row = await env.DB.prepare(
    `SELECT ${COLUMNS} FROM posts
     WHERE slug = ? AND status IN ('published', 'scheduled')
       AND COALESCE(published_at, publish_at) IS NOT NULL
       AND COALESCE(published_at, publish_at) <= ?`,
  )
    .bind(slug, now)
    .first<PostRow>();
  if (!row) return null;
  const tags = await tagsFor(env, [row.id]);
  return rowToPost(row, tags.get(row.id) ?? [], true);
}

export async function listAll(env: Env): Promise<CmsPost[]> {
  await ensureSchema(env);
  const { results } = await env.DB.prepare(
    `SELECT ${COLUMNS} FROM posts ORDER BY updated_at DESC`,
  ).all<PostRow>();
  const tags = await tagsFor(env, results.map((row) => row.id));
  return results.map((row) => rowToPost(row, tags.get(row.id) ?? [], false));
}

export async function getOne(env: Env, slug: string): Promise<CmsPost | null> {
  await ensureSchema(env);
  const row = await getRow(env, slug);
  if (!row) return null;
  const tags = await tagsFor(env, [row.id]);
  return rowToPost(row, tags.get(row.id) ?? [], true);
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'invalid_body', 'Request body must be a JSON object.');
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') {
    throw new HttpError(400, 'invalid_publish_date', 'Publish date must be a date string.');
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) {
    throw new HttpError(400, 'invalid_publish_date', 'Publish date must look like YYYY-MM-DD.');
  }
  const date = `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new HttpError(400, 'invalid_publish_date', 'Publish date is not a real calendar date.');
  }
  return date;
}

function normalizeReadTime(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 999) {
    throw new HttpError(400, 'invalid_read_time', 'Read time must be a number between 0 and 999.');
  }
  return Math.round(parsed);
}

function normalizeTags(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const tag = item.trim().slice(0, 40);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length >= 12) break;
  }
  return tags;
}

function normalizeCover(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw new HttpError(400, 'invalid_cover_image', 'Cover image must be a URL or path.');
  }
  const cover = value.trim();
  if (!cover) return null;
  if (cover.length > 1000) {
    throw new HttpError(400, 'invalid_cover_image', 'Cover image URL is too long.');
  }
  if (!/^(https?:\/\/|\/)/i.test(cover)) {
    throw new HttpError(400, 'invalid_cover_image', 'Cover image must start with http(s):// or /.');
  }
  return cover;
}

export function validatePostInput(raw: unknown, slugOverride?: string): PostInput {
  const body = record(raw);

  const title = text(body.title).trim();
  if (!title) throw new HttpError(400, 'missing_title', 'Title is required.');
  if (title.length > 200) throw new HttpError(400, 'invalid_title', 'Title must be 200 characters or fewer.');

  const rawSlug = (slugOverride ?? text(body.slug)).trim();
  const slug = slugify(slugify(rawSlug || title) || fallbackSlug());
  if (!isValidSlug(slug)) {
    throw new HttpError(400, 'invalid_slug', 'Slug must use lowercase letters, numbers, and hyphens.');
  }

  const excerpt = text(body.excerpt).trim();
  if (excerpt.length > 600) {
    throw new HttpError(400, 'invalid_excerpt', 'Excerpt must be 600 characters or fewer.');
  }

  const content = text(body.content);
  if (content.length > 200_000) {
    throw new HttpError(400, 'invalid_content', 'Content is too large (max 200,000 characters).');
  }

  const rawChannels = Array.isArray(body.channels) ? body.channels : [];
  const channels = Array.from(new Set(rawChannels.filter(isArticleChannel)));
  if (channels.length === 0) {
    throw new HttpError(400, 'invalid_channels', 'Choose at least one channel: news or culture.');
  }

  const ratio = text(body.ratio, '4 / 3').trim() || '4 / 3';
  if (!/^\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?$/.test(ratio)) {
    throw new HttpError(400, 'invalid_ratio', 'Ratio must look like "4 / 3".');
  }

  const draft = typeof body.draft === 'boolean' ? body.draft : true;
  const publishDate = normalizeDate(body.publishDate) ?? (draft ? null : todayISO());

  return {
    slug,
    title,
    excerpt,
    content,
    channels,
    publishDate,
    draft,
    featured: typeof body.featured === 'boolean' ? body.featured : false,
    readTime: normalizeReadTime(body.readTime),
    ratio,
    tags: normalizeTags(body.tags),
    coverImage: normalizeCover(body.coverImage),
  };
}

function publicationValues(
  input: PostInput,
  existing?: PostRow,
): { status: string; publish_at: string | null; published_at: string | null } {
  const now = new Date();
  const nowIso = now.toISOString();

  if (input.draft) {
    // Keep the original non-public state instead of silently downgrading a
    // scheduled or archived post to a plain draft when the editor saves it.
    const keepState = existing?.status === 'scheduled' || existing?.status === 'archived';
    const status = keepState ? (existing as PostRow).status : 'draft';
    return {
      status,
      publish_at: input.publishDate ? `${input.publishDate}T00:00:00.000Z` : null,
      // Archived posts keep their historical publish stamp; a post that is
      // deliberately unpublished loses it so it cannot reappear.
      published_at: status === 'archived' ? existing?.published_at ?? null : null,
    };
  }

  const desired = input.publishDate ? `${input.publishDate}T00:00:00.000Z` : nowIso;
  const keepExisting =
    existing?.status === 'published' &&
    existing.published_at &&
    existing.published_at.slice(0, 10) === desired.slice(0, 10);

  return {
    status: 'published',
    publish_at: desired,
    published_at: keepExisting ? existing.published_at : desired <= nowIso ? nowIso : desired,
  };
}

function toPlainText(markdown: string): string {
  return markdown
    .replace(/\{%[\s\S]*?%\}/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hash(value: string): string {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function tagSlug(name: string): string {
  return slugify(name) || `tag-${hash(name)}`;
}

async function syncTags(env: Env, postId: string, names: string[]): Promise<void> {
  const statements: D1PreparedStatement[] = [
    env.DB.prepare('DELETE FROM post_tags WHERE post_id = ?').bind(postId),
  ];
  const seen = new Set<string>();
  for (const [index, name] of names.entries()) {
    const slug = tagSlug(name);
    if (seen.has(slug)) continue;
    seen.add(slug);
    statements.push(
      env.DB.prepare(
        'INSERT INTO tags (slug, name) VALUES (?, ?) ON CONFLICT(slug) DO UPDATE SET name = excluded.name',
      ).bind(slug, name),
    );
    statements.push(
      env.DB.prepare(
        'INSERT INTO post_tags (post_id, tag_slug, position) VALUES (?, ?, ?)',
      ).bind(postId, slug, index),
    );
  }
  await env.DB.batch(statements);
}

export async function createPost(env: Env, input: PostInput): Promise<CmsPost> {
  await ensureSchema(env);
  const existing = await env.DB.prepare('SELECT id FROM posts WHERE slug = ?')
    .bind(input.slug)
    .first<{ id: string }>();
  if (existing) {
    throw new HttpError(409, 'slug_taken', 'A post with this slug already exists.');
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const publication = publicationValues(input);

  await env.DB.prepare(
    `INSERT INTO posts
      (id, slug, title, excerpt, content_md, content_plain, channels, status, locale,
       publish_at, published_at, featured, read_time, ratio, cover_media_id, cover_url,
       author_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      input.slug,
      input.title,
      input.excerpt,
      input.content,
      toPlainText(input.content),
      JSON.stringify(input.channels),
      publication.status,
      'en',
      publication.publish_at,
      publication.published_at,
      input.featured ? 1 : 0,
      input.readTime,
      input.ratio,
      null,
      input.coverImage,
      null,
      now,
      now,
    )
    .run();

  await syncTags(env, id, input.tags);

  const created = await getOne(env, input.slug);
  if (!created) throw new HttpError(500, 'create_failed', 'Post was created but could not be read back.');
  return created;
}

export async function updatePost(env: Env, slug: string, input: PostInput): Promise<CmsPost> {
  await ensureSchema(env);
  const existing = await getRow(env, slug);
  if (!existing) throw new HttpError(404, 'not_found', 'Post not found.');

  const publication = publicationValues(input, existing);
  const coverMediaId =
    input.coverImage && input.coverImage === existing.cover_url ? existing.cover_media_id : null;

  await env.DB.prepare(
    `UPDATE posts SET
       title = ?, excerpt = ?, content_md = ?, content_plain = ?, channels = ?,
       status = ?, publish_at = ?, published_at = ?, featured = ?, read_time = ?,
       ratio = ?, cover_media_id = ?, cover_url = ?, updated_at = ?
     WHERE id = ?`,
  )
    .bind(
      input.title,
      input.excerpt,
      input.content,
      toPlainText(input.content),
      JSON.stringify(input.channels),
      publication.status,
      publication.publish_at,
      publication.published_at,
      input.featured ? 1 : 0,
      input.readTime,
      input.ratio,
      coverMediaId,
      input.coverImage,
      new Date().toISOString(),
      existing.id,
    )
    .run();

  await syncTags(env, existing.id, input.tags);

  const updated = await getOne(env, slug);
  if (!updated) throw new HttpError(500, 'update_failed', 'Post was updated but could not be read back.');
  return updated;
}

export async function deletePost(env: Env, slug: string): Promise<void> {
  await ensureSchema(env);
  const existing = await getRow(env, slug);
  if (!existing) throw new HttpError(404, 'not_found', 'Post not found.');

  await env.DB.batch([
    env.DB.prepare('DELETE FROM post_revisions WHERE post_id = ?').bind(existing.id),
    env.DB.prepare('DELETE FROM post_tags WHERE post_id = ?').bind(existing.id),
    env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(existing.id),
  ]);
}

/**
 * Media delete guard: production posts reference covers either through the
 * `media` row (`cover_media_id`), through the stored URL, or through an
 * absolute `media.bluebook.blue` URL that only contains the R2 key.
 */
export async function countMediaReferences(
  env: Env,
  media: { id: string; key: string; url: string },
): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM posts
     WHERE cover_media_id = ?
        OR cover_url = ?
        OR (? <> '' AND instr(cover_url, ?) > 0)`,
  )
    .bind(media.id, media.url, media.key, media.key)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

export { parseTagNames };
