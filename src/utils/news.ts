import type { Article, ArticleChannel } from '../data/articles';
import { articlesFor, getArticle as getStaticArticle } from '../data/articles';
import { getArticleFromCms, getArticlesFromCms } from '@/cms/client';
import { parseMarkdoc, formatNewsDate } from '@/cms/markdown';

export type { MarkdocContent } from '@/cms/markdown';
export { parseMarkdoc, formatNewsDate };

/** CMS posts for a channel, or static fallback when the API is empty / offline. */
export async function getArticlesFor(channel: ArticleChannel): Promise<Article[]> {
  const fromCms = await getArticlesFromCms(channel);
  if (fromCms) return fromCms;
  return articlesFor(channel);
}

export async function getArticleBySlug(
  slug: string,
  channel?: ArticleChannel,
): Promise<Article | null> {
  const fromCms = await getArticleFromCms(slug, channel);
  if (fromCms) return fromCms;

  const staticArticle = getStaticArticle(slug);
  if (!staticArticle) return null;
  if (channel && staticArticle.channels && !staticArticle.channels.includes(channel)) {
    return null;
  }
  return staticArticle;
}

export const newsLabels = {
  kicker: 'News',
  title: 'Latest from Bluebook',
  subtitle: 'Product updates, case studies, and company news',
  readMore: 'Read more',
  back: 'Back to News',
  empty: 'No posts yet. Check back soon.',
} as const;
