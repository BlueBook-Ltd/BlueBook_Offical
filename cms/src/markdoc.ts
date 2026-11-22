import Markdoc, { Tag, type Config } from '@markdoc/markdoc';

/**
 * Keep this config in sync with the main site's `src/cms/markdown.ts`.
 * Both sides render the same raw Markdoc so figures and videos don't silently
 * disappear in the editor preview.
 */
const config: Config = {
  tags: {
    figure: {
      render: 'figure',
      attributes: {
        src: { type: String, required: true },
        alt: { type: String, default: '' },
        link: { type: String },
        caption: { type: String },
      },
      transform(node) {
        const { src, alt, link, caption } = node.attributes as {
          src: string;
          alt?: string;
          link?: string;
          caption?: string;
        };
        const effectiveAlt = alt || caption || '';
        const img = new Tag('img', { src, alt: effectiveAlt, loading: 'lazy' }, []);
        const media = link
          ? new Tag('a', { href: link, target: '_blank', rel: 'noopener noreferrer' }, [img])
          : img;
        return new Tag('figure', { class: 'cms-figure' }, [media]);
      },
    },
    video: {
      render: 'figure',
      attributes: {
        src: { type: String, required: true },
        alt: { type: String, default: '' },
        poster: { type: String },
        caption: { type: String },
      },
      transform(node) {
        const { src, alt, poster, caption } = node.attributes as {
          src: string;
          alt?: string;
          poster?: string;
          caption?: string;
        };
        const effectiveAlt = alt || caption || '';
        const attrs: Record<string, unknown> = { src, controls: true, playsinline: true };
        if (poster) attrs.poster = poster;
        if (effectiveAlt) attrs['aria-label'] = effectiveAlt;
        const video = new Tag('video', attrs, []);
        return new Tag('figure', { class: 'cms-figure cms-video' }, [video]);
      },
    },
  },
};

export function renderMarkdoc(raw: string): string {
  const ast = Markdoc.parse(raw || '');
  return Markdoc.renderers.html(Markdoc.transform(ast, config));
}
