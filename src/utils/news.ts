import Markdoc from '@markdoc/markdoc';
import type { Article, ArticleChannel } from '../data/articles';
import { articlesFor, getArticle as getStaticArticle } from '../data/articles';
import {
  getSanityClient,
  getImageUrl,
  sanityConfigured,
  NEWS_BY_CHANNEL_QUERY,
  NEWS_BY_SLUG_QUERY,
  NEWS_QUERY,
  type SanityNewsDocument,
} from './sanity';

export interface NewsPostMeta {
  slug: string;
  publishDate: string | null;
  draft: boolean;
  tags: readonly string[];
  coverImage: string | null;
  title: string;
  excerpt: string;
  channels: ArticleChannel[];
  featured: boolean;
  readTime: number;
  ratio: string;
}

export interface MarkdocContent {
  node: unknown;
}

export interface NewsPost extends NewsPostMeta {
  content: MarkdocContent;
}

export function parseMarkdoc(raw: string): MarkdocContent {
  const ast = Markdoc.parse(raw || '');
  const node = Markdoc.transform(ast);
  return { node };
}

export function formatNewsDate(date: string | null): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function estimateReadTime(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function toMeta(doc: SanityNewsDocument): NewsPostMeta {
  const channels = (doc.channels?.length ? doc.channels : ['news']) as ArticleChannel[];
  return {
    slug: doc.slug,
    publishDate: doc.publishDate ?? null,
    draft: doc.draft ?? false,
    tags: doc.tags ?? [],
    coverImage: getImageUrl(doc.coverImage),
    title: doc.titleEn ?? '',
    excerpt: doc.excerptEn ?? '',
    channels,
    featured: Boolean(doc.featured),
    readTime: doc.readTime ?? estimateReadTime(doc.contentEn ?? ''),
    ratio: doc.ratio?.trim() || '4 / 5',
  };
}

export function docToArticle(doc: SanityNewsDocument, withContent = false): Article {
  const meta = toMeta(doc);
  const article: Article = {
    slug: meta.slug,
    image: meta.coverImage ?? undefined,
    tag: meta.tags[0] ?? 'Note',
    tags: meta.tags,
    date: formatNewsDate(meta.publishDate),
    publishDate: meta.publishDate,
    title: meta.title,
    summary: meta.excerpt || undefined,
    ratio: meta.ratio,
    featured: meta.featured ? 'main' : undefined,
    readTime: meta.readTime,
    channels: meta.channels,
    source: 'cms',
  };
  if (withContent) {
    article.content = parseMarkdoc(doc.contentEn ?? '');
  }
  return article;
}

async function fetchAllDocs(): Promise<SanityNewsDocument[]> {
  const client = getSanityClient();
  if (!client) return [];
  return client.fetch<SanityNewsDocument[]>(NEWS_QUERY);
}

async function fetchChannelDocs(channel: ArticleChannel): Promise<SanityNewsDocument[]> {
  const client = getSanityClient();
  if (!client) return [];
  return client.fetch<SanityNewsDocument[]>(NEWS_BY_CHANNEL_QUERY, { channel });
}

export async function getPublishedNewsPosts(): Promise<NewsPostMeta[]> {
  if (!sanityConfigured) return [];
  const docs = await fetchAllDocs();
  return docs.map(toMeta);
}

export async function getNewsPost(slug: string): Promise<NewsPost | null> {
  if (!sanityConfigured) return null;
  const client = getSanityClient();
  if (!client) return null;

  const doc = await client.fetch<SanityNewsDocument | null>(NEWS_BY_SLUG_QUERY, { slug });
  if (!doc) return null;

  return {
    ...toMeta(doc),
    content: parseMarkdoc(doc.contentEn ?? ''),
  };
}

export async function getAllNewsSlugs(): Promise<string[]> {
  const posts = await getPublishedNewsPosts();
  return posts.map((post) => post.slug);
}

/** CMS posts for a channel, or static fallback when CMS is empty / unconfigured. */
export async function getArticlesFor(channel: ArticleChannel): Promise<Article[]> {
  if (!sanityConfigured) return articlesFor(channel);

  try {
    const docs = await fetchChannelDocs(channel);
    if (docs.length === 0) return articlesFor(channel);

    const articles = docs.map((doc) => docToArticle(doc));
    // Ensure only one featured main card.
    let featuredSeen = false;
    return articles.map((a) => {
      if (a.featured === 'main') {
        if (featuredSeen) return { ...a, featured: undefined };
        featuredSeen = true;
      }
      return a;
    });
  } catch (err) {
    console.warn('[cms] Failed to load posts, using static fallback.', err);
    return articlesFor(channel);
  }
}

export async function getArticleBySlug(
  slug: string,
  channel?: ArticleChannel,
): Promise<Article | null> {
  if (sanityConfigured) {
    try {
      const client = getSanityClient();
      if (client) {
        const doc = await client.fetch<SanityNewsDocument | null>(NEWS_BY_SLUG_QUERY, { slug });
        if (doc) {
          const article = docToArticle(doc, true);
          if (!channel || article.channels?.includes(channel)) return article;
          return null;
        }
      }
    } catch (err) {
      console.warn('[cms] Failed to load post, trying static fallback.', err);
    }
  }

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
  empty: sanityConfigured
    ? 'No posts yet. Check back soon.'
    : 'Sanity CMS is not configured. Set PUBLIC_SANITY_PROJECT_ID and rebuild.',
} as const;
