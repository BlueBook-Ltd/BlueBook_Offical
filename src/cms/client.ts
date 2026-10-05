import type { Article, ArticleChannel } from '@/data/articles';
import { parseMarkdoc, formatNewsDate } from '@/cms/markdown';
import type { CmsPost } from '@/cms/types';

/**
 * Public read client for the standalone CMS (bluebook-cms). Writing and
 * auth live entirely on that Worker now, behind Cloudflare Access — this
 * site only ever reads published posts, either straight from CMS_ORIGIN
 * (VITE_CMS_ORIGIN, browser-side) or via this Worker's same-origin proxy
 * (worker/index.ts: proxyPublicCmsGet) when that's unset.
 */

function cmsOrigin(): string {
  return (import.meta.env.VITE_CMS_ORIGIN || '').replace(/\/+$/, '');
}

function publicApi(path: string): string {
  return `${cmsOrigin()}${path}`;
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function cmsPostToArticle(post: CmsPost, withContent = false): Article {
  const article: Article = {
    slug: post.slug,
    image: post.coverImage ?? undefined,
    tag: post.tags[0] ?? 'Note',
    tags: post.tags,
    date: formatNewsDate(post.publishDate),
    publishDate: post.publishDate,
    title: post.title,
    summary: post.excerpt || undefined,
    ratio: post.ratio,
    featured: post.featured ? 'main' : undefined,
    readTime: post.readTime ?? undefined,
    channels: post.channels,
    source: 'cms',
  };
  if (withContent) {
    article.content = parseMarkdoc(post.content);
  }
  return article;
}

export async function fetchPublishedPosts(channel?: ArticleChannel): Promise<CmsPost[] | null> {
  const query = channel ? `?channel=${channel}` : '';
  const posts = await readJson<CmsPost[]>(publicApi(`/api/posts${query}`));
  return Array.isArray(posts) ? posts : null;
}

export async function fetchPost(slug: string): Promise<CmsPost | null> {
  return readJson<CmsPost>(publicApi(`/api/posts/${slug}`));
}

export async function getArticlesFromCms(channel: ArticleChannel): Promise<Article[] | null> {
  const posts = await fetchPublishedPosts(channel);
  if (!posts) return null;
  let featuredSeen = false;
  return posts.map((post) => {
    const article = cmsPostToArticle(post);
    if (article.featured === 'main') {
      if (featuredSeen) return { ...article, featured: undefined };
      featuredSeen = true;
    }
    return article;
  });
}

export async function getArticleFromCms(slug: string, channel?: ArticleChannel): Promise<Article | null> {
  const post = await fetchPost(slug);
  if (!post) return null;
  if (channel && !post.channels.includes(channel)) return null;
  return cmsPostToArticle(post, true);
}
