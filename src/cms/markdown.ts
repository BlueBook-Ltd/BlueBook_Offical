import Markdoc, { Tag, type Config } from '@markdoc/markdoc';

export interface MarkdocContent {
  node: unknown;
}

/**
 * The CMS's content-embed tags — `{% figure src="…" alt="…" link="…" /%}`
 * and `{% video src="…" alt="…" /%}` — carried straight through from the
 * Worker (bluebook-cms: worker/lib/markdown.ts) since this site renders raw
 * contentMd itself rather than the CMS's own pre-rendered HTML (see
 * src/cms/client.ts). Markdoc drops any tag with no matching schema instead
 * of erroring, so without this config those embeds silently vanish from the
 * page — no error, just missing images/video. Keep this in sync with the
 * Worker's copy if either one changes.
 *
 * `alt` is metadata only (screen readers / SEO) — never rendered as visible
 * text, for images or video. `caption` is still accepted on read so older
 * posts that used it keep their text (folded into `alt` when no `alt` is
 * set), but it's never shown as an on-page caption.
 */
const config: Config = {
  tags: {
    figure: {
      render: 'figure',
      attributes: {
        src: { type: String, required: true },
        alt: { type: String, default: '' },
        link: { type: String },
        caption: { type: String }, // legacy — folded into alt, never rendered visibly
      },
      transform(node) {
        const { src, alt, link, caption } = node.attributes as {
          src: string; alt?: string; link?: string; caption?: string;
        };
        const effectiveAlt = alt || caption || '';
        const img = new Tag('img', { src, alt: effectiveAlt, loading: 'lazy' }, []);
        const media = link ? new Tag('a', { href: link, target: '_blank', rel: 'noopener noreferrer' }, [img]) : img;
        return new Tag('figure', { class: 'cms-figure' }, [media]);
      },
    },
    video: {
      render: 'figure',
      attributes: {
        src: { type: String, required: true },
        alt: { type: String, default: '' },
        poster: { type: String },
        caption: { type: String }, // legacy — folded into alt, never rendered visibly
      },
      transform(node) {
        const { src, alt, poster, caption } = node.attributes as {
          src: string; alt?: string; poster?: string; caption?: string;
        };
        const effectiveAlt = alt || caption || '';
        const attrs: Record<string, unknown> = { src, controls: true, playsinline: true };
        if (poster) attrs.poster = poster;
        // Video elements have no `alt`; `aria-label` is the accessibility
        // equivalent, and it's non-visual same as an image's alt text.
        if (effectiveAlt) attrs['aria-label'] = effectiveAlt;
        const video = new Tag('video', attrs, []);
        return new Tag('figure', { class: 'cms-figure cms-video' }, [video]);
      },
    },
  },
};

export function parseMarkdoc(raw: string): MarkdocContent {
  const ast = Markdoc.parse(raw || '');
  const node = Markdoc.transform(ast, config);
  return { node };
}

export function formatNewsDate(date: string | null): string {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
