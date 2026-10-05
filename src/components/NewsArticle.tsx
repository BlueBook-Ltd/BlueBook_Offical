import { useMemo } from 'react';
import Markdoc from '@markdoc/markdoc';
import { addHeadingIds } from '@/utils/headingId';
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
    // Ids go in here so they survive re-renders and the section nav can link to them.
    return typeof rendered === 'string' ? addHeadingIds(rendered) : '';
  }, [content]);

  return <div className="news-prose" dangerouslySetInnerHTML={{ __html: html }} />;
}
