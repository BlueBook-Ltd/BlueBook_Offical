import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
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

export default function HomeStage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [, setLooping] = useState(false);
  const loopingRef = useRef(false);
  const showCopyRef = useRef(false);
  const showStatementRef = useRef(false);
  usePageContentGate(loaded);

  useEffect(() => {
    setLoaded(true);
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    return mountDirectedScroll(root, () => loopingRef.current);
  }, []);

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

  return (
    <div className="home-stage is-directed" data-spring-own ref={rootRef}>
      <svg className="hm-shard-filter" aria-hidden="true">
        <filter id="hm-shard-cover" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  1.15 1.15 1.15 0 -0.62"
          />
        </filter>
      </svg>
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
      </main>
      {/* Contact (GetInTouch) + site footer — no Video End / Bluebook City on the homepage. */}
      <div data-scene>
        <SiteFooter />
      </div>
    </div>
  );
}
