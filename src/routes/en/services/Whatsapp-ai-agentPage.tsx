import { Link } from 'react-router-dom';
import BaseLayout from '@/layouts/BaseLayout';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import '@/styles/landing.css';
import '@/styles/pages/whatsapp-ai-agent.css';

const title = 'WhatsApp AI Agent: Turn Team Chats Into Searchable Knowledge';
const description =
  "Bluebook's WhatsApp AI Agent turns WhatsApp group chats into a searchable, trackable, exportable knowledge base for internal teams. Not a customer-service bot. Enquire today.";
const currentPath = '/en/services/whatsapp-ai-agent/';

const pains = [
  {
    number: '/images/whatsapp/problem-01.svg',
    title: 'Decisions buried across groups',
    body: 'Important decisions and approvals are scattered across many WhatsApp groups, and no one can find them when they matter.',
  },
  {
    number: '/images/whatsapp/problem-02.svg',
    title: 'Voice notes you can\u2019t search',
    body: 'Key instructions arrive as voice notes that WhatsApp can\u2019t search, so they vanish into the scroll.',
  },
  {
    number: '/images/whatsapp/problem-03.svg',
    title: 'No audit trail when disputes hit',
    body: 'When delays or disputes arise, teams have no structured record to evidence what was agreed or decided.',
  },
] as const;

const functions = [
  {
    icon: '/images/whatsapp/feature-conversation.svg',
    title: 'WhatsApp cross-group AI Q&A',
    tags: ['Knowledge discovery'],
    body: 'Ask a question in plain language and the AI searches across every connected WhatsApp group to synthesize an answer. Find past decisions, instructions, files, and voice notes without remembering which group they landed in.',
  },
  {
    icon: '/images/whatsapp/feature-search.svg',
    title: 'WhatsApp topic tracking',
    tags: ['Topic monitoring'],
    body: 'Pick a topic \u2014 or let the AI suggest one \u2014 and it continuously collects every related discussion across your groups. Follow a project, a risk, or a commitment without patrolling each group manually.',
  },
  {
    icon: '/images/whatsapp/feature-routing.svg',
    title: 'WhatsApp AI digest',
    tags: ['Summarization'],
    body: 'Get an automatic summary of what was decided, blocked, and needs attention in each busy group over a set period. Survive information overload without scrolling hundreds of messages.',
  },
  {
    icon: '/images/whatsapp/feature-files.svg',
    title: 'WhatsApp backup & export',
    tags: ['Data governance'],
    body: 'Export structured chat logs with timestamps and context from the stored WhatsApp database. Hand over projects cleanly, satisfy compliance, and prepare evidence for disputes in minutes, not days.',
  },
] as const;

const useCases = [
  {
    icon: '/images/whatsapp/industry-construction.svg',
    title: 'Construction & engineering',
    role: 'Ops & project leads',
    problem: 'Site updates, photos, and voice notes are often scattered across busy groups.',
    result: 'AI turns site messages into searchable records and helps prepare evidence for VO, EOT, and disputes.',
  },
  {
    icon: '/images/whatsapp/industry-it.svg',
    title: 'IT & software',
    role: 'Delivery leads',
    problem: 'Clients often send bug reports and scope changes directly in WhatsApp groups.',
    result: 'AI identifies requests, organizes them into change records, and reduces acceptance disputes.',
  },
  {
    icon: '/images/whatsapp/industry-legal.svg',
    title: 'Legal & professional services',
    role: 'Compliance officers',
    problem: 'Advice, client instructions, and commitments are often exchanged informally.',
    result: 'AI creates a clearer audit trail for advice, decisions, billing support, and compliance.',
  },
  {
    icon: '/images/whatsapp/industry-logistics.svg',
    title: 'Logistics & supply chain',
    role: 'Ops leads',
    problem: 'Shipment updates, ETA changes, and exception messages are easy to miss.',
    result: 'AI extracts key shipment details and summarizes operational updates for the team.',
  },
  {
    icon: '/images/whatsapp/industry-manufacturing.svg',
    title: 'Manufacturing',
    role: 'Shift leads',
    problem: 'Shift handovers, machine issues, and maintenance photos are buried in chat history.',
    result: 'AI turns repair records and troubleshooting notes into a searchable knowledge base.',
  },
  {
    icon: '/images/whatsapp/industry-retail.svg',
    title: 'Retail & e-commerce',
    role: 'Service leads',
    problem: 'Customer preferences, complaints, and follow-ups are spread across shifts.',
    result: 'AI tracks unresolved issues and builds better customer context for service teams.',
  },
] as const;

const steps = [
  {
    number: '1',
    title: 'Invite the AI agent',
    body: "Add Bluebook's AI contact to an existing WhatsApp project group and grant the required access.",
    image: '/images/whatsapp/step-invite.png',
    alt: 'Adding the Bluebook AI Agent to a WhatsApp group',
  },
  {
    number: '2',
    title: 'Keep communicating',
    body: 'Teams continue sending text, voice notes, images, and files as usual while the AI structures them.',
    image: '/images/whatsapp/step-interact.png',
    alt: 'A project team interacting with the AI Agent in WhatsApp',
  },
  {
    number: '3',
    title: 'Search and export',
    body: 'Ask questions in the group or use the dashboard to search, summarize, and export records.',
    image: '/images/whatsapp/step-search.png',
    alt: 'Searching and exporting structured WhatsApp records',
  },
] as const;

const metrics = [
  { value: 90, suffix: '%', label: 'Less search time', body: 'Find key info in minutes.' },
  { value: 100, suffix: '%', label: 'Key records captured', body: 'Reduce missed decisions.' },
  { value: 80, suffix: '%', label: 'Faster evidence prep', body: 'Prepare records faster.' },
  { value: 0, suffix: '', label: 'Learning curve', body: 'No change to daily habits.' },
] as const;

const quotes = [
  {
    quote:
      'We reduced the time needed to prepare variation-dispute records from several days to around twenty minutes.',
    source: 'Large construction company',
  },
  {
    quote:
      'Client requests in WhatsApp are now organized into a clear change timeline, reducing acceptance disputes.',
    source: 'Software consulting firm',
  },
  {
    quote:
      'ETA changes and exception updates are easier to summarize, helping our team reduce missed information.',
    source: 'Cross-border logistics provider',
  },
] as const;

const governance = [
  {
    title: 'Org-boundary storage',
    body: 'Your WhatsApp records are stored inside your organization\u2019s boundary, scoped to the groups you connect.',
  },
  {
    title: 'Strict tenant isolation',
    body: 'Your data is strictly isolated from every other customer and never used to train shared models.',
  },
  {
    title: 'No personal chat access',
    body: 'The AI only sees the groups you enroll. Personal chats and DMs are never included.',
  },
] as const;

const faqs = [
  {
    q: 'Is this a WhatsApp customer-service bot?',
    a: 'No. Customer-service bots answer a business\u2019s external customers on a WhatsApp Business number. Bluebook\u2019s WhatsApp AI Agent is an internal tool: it works on your team\u2019s own WhatsApp groups to turn them into a searchable, trackable, exportable knowledge asset. It never talks to your customers.',
  },
  {
    q: 'How does WhatsApp cross-group AI Q&A work?',
    a: 'Ask a question in the group or the dashboard. The AI searches across every connected WhatsApp group, synthesizes the relevant discussions, and returns an answer with the source messages \u2014 so you don\u2019t need to remember which group a decision landed in.',
  },
  {
    q: 'Can the AI search voice notes?',
    a: 'Yes. Voice notes are transcribed and indexed alongside text, images, and files, so a search returns hits across everything your team said, typed, or shared.',
  },
  {
    q: 'What is WhatsApp topic tracking?',
    a: 'Choose a topic \u2014 or accept an AI-suggested one \u2014 and the agent continuously collects related discussions across your groups, so you can follow a project or risk without manually checking every group.',
  },
  {
    q: 'Can I export chats for compliance or handover?',
    a: 'Yes. The stored WhatsApp database exports structured logs with timestamps and context \u2014 for project handover, compliance review, and dispute evidence.',
  },
  {
    q: 'Do teams need to install a new app?',
    a: 'No. Teams keep talking in the WhatsApp groups they already use. Add the AI agent to a group and it works in the background \u2014 no new app, no workflow change.',
  },
] as const;

export default function WhatsappAiAgentPage() {
  return (
    <BaseLayout title={title} description={description} canonical="https://www.bluebook.blue/en/services/whatsapp-ai-agent/">
      <SiteHeader currentPath={currentPath} />
      <div className="wa-page" data-wa-page>
        {/* Hero — Attio-style centered */}
        <section className="wa-hero" aria-labelledby="wa-title">
          <div className="wa-hero__inner">
            <h1 id="wa-title" className="wa-hero__title">
              WhatsApp AI Agent — turn team chats into searchable knowledge
            </h1>
            <p className="wa-hero__lede">
              An internal knowledge management tool for teams whose real decisions live in WhatsApp groups.
              Bluebook turns messages, voice notes, images, and files into structured records your team
              can search, track, summarize, and export. 
            </p>
            <div className="wa-hero__actions">
              <a className="btn btn-primary" href="#contact">Enquire now</a>
              <a className="btn btn-secondary" href="#how-it-works">How it works</a>
            </div>
            <div className="wa-hero__mockup" role="img" aria-label="From chat chaos to structured clarity">
              <div className="wa-hero__chaos">
                <img src="/images/whatsapp/hero-chaos.png" alt="" aria-hidden="true" />
                <span>Chaos</span>
              </div>
              <div className="wa-hero__clarity">
                <img src="/images/whatsapp/hero-clarity.png" alt="" aria-hidden="true" />
                <span>Clarity</span>
              </div>
            </div>
          </div>
        </section>

        {/* Problem */}
        <section className="wa-problem wa-section">
          <div className="wa-shell wa-problem__grid">
            <header className="wa-problem__heading" data-wa-reveal>
              <h2>The problem with <em>WhatsApp project knowledge</em></h2>
              <p>Real decisions live in WhatsApp groups. Without structure, they disappear into the scroll.</p>
            </header>
            <div className="wa-problem__list">
              {pains.map((pain, index) => (
                <article
                  key={pain.title}
                  className="wa-problem-card"
                  style={{ ['--offset' as string]: `${index * 48}px` }}
                  data-wa-problem
                >
                  <img src={pain.number} alt="" width={111} height={81} aria-hidden="true" />
                  <h3>{pain.title}</h3>
                  <p>{pain.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Solution */}
        <section className="wa-solution wa-section">
          <div className="wa-shell">
            <header className="wa-centered" data-wa-reveal>
              <p className="wa-tag">More than chat backup</p>
              <h2>What the <em>WhatsApp AI Agent</em> does</h2>
              <p>
                Two layers form the moat: a persistent WhatsApp Database that stores every connected
                conversation, and an AI Understanding Engine that turns it into four working capabilities
                &mdash; query, track, summarize, and export. Teams keep talking in WhatsApp as usual.
              </p>
            </header>
            <figure className="wa-diagram" data-wa-diagram>
              <img
                src="/images/whatsapp/workflow-diagram.png"
                alt="WhatsApp messages being transformed into structured AI data"
                width={1142}
                height={680}
                loading="lazy"
              />
            </figure>
          </div>
        </section>

        {/* Features */}
        <section className="wa-features wa-section">
          <div className="wa-shell">
            <header className="wa-directory" data-wa-reveal>
              <h2>The four WhatsApp AI Agent capabilities</h2>
              <span>Four core capabilities</span>
            </header>
            <div className="wa-feature-list">
              {functions.map((fn, index) => (
                <article
                  key={fn.title}
                  className={`wa-feature${index % 2 === 1 ? ' wa-feature--reverse' : ''}`}
                  data-wa-feature
                >
                  <img className="wa-feature__icon" src={fn.icon} alt="" width={236} height={169} aria-hidden="true" />
                  <div className="wa-feature__title">
                    <h3>{fn.title}</h3>
                    <div className="wa-feature__tags">
                      {fn.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  </div>
                  <p>{fn.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Industries */}
        <section className="wa-industries wa-section">
          <div className="wa-shell">
            <header className="wa-centered" data-wa-reveal>
              <p className="wa-tag">Where WhatsApp AI Agent helps</p>
              <h2>Who the WhatsApp AI Agent is for</h2>
            </header>
            <div className="wa-industries__grid">
              {useCases.map((useCase) => (
                <article key={useCase.title} className="wa-industry" data-wa-industry>
                  <img src={useCase.icon} alt="" width={34} height={30} aria-hidden="true" />
                  <h3>{useCase.title}</h3>
                  <p className="wa-industry__role">{useCase.role}</p>
                  <p>{useCase.problem}</p>
                  <strong>{useCase.result}</strong>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Steps */}
        <section className="wa-steps wa-section" id="how-it-works">
          <div className="wa-shell">
            <header className="wa-centered" data-wa-reveal>
              <h2>Launch in three simple steps</h2>
              <p>Start from the WhatsApp groups your team already uses.</p>
            </header>
            <div className="wa-steps__grid">
              {steps.map((step) => (
                <article key={step.number} className="wa-step" data-wa-step>
                  <div className="wa-step__copy">
                    <span>{step.number}</span>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                  <div className="wa-step__media">
                    <img src={step.image} alt={step.alt} width={512} height={512} loading="lazy" />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Impact */}
        <section className="wa-impact wa-section">
          <div className="wa-shell">
            <h2 data-wa-reveal>Clear operational impact</h2>
            <p className="wa-impact__note" data-wa-reveal>
              Illustrative outcomes from early deployments—results vary by workflow and team habits.
            </p>
            <div className="wa-metrics">
              {metrics.map((metric) => (
                <article key={metric.label} className="wa-metric" data-wa-metric>
                  <strong data-wa-count={metric.value} data-suffix={metric.suffix}>
                    {metric.value}{metric.suffix}
                  </strong>
                  <h3>{metric.label}</h3>
                  <p>{metric.body}</p>
                </article>
              ))}
            </div>
            <div className="wa-quotes">
              {quotes.map((item) => (
                <figure key={item.source} data-wa-quote>
                  <blockquote>&ldquo;{item.quote}&rdquo;</blockquote>
                  <figcaption>{item.source}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* Governance */}
        <section className="wa-governance wa-section">
          <div className="wa-shell">
            <header className="wa-centered" data-wa-reveal>
              <p className="wa-tag">Data governance</p>
              <h2>Your data stays inside your <em>organization</em></h2>
            </header>
            <div className="wa-governance__grid">
              {governance.map((g) => (
                <article key={g.title} className="wa-governance__card">
                  <h3>{g.title}</h3>
                  <p>{g.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="wa-faq wa-section">
          <div className="wa-shell">
            <header className="wa-centered" data-wa-reveal>
              <h2>Frequently asked questions</h2>
            </header>
            <div className="wa-faq__list">
              {faqs.map((f) => (
                <article key={f.q} className="wa-faq__item">
                  <h3>{f.q}</h3>
                  <p>{f.a}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
      <SiteFooter />
    </BaseLayout>
  );
}
