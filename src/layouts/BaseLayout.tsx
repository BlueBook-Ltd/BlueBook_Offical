import { useEffect, type ReactNode } from 'react';
import ShaderPreview from '@/components/ShaderPreview';

const siteUrl = 'https://www.bluebook.blue';
const defaultDesc =
  'Bluebook helps Hong Kong teams turn real business workflows into AI, automation, and system integration that people can actually use.';

export interface BaseLayoutProps {
  title: string;
  description?: string;
  image?: string;
  canonical?: string;
  noindex?: boolean;
  type?: 'website' | 'article';
  publishedTime?: string;
  tags?: string[];
  children: ReactNode;
  showShader?: boolean;
}

function setMeta(name: string, content: string, property = false) {
  const attr = property ? 'property' : 'name';
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.content = content;
}

function setLink(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

export default function BaseLayout({
  title,
  description,
  image,
  canonical,
  noindex = false,
  type = 'website',
  publishedTime,
  tags = [],
  children,
  showShader = true,
}: BaseLayoutProps) {
  const metaDesc = description || defaultDesc;
  const metaImageRaw = image || `${siteUrl}/images/bluebook-logo.svg`;
  const metaImage = metaImageRaw.startsWith('http') ? metaImageRaw : new URL(metaImageRaw, siteUrl).href;
  const pathname = window.location.pathname === '/' ? '/' : window.location.pathname.replace(/\/?$/, '/');
  const pageUrl = canonical || new URL(pathname, siteUrl).href;
  const tagList = Array.isArray(tags) ? tags.filter(Boolean) : [];

  useEffect(() => {
    document.title = title;
    setMeta('description', metaDesc);
    setMeta('robots', noindex ? 'noindex, follow' : 'index, follow');
    setMeta('theme-color', '#17171c');
    setLink('canonical', pageUrl);
    setMeta('og:type', type, true);
    setMeta('og:site_name', 'Bluebook', true);
    setMeta('og:url', pageUrl, true);
    setMeta('og:title', title, true);
    setMeta('og:description', metaDesc, true);
    setMeta('og:image', metaImage, true);
    setMeta('og:locale', 'en_US', true);
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', title);
    setMeta('twitter:description', metaDesc);
    setMeta('twitter:image', metaImage);

    const jsonLd = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'ProfessionalService',
          '@id': `${siteUrl}/#org`,
          name: 'Bluebook',
          url: siteUrl,
          email: 'info@bluebook.blue',
          areaServed: 'HK',
          address: {
            '@type': 'PostalAddress',
            streetAddress: 'RM 702 7/F, Kowloon Building, 555 Nathan Road',
            addressLocality: 'Kowloon',
            addressCountry: 'HK',
          },
        },
        {
          '@type': 'WebSite',
          '@id': `${siteUrl}/#website`,
          url: siteUrl,
          name: 'Bluebook',
          inLanguage: 'en',
          publisher: { '@id': `${siteUrl}/#org` },
        },
        ...(type === 'article'
          ? [{
              '@type': 'Article',
              headline: title,
              description: metaDesc,
              image: metaImage,
              datePublished: publishedTime,
              keywords: tagList,
              articleSection: tagList[0],
              mainEntityOfPage: pageUrl,
              publisher: { '@id': `${siteUrl}/#org` },
            }]
          : []),
      ],
    };

    let script = document.getElementById('bluebook-jsonld') as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = 'bluebook-jsonld';
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(jsonLd);
  }, [title, metaDesc, metaImage, pageUrl, noindex, type, publishedTime, tagList]);

  useEffect(() => {
    const failOpen = window.setTimeout(() => {
      document.querySelectorAll('[data-motion-pending]').forEach((el) => {
        el.removeAttribute('data-motion-pending');
      });
    }, 2500);
    return () => window.clearTimeout(failOpen);
  }, []);

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      {showShader ? <ShaderPreview background /> : null}
      <div id="main-content">{children}</div>
    </>
  );
}
