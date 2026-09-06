import { Link } from 'react-router-dom';
import BaseLayout from '@/layouts/BaseLayout';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import '@/styles/landing.css';
import '@/styles/pages/ai-ocr.css';

const title = 'AI OCR & Data Extraction | Bluebook';
const description =
  'Transform unstructured documents, legacy paperwork, and scattered PDFs into structured data pipelines with enterprise-grade AI OCR.';
const currentPath = '/en/services/ai-ocr/';
const asset = '/assets/figma/ai-ocr';

const pains = [
  {
    n: '01',
    title: 'Structural ambiguity',
    body: 'Invoices and receipts lack standard formats. Legacy systems break when a table column shifts or a vendor redesigns their billing template.',
  },
  {
    n: '02',
    title: 'Degraded quality',
    body: 'Faxed documents, mobile phone photos in poor lighting, and crumpled receipts create noise that traditional template-based parsers cannot interpret.',
  },
  {
    n: '03',
    title: 'Multilingual context',
    body: 'Global operations encounter documents mixing English, Mandarin, and Japanese within the same form, requiring deep semantic understanding to extract accurately.',
  },
] as const;

const applied = [
  {
    img: `${asset}/apply-1.png`,
    title: 'Commercial invoices',
    tag: 'VAR: COMPLEX_TABLE',
    offset: 0,
  },
  {
    img: `${asset}/apply-2.png`,
    title: 'Packing lists',
    tag: 'VAR: HANDWRITTEN_NOTES',
    offset: 1,
  },
  {
    img: `${asset}/apply-3.png`,
    title: 'ACORD certs',
    tag: 'VAR: MULTI_PAGE_PDF',
    offset: 2,
  },
] as const;

const industries = [
  {
    img: `${asset}/industry-1.png`,
    title: 'Financial services',
    body: 'Automated parsing of complex bank statements, loan applications, and tax forms into structured JSON ready for risk analysis.',
    variant: 'finance',
  },
  {
    img: `${asset}/industry-2.png`,
    title: 'Global logistics',
    body: 'Instant digitization of Bills of Lading, customs declarations, and handwritten shipping manifests across borders.',
    variant: 'logistics',
  },
  {
    img: `${asset}/industry-3.png`,
    title: 'Legal discovery',
    body: 'Extracting specific clauses, dates, and entity names from thousands of pages of unstructured case files and contracts.',
    variant: 'legal',
  },
] as const;

const features = [
  {
    n: '01',
    title: 'Custom OCR projects',
    body: 'Tailored machine learning models designed explicitly for your niche document types. We eschew off-the-shelf fragility for robust, domain-specific accuracy.',
  },
  {
    n: '02',
    title: 'Intelligent field mapping',
    body: "Automated cross-referencing and contextual understanding ensures that 'Total Due' and 'Amount Payable' map perfectly to the same database field, regardless of layout.",
  },
  {
    n: '03',
    title: 'Human-in-the-loop',
    body: 'Engineered fallback protocols where low-confidence extractions are instantly routed to expert human operators for verification, ensuring perfect data integrity.',
  },
  {
    n: '04',
    title: 'Batch processing',
    body: 'High-throughput infrastructure capable of ingesting and structuring thousands of pages per hour. Designed for massive historical backlogs or high-volume daily intake.',
  },
  {
    n: '05',
    title: 'Multi-format support',
    body: 'Seamless ingestion across the spectrum: complex nested PDFs, heavily degraded scans, smartphone photographs, and archaic word processor formats.',
  },
] as const;

const steps = [
  {
    n: '01',
    title: 'Ingest',
    body: 'Upload via API, email parse, or direct drop. Image pre-processing normalizes skew, contrast, and noise.',
    done: false,
  },
  {
    n: '02',
    title: 'Extract',
    body: 'Spatial layout analysis and LLM-driven entity extraction identify key fields and nested line items.',
    done: false,
  },
  {
    n: '03',
    title: 'Validate',
    body: 'Automated logic checks (e.g., math verification). Low-confidence flags route to Human-in-the-Loop review.',
    done: false,
  },
  {
    n: '04',
    title: 'Export',
    body: 'Structured JSON payload delivered via webhook to downstream ERP, CRM, or database systems.',
    done: true,
  },
] as const;

export default function AiOcrPage() {
  return (
    <BaseLayout title={title} description={description} canonical="https://www.bluebook.blue/en/services/ai-ocr/">
      <SiteHeader currentPath={currentPath} />
      <main className="ocr" data-motion-pending>
        <section className="ocr-hero">
          <div className="ocr-shell ocr-hero__grid">
            <div className="ocr-hero__copy">
              <p className="ocr-kicker">
                <span className="ocr-kicker__rule" aria-hidden="true" />
                AI-powered data extraction
              </p>
              <h1>
                The end of<br />
                <em>manual data<br />entry.</em>
              </h1>
              <p className="ocr-hero__lead">
                Transform unstructured documents, legacy paperwork, and scattered PDFs into pristine, structured data
                pipelines with absolute precision.
              </p>
              <Link className="ocr-btn ocr-btn--primary" to="/en/contact/">
                Deploy AI extraction
                <img src={`${asset}/arrow.svg`} alt="" width={12} height={12} />
              </Link>
            </div>
            <div className="ocr-hero__visual">
              <img
                src={`${asset}/hero.png`}
                alt="Bluebook AI OCR portal showing document extraction records"
                width={1280}
                height={720}
              />
            </div>
          </div>
        </section>

        <section className="ocr-problem">
          <div className="ocr-shell">
            <div className="ocr-problem__head">
              <h2>The burden<br />of paper.</h2>
              <p>
                Organizations lose thousands of hours annually attempting to structure the unstructured. Traditional OCR
                fails on complex layouts, handwritten notes, and degraded scans, requiring costly human intervention.
              </p>
            </div>
            <ol className="ocr-problem__list">
              {pains.map((p) => (
                <li key={p.n}>
                  <span className="ocr-problem__n" aria-hidden="true">
                    {p.n}
                  </span>
                  <div>
                    <h3>{p.title}</h3>
                    <p>{p.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="ocr-solution">
          <div className="ocr-shell ocr-solution__grid">
            <div className="ocr-solution__visual">
              <img src={`${asset}/solution.png`} alt="DATA — structured extraction" />
              <div className="ocr-solution__badge">
                <span>Extraction accuracy</span>
                <strong>99.8%</strong>
              </div>
            </div>
            <div className="ocr-solution__copy">
              <p className="ocr-label">The solution matrix</p>
              <h2>
                From<br />document<br />to data.
              </h2>
              <p>
                We don&apos;t just sell software; we deliver completed projects. Our approach to AI OCR involves architecting
                bespoke models tailored to your specific document taxonomy. We train systems to understand context, untangle
                complex layouts, and map extracted entities directly to your schema.
              </p>
              <dl className="ocr-solution__io">
                <div>
                  <dt>Input</dt>
                  <dd>Unstructured chaos</dd>
                </div>
                <div>
                  <dt className="is-accent">Output</dt>
                  <dd>Structured intelligence</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <section className="ocr-applied">
          <div className="ocr-shell">
            <div className="ocr-applied__head">
              <div>
                <p className="ocr-mono">// Operational context</p>
                <h2>Applied intelligence</h2>
              </div>
              <p>
                Real-world deployment across financial services, logistics, and healthcare sectors demonstrating robust
                layout comprehension.
              </p>
            </div>
            <ul className="ocr-applied__grid">
              {applied.map((item) => (
                <li key={item.title} className={`ocr-applied__item ocr-applied__item--${item.offset}`}>
                  <div className="ocr-applied__frame">
                    <img src={item.img} alt="" />
                  </div>
                  <div className="ocr-applied__meta">
                    <span>{item.title}</span>
                    <span className="ocr-mono">{item.tag}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="ocr-industries">
          <div className="ocr-shell">
            <div className="ocr-industries__head">
              <p className="ocr-kicker ocr-kicker--center">Application scenarios</p>
              <h2>
                Where AI OCR drives<br />business velocity.
              </h2>
            </div>
            <ul className="ocr-industries__masonry">
              {industries.map((item) => (
                <li key={item.title} className={`ocr-industry ocr-industry--${item.variant}`}>
                  <div className="ocr-industry__media">
                    <img src={item.img} alt="" />
                  </div>
                  <div className="ocr-industry__copy">
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="ocr-features">
          <div className="ocr-shell">
            <h2 className="ocr-features__title">Architecture &amp; capability</h2>
            <ul className="ocr-features__grid">
              {features.map((f) => (
                <li key={f.n}>
                  <span className="ocr-features__n">{f.n}</span>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="ocr-steps" id="how-it-works">
          <div className="ocr-shell">
            <p className="ocr-steps__label">The extraction sequence</p>
            <ol className="ocr-steps__grid">
              {steps.map((s) => (
                <li key={s.n} className={s.done ? 'is-done' : undefined}>
                  <span className="ocr-steps__n">{s.n}</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="ocr-demo" aria-label="AI OCR demo">
          <div className="ocr-shell">
            <p className="ocr-kicker ocr-kicker--center">See it in action</p>
            <h2>AI OCR demo</h2>
            <div className="ocr-demo__frame">
              <video
                className="ocr-demo__video"
                autoPlay
                muted
                loop
                playsInline
                disablePictureInPicture
                controlsList="nodownload nofullscreen noremoteplayback"
                preload="auto"
                poster={`${asset}/hero.png`}
                onContextMenu={(e) => e.preventDefault()}
              >
                <source src={`${asset}/demo.mp4`} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </BaseLayout>
  );
}
