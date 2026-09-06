import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Article } from '@/data/articles';
import { getArticlesFor } from '@/utils/news';
import '@/styles/components/news-content.css';

interface Props {
  articles?: Article[];
}

export default function NewsContent({ articles: articlesProp }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [articles, setArticles] = useState<Article[]>(articlesProp ?? []);
  const [activeFilter, setActiveFilter] = useState('ALL');

  useEffect(() => {
    if (articlesProp) {
      setArticles(articlesProp);
      return;
    }
    let cancelled = false;
    getArticlesFor('culture').then((data) => {
      if (!cancelled) setArticles(data);
    });
    return () => { cancelled = true; };
  }, [articlesProp]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const t = window.setTimeout(() => {
      root.removeAttribute('data-news-pending');
    }, 2500);
    return () => clearTimeout(t);
  }, []);

  const uniqueTags = Array.from(new Set(articles.map((a) => a.tag)));
  const filters = ['ALL', ...uniqueTags];

  useEffect(() => {
    try {
      const initialTag = new URL(window.location.href).searchParams.get('tag');
      if (initialTag && uniqueTags.includes(initialTag)) {
        setActiveFilter(initialTag);
      }
    } catch {
      /* ignore */
    }
  }, [uniqueTags]);
  const visible = articles.filter((a) => activeFilter === 'ALL' || a.tag === activeFilter);

  const applyFilter = (filter: string) => {
    setActiveFilter(filter);
    const root = rootRef.current;
    if (root) {
      try {
        root.dispatchEvent(
          new CustomEvent('bb:culture-filter', { detail: { filter: filter || 'ALL' } }),
        );
      } catch {
        /* ignore */
      }
    }
    try {
      const url = new URL(window.location.href);
      if (filter && filter !== 'ALL') url.searchParams.set('tag', filter);
      else url.searchParams.delete('tag');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="news" data-news data-news-pending ref={rootRef}>
      <section className="news__heading" aria-label="Culture and Code heading">
        <div className="news__shell">
          <h1 className="news__title" data-news-heading>Culture &amp; Code</h1>
          <nav className="news__filters" aria-label="Article category filters" data-filters>
            {filters.map((f) => (
              <button
                key={f}
                className={`news__filter${activeFilter === f ? ' is-active' : ''}`}
                data-filter={f}
                type="button"
                aria-pressed={activeFilter === f ? 'true' : 'false'}
                onClick={() => applyFilter(f)}
              >
                {f}
              </button>
            ))}
          </nav>
        </div>
      </section>

      <section className="news__body" aria-label="Articles">
        <div className="news__shell">
          <div className="news__masonry" data-grid>
            {articles.map((article, i) => {
              const match = activeFilter === 'ALL' || article.tag === activeFilter;
              return (
                <Link
                  key={article.slug}
                  className={`news__pin${!article.image ? ' news__pin--text' : ''}`}
                  data-card
                  data-tag={article.tag}
                  data-index={i}
                  to={`/en/culture/${article.slug}/`}
                  style={{ display: match ? '' : 'none' }}
                >
                  <div
                    className={`news__thumb${!article.image ? ' news__thumb--placeholder' : ''}`}
                    style={{ aspectRatio: article.ratio ?? '4 / 5' }}
                  >
                    {article.image ? (
                      <img
                        src={article.image}
                        alt=""
                        width={640}
                        height={800}
                        loading="lazy"
                        aria-hidden="true"
                      />
                    ) : (
                      <span>{article.tag}</span>
                    )}
                  </div>
                  <div className="news__pin-body">
                    <div className="news__meta">
                      <span className="news__tag">{article.tag}</span>
                      {article.date && <time className="news__date">{article.date}</time>}
                    </div>
                    <h2 className="news__pin-title">{article.title}</h2>
                    {article.summary && <p className="news__pin-summary">{article.summary}</p>}
                  </div>
                </Link>
              );
            })}
          </div>
          <p className="news__empty" data-news-empty hidden={visible.length > 0}>
            No articles in this category.
          </p>
        </div>
      </section>
    </div>
  );
}
