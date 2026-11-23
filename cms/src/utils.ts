import type { CmsPost } from '@shared/types';

export type PostStatus = 'published' | 'draft' | 'scheduled';

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function postStatus(post: Pick<CmsPost, 'draft' | 'publishDate'>): PostStatus {
  if (post.draft) return 'draft';
  if (post.publishDate && post.publishDate > todayISO()) return 'scheduled';
  return 'published';
}

export function statusLabel(status: PostStatus): string {
  if (status === 'published') return 'Published';
  if (status === 'scheduled') return 'Scheduled';
  return 'Draft';
}

export function postUrl(post: CmsPost, siteOrigin: string): string {
  const channel = post.channels[0] || 'news';
  return `${siteOrigin.replace(/\/+$/, '')}/en/${channel}/${post.slug}/`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  return Promise.reject(new Error('Clipboard is unavailable.'));
}

export function insertAtCursor(
  textarea: HTMLTextAreaElement,
  before: string,
  after = '',
  placeholder = 'text',
): void {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end) || placeholder;
  const next = `${textarea.value.slice(0, start)}${before}${selected}${after}${textarea.value.slice(end)}`;
  textarea.value = next;
  const cursor = start + before.length + selected.length + after.length;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(cursor, cursor);
  });
}

export function initials(email: string | null): string {
  if (!email) return 'BB';
  return email
    .split('@')[0]
    .split(/[._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'BB';
}
