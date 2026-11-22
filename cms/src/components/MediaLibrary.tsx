import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import type { MediaItem } from '@shared/types';
import * as api from '../api';
import { copyText, formatBytes, formatDateTime } from '../utils';
import {
  CheckIcon,
  CopyIcon,
  ImageIcon,
  TrashIcon,
  UploadIcon,
  XIcon,
} from './Icons';
import type { ToastTone } from './Toast';

interface Props {
  token: string;
  notify: (message: string, tone?: ToastTone) => void;
  onError: (err: unknown, fallback?: string) => void;
  onClose?: () => void;
  onSelect?: (item: MediaItem) => void;
  accept?: 'image' | 'video' | 'all';
}

export default function MediaLibrary({
  token,
  notify,
  onError,
  onClose,
  onSelect,
  accept = 'all',
}: Props) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchPage = useCallback(
    async (nextCursor: string | null, append: boolean) => {
      if (!append) setLoading(true);
      try {
        const data = await api.listMedia(token, nextCursor);
        setItems((current) => (append ? [...current, ...data.items] : data.items));
        setCursor(data.cursor);
      } catch (err) {
        onError(err, 'Could not load media.');
      } finally {
        setLoading(false);
      }
    },
    [token, onError],
  );

  useEffect(() => {
    void fetchPage(null, false);
  }, [fetchPage]);

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(true);
    try {
      for (const file of list) {
        const item = await api.uploadMedia(file, token);
        setItems((current) => [item, ...current]);
        notify(`Uploaded ${file.name}.`);
      }
    } catch (err) {
      onError(err, 'Upload failed.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleCopy(item: MediaItem) {
    try {
      await copyText(item.url);
      notify('Media URL copied.');
    } catch {
      notify('Could not access the clipboard. Copy the URL manually.', 'error');
    }
  }

  async function handleDelete(item: MediaItem) {
    if (!window.confirm(`Delete “${item.name}”? This cannot be undone.`)) return;
    setDeleting(item.key);
    try {
      await api.deleteMedia(item.key, token);
      setItems((current) => current.filter((entry) => entry.key !== item.key));
      notify('Media deleted.');
    } catch (err) {
      onError(err, 'Could not delete this media item.');
    } finally {
      setDeleting(null);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length) void handleFiles(event.dataTransfer.files);
  }

  const visible = items.filter((item) => {
    if (accept === 'all') return true;
    return item.contentType.startsWith(`${accept}/`);
  });

  const acceptAttr = accept === 'image' ? 'image/*' : accept === 'video' ? 'video/*' : 'image/*,video/*';
  const isModal = Boolean(onClose);

  const body = (
    <>
      <div className="media-head">
        <div>
          {isModal ? (
            <h2 className="media-head__title">Choose media</h2>
          ) : (
            <>
              <p className="page__eyebrow">ASSETS</p>
              <h1 className="page__title">Media</h1>
              <p className="page__subtitle">
                Images and video for covers and article embeds. Files are stored in R2.
              </p>
            </>
          )}
        </div>
        {onClose && (
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close media library">
            <XIcon size={18} />
          </button>
        )}
      </div>

      <div
        className={`dropzone${dragging ? ' is-dragging' : ''}${uploading ? ' is-busy' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click();
        }}
      >
        <span className="dropzone__icon">
          <UploadIcon size={20} />
        </span>
        <div>
          <strong>{uploading ? 'Uploading…' : 'Drop files here or click to upload'}</strong>
          <span>
            {accept === 'image'
              ? 'Images up to 25 MB.'
              : accept === 'video'
                ? 'Videos up to 25 MB.'
                : 'Images and videos up to 25 MB.'}
          </span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={acceptAttr}
          multiple
          hidden
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            if (event.target.files) void handleFiles(event.target.files);
          }}
        />
      </div>

      {loading ? (
        <div className="media-grid" aria-busy="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="media-card media-card--skeleton" key={index}>
              <span className="skeleton skeleton--media" />
              <span className="skeleton skeleton--short" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="empty empty--compact">
          <span className="empty__mark" aria-hidden="true">R2</span>
          <h2>{items.length === 0 ? 'No media yet' : 'Nothing matches this filter'}</h2>
          <p>
            {items.length === 0
              ? 'Upload an image or video to use it as a cover or inside an article.'
              : 'Upload a different file type to see it here.'}
          </p>
        </div>
      ) : (
        <>
          <div className="media-grid">
            {visible.map((item) => {
              const isVideo = item.contentType.startsWith('video/');
              return (
                <article className="media-card" key={item.key}>
                  <div className="media-card__thumb">
                    {isVideo ? (
                      <video src={item.url} muted playsInline preload="metadata" />
                    ) : (
                      <img src={item.url} alt={item.name} loading="lazy" />
                    )}
                    <span className="media-card__kind">
                      {isVideo ? 'VIDEO' : 'IMAGE'}
                    </span>
                  </div>
                  <div className="media-card__body">
                    <strong className="media-card__name" title={item.name}>{item.name}</strong>
                    <span className="media-card__meta">
                      {formatBytes(item.size)} · {formatDateTime(item.uploaded)}
                    </span>
                    <div className="media-card__actions">
                      {onSelect && (
                        <button
                          type="button"
                          className="btn btn--primary btn--sm"
                          onClick={() => onSelect(item)}
                        >
                          <CheckIcon size={14} />
                          Select
                        </button>
                      )}
                      <button type="button" className="icon-btn" onClick={() => void handleCopy(item)} title="Copy URL" aria-label={`Copy URL for ${item.name}`}>
                        <CopyIcon size={15} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn icon-btn--danger"
                        onClick={() => void handleDelete(item)}
                        disabled={deleting === item.key}
                        title="Delete"
                        aria-label={`Delete ${item.name}`}
                      >
                        <TrashIcon size={15} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {cursor && (
            <div className="media-more">
              <button className="btn btn--ghost" type="button" onClick={() => void fetchPage(cursor, true)}>
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </>
  );

  if (isModal) {
    return (
      <div
        className="modal-backdrop"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose?.();
        }}
      >
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="media-dialog-title">
          <span id="media-dialog-title" className="sr-only">Media library</span>
          <div className="modal__body">{body}</div>
        </div>
      </div>
    );
  }

  return <main className="page">{body}</main>;
}
