import { useMemo } from 'react';
import Markdoc from '@markdoc/markdoc';
import '@/styles/components/news-prose.css';

interface Props {
  content: { node: unknown } | null | undefined;
}

export default function NewsArticle({ content }: Props) {
  const html = useMemo(() => {
    if (!content?.node) return '';
    const rendered = Markdoc.renderers.html(
      content.node as Parameters<typeof Markdoc.renderers.html>[0],
    );
    return typeof rendered === 'string' ? rendered : '';
  }, [content]);

  return <div className="news-prose" dangerouslySetInnerHTML={{ __html: html }} />;
}
