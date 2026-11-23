import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import BaseLayout from '@/layouts/BaseLayout';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import NewsDetailContent from '@/components/NewsDetailContent';
import { toCard, type Article, type ArticleCard } from '@/data/articles';
import { getArticleBySlug, getArticlesFor } from '@/utils/news';
import { getPreviewArticle, readPreviewToken } from '@/cms/client';
import { usePageContentGate } from '@/motion/pageReady';
import '@/styles/landing.css';

export default function NewsDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const previewToken = readPreviewToken();
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
      // A signed `?preview=` link renders the draft exactly as it will look
      // once published, without touching the live channel listings.
      const found = previewToken
        ? await getPreviewArticle(slug, 'news')
        : await getArticleBySlug(slug, 'news');
      if (cancelled) return;
      if (!found) {
        setArticle(null);
        setLoaded(true);
        return;
      }
      setArticle(found);
      const channelArticles = await getArticlesFor('news');
      if (!cancelled) {
        setMoreArticles(channelArticles.filter((a) => a.slug !== found.slug).map(toCard));
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, previewToken]);

  // A new slug starts a fresh load, so re-arm the gate for it.
  useEffect(() => { setLoaded(false); }, [slug]);

  useEffect(() => {
    if (article) void import('@/scripts/infiniteArticles');
  }, [article?.slug]);

  if (article === undefined) return null;
  if (article === null) return <Navigate to="/en/news/" replace />;

  const currentPath = `/en/news/${article.slug}/`;

  return (
    <BaseLayout
      title={`${article.title} | Insights | Bluebook`}
      description={article.summary ?? `${article.title} — Bluebook insights.`}
      canonical={previewToken ? undefined : `https://www.bluebook.blue/en/news/${article.slug}/`}
      noindex={Boolean(previewToken)}
      type="article"
      publishedTime={article.publishDate ?? undefined}
      tags={article.tags ?? (article.tag ? [article.tag] : [])}
      image={article.image}
    >
      <SiteHeader currentPath={currentPath} />
      <div className="landing">
        {previewToken && (
          <p className="preview-strip" role="status">
            Draft preview. This post is not published and will not appear in the channel.
          </p>
        )}
        <NewsDetailContent article={article} basePath="/en/news/" moreArticles={moreArticles} />
      </div>
      <SiteFooter hideBanner />
    </BaseLayout>
  );
}
