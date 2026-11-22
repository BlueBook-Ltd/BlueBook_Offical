export type ArticleChannel = 'news' | 'culture';

export const ARTICLE_CHANNELS: readonly ArticleChannel[] = ['news', 'culture'];

export interface CmsPost {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  channels: ArticleChannel[];
  publishDate: string | null;
  draft: boolean;
  featured: boolean;
  readTime: number | null;
  ratio: string;
  tags: string[];
  coverImage: string | null;
  updatedAt: string;
}

/** Fields accepted when creating or updating a post. */
export type PostInput = Omit<CmsPost, 'updatedAt'>;

export interface MediaItem {
  key: string;
  /** Relative URL (`/media/...`); the main site proxies this to the CMS. */
  url: string;
  name: string;
  size: number;
  uploaded: string;
  contentType: string;
}

export type AuthMode = 'token' | 'access';

export interface SessionInfo {
  mode: AuthMode;
  email: string | null;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}

export function isArticleChannel(value: unknown): value is ArticleChannel {
  return value === 'news' || value === 'culture';
}
