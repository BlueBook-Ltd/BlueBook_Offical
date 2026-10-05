import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { getArticlesFor } from '@/utils/news';
import type { Article } from '@/data/articles';
import { SpringReveal } from '@/motion/SpringReveal';
import { SpringParallax } from '@/motion/SpringParallax';
import { SpringLink, useClearMotionPending } from '@/motion/SpringStagger';
import { usePageContentGate } from '@/motion/pageReady';
import '@/styles/figma-landing.css';

const prefix = '/en';

const services = [
  ['01', 'DIGITAL CONSULTANCY', 'Clarify where to begin before you commit to a tool.', ['PROCESS REVIEW', 'TRANSFORMATION ROADMAP', 'SYSTEM REQUIREMENTS'], `${prefix}/contact/`],
  ['02', 'WHATSAPP AI AGENT', 'Make conversations, voice notes, images, and files operationally useful.', ['CONVERSATION CAPTURE', 'SEARCHABLE RECORDS', 'TASK ROUTING'], `${prefix}/contact/`],
  ['03', 'AI OCR & DATA EXTRACTION', 'Turn documents into fields your team can check and export.', ['FIELD EXTRACTION', 'REVIEW WORKFLOW', 'CSV AND API OUTPUT'], `${prefix}/contact/`],
  ['04', 'WORKFLOW AUTOMATION', 'Remove repetitive steps from approvals, notifications, and reporting.', ['AUTOMATION DESIGN', 'BUSINESS RULES', 'OPERATIONAL MONITORING'], `${prefix}/contact/`],
] as const;

const advantages = [
  ['01', '01 / STRUCTURE', 'OUR TEAM IS YOURS', 'Our teams are not remote assistants you "rent by the hour." They work as an extension of your operation: mapping the real workflow, sitting with the friction, and owning the outcome with you.', '/assets/figma/edge-01.png'],
  ['02', '02 / PHILOSOPHY', 'BUSINESS MINDSET EVERYWHERE', 'At Bluebook, nobody is allowed to hide behind a narrow role. The engineer thinks about the process, not just the stack. The strategist thinks about decisions, records, and handoffs.', '/assets/figma/edge-02.png'],
  ['03', '03 / DELIVERY', 'THE SAME SERVICE STANDARDS', 'Service standards are the baseline every client can expect from us—whether the scope is one process or a broader programme. That means a clear map of the workflow and honest trade-offs.', '/assets/figma/edge-03.png'],
  ['04', '04 / INNOVATION', 'AI-ENHANCED DEVELOPMENT', 'We combine human judgment with AI where it genuinely speeds the work: structuring messy inputs, accelerating analysis, and tightening build-and-review loops.', '/assets/figma/edge-04.png'],
  ['05', '05 / COMMITMENT', 'COMMITTED FROM THE FIRST CALL', 'While others open with tools, packages, or headcount to sell, we open with the problem you are trying to remove. We listen for the real bottleneck from the first conversation.', '/assets/figma/edge-05.png'],
  ['06', '06 / PARTNERSHIP', 'WE BELIEVE IN PARTNERSHIPS', 'Most useful systems are not finished on launch day—they mature as your team, volume, and constraints change. We design for that reality: start with one process, then grow.', '/assets/figma/edge-06.png'],
];

const reviewRowA = [
  ['Chris L.', 'Operations director, logistics', 'We stopped chasing status in three WhatsApp groups. If a request stalls, you can see exactly who is holding it—and the team spends the morning closing work instead of hunting for updates.'],
  ['Mei W.', 'Programme lead, retail', 'They mapped the handoffs before touching any tools. That alone cut two weeks of back-and-forth, and everyone finally agreed on where the process actually breaks.'],
  ['Daniel K.', 'Commercial manager, B2B services', 'Less re-typing from chat into Excel. Our people actually have time to follow up with customers again, and fewer quotes go cold because a detail was missed.'],
  ['Aisha R.', 'Operations lead, field services', 'Photos and voice notes now land with the job. The next person does not have to ask the same questions twice, which makes a real difference on busy site days.'],
  ['Tom H.', 'Finance lead, professional services', 'I only review the exceptions now. The rest clears without me opening every file, so month-end feels like a check, not a scavenger hunt.'],
  ['Sarah P.', 'Delivery manager, agency', 'First release was small and usable. No six-month phase one that nobody can touch—our team could try it in week three and tell us what to fix next.'],
  ['Ken T.', 'Customer service lead, e-commerce', 'Night-shift handovers got quieter. Context is already on the ticket when the morning team logs in, so we spend less time reconstructing what the customer already said.'],
  ['Laura M.', 'Project sponsor, manufacturing', 'We knew what would ship in week three and what could wait. That made budget talks much calmer, because nobody was guessing what done looked like.'],
] as const;

const reviewRowB = [
  ['Nina C.', 'Admin lead, property', 'Contracts stopped living in someone\'s Downloads folder. Everyone works from the same version, and we no longer email three PDFs asking which one is final.'],
  ['James O.', 'Client success, SaaS', 'When a teammate takes over an account, the conversation history is already attached. No detective work—and customers notice that we do not ask them to repeat themselves.'],
  ['Helen Y.', 'COO, mid-size trading firm', 'I can see volume, delays, and owners without waiting for Friday\'s manual report. That weekly scramble used to burn half a day for two people.'],
  ['Ravi S.', 'Service desk lead, IT support', 'The queue is honest at 9am. We stopped building our own trackers on the side, and new joiners understand the backlog on day one.'],
  ['Olivia F.', 'Data owner, healthcare admin', 'Cleaner audit trail, and nobody had to fill in an extra form just for compliance. The record comes from the work itself, which is how it should have been.'],
  ['Marcus B.', 'Business lead, wholesale', 'Automation takes the repetitive steps. Approvals stay with people when judgement matters—so we gained speed without pretending every case is the same.'],
  ['Priya N.', 'Operations manager, logistics', 'From first message to final decision, one thread. That used to take a chase across email and chat, and exceptions often sat unnoticed until a customer chased us.'],
  ['Eric D.', 'Transformation lead, financial services', 'They were honest about what not to automate. We spent money on the bottleneck, not a shiny dashboard, and the first change stuck because the team could actually use it.'],
] as const;

const people = Array.from({ length: 12 }, (_, i) => `/assets/people/${String(i + 1).padStart(2, '0')}.png`);

export default function FigmaLanding() {
  const [homeNews, setHomeNews] = useState<Article[]>([]);
  const [homeCulture, setHomeCulture] = useState<Article[]>([]);
  // The hero renders immediately but the News and Culture strips arrive later;
  // hold the route transition until they do.
  const [loaded, setLoaded] = useState(false);
  usePageContentGate(loaded);
  useClearMotionPending('.figma-landing');

  useEffect(() => {
    let cancelled = false;
    Promise.all([getArticlesFor('news'), getArticlesFor('culture')])
      .then(([news, culture]) => {
        if (cancelled) return;
        setHomeNews(news.filter((a) => a.image).slice(0, 3));
        setHomeCulture(culture.slice(0, 6));
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <SiteHeader currentPath={`${prefix}/`} />
      <div className="figma-landing" data-motion-pending data-spring-own>
      <main>
        <section className="hero" data-no-hero-transition aria-label="Bluebook hero">
          <div className="hero__inner">
            <div className="hero__copy">
              <SpringReveal as="h1" className="hero__title" fromY={48} delay={40} rootMargin="0px" amount={0.01}>
                A GUIDE TO THE<br /><span>DIGITAL WORLD.</span>
              </SpringReveal>
              <SpringReveal as="p" className="hero__body" fromY={28} delay={140} rootMargin="0px" amount={0.01}>
                Bridging AI tools with day-to-day operations to create intelligent infrastructure<br />for modern B2B growth. We architect the void between potential and<br />execution.
              </SpringReveal>
              <SpringReveal className="hero__actions" fromY={20} delay={220} rootMargin="0px" amount={0.01}>
                <Link to={`${prefix}/contact/`}>Start with one process</Link>
              </SpringReveal>
            </div>
          </div>
        </section>

        <section className="precision" id="precision" data-node-id="235:23" aria-label="Mathematical precision in execution">
          <SpringParallax distance={56} className="precision__bg-wrap">
            <img className="precision__bg" src="/assets/figma/precision-bg.png" alt="" width={1536} height={1024} />
          </SpringParallax>
          <div className="precision__veil" aria-hidden="true" />
          <div className="precision__inner">
            <SpringReveal as="h2" className="precision__title" fromY={44} delay={40}>
              MATHEMATICAL<br />PRECISION IN <span>EXECUTION.</span>
            </SpringReveal>
            <SpringReveal className="precision__body" fromY={28} delay={120}>
              <p>We strip away redundant processes and legacy bloat until only the pure,<br />necessary mechanics remain. Structural analysis meets precise execution.</p>
            </SpringReveal>
          </div>
        </section>

        <section className="mission shell" id="mission" data-node-id="146:41">
          <div className="mission__grid">
            <SpringReveal className="mission__copy" fromY={32} fromX={-16}>
              <h2>OUR PHILOSOPHY</h2>
              <p>At Bluebook, we reject the notion that digital transformation must be<br />inherently chaotic. True innovation is born from rigorous structural analysis<br />and precise execution. We view enterprise architecture not as a blank<br />canvas, but as a complex equation waiting to be solved.</p>
              <p className="mission__method">Our methodology is rooted in absolute minimalism: stripping away<br />redundant processes and legacy bloat until only the pure, necessary<br />mechanics remain.</p>
            </SpringReveal>
            <SpringReveal className="mission__art" fromY={40} fromX={28} delay={100} aria-hidden="true">
              <div className="mission__stack" />
              <div className="mission__frame">
                <img src="/assets/figma/mission-philosophy.png" alt="" width={1024} height={1024} />
                <span className="mission__fade" />
                <span className="mission__deco">
                  <img src="/assets/figma/mission-deco-1.svg" alt="" width={128} height={128} />
                  <img src="/assets/figma/mission-deco-2.svg" alt="" width={128} height={128} />
                </span>
              </div>
            </SpringReveal>
          </div>
        </section>

        <section className="shift" data-node-id="146:455">
          <div className="shift__inner">
            <SpringReveal className="shift__copy" fromY={28}>
              <h2>The<br />Architectural<br />Void</h2>
              <p>Bridging AI tools with day-to-day operations to create intelligent infrastructure for modern B2B growth.</p>
              <ol className="shift__sr">
                <li><strong>Legacy Systems</strong> — Fragmented data, manual handoffs, static infrastructure.</li>
                <li><strong>Process Mapping</strong> — People, documents, decisions, clear next steps.</li>
                <li><strong>Digital Synthesis</strong> — Automated flows, operational clarity, adaptive architecture.</li>
              </ol>
            </SpringReveal>
            <SpringReveal className="shift__map" fromY={24} delay={80} aria-hidden="true">
              <img className="shift__curve" src="/assets/figma/shift-curve.svg" alt="" width={965} height={675} />
              <b className="shift__n shift__n--1">1</b>
              <b className="shift__n shift__n--2">2</b>
              <b className="shift__n shift__n--3">3</b>
              <div className="shift__node shift__node--1"><i /><p className="shift__node-title">Legacy Systems</p><small>Fragmented Data, Manual Handoffs, Static Infrastructure.</small></div>
              <div className="shift__node shift__node--2"><i /><p className="shift__node-title">Process Mapping</p><small>People, Documents, Decisions, Clear Next Steps.</small></div>
              <div className="shift__node shift__node--3"><i /><p className="shift__node-title">Digital Synthesis</p><small>Automated Flows, Operational Clarity, Adaptive Architecture.</small></div>
            </SpringReveal>
          </div>
        </section>

        <section className="edge shell" data-node-id="146:66">
          <SpringReveal as="header" className="edge__head" fromY={24}>
            <h2>OUR COMPETITIVE ADVANTAGES</h2>
          </SpringReveal>
          {advantages.map(([num, tag, title, body, img], i) => (
            <SpringReveal
              key={num}
              as="article"
              className={`edge__row ${i % 2 === 1 ? 'edge__row--flip' : ''}`}
              fromY={30}
              fromX={i % 2 === 1 ? -24 : 24}
              delay={i * 40}
            >
              <div className="edge__copy">
                <span className="edge__bar" />
                <p>{tag}</p>
                <h3>{title}</h3>
                <p className="edge__body">{body}</p>
              </div>
              <div className="edge__num" style={{ backgroundImage: `url('${img}')` }} aria-hidden="true">{num}</div>
            </SpringReveal>
          ))}
        </section>

        <section className="services shell" id="services" data-node-id="39:6291">
          <SpringReveal as="header" className="services__head" fromY={28}>
            <h2>A PRACTICAL GUIDE FOR EVERY STAGE OF CHANGE.</h2>
          </SpringReveal>
          <div className="services__list">
            {services.map(([n, t, d, bullets, href], i) => (
              <SpringLink key={n} className="services__row" to={href} fromY={26} delay={i * 50}>
                <b>{n}</b>
                <h3>{t}</h3>
                <div>
                  <p>{d}</p>
                  <ul>{bullets.map((b) => <li key={b}>• {b}</li>)}</ul>
                </div>
              </SpringLink>
            ))}
          </div>
        </section>

        <section className="reviews" data-node-id="166:2">
          <div className="reviews__top">
            <div className="crescent" aria-hidden="true">
              <div className="crescent__stage">
                {people.map((src, i) => (
                  <SpringReveal key={src} as="i" fromY={18} fromScale={0.9} delay={i * 35} amount={0.05}>
                    <img src={src} alt="" loading="lazy" decoding="async" />
                  </SpringReveal>
                ))}
                <SpringReveal className="crescent__msg" fromY={24} delay={200}>
                  <p>CLIENT PERSPECTIVES</p>
                  <h3>BUILT WITH THE PEOPLE<br />WHO DO THE WORK.</h3>
                  <span>From first workflow map to daily use, every change is shaped with the people closest to the work.</span>
                </SpringReveal>
              </div>
            </div>
          </div>
          <SpringReveal className="reviews__body" fromY={20}>
            <div className="reviews-marquee" aria-label="Client perspectives">
              <div className="reviews-marquee__row">
                <div className="reviews-marquee__track">
                  {[...reviewRowA, ...reviewRowA].map(([name, role, quote], i) => (
                    <article key={`a-${i}`} className="review-card">
                      <header>
                        <img className="review-card__avatar" src={people[i % reviewRowA.length]} alt="" loading="lazy" decoding="async" />
                        <div><strong>{name}</strong><small>{role}</small></div>
                      </header>
                      <p>{quote}</p>
                    </article>
                  ))}
                </div>
              </div>
              <div className="reviews-marquee__row reviews-marquee__row--alt">
                <div className="reviews-marquee__track">
                  {[...reviewRowB, ...reviewRowB].map(([name, role, quote], i) => (
                    <article key={`b-${i}`} className="review-card">
                      <header>
                        <img className="review-card__avatar" src={people[((i % reviewRowB.length) + reviewRowA.length) % people.length]} alt="" loading="lazy" decoding="async" />
                        <div><strong>{name}</strong><small>{role}</small></div>
                      </header>
                      <p>{quote}</p>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </SpringReveal>
        </section>

        <section className="editorial shell" id="news" data-node-id="148:920">
          <SpringReveal as="header" className="editorial__head" fromY={24}>
            <h2>NEWS & INSIGHTS</h2>
          </SpringReveal>
          <div className="editorial__grid">
            {homeNews.map((article, i) => (
              <SpringLink key={article.slug} to={`${prefix}/news/${article.slug}/`} fromY={32} delay={i * 60}>
                <span className="editorial__media"><img src={article.image} alt="" width={352} height={352} /></span>
                <small>{article.date ? `${article.date} • ${article.tag}` : article.tag}</small>
                <h3>{article.title}</h3>
              </SpringLink>
            ))}
          </div>
        </section>

        <section className="culture shell" id="culture" data-node-id="culture">
          <SpringReveal as="header" className="editorial__head" fromY={24}>
            <h2>CULTURE & CODE</h2>
          </SpringReveal>
          <div className="culture__grid">
            {homeCulture.map((article, i) => (
              <SpringLink key={article.slug} to={`${prefix}/culture/${article.slug}/`} fromY={32} delay={i * 50}>
                <i>{article.image ? <img src={article.image} alt="" width={352} height={260} loading="lazy" /> : null}</i>
                <h3>{article.title}</h3>
                <small>{article.date ? `${article.date} · ${article.tag}` : article.tag}</small>
              </SpringLink>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
    </>
  );
}
