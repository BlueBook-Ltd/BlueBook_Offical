import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { usePageContentGate } from '@/motion/pageReady';
import { mountDirectedScroll } from '@/motion/homeDirectedScroll';
import HeroBackground from '@/components/landing/HeroBackground';
import '@/styles/home-stage.css';

const prefix = '/en';

/**
 * Scene stepping only makes sense with a pointer/wheel. Below this width, or on
 * touch-only devices, the homepage runs as a normal scrolling document instead
 * (see the `.is-mobile` rules in home-stage.css).
 */
const DESKTOP_QUERY = '(min-width: 960px) and (hover: hover)';

const services = [
  {
    n: '01',
    category: 'AI Strategy & Workflow Consulting',
    title: ['From AI Noise', 'to Action'],
    body: 'Cut through the AI hype. We map your workflows and help you decide where to begin—with a plan your team can realistically deliver.',
  },
  {
    n: '02',
    category: 'Conversation Intelligence',
    title: ['WhatsApp', 'Signal'],
    body: 'Find the signal in the conversation. Search authorised WhatsApp groups and keep the original source connected to every piece of information.',
  },
  {
    n: '03',
    category: 'Intelligent Document Extraction',
    title: ['Document', 'Lens'],
    body: 'See the data hiding in your documents. Extract useful fields for your team to review and export.',
  },
  {
    n: '04',
    category: 'Workflow Automation',
    title: ['Workflow', 'Current'],
    body: 'Keep work moving. Streamline repetitive approvals, notifications and reporting without taking judgement away from your team.',
  },
] as const;

export default function HomeStage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [, setLooping] = useState(false);
  const loopingRef = useRef(false);
  const showCopyRef = useRef(false);
  const showStatementRef = useRef(false);
  const [desktop, setDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(DESKTOP_QUERY).matches,
  );
  usePageContentGate(loaded);

  useEffect(() => {
    setLoaded(true);
  }, []);

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => setDesktop(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !desktop) return;
    return mountDirectedScroll(root, () => loopingRef.current);
  }, [desktop]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    // After panel 04 unlocks, scenes stay in normal document flow.
    if (root.classList.contains('is-free-scroll') || !root.classList.contains('is-directed')) {
      return;
    }
    const index = Number(root.dataset.sceneIndex || 0);
    const list = [...root.querySelectorAll<HTMLElement>('[data-scene]')];
    list.forEach((scene, i) => scene.classList.toggle('is-active', i === index));
    const onHero = list[index]?.classList.contains('hm-hero') ?? false;
    root.classList.toggle(
      'is-on-hero',
      onHero || root.classList.contains('is-city-pin') || root.classList.contains('is-end-video'),
    );
    const hero = root.querySelector('.hm-hero');
    hero?.classList.toggle('is-looping', showCopyRef.current);
    hero?.classList.toggle('is-shard', showStatementRef.current);
  });

  /*
   * The hero wordmark and statement are sized in `vw` and set to `nowrap`, so a
   * narrower window runs the text past its column and clips it. Measure the
   * rendered line and scale it down to the box: the CSS size stays the ceiling,
   * this only ever shrinks, and it re-runs on resize / font swap.
   */
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // Every nowrap display line — hero wordmark, hero statement, and the mobile
    // statement section — is scaled to its own column width.
    const groups = [...root.querySelectorAll<HTMLElement>('.hm-word-mask, .hm-statement')].map((host) => ({
      host,
      selector: host.classList.contains('hm-word-mask') ? '.hm-word' : '.hm-line',
    }));

    const widths = new Map<HTMLElement, number>();

    const fit = (force = false) => {
      for (const { host, selector } of groups) {
        const width = host.clientWidth;
        if (!width || (!force && widths.get(host) === width)) continue;
        widths.set(host, width);

        host.querySelectorAll<HTMLElement>(selector).forEach((line) => {
          line.style.fontSize = '';
          const range = document.createRange();
          range.selectNodeContents(line);
          const textWidth = range.getBoundingClientRect().width;
          if (!textWidth || textWidth <= width + 1) return;

          const cssSize = Number.parseFloat(getComputedStyle(line).fontSize) || 16;
          line.style.fontSize = `${((cssSize * width) / textWidth) * 0.995}px`;
        });
      }
    };

    fit();
    const observer = new ResizeObserver(() => fit());
    groups.forEach(({ host }) => observer.observe(host));
    // Web fonts land after first paint and change the metrics.
    void document.fonts?.ready.then(() => fit(true));

    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`home-stage ${desktop ? 'is-directed' : 'is-mobile is-on-hero'}`}
      data-spring-own
      ref={rootRef}
    >
      <SiteHeader currentPath={`${prefix}/`} />
      <main>
        {/* The hero film is dark, but the light .home-stage background sits
            behind it — pin the white cursor so it never flips to black here. */}
        <section className="hm-hero" data-scene aria-label="Bluebook" data-cursor-tone="dark">
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
          <h1 className="hm-word-mask">
            <span className="hm-word-shift">
              <span className="hm-word">bluebook</span>
            </span>
          </h1>
          <h2 className="hm-hero-copy">
            <span className="hm-mask">
              <span className="hm-line">A guide to the</span>
            </span>
            <span className="hm-mask">
              <span className="hm-line">digital world.</span>
            </span>
          </h2>
          <div className="hm-statement">
            <span className="hm-mask">
              <span className="hm-line hm-statement__lead">From complexity</span>
            </span>
            <span className="hm-mask">
              <span className="hm-line hm-statement__sub">
                to <em>clear</em> workflows.
              </span>
            </span>
          </div>
          <div className="hm-scroll-hint" aria-hidden="true">
            <img className="hm-scroll-hint__arrow is-up" src="/assets/bluebook/scroll-arrow.png" alt="" width={22} height={24} />
            <img className="hm-scroll-hint__arrow is-down" src="/assets/bluebook/scroll-arrow.png" alt="" width={22} height={24} />
            <span className="hm-scroll-hint__label">Scroll</span>
          </div>
        </section>

        {/* Mobile only: the statement gets its own scene on the shard film.
            On desktop it stays inside the hero and rides the shard phase. */}
        {!desktop && (
          <section className="hm-statement-section" aria-label="From complexity to clear workflows">
            <div className="hm-section-bg" aria-hidden="true">
              <video src="/assets/bluebook/shard_floating.mp4" autoPlay muted loop playsInline preload="metadata" />
            </div>
            <div className="hm-statement">
              <span className="hm-mask">
                <span className="hm-line hm-statement__lead">From complexity</span>
              </span>
              <span className="hm-mask">
                <span className="hm-line hm-statement__sub">
                  to <em>clear</em> workflows.
                </span>
              </span>
            </div>
          </section>
        )}

        <section className="hm-pin" aria-label="Services">
          {!desktop && (
            <div className="hm-pin-bg" aria-hidden="true">
              <video src="/assets/bluebook/Girl_Loop.mp4" autoPlay muted loop playsInline preload="metadata" />
            </div>
          )}
          {services.map(({ n, category, title, body }) => (
            <article key={n} className="hm-panel" data-scene>
              <p className="hm-panel-index">
                <span className="hm-panel-index__num">{n}</span>
                <span className="hm-panel-index__cat">{category}</span>
              </p>
              <h2 className="hm-tone">
                <span className="hm-mask">
                  <span className="hm-line">{title[0]}</span>
                </span>
                <span className="hm-mask">
                  <span className="hm-line hm-tone-b">{title[1]}</span>
                </span>
              </h2>
              <p className="hm-panel-body">{body}</p>
              <Link className="hm-btn" to={`${prefix}/contact/`}>
                Start with one process
              </Link>
            </article>
          ))}
        </section>
      </main>
      {/* Contact (GetInTouch) + site footer — no Video End / Bluebook City on the homepage. */}
      <div data-scene>
        <SiteFooter />
      </div>
    </div>
  );
}
