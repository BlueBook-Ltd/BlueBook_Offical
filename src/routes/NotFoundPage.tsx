import { Link } from 'react-router-dom';
import BaseLayout from '@/layouts/BaseLayout';

export default function NotFoundPage() {
  return (
    <BaseLayout title="Page Not Found | Bluebook" noindex>
      <style>{`
        :root { --blue: #17171c; --muted: #616161; }
        body { font-family: Inter, ui-sans-serif, system-ui, Arial, sans-serif; background: #17171c; color: #fff; margin: 0; display: grid; place-items: center; min-height: 100vh; text-align: center; overflow-x: hidden; }
        .err-wrap { padding: 48px 24px; }
        .err-code { font-family: 'DM Mono', monospace; font-size: 160px; font-weight: 700; line-height: 1; letter-spacing: -0.06em; color: rgba(255,255,255,0.06); pointer-events: none; user-select: none; position: relative; z-index: 0; }
        h1 { position: relative; z-index: 1; margin-top: -76px; font-size: clamp(28px, 4.8vw, 44px); font-weight: 600; letter-spacing: -0.03em; color: #fff; }
        p { color: rgba(255,255,255,0.62); font-size: 16px; max-width: 440px; margin: 16px auto 36px; line-height: 1.75; }
        .btn-home { display: inline-flex; align-items: center; justify-content: center; height: 50px; min-width: 180px; padding: 0 28px; border-radius: 999px; font-size: 15px; font-weight: 700; background: var(--blue); color: #fff; text-decoration: none; transition: transform 0.24s ease, box-shadow 0.24s ease; box-shadow: 0 12px 34px rgba(0,0,0,0.22); }
        .btn-home:hover { transform: translateY(-3px); box-shadow: 0 18px 44px rgba(0,0,0,0.28); }
      `}</style>
      <div className="err-wrap">
        <div className="err-code">404</div>
        <h1 className="reveal-up">Page not found</h1>
        <p className="reveal-up reveal-delay-2">Sorry, the page you are looking for does not exist. It may have been moved, renamed, or the URL may be incorrect.</p>
        <Link to="/" className="btn-home reveal-up reveal-delay-3">Back to Homepage</Link>
      </div>
    </BaseLayout>
  );
}
