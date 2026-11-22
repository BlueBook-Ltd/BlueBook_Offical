import { useMemo } from 'react';
import { renderMarkdoc } from '../markdoc';

interface Props {
  content: string;
}

export default function MarkdocPreview({ content }: Props) {
  const html = useMemo(() => {
    try {
      return renderMarkdoc(content);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Markdoc error.';
      return `<p class="preview-error">Preview failed: ${escapeHtml(message)}</p>`;
    }
  }, [content]);

  if (!content.trim()) {
    return (
      <div className="preview-empty">
        <p>Nothing to preview yet.</p>
        <span>Switch to Write and add some Markdoc content.</span>
      </div>
    );
  }

  return <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
