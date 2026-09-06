import { createClient, type SanityClient } from '@sanity/client';
import { createImageUrlBuilder } from '@sanity/image-url';
import type { SanityImageSource } from '@sanity/image-url';

export const projectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID as string | undefined;
export const dataset = (import.meta.env.PUBLIC_SANITY_DATASET as string | undefined) ?? 'production';
export const sanityConfigured = Boolean(projectId);

export function getSanityClient(): SanityClient | null {
  if (!projectId) return null;
  return createClient({
    projectId,
    dataset,
    apiVersion: '2024-06-14',
    // Fresh reads so CMS publishes show on the next page request.
    useCdn: false,
  });
}

export function getImageUrl(source: SanityImageSource | null | undefined): string | null {
  if (!source || !projectId) return null;
  return createImageUrlBuilder({ projectId, dataset })
    .image(source)
    .width(1200)
    .height(675)
    .fit('crop')
    .auto('format')
    .url();
}

export type PostChannel = 'news' | 'culture';

export interface SanityNewsDocument {
  slug: string;
  publishDate: string | null;
  draft: boolean;
  featured: boolean;
  readTime: number | null;
  ratio: string | null;
  channels: PostChannel[];
  tags: string[];
  coverImage: SanityImageSource | null;
  titleEn: string;
  excerptEn: string;
  contentEn: string;
}

const POST_FIELDS = `
  "slug": slug.current,
  publishDate,
  draft,
  featured,
  readTime,
  ratio,
  "channels": coalesce(channels, ["news"]),
  tags,
  coverImage,
  titleEn,
  excerptEn,
  contentEn
`;

export const NEWS_QUERY = `*[_type == "news" && !draft && defined(slug.current)] | order(publishDate desc) {
  ${POST_FIELDS}
}`;

export const NEWS_BY_CHANNEL_QUERY = `*[
  _type == "news" &&
  !draft &&
  defined(slug.current) &&
  (
    !defined(channels) ||
    count(channels) == 0 ||
    $channel in channels
  )
] | order(publishDate desc) {
  ${POST_FIELDS}
}`;

export const NEWS_BY_SLUG_QUERY = `*[_type == "news" && !draft && slug.current == $slug][0] {
  ${POST_FIELDS}
}`;
