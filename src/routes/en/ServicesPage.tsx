import { Link } from 'react-router-dom';
import BaseLayout from '@/layouts/BaseLayout';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import '@/styles/landing.css';
import '@/styles/pages/services.css';

const currentPath = '/en/services/';
const services = [
  {
    title: 'AI OCR',
    href: '/en/services/ai-ocr/',
    body: 'Turn documents into fields your team can check and export—with a review workflow built for real operations.',
    thumb: '/assets/figma/services/ai-ocr-thumb.png',
  },
  {
    title: 'WhatsApp',
    href: '/en/services/whatsapp-ai-agent/',
    body: 'Make conversations, voice notes, images, and files operationally useful across your day-to-day work.',
    thumb: '/assets/figma/services/whatsapp-thumb.png',
  },
] as const;

export default function ServicesPage() {
  return (
    <BaseLayout
      title="Hong Kong AI OCR and WhatsApp automation | Bluebook"
      description="Explore Bluebook services: AI OCR & data extraction, and WhatsApp AI Agent."
      canonical="https://www.bluebook.blue/en/services/"
    >
      <SiteHeader currentPath={currentPath} />
      <main className="svc" data-motion-pending>
        <div className="svc__inner">
          <h1 className="svc__title">Our services</h1>
          <ul className="svc__grid">
            {services.map((s) => (
              <li key={s.href}>
                <Link className="svc__card" to={s.href}>
                  <div className="svc__media" aria-hidden="true">
                    {s.thumb ? (
                      <img src={s.thumb} alt="" width={640} height={640} loading="lazy" />
                    ) : (
                      <svg viewBox="0 0 120 120" fill="none">
                        <rect x="22" y="18" width="56" height="72" stroke="#1a1c1c" strokeWidth="2" />
                        <path d="M36 40h28M36 52h22M36 64h26" stroke="#1a1c1c" strokeWidth="2" />
                        <circle cx="78" cy="78" r="22" stroke="#1a1c1c" strokeWidth="2" />
                        <path d="M70 78h16M78 70v16" stroke="#1a1c1c" strokeWidth="2" />
                      </svg>
                    )}
                  </div>
                  <h2>{s.title}</h2>
                  <p>{s.body}</p>
                  <span className="svc__cta">View service</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
      <SiteFooter />
    </BaseLayout>
  );
}
