const SITE = 'https://www.bluebook.blue';

const staticPaths = [
  '/en/',
  '/en/about/',
  '/en/contact/',
  '/en/news/',
  '/en/culture/',
];

const retiredPaths = new Set([
  '/en/services',
  '/en/services/',
  '/en/services/whatsapp-ai-agent',
  '/en/services/whatsapp-ai-agent/',
  '/en/services/ai-ocr',
  '/en/services/ai-ocr/',
]);

function cmsOrigin(env: Env): string {
  return (env.CMS_ORIGIN || '').trim().replace(/\/+$/, '');
}

function isPostsApiPath(path: string): boolean {
  return path === '/api/posts' || /^\/api\/posts\/[a-z0-9-]+$/.test(path);
}

async function fetchRemotePosts(env: Env, channel?: 'news' | 'culture'): Promise<{ slug: string }[]> {
  const origin = cmsOrigin(env);
  if (!origin) return [];
  const query = channel ? `?channel=${channel}` : '';
  try {
    const res = await fetch(`${origin}/api/posts${query}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    const data = (await res.json()) as { slug?: string }[];
    return Array.isArray(data) ? data.filter((post): post is { slug: string } => Boolean(post.slug)) : [];
  } catch {
    return [];
  }
}

/**
 * All post reads — this site's own pages and this proxy — go to the
 * standalone CMS at CMS_ORIGIN. There is no local CMS anymore: posts,
 * media, and editing all live on that separate Worker, behind Cloudflare
 * Access. This site only ever proxies public GETs of published posts.
 */
async function proxyPublicCmsGet(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const origin = cmsOrigin(env);

  if (!origin) {
    return new Response(
      JSON.stringify({ error: { code: 'not_configured', message: 'CMS_ORIGIN is not set.' } }),
      { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8' } },
    );
  }

  try {
    const res = await fetch(`${origin}${path}${url.search}`, { headers: { Accept: 'application/json' } });
    return new Response(res.body, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: { code: 'upstream_unreachable', message: 'Could not reach the CMS.' } }),
      { status: 502, headers: { 'Content-Type': 'application/json; charset=utf-8' } },
    );
  }
}

async function sitemapResponse(env: Env): Promise<Response> {
  const [news, culture] = await Promise.all([
    fetchRemotePosts(env, 'news'),
    fetchRemotePosts(env, 'culture'),
  ]);
  const paths = [
    ...staticPaths,
    ...news.map((post) => `/en/news/${post.slug}/`),
    ...culture.map((post) => `/en/culture/${post.slug}/`),
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
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'GET' && isPostsApiPath(path)) {
      return proxyPublicCmsGet(request, env);
    }
    if (url.pathname === '/sitemap.xml') {
      return sitemapResponse(env);
    }
    if (retiredPaths.has(url.pathname)) {
      return Response.redirect(new URL('/en/', url.origin), 301);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

interface Env {
  ASSETS: Fetcher;
  CMS_ORIGIN?: string;
}
