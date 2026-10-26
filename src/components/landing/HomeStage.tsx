import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { getArticlesFor } from '@/utils/news';
import type { Article } from '@/data/articles';
import { usePageContentGate } from '@/motion/pageReady';
import { mountDirectedScroll } from '@/motion/homeDirectedScroll';
import HeroBackground from '@/components/landing/HeroBackground';
import '@/styles/home-stage.css';

const prefix = '/en';

const services = [
  ['01', 'Digital', 'Consultancy', 'Clarify where to begin before you commit to a tool. A map of the workflow, then a path you can actually staff.'],
  ['02', 'WhatsApp', 'Agent', 'Make conversations, voice notes, images, and files operationally useful. Search the groups you authorised, and keep the source attached.'],
  ['03', 'Document', 'Extraction', 'Turn documents into fields your team can check and export. Review stays with people. The re-typing does not.'],
  ['04', 'Workflow', 'Automation', 'Remove the repetitive steps from approvals, notifications, and reporting. Judgement stays where judgement matters.'],
] as const;

const ways = [
  ['Our team is yours', 'They work as an extension of the operation: mapping the real workflow and owning the outcome with you.'],
  ['A business mindset', 'The engineer thinks about the process. The strategist thinks about decisions, records, and handoffs.'],
  ['The same standard', 'One process or a broader programme, you get a clear map and honest trade-offs.'],
  ['AI where it helps', 'Structuring messy inputs, accelerating analysis, and tightening the build-and-review loop.'],
  ['From the first call', 'We open with the bottleneck, not a package. The first conversation is about the work.'],
  ['Built to grow', 'Most useful systems mature as volume and constraints change. Start with one process, then the next.'],
] as const;

const voices = [
  ['Chris L.', 'Operations, logistics', 'We stopped chasing status in three WhatsApp groups. The morning is for closing work, not hunting for updates.'],
  ['Mei W.', 'Programme lead, retail', 'They mapped the handoffs before touching any tools. Everyone finally agreed where the process actually breaks.'],
  ['Helen Y.', 'COO, trading', 'I can see volume, delays, and owners without waiting for a manual report that used to burn half a day.'],
] as const;

function MaskLines({ lines }: { lines: string[] }) {
  return (
    <>
      {lines.map((line) => (
        <span key={line} className="hm-mask">
          <span className="hm-line">{line}</span>
        </span>
      ))}
    </>
  );
}

export default function HomeStage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [homeNews, setHomeNews] = useState<Article[]>([]);
  const [homeCulture, setHomeCulture] = useState<Article[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [, setLooping] = useState(false);
  const loopingRef = useRef(false);
  const showCopyRef = useRef(false);
  const showStatementRef = useRef(false);
  usePageContentGate(loaded);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getArticlesFor('news'), getArticlesFor('culture')])
      .then(([news, culture]) => {
        if (cancelled) return;
        setHomeNews(news.filter((a) => a.image).slice(0, 3));
        setHomeCulture(culture.slice(0, 4));
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    return mountDirectedScroll(root, () => loopingRef.current);
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const index = Number(root.dataset.sceneIndex || 0);
    const list = [...root.querySelectorAll<HTMLElement>('[data-scene]')];
    list.forEach((scene, i) => scene.classList.toggle('is-active', i === index));
    root.classList.toggle('is-on-hero', list[index]?.classList.contains('hm-hero') ?? false);
    const hero = root.querySelector('.hm-hero');
    hero?.classList.toggle('is-looping', showCopyRef.current);
    hero?.classList.toggle('is-shard', showStatementRef.current);
  });

  return (
    <div className="home-stage is-directed" data-spring-own ref={rootRef}>
      <SiteHeader currentPath={`${prefix}/`} />
      <main>
        <section className="hm-hero" data-scene aria-label="Bluebook">
          <HeroBackground
            onLoopStart={() => {
              loopingRef.current = true;
              showCopyRef.current = true;
              rootRef.current?.querySelector('.hm-hero')?.classList.add('is-looping');
              setLooping(true);
            }}
            onCopyChange={(visible) => {
              showCopyRef.current = visible;
              rootRef.current?.querySelector('.hm-hero')?.classList.toggle('is-looping', visible);
            }}
            onStatementChange={(visible) => {
              showStatementRef.current = visible;
              rootRef.current?.querySelector('.hm-hero')?.classList.toggle('is-shard', visible);
            }}
          />
          <p className="hm-word-mask" aria-hidden="true">
            <span className="hm-word-shift">
              <span className="hm-word">bluebook</span>
            </span>
          </p>
          <h1 className="hm-hero-copy">
            <span className="hm-mask">
              <span className="hm-line">A guide to the</span>
            </span>
            <span className="hm-mask">
              <span className="hm-line">digital world.</span>
            </span>
          </h1>
          <div className="hm-statement">
            <span className="hm-mask">
              <span className="hm-line">Structural analysis, then</span>
            </span>
            <span className="hm-mask">
              <span className="hm-line">
                <em>precise</em> execution.
              </span>
            </span>
            <span className="hm-mask">
              <span className="hm-line">Only the necessary</span>
            </span>
            <span className="hm-mask">
              <span className="hm-line">mechanics remain.</span>
            </span>
          </div>
        </section>

        <section className="hm-pin" aria-label="Services">
          {services.map(([n, a, b, body]) => (
            <article key={n} className="hm-panel" data-scene>
              <p className="hm-panel-index">{n}</p>
              <h2 className="hm-tone">
                <span className="hm-mask">
                  <span className="hm-line">{a}</span>
                </span>
                <span className="hm-mask">
                  <span className="hm-line hm-tone-b">{b}</span>
                </span>
              </h2>
              <p className="hm-panel-body">{body}</p>
              <Link className="hm-btn" to={`${prefix}/contact/`}>
                Start with one process
              </Link>
            </article>
          ))}
        </section>

        <section className="hm-work" data-scene aria-label="How the team works">
          <h2 className="hm-kicker">Practice</h2>
          <div className="hm-work-list">
            {ways.map(([title, body]) => (
              <article key={title} className="hm-work-row" data-hm-lines>
                <h3>
                  <MaskLines lines={[title]} />
                </h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="hm-voices" data-scene aria-label="Client perspectives">
          <h2 className="hm-kicker">Perspectives</h2>
          <div className="hm-voices-list">
            {voices.map(([name, role, quote]) => (
              <article key={name} data-hm-lines>
                <p>
                  <MaskLines lines={[quote]} />
                </p>
                <small>
                  {name} — {role}
                </small>
              </article>
            ))}
          </div>
        </section>

        {homeNews.length > 0 ? (
          <section className="hm-news" data-scene aria-label="News">
            <h2 className="hm-kicker">News</h2>
            <div className="hm-news-grid">
              {homeNews.map((article) => (
                <Link key={article.slug} className="hm-card" to={`${prefix}/news/${article.slug}/`} data-hm-late-lines>
                  <span className="hm-card-media">
                    <img src={article.image} alt="" width={640} height={800} />
                  </span>
                  <h3>
                    <span className="hm-mask">
                      <span className="hm-line">{article.title}</span>
                    </span>
                  </h3>
                  <small>{article.date ? `${article.date} · ${article.tag}` : article.tag}</small>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {homeCulture.length > 0 ? (
          <section className="hm-culture" data-scene data-hm-late-lines aria-label="Culture">
            <h2 className="hm-kicker">Culture</h2>
            <div className="hm-culture-grid">
              {homeCulture.map((article) => (
                <Link key={article.slug} to={`${prefix}/culture/${article.slug}/`}>
                  <h3>
                    <MaskLines lines={[article.title]} />
                  </h3>
                  <small>{article.date ? `${article.date} · ${article.tag}` : article.tag}</small>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="hm-close" data-scene data-hm-lines aria-label="Contact">
          <h2>
            <span className="hm-mask">
              <span className="hm-line">Start with</span>
            </span>
            <span className="hm-mask">
              <span className="hm-line">one process.</span>
            </span>
          </h2>
          <Link className="hm-btn" to={`${prefix}/contact/`}>
            Start with one process
          </Link>
        </section>
      </main>
      <div data-scene>
        <SiteFooter />
      </div>
    </div>
  );
}
