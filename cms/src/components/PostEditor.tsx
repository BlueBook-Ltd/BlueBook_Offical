import { useEffect, useMemo, useRef, useState } from 'react';
import type { CmsPost, MediaItem, PostInput } from '@shared/types';
import { ARTICLE_CHANNELS } from '@shared/types';
import { fallbackSlug, isValidSlug, slugify } from '@shared/slug';
import * as api from '../api';
import {
  formatDateTime,
  postStatus,
  statusLabel,
  todayISO,
} from '../utils';
import MarkdocPreview from './MarkdocPreview';
import MediaLibrary from './MediaLibrary';
import type { ToastTone } from './Toast';
import {
  ArrowLeftIcon,
  ExternalIcon,
  ImageIcon,
  SaveIcon,
  TrashIcon,
  UploadIcon,
  XIcon,
} from './Icons';

interface Props {
  token: string;
  slug: string | null;
  siteOrigin: string;
  navigate: (path: string) => void;
  notify: (message: string, tone?: ToastTone) => void;
  onError: (err: unknown, fallback?: string) => void;
  onDirtyChange: (dirty: boolean) => void;
}

type PickerMode = 'cover' | 'figure' | 'video';

const RATIOS = ['4 / 3', '3 / 4', '1 / 1', '16 / 9', '4 / 5', '5 / 4', '2 / 3', '3 / 2'];

function blankPost(): PostInput {
  return {
    slug: '',
    title: '',
    excerpt: '',
    content: '',
    channels: ['news'],
    publishDate: todayISO(),
    draft: true,
    featured: false,
    readTime: 5,
    ratio: '4 / 3',
    tags: [],
    coverImage: null,
  };
}

function toInput(post: CmsPost): PostInput {
  const { updatedAt: _updatedAt, ...input } = post;
  return input;
}

function same(a: PostInput, b: PostInput): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function validate(post: PostInput): string[] {
  const messages: string[] = [];
  if (!post.title.trim()) messages.push('Title is required.');
  const slug = post.slug.trim() || slugify(post.title) || fallbackSlug();
  if (!isValidSlug(slug)) {
    messages.push('Slug must use lowercase letters, numbers, and hyphens.');
  }
  if (post.channels.length === 0) messages.push('Choose at least one channel.');
  if (post.publishDate && !/^\d{4}-\d{2}-\d{2}$/.test(post.publishDate)) {
    messages.push('Publish date must be YYYY-MM-DD.');
  }
  if (!post.draft && !post.publishDate) messages.push('Published posts need a publish date.');
  if (post.readTime !== null && (!Number.isInteger(post.readTime) || post.readTime < 0 || post.readTime > 999)) {
    messages.push('Read time must be a whole number between 0 and 999.');
  }
  if (post.coverImage && !/^(https?:\/\/|\/)/i.test(post.coverImage.trim())) {
    messages.push('Cover image must start with http(s):// or /.');
  }
  return messages;
}

export default function PostEditor({
  token,
  slug,
  siteOrigin,
  navigate,
  notify,
  onError,
  onDirtyChange,
}: Props) {
  const isNew = !slug;
  const [post, setPost] = useState<PostInput | null>(() => (isNew ? blankPost() : null));
  const [original, setOriginal] = useState<PostInput | null>(() => (isNew ? blankPost() : null));
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [errors, setErrors] = useState<string[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [picker, setPicker] = useState<PickerMode | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!slug) {
      const blank = blankPost();
      setPost(blank);
      setOriginal(blank);
      setUpdatedAt(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    api
      .getPost(slug, token)
      .then((found) => {
        if (cancelled) return;
        const input = toInput(found);
        setPost(input);
        setOriginal(input);
        setUpdatedAt(found.updatedAt);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoading(false);
        onError(err, 'Could not load this post.');
      });
    return () => {
      cancelled = true;
    };
  }, [slug, token, onError]);

  const dirty = useMemo(() => Boolean(post && original && !same(post, original)), [post, original]);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function patch<K extends keyof PostInput>(key: K, value: PostInput[K]) {
    setPost((current) => (current ? { ...current, [key]: value } : current));
  }

  function handleTitleChange(value: string) {
    setPost((current) => {
      if (!current) return current;
      const next = { ...current, title: value };
      if (isNew && !slugTouched) next.slug = slugify(value);
      return next;
    });
  }

  function toggleChannel(channel: PostInput['channels'][number]) {
    if (!post) return;
    const has = post.channels.includes(channel);
    if (has && post.channels.length === 1) {
      notify('A post needs at least one channel.', 'error');
      return;
    }
    patch(
      'channels',
      has ? post.channels.filter((item) => item !== channel) : [...post.channels, channel],
    );
  }

  function addTag() {
    if (!post) return;
    const tag = tagDraft.trim();
    if (!tag) return;
    if (post.tags.some((item) => item.toLowerCase() === tag.toLowerCase())) {
      setTagDraft('');
      return;
    }
    patch('tags', [...post.tags, tag.slice(0, 40)].slice(0, 12));
    setTagDraft('');
  }

  function insertContent(before: string, after = '', placeholder = 'text') {
    if (!post) return;
    const textarea = textareaRef.current;
    if (!textarea) {
      patch('content', `${post.content}${before}${placeholder}${after}`);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = post.content.slice(start, end) || placeholder;
    const next = `${post.content.slice(0, start)}${before}${selected}${after}${post.content.slice(end)}`;
    patch('content', next);
    const cursor = start + before.length + selected.length + after.length;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  /** Insert a block verbatim, replacing any current selection. */
  function insertRaw(snippet: string) {
    if (!post) return;
    const textarea = textareaRef.current;
    if (!textarea) {
      patch('content', `${post.content}${snippet}`);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = `${post.content.slice(0, start)}${snippet}${post.content.slice(end)}`;
    patch('content', next);
    const cursor = start + snippet.length;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  async function save(overrides: Partial<PostInput> = {}) {
    if (!post || saving) return;
    const payload: PostInput = {
      ...post,
      ...overrides,
      title: post.title.trim(),
      excerpt: post.excerpt.trim(),
      slug: (overrides.slug ?? post.slug).trim() || slugify(post.title) || fallbackSlug(),
      coverImage: (post.coverImage || '').trim() || null,
      tags: post.tags,
      content: post.content,
    };
    if (!payload.draft && !payload.publishDate) payload.publishDate = todayISO();

    const messages = validate(payload);
    if (messages.length) {
      setErrors(messages);
      return;
    }

    setSaving(true);
    setErrors([]);
    try {
      const saved = slug
        ? await api.updatePost(slug, payload, token)
        : await api.createPost(payload, token);
      const input = toInput(saved);
      setPost(input);
      setOriginal(input);
      setUpdatedAt(saved.updatedAt);
      onDirtyChange(false);
      notify(slug ? 'Post saved.' : 'Post created.');
      if (!slug) navigate(`/posts/${encodeURIComponent(saved.slug)}`);
    } catch (err) {
      onError(err, 'Could not save this post.');
    } finally {
      setSaving(false);
    }
  }

  saveRef.current = () => {
    void save();
  };

  /**
   * Opens the real article page on the site with a signed, short-lived link, so
   * a draft can be read in its final layout without publishing it.
   */
  async function handlePreview() {
    if (!post || previewing || saving) return;
    if (isNew) {
      notify('Save the draft once, then preview it.', 'info');
      return;
    }
    if (dirty) await save();

    setPreviewing(true);
    try {
      const link = await api.createPreviewLink(slug as string, token);
      const base = siteOrigin.replace(/\/+$/, '');
      window.open(`${base}${link.path}?preview=${encodeURIComponent(link.token)}`, '_blank', 'noopener,noreferrer');
    } catch (err) {
      onError(err, 'Could not open the preview.');
    } finally {
      setPreviewing(false);
    }
  }

  async function handleDelete() {
    if (!slug || deleting) return;
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await api.deletePost(slug, token);
      onDirtyChange(false);
      notify('Post deleted.');
      navigate('/posts');
    } catch (err) {
      onError(err, 'Could not delete this post.');
    } finally {
      setDeleting(false);
    }
  }

  function handleBack() {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    onDirtyChange(false);
    navigate('/posts');
  }

  function handleMediaSelect(item: MediaItem) {
    if (!post || !picker) return;
    if (picker === 'cover') {
      patch('coverImage', item.url);
      notify('Cover image set.');
    } else {
      const tag = picker;
      const alt = item.name.replace(/"/g, '');
      const snippet = `\n{% ${tag} src="${item.url}" alt="${alt}" /%}\n`;
      if (post.content.includes(snippet)) {
        notify('That media is already in the article.', 'info');
      } else {
        insertRaw(snippet);
        notify(`${tag === 'figure' ? 'Image' : 'Video'} added to the article.`);
      }
      setTab('write');
    }
    setPicker(null);
  }

  if (loading) {
    return (
      <main className="page">
        <div className="editor-loading" aria-busy="true">
          <span className="skeleton skeleton--title" />
          <span className="skeleton skeleton--line" />
          <span className="skeleton skeleton--line" />
          <span className="skeleton skeleton--block" />
        </div>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="page">
        <div className="empty">
          <span className="empty__mark" aria-hidden="true">404</span>
          <h2>Post not found</h2>
          <p>The post may have been deleted or the slug is wrong.</p>
          <button className="btn btn--primary" type="button" onClick={() => navigate('/posts')}>
            Back to posts
          </button>
        </div>
      </main>
    );
  }

  const status = postStatus(post);
  const previewUrl = `${siteOrigin.replace(/\/+$/, '')}/en/${post.channels[0] || 'news'}/${post.slug}/`;

  return (
    <main className="page page--editor">
      <div className="editor-head">
        <div className="editor-head__left">
          <button className="btn btn--ghost btn--sm" type="button" onClick={handleBack}>
            <ArrowLeftIcon size={15} />
            Posts
          </button>
          <span className={`badge badge--${status}`}>{statusLabel(status)}</span>
          {updatedAt && <span className="editor-head__updated">Saved {formatDateTime(updatedAt)}</span>}
        </div>
        <div className="editor-head__actions">
          {!isNew && status === 'published' && (
            <a className="btn btn--ghost btn--sm" href={previewUrl} target="_blank" rel="noopener noreferrer">
              <ExternalIcon size={15} />
              View
            </a>
          )}
          <button
            className="btn btn--ghost btn--sm"
            type="button"
            onClick={() => void handlePreview()}
            disabled={saving || previewing}
            title="Open this post on the site, draft or not"
          >
            <ExternalIcon size={15} />
            {previewing ? 'Opening…' : 'Preview'}
          </button>
          <button className="btn btn--ghost" type="button" onClick={() => void save()} disabled={saving}>
            <SaveIcon size={16} />
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            className="btn btn--primary"
            type="button"
            onClick={() => void save(post.draft ? { draft: false, publishDate: post.publishDate || todayISO() } : {})}
            disabled={saving}
          >
            {post.draft ? 'Publish' : 'Save changes'}
          </button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="banner banner--error" role="alert">
          <ul className="banner__list">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="editor-grid">
        <section className="editor-main">
          <div className="editor-title-wrap">
            <input
              className="editor-title"
              value={post.title}
              onChange={(event) => handleTitleChange(event.target.value)}
              placeholder="Post title"
              aria-label="Post title"
            />
            <textarea
              className="editor-excerpt"
              value={post.excerpt}
              onChange={(event) => patch('excerpt', event.target.value)}
              placeholder="One or two sentences for listings and search results."
              rows={2}
              aria-label="Post excerpt"
            />
          </div>

          <div className="editor-tabs" role="tablist" aria-label="Editor mode">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'write'}
              className={`editor-tab${tab === 'write' ? ' is-active' : ''}`}
              onClick={() => setTab('write')}
            >
              Write
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'preview'}
              className={`editor-tab${tab === 'preview' ? ' is-active' : ''}`}
              onClick={() => setTab('preview')}
            >
              Preview
            </button>
            <span className="editor-tabs__hint">Markdoc</span>
          </div>

          {tab === 'write' ? (
            <div className="editor-write">
              <div className="md-toolbar" role="toolbar" aria-label="Markdown formatting">
                <button type="button" className="md-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => insertContent('## ', '', 'Heading')}>H2</button>
                <button type="button" className="md-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => insertContent('### ', '', 'Heading')}>H3</button>
                <span className="md-toolbar__sep" />
                <button type="button" className="md-btn md-btn--bold" onMouseDown={(e) => e.preventDefault()} onClick={() => insertContent('**', '**', 'bold text')}>B</button>
                <button type="button" className="md-btn md-btn--italic" onMouseDown={(e) => e.preventDefault()} onClick={() => insertContent('_', '_', 'italic text')}>I</button>
                <button type="button" className="md-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => insertContent('[', '](https://)', 'link text')}>Link</button>
                <span className="md-toolbar__sep" />
                <button type="button" className="md-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => insertContent('> ', '', 'Quote')}>Quote</button>
                <button type="button" className="md-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => insertContent('- ', '', 'List item')}>List</button>
                <button type="button" className="md-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => insertContent('1. ', '', 'List item')}>1.</button>
                <span className="md-toolbar__sep" />
                <button type="button" className="md-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => setPicker('figure')}>
                  <ImageIcon size={14} />
                  Image
                </button>
                <button type="button" className="md-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => setPicker('video')}>
                  Video
                </button>
              </div>
              <textarea
                ref={textareaRef}
                className="content-textarea"
                value={post.content}
                onChange={(event) => patch('content', event.target.value)}
                placeholder={'## Start writing\n\nUse Markdoc. Add images and video with the toolbar.'}
                spellCheck
                aria-label="Post content"
              />
            </div>
          ) : (
            <div className="editor-preview">
              <MarkdocPreview content={post.content} />
            </div>
          )}
        </section>

        <aside className="editor-side">
          <section className="side-card">
            <h2 className="side-card__title">Publishing</h2>
            <label className="check-row">
              <input
                type="checkbox"
                checked={!post.draft}
                onChange={(event) => {
                  if (event.target.checked && !post.publishDate) patch('publishDate', todayISO());
                  patch('draft', !event.target.checked);
                }}
              />
              <span>Published</span>
            </label>
            <label className="field">
              <span className="field__label">Publish date</span>
              <input
                className="input"
                type="date"
                value={post.publishDate || ''}
                onChange={(event) => patch('publishDate', event.target.value || null)}
              />
            </label>
            {!post.draft && (
              <p className="side-card__hint">
                {status === 'scheduled'
                  ? 'This post is scheduled and will appear on its publish date.'
                  : 'Visible on the site now.'}
              </p>
            )}
            {!post.draft && (
              <button className="btn btn--ghost btn--sm" type="button" onClick={() => void save({ draft: true })} disabled={saving}>
                Unpublish
              </button>
            )}
          </section>

          <section className="side-card">
            <h2 className="side-card__title">Channels</h2>
            <div className="check-group">
              {ARTICLE_CHANNELS.map((channel) => (
                <label className="check-row" key={channel}>
                  <input
                    type="checkbox"
                    checked={post.channels.includes(channel)}
                    onChange={() => toggleChannel(channel)}
                  />
                  <span className="check-row__label">{channel === 'news' ? 'News' : 'Culture & Code'}</span>
                </label>
              ))}
            </div>
            <label className="check-row">
              <input
                type="checkbox"
                checked={post.featured}
                onChange={(event) => patch('featured', event.target.checked)}
              />
              <span>Featured</span>
            </label>
            <p className="side-card__hint">Featured posts are shown first in the channel listing.</p>
          </section>

          <section className="side-card">
            <h2 className="side-card__title">Cover image</h2>
            {post.coverImage ? (
              <div className="cover-preview">
                <img src={post.coverImage} alt="" />
                <button
                  type="button"
                  className="icon-btn cover-preview__remove"
                  onClick={() => patch('coverImage', null)}
                  aria-label="Remove cover image"
                >
                  <XIcon size={14} />
                </button>
              </div>
            ) : (
              <button type="button" className="cover-empty" onClick={() => setPicker('cover')}>
                <ImageIcon size={20} />
                <span>Choose or upload a cover</span>
              </button>
            )}
            <div className="cover-actions">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPicker('cover')}>
                <UploadIcon size={14} />
                Media library
              </button>
            </div>
            <label className="field">
              <span className="field__label">Image URL</span>
              <input
                className="input input--mono"
                value={post.coverImage || ''}
                onChange={(event) => patch('coverImage', event.target.value || null)}
                placeholder="/media/… or https://…"
              />
            </label>
          </section>

          <section className="side-card">
            <h2 className="side-card__title">Tags</h2>
            <div className="tag-input">
              {post.tags.map((tag) => (
                <span className="tag-chip" key={tag}>
                  {tag}
                  <button
                    type="button"
                    onClick={() => patch('tags', post.tags.filter((item) => item !== tag))}
                    aria-label={`Remove tag ${tag}`}
                  >
                    <XIcon size={11} />
                  </button>
                </span>
              ))}
              <input
                value={tagDraft}
                onChange={(event) => setTagDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ',') {
                    event.preventDefault();
                    addTag();
                  }
                  if (event.key === 'Backspace' && !tagDraft && post.tags.length) {
                    patch('tags', post.tags.slice(0, -1));
                  }
                }}
                onBlur={addTag}
                placeholder={post.tags.length ? 'Add tag' : 'Architecture, Product…'}
                aria-label="Add a tag"
              />
            </div>
            <p className="side-card__hint">Press Enter or comma. Up to 12 tags.</p>
          </section>

          <section className="side-card">
            <h2 className="side-card__title">Details</h2>
            <div className="field-row">
              <label className="field">
                <span className="field__label">Read time (min)</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={999}
                  value={post.readTime ?? ''}
                  onChange={(event) => {
                    const value = event.target.value;
                    patch('readTime', value === '' ? null : Number(value));
                  }}
                />
              </label>
              <label className="field">
                <span className="field__label">Ratio</span>
                <select
                  className="input"
                  value={post.ratio}
                  onChange={(event) => patch('ratio', event.target.value)}
                >
                  {RATIOS.map((ratio) => (
                    <option key={ratio} value={ratio}>{ratio}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span className="field__label">Slug</span>
              <input
                className="input input--mono"
                value={post.slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  patch('slug', event.target.value);
                }}
                disabled={!isNew}
                placeholder="post-slug"
              />
            </label>
            <p className="side-card__hint">
              {isNew ? 'Used in the public URL. Lowercase letters, numbers, and hyphens.' : 'The slug is fixed after the first save.'}
            </p>
          </section>

          {!isNew && (
            <section className="side-card side-card--danger">
              <h2 className="side-card__title">Danger zone</h2>
              <p className="side-card__hint">Deleting removes the post from both channels immediately.</p>
              <button className="btn btn--danger-ghost btn--sm" type="button" onClick={() => void handleDelete()} disabled={deleting}>
                <TrashIcon size={15} />
                {deleting ? 'Deleting…' : 'Delete post'}
              </button>
            </section>
          )}
        </aside>
      </div>

      {picker && (
        <MediaLibrary
          token={token}
          notify={notify}
          onError={onError}
          accept={picker === 'video' ? 'video' : 'image'}
          onClose={() => setPicker(null)}
          onSelect={handleMediaSelect}
        />
      )}
    </main>
  );
}
