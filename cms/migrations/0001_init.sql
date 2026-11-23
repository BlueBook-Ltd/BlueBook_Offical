-- Bluebook CMS schema.
--
-- This mirrors the schema the original bluebook-cms worker already created in
-- production (`bluebook-cms`, id `d0e4a335-0758-4db7-823b-a61c3f6bd954`), so a
-- fresh local database matches production instead of drifting from it:
--   * `posts.content_md` holds Markdoc source, `content_plain` the search copy.
--   * publication lives in `status` + `publish_at` + `published_at`.
--   * covers live in `cover_media_id` / `cover_url`; media metadata in `media`.
--   * tags are normalised into `tags` + `post_tags` (position keeps order).
-- Every statement is idempotent because the production tables already exist.

CREATE TABLE IF NOT EXISTS posts (
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
);

CREATE INDEX IF NOT EXISTS posts_publish_at
  ON posts (publish_at) WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS posts_status_published_at
  ON posts (status, published_at DESC);

CREATE TABLE IF NOT EXISTS tags (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS post_tags (
  post_id  TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_slug TEXT NOT NULL REFERENCES tags(slug) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (post_id, tag_slug)
);

CREATE INDEX IF NOT EXISTS post_tags_tag ON post_tags (tag_slug);

CREATE TABLE IF NOT EXISTS media (
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
);

CREATE TABLE IF NOT EXISTS post_revisions (
  id         TEXT PRIMARY KEY,
  post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  snapshot   TEXT NOT NULL,
  author_id  TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS post_revisions_post
  ON post_revisions (post_id, created_at DESC);

CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE,
  name         TEXT,
  role         TEXT NOT NULL DEFAULT 'editor',
  created_at   TEXT NOT NULL,
  last_seen_at TEXT
);
