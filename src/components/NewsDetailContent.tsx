import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { Article, ArticleCard } from '@/data/articles';
import NewsArticle from '@/components/NewsArticle';
import ArticleToc from '@/components/ArticleToc';
import '@/styles/components/news-detail.css';

interface Props {
  article: Article;
  basePath?: string;
  moreArticles?: ArticleCard[];
  pageSize?: number;
}

const toc = [
  { id: 'overview', label: 'Overview' },
  { id: 'methodology', label: 'Methodology' },
  { id: 'deliverables', label: 'Key Deliverables' },
  { id: 'outcomes', label: 'Outcomes' },
];

const phases = [
  { phase: 'Discovery', focus: 'Domain Mapping & API Gateway Setup', timeline: 'Months 1-2', risk: 'Low' },
  { phase: 'Extraction', focus: 'Decoupling High-Frequency Read Services', timeline: 'Months 3-6', risk: 'Medium' },
  { phase: 'Decommission', focus: 'Legacy Data Store Migration & Sunset', timeline: 'Months 7-9', risk: 'High' },
];

const outcomes = [
  { title: 'Cost Reduction', desc: '40% decrease in infrastructure maintenance costs within the first year.' },
  { title: 'Deployment Agility', desc: 'Release cycles reduced from bi-weekly monolithic deployments to multiple daily micro-releases.' },
  { title: 'Talent Acquisition', desc: 'Modern tech stack improved engineering recruitment pipelines by 65%.' },
];

export default function NewsDetailContent({
  article,
  basePath = '/en/news/',
  moreArticles = [],
  pageSize = 3,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const briefRef = useRef<HTMLDivElement>(null);
  const isCaseStudy = Boolean(article.caseStudy) && !article.content;
  const hasCmsBody = Boolean(article.content?.node);
  const initialMore = moreArticles.slice(0, pageSize);
  const queuedMore = moreArticles.slice(pageSize);
  const backLabel = basePath.includes('/culture') ? 'Back to Culture & Code' : 'Back to News';

  useEffect(() => {
    void import('@/scripts/infiniteArticles');
  }, []);

  // No entrance or scroll-reveal motion on article pages: the content is shown
  // as soon as it renders. newsDetailMotion is deliberately not imported here.

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const links = root.querySelectorAll<HTMLAnchorElement>('[data-toc-link]');
    const sections = ['overview', 'methodology', 'deliverables', 'outcomes']
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));

    let observer: IntersectionObserver | undefined;

    if (links.length && sections.length && 'IntersectionObserver' in window) {
      const setActive = (id: string) => {
        links.forEach((link) => {
          link.classList.toggle('is-active', link.getAttribute('href') === `#${id}`);
        });
      };

      observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
          if (visible?.target.id) setActive(visible.target.id);
        },
        { rootMargin: '-30% 0px -55% 0px', threshold: [0.1, 0.4, 0.7] },
      );

      sections.forEach((section) => observer!.observe(section));
    }

    const onServiceClick = (e: Event) => {
      const link = e.currentTarget as HTMLAnchorElement;
      const interest = link.dataset.serviceInterest;
      if (!interest) return;
      try {
        sessionStorage.setItem('bluebook-enquire-service', interest);
      } catch {
        /* ignore */
      }
    };

    root.querySelectorAll<HTMLAnchorElement>('a[data-service-interest]').forEach((link) => {
      link.addEventListener('click', onServiceClick);
    });

    return () => {
      observer?.disconnect();
      root.querySelectorAll<HTMLAnchorElement>('a[data-service-interest]').forEach((link) => {
        link.removeEventListener('click', onServiceClick);
      });
    };
  }, [article.slug]);

  return (
    // data-no-spring is in SpringPageMotion's SKIP list and is matched with
    // closest(), so it opts this root and everything inside it out of the
    // site-wide scroll springs. data-motion-pending is gone too — nothing
    // animates here, so nothing should be pre-hidden waiting for it.
    <div className="nd" data-news-detail data-no-spring ref={rootRef}>
      <section className="nd__hero">
        <div className="nd__shell">
          {/* Always points at the listing rather than using history: readers
              arrive here from search and shared links too, where "back" would
              leave the site. */}
          <Link className="nd__back" to={basePath} data-nd-hero>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M12.5 8h-9m0 0L7.5 3.5M3.5 8 7.5 12.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>{backLabel}</span>
          </Link>

          <p className="nd__crumb" data-nd-hero>
            {article.tag}
            {article.date ? ` · ${article.date}` : ''}
          </p>
          <h1 className="nd__title" data-nd-hero>{article.title}</h1>
          {article.summary && (
            <p className="nd__lede" data-nd-hero>{article.summary}</p>
          )}
        </div>
      </section>

      {isCaseStudy ? (
        <section className="nd__main">
          <div className="nd__shell nd__main-grid">
            <aside className="nd__sidebar">
              <h2 className="nd__sidebar-title">CONTENTS</h2>
              <nav className="nd__toc" aria-label="Article sections">
                {toc.map((item, i) => (
                  <a
                    key={item.id}
                    className={`nd__toc-link${i === 0 ? ' is-active' : ''}`}
                    href={`#${item.id}`}
                    data-toc-link
                  >
                    <span className="nd__toc-bar" />
                    {item.label}
                  </a>
                ))}
              </nav>
            </aside>

            <div className="nd__article">
              <section className="nd__section" id="overview" data-nd-reveal>
                <h2 className="nd__section-title">The Burden of Technical Debt</h2>
                <p className="nd__body">
                  For over two decades, the client&apos;s core operations were tethered to a monolithic application structure. While
                  robust in its inception, this system had evolved into a labyrinthine constraint. Deployments were fraught with
                  risk, requiring extensive downtime and manual intervention. The cost of maintaining this architecture was
                  cannibalising resources earmarked for innovation.
                </p>
                <p className="nd__body">
                  The mandate was clear: decouple the monolith, migrate to a cloud-native microservices architecture, and ensure
                  zero interruption to ongoing global services.
                </p>
                <div className="nd__callout">
                  <img
                    src="/assets/bluebook/news/detail-hero.png"
                    alt="Dense server cabling representing legacy systems"
                    width={1200}
                    height={800}
                    loading="lazy"
                  />
                </div>
              </section>

              <blockquote className="nd__quote" data-nd-reveal>
                <p className="nd__quote-text">
                  &ldquo;Transformation is not an event, it is a deliberate, persistent process of peeling away obsolescence.&rdquo;
                </p>
                <cite className="nd__quote-attr">Lead Systems Architect, Bluebook</cite>
              </blockquote>

              <section className="nd__section" id="methodology" data-nd-reveal>
                <h2 className="nd__section-title">The &apos;Strangler Fig&apos; Application</h2>
                <p className="nd__body">
                  A &ldquo;big bang&rdquo; rewrite was deemed unacceptable due to unacceptable risk profiles. Instead, we implemented the
                  Strangler Fig pattern. This involves incrementally creating a new system around the edges of the old, letting the
                  new grow while the old slowly becomes obsolete.
                </p>
                <div className="nd__cards">
                  <article className="nd__card nd__card--muted">
                    <span className="nd__card-num">01</span>
                    <h3 className="nd__card-title">Intercept</h3>
                    <p className="nd__card-body">
                      Routing traffic selectively between the legacy monolith and new microservices via an API gateway.
                    </p>
                  </article>
                  <article className="nd__card nd__card--teal">
                    <span className="nd__card-num">02</span>
                    <h3 className="nd__card-title">Migrate</h3>
                    <p className="nd__card-body">
                      Gradually shifting domain logic to independent, easily deployable cloud-native services.
                    </p>
                  </article>
                </div>
              </section>

              <section className="nd__section" id="deliverables" data-nd-reveal>
                <h2 className="nd__section-title">Structured Migration Phases</h2>
                <div className="nd__table-wrap">
                  <table className="nd__table">
                    <thead>
                      <tr>
                        <th>Phase</th>
                        <th>Focus Area</th>
                        <th>Timeline</th>
                        <th>Risk Profile</th>
                      </tr>
                    </thead>
                    <tbody>
                      {phases.map((row) => (
                        <tr key={row.phase}>
                          <td className="nd__table-phase">{row.phase}</td>
                          <td>{row.focus}</td>
                          <td>{row.timeline}</td>
                          <td>
                            <span className={`nd__pill nd__pill--${row.risk.toLowerCase()}`}>{row.risk}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="nd__section" id="outcomes" data-nd-reveal>
                <h2 className="nd__section-title">Measurable Outcomes</h2>
                <p className="nd__body">
                  The completed migration established a resilient, scalable foundation capable of supporting aggressive future
                  growth vectors.
                </p>
                <div className="nd__outcomes">
                  {outcomes.map((o) => (
                    <article key={o.title} className="nd__outcome">
                      <img
                        className="nd__outcome-icon"
                        src="/assets/bluebook/news/icon-outcome.svg"
                        alt=""
                        width={20}
                        height={24}
                        aria-hidden="true"
                      />
                      <div className="nd__outcome-body">
                        <h3 className="nd__outcome-title">{o.title}</h3>
                        <p className="nd__outcome-desc">{o.desc}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </section>
      ) : (
        <section className="nd__main">
          <div className="nd__shell nd__main-grid">
            <ArticleToc containerRef={briefRef} watch={article.slug} />

            <div className="nd__brief" data-nd-brief ref={briefRef}>
              {article.image && (
                <div className="nd__callout nd__callout--brief" data-nd-brief-item>
                  <img src={article.image} alt={article.title} width={1200} height={675} loading="lazy" />
                </div>
              )}
              {hasCmsBody ? (
                <div data-nd-brief-item>
                  <NewsArticle content={article.content} />
                </div>
              ) : (
                <>
                  <p className="nd__body" data-nd-brief-item>
                    {article.summary ??
                      'This Bluebook note explores a practical angle on digital operations, systems design, and workflow clarity.'}
                  </p>
                  <p className="nd__body" data-nd-brief-item>
                    Bluebook writes about the messy middle of digital change: where chats, documents, and handoffs meet systems.
                    Use this note as a prompt to name one workflow you want clearer—then we can map the steps, data, and
                    integrations that would make the biggest difference.
                  </p>
                </>
              )}
              <Link
                className="nd__cta"
                to="/en/contact/"
                data-nd-brief-item
                data-service-interest="Other"
              >
                Enquire about this topic
              </Link>
            </div>
          </div>
        </section>
      )}

      {moreArticles.length > 0 && (
        <section
          className="nd-more"
          data-infinite
          data-infinite-mode="related"
          data-infinite-base={basePath}
          data-infinite-page-size={String(pageSize)}
          data-infinite-offset={String(initialMore.length)}
          data-infinite-items={JSON.stringify(queuedMore)}
          aria-label="More articles"
        >
          <div className="nd__shell">
            <h2 className="nd-more__title">More articles</h2>
            <div className="nd-more__grid" data-infinite-feed>
              {initialMore.map((card) => (
                <Link key={card.slug} className="nd-more__card" to={`${basePath}${card.slug}/`}>
                  {card.image && (
                    <span className="nd-more__media">
                      <img src={card.image} alt="" width={320} height={200} loading="lazy" decoding="async" />
                    </span>
                  )}
                  <span className="nd-more__meta">
                    {card.tag}
                    {card.date ? ` · ${card.date}` : ''}
                  </span>
                  <strong>{card.title}</strong>
                </Link>
              ))}
            </div>
            <div className="nd-more__sentinel" data-infinite-sentinel aria-hidden="true" />
            <p className="nd-more__status" data-infinite-status />
          </div>
        </section>
      )}
    </div>
  );
}
