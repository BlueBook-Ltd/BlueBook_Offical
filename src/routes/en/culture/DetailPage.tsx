import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import BaseLayout from '@/layouts/BaseLayout';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import NewsDetailContent from '@/components/NewsDetailContent';
import { toCard, type Article, type ArticleCard } from '@/data/articles';
import { getArticleBySlug, getArticlesFor } from '@/utils/news';
import { usePageContentGate } from '@/motion/pageReady';
import '@/styles/landing.css';

export default function CultureDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null | undefined>(undefined);
  const [moreArticles, setMoreArticles] = useState<ArticleCard[]>([]);
  // The article lands first and the page paints; the "More articles" rail
  // is a second await. Hold the curtain until both are in, or the rail
  // pops into a page the visitor is already looking at.
  const [loaded, setLoaded] = useState(false);
  usePageContentGate(loaded);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      const found = await getArticleBySlug(slug, 'culture');
      if (cancelled) return;
      if (!found) {
        setArticle(null);
        setLoaded(true);
        return;
      }
      setArticle(found);
      const channelArticles = await getArticlesFor('culture');
      if (!cancelled) {
        setMoreArticles(channelArticles.filter((a) => a.slug !== found.slug).map(toCard));
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  // A new slug starts a fresh load, so re-arm the gate for it.
  useEffect(() => { setLoaded(false); }, [slug]);

  useEffect(() => {
    if (article) void import('@/scripts/infiniteArticles');
  }, [article?.slug]);

  if (article === undefined) return null;
  if (article === null) return <Navigate to="/en/culture/" replace />;

  const currentPath = `/en/culture/${article.slug}/`;

  return (
    <BaseLayout
      title={`${article.title} | Culture & Code | Bluebook`}
      description={article.summary ?? `${article.title} — Bluebook Culture & Code.`}
      canonical={`https://www.bluebook.blue/en/culture/${article.slug}/`}
      type="article"
      publishedTime={article.publishDate ?? undefined}
      tags={article.tags ?? (article.tag ? [article.tag] : [])}
      image={article.image}
    >
      <SiteHeader currentPath={currentPath} />
      <div className="landing">
        <NewsDetailContent article={article} basePath="/en/culture/" moreArticles={moreArticles} />
      </div>
      <SiteFooter hideBanner />
    </BaseLayout>
  );
}
