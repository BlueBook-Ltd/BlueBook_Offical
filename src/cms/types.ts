export type ArticleChannel = 'news' | 'culture';

export type CmsPost = {
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
};
