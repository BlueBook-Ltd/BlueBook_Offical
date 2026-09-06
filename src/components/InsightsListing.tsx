import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toCard, type Article, type ArticleChannel } from '@/data/articles';
import { getArticlesFor } from '@/utils/news';
import '@/styles/components/insights-listing.css';

interface Props {
  channel: ArticleChannel;
  basePath?: string;
  pageSize?: number;
  articles?: Article[];
}

export default function InsightsListing({
  channel,
  basePath = channel === 'culture' ? '/en/culture/' : '/en/news/',
  pageSize = 3,
  articles: articlesProp,
}: Props) {
  const [pool, setPool] = useState<Article[]>(articlesProp ?? []);

  useEffect(() => {
    if (articlesProp) {
      setPool(articlesProp);
      return;
    }
    let cancelled = false;
    getArticlesFor(channel).then((articles) => {
      if (!cancelled) setPool(articles);
    });
    return () => { cancelled = true; };
  }, [channel, articlesProp]);

  useEffect(() => {
    void import('@/scripts/infiniteArticles');
  }, []);

  const featured = pool[0];
  const list = pool.map(toCard);
  const initial = list.slice(0, pageSize);
  const queued = list.slice(pageSize);

  return (
    <div
      className="insights"
      data-motion-pending
      data-infinite
      data-infinite-mode="list"
      data-infinite-base={basePath}
      data-infinite-page-size={String(pageSize)}
      data-infinite-offset={String(initial.length)}
      data-infinite-items={JSON.stringify(queued)}
    >
      <div className="insights__main">
        {featured && (
          <Link className="insights__hero" to={`${basePath}${featured.slug}/`}>
            <div className="insights__hero-media">
              {featured.image && (
                <img src={featured.image} alt={featured.title} width={1440} height={720} />
              )}
            </div>
            <div className="insights__hero-copy">
              <div className="insights__hero-meta">
                <span>FEATURED</span>
                <i />
                {featured.date && <time>{featured.date}</time>}
              </div>
              <h1>{featured.title}</h1>
              {featured.summary && <p>{featured.summary}</p>}
              <span className="insights__hero-cta">
                Read Analysis{' '}
                <img src="/assets/figma/insights/arrow.svg" alt="" width={12} height={12} />
              </span>
            </div>
          </Link>
        )}

        <div className="insights__list-wrap">
          <h3 className="insights__list-label">Recent publications</h3>
          <div className="insights__list" data-infinite-feed>
            {initial.map((card) => (
              <Link key={card.slug} className="insights__item" to={`${basePath}${card.slug}/`}>
                <div className="insights__thumb">
                  {card.image ? (
                    <img
                      src={card.image}
                      alt={card.title}
                      width={320}
                      height={240}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span className="insights__thumb-ph">{card.tag}</span>
                  )}
                </div>
                <div className="insights__item-body">
                  <div className="insights__meta">
                    <span>{card.tag}</span>
                    <i />
                    {card.date && <time>{card.date}</time>}
                  </div>
                  <h3>{card.title}</h3>
                  {card.summary && <p>{card.summary}</p>}
                  <div className="insights__foot">
                    <span>Read Time: {card.readTime ?? 5} min</span>
                    <img src="/assets/figma/insights/arrow.svg" alt="" width={16} height={16} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="insights__sentinel" data-infinite-sentinel aria-hidden="true" />
          <p className="insights__status" data-infinite-status />
        </div>
      </div>
    </div>
  );
}
