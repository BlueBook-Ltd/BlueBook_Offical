import { getArticlesFor } from '../src/utils/news';

const SITE = 'https://www.bluebook.blue';

const staticPaths = [
  '/en/',
  '/en/about/',
  '/en/contact/',
  '/en/services/',
  '/en/services/whatsapp-ai-agent/',
  '/en/services/ai-ocr/',
  '/en/news/',
  '/en/culture/',
];

async function sitemapResponse(): Promise<Response> {
  const [news, culture] = await Promise.all([
    getArticlesFor('news'),
    getArticlesFor('culture'),
  ]);
  const paths = [
    ...staticPaths,
    ...news.map((a) => `/en/news/${a.slug}/`),
    ...culture.map((a) => `/en/culture/${a.slug}/`),
  ];
  const unique = [...new Set(paths)];
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...unique.map((path) => `  <url><loc>${SITE}${path}</loc></url>`),
    '</urlset>',
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/sitemap.xml') {
      return sitemapResponse();
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

interface Env {
  ASSETS: Fetcher;
}
