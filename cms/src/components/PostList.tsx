import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CmsPost } from '@shared/types';
import * as api from '../api';
import {
  formatDate,
  formatDateTime,
  postStatus,
  postUrl,
  statusLabel,
  type PostStatus,
} from '../utils';
import {
  ExternalIcon,
  PencilIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
  TrashIcon,
} from './Icons';
import type { ToastTone } from './Toast';

type Filter = 'all' | PostStatus;

interface Props {
  token: string;
  siteOrigin: string;
  navigate: (path: string) => void;
  notify: (message: string, tone?: ToastTone) => void;
  onError: (err: unknown, fallback?: string) => void;
}

export default function PostList({ token, siteOrigin, navigate, notify, onError }: Props) {
  const [posts, setPosts] = useState<CmsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setPosts(await api.listPosts(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load posts.');
      onError(err, 'Could not load posts.');
    } finally {
      setLoading(false);
    }
  }, [token, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const counts = { published: 0, draft: 0, scheduled: 0 };
    for (const post of posts) counts[postStatus(post)] += 1;
    return counts;
  }, [posts]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return posts.filter((post) => {
      if (filter !== 'all' && postStatus(post) !== filter) return false;
      if (!needle) return true;
      return (
        post.title.toLowerCase().includes(needle) ||
        post.slug.toLowerCase().includes(needle) ||
        post.tags.some((tag) => tag.toLowerCase().includes(needle))
      );
    });
  }, [posts, query, filter]);

  async function handleDelete(post: CmsPost) {
    if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`)) return;
    setDeleting(post.slug);
    try {
      await api.deletePost(post.slug, token);
      setPosts((current) => current.filter((item) => item.slug !== post.slug));
      notify('Post deleted.');
    } catch (err) {
      onError(err, 'Could not delete this post.');
    } finally {
      setDeleting(null);
    }
  }

  const filters: Array<{ key: Filter; label: string; count: number }> = [
    { key: 'all', label: 'All', count: posts.length },
    { key: 'published', label: 'Published', count: stats.published },
    { key: 'draft', label: 'Drafts', count: stats.draft },
    { key: 'scheduled', label: 'Scheduled', count: stats.scheduled },
  ];

  return (
    <main className="page">
      <div className="page__header">
        <div>
          <p className="page__eyebrow">EDITORIAL</p>
          <h1 className="page__title">Posts</h1>
          <p className="page__subtitle">
            Everything published to News and Culture. Drafts stay private until
            you publish them.
          </p>
        </div>
        <div className="page__actions">
          <button className="btn btn--ghost" type="button" onClick={() => void load()} disabled={loading}>
            <RefreshIcon size={16} />
            Refresh
          </button>
          <button className="btn btn--primary" type="button" onClick={() => navigate('/posts/new')}>
            <PlusIcon size={16} />
            New post
          </button>
        </div>
      </div>

      <section className="stats" aria-label="Post statistics">
        <div className="stat">
          <span className="stat__label">Total</span>
          <strong className="stat__value">{posts.length}</strong>
        </div>
        <div className="stat">
          <span className="stat__label">Published</span>
          <strong className="stat__value">{stats.published}</strong>
        </div>
        <div className="stat">
          <span className="stat__label">Drafts</span>
          <strong className="stat__value">{stats.draft}</strong>
        </div>
        <div className="stat">
          <span className="stat__label">Scheduled</span>
          <strong className="stat__value">{stats.scheduled}</strong>
        </div>
      </section>

      <section className="panel">
        <div className="panel__toolbar">
          <label className="search">
            <SearchIcon size={16} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, slug, or tag"
              aria-label="Search posts"
            />
          </label>
          <div className="segmented" role="group" aria-label="Filter posts by status">
            {filters.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`segmented__btn${filter === item.key ? ' is-active' : ''}`}
                aria-pressed={filter === item.key}
                onClick={() => setFilter(item.key)}
              >
                {item.label}
                <span className="segmented__count">{item.count}</span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="banner banner--error" role="alert">
            <span>{error}</span>
            <button className="btn btn--danger-ghost btn--sm" type="button" onClick={() => void load()}>
              Try again
            </button>
          </div>
        )}

        {loading ? (
          <div className="post-table" aria-busy="true">
            {Array.from({ length: 6 }).map((_, index) => (
              <div className="post-row post-row--skeleton" key={index}>
                <span className="skeleton skeleton--title" />
                <span className="skeleton skeleton--short" />
                <span className="skeleton skeleton--short" />
                <span className="skeleton skeleton--pill" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <span className="empty__mark" aria-hidden="true">BB</span>
            <h2>{posts.length === 0 ? 'No posts yet' : 'No matching posts'}</h2>
            <p>
              {posts.length === 0
                ? 'Create the first News or Culture post. It stays a draft until you publish it.'
                : 'Try a different search term or status filter.'}
            </p>
            {posts.length === 0 && (
              <button className="btn btn--primary" type="button" onClick={() => navigate('/posts/new')}>
                <PlusIcon size={16} />
                Create a post
              </button>
            )}
          </div>
        ) : (
          <div className="post-table">
            <div className="post-row post-row--head" aria-hidden="true">
              <span>Post</span>
              <span>Channels</span>
              <span>Status</span>
              <span>Updated</span>
              <span />
            </div>
            {filtered.map((post) => {
              const status = postStatus(post);
              return (
                <div className="post-row" key={post.slug}>
                  <div className="post-row__main">
                    <button
                      type="button"
                      className="post-row__title"
                      onClick={() => navigate(`/posts/${encodeURIComponent(post.slug)}`)}
                    >
                      {post.title}
                    </button>
                    <span className="post-row__slug">/{post.slug}</span>
                  </div>

                  <div className="post-row__channels">
                    {post.channels.map((channel) => (
                      <span className="badge badge--channel" key={channel}>
                        {channel}
                      </span>
                    ))}
                  </div>

                  <div className="post-row__status">
                    <span className={`badge badge--${status}`}>{statusLabel(status)}</span>
                    <span className="post-row__date">{formatDate(post.publishDate)}</span>
                  </div>

                  <div className="post-row__updated" title={formatDateTime(post.updatedAt)}>
                    {formatDateTime(post.updatedAt)}
                  </div>

                  <div className="post-row__actions">
                    {status === 'published' && (
                      <a
                        className="icon-btn"
                        href={postUrl(post, siteOrigin)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`View “${post.title}” on the site`}
                        title="View on site"
                      >
                        <ExternalIcon size={16} />
                      </a>
                    )}
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => navigate(`/posts/${encodeURIComponent(post.slug)}`)}
                      aria-label={`Edit “${post.title}”`}
                      title="Edit"
                    >
                      <PencilIcon size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--danger"
                      onClick={() => void handleDelete(post)}
                      disabled={deleting === post.slug}
                      aria-label={`Delete “${post.title}”`}
                      title="Delete"
                    >
                      <TrashIcon size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
