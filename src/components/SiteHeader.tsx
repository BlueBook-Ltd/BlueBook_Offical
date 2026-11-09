import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMagneticHover } from '@/motion/useMagneticHover';
import '@/styles/components/site-header.css';

interface Props {
  currentPath?: string;
}

function FlipLabel({ text }: { text: string }) {
  return (
    <span className="site-nav__flip">
      <span className="site-nav__flip-face site-nav__flip-face--a">{text}</span>
      <span className="site-nav__flip-face site-nav__flip-face--b" aria-hidden="true">
        {text}
      </span>
    </span>
  );
}

export default function SiteHeader({ currentPath = '' }: Props) {
  const prefix = '/en';
  const onNews = currentPath.startsWith(`${prefix}/news`);
  const onCulture = currentPath.startsWith(`${prefix}/culture`);
  const onContact = currentPath.startsWith(`${prefix}/contact`);
  const [menuOpen, setMenuOpen] = useState(false);

  const chatBtnRef = useRef<HTMLAnchorElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  useMagneticHover([chatBtnRef, menuBtnRef], { strength: 0.34, padding: 16 });

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      const panel = document.getElementById('nav-menu-panel');
      if (panel && !panel.contains(e.target as Node) && !menuBtnRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [menuOpen]);

  const links = [
    { href: `${prefix}/`, label: 'Home', current: currentPath === `${prefix}/` || currentPath === `${prefix}` },
    { href: `${prefix}/news/`, label: 'News', current: onNews },
    { href: `${prefix}/culture/`, label: 'Culture', current: onCulture },
    { href: `${prefix}/contact/`, label: 'Contact', current: onContact },
  ] as const;

  return (
    <header className="site-nav" data-node-id="647:6">
      <div className="site-nav__inner">
        <Link to={`${prefix}/`} className="site-nav__brand">
          <img
            src="/assets/figma/bluebook-wordmark.png"
            alt="BLUEBOOK"
            width={320}
            height={33}
          />
        </Link>

        <div className="site-nav__actions">
          <Link
            ref={chatBtnRef}
            className="site-nav__btn site-nav__btn--dark site-nav__chat"
            to={`${prefix}/contact/`}
          >
            <span className="site-nav__chat-inner">
              <span className="site-nav__chat-arrow" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M2.343 8h11.314m0 0-4.984 4.984M13.657 8 8.673 3.016"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="site-nav__chat-label">Chat With Us</span>
              <span className="site-nav__chat-dots" aria-hidden="true">
                <span className="site-nav__dot" />
              </span>
            </span>
          </Link>

          <div className="site-nav__menu-wrap">
            <button
              ref={menuBtnRef}
              className={`site-nav__btn site-nav__btn--light site-nav__menu${menuOpen ? ' is-open' : ''}`}
              type="button"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="nav-menu-panel"
              onClick={() => setMenuOpen((o) => !o)}
            >
              <span className="site-nav__menu-inner">
                <span className="site-nav__menu-label">
                  <span className="site-nav__menu-face site-nav__menu-face--menu">Menu</span>
                  <span className="site-nav__menu-face site-nav__menu-face--close">Close</span>
                </span>
                <span className="site-nav__menu-dots" aria-hidden="true">
                  <span className="site-nav__dot" />
                  <span className="site-nav__dot" />
                </span>
              </span>
            </button>

            <div id="nav-menu-panel" className={`site-nav__flyout${menuOpen ? ' is-open' : ''}`}>
              <nav className="site-nav__panel" aria-label="Primary" aria-hidden={!menuOpen}>
                {links.map(({ href, label, current }, i) => (
                  <Link
                    key={href}
                    to={href}
                    className="site-nav__link"
                    aria-current={current ? 'page' : undefined}
                    onClick={() => setMenuOpen(false)}
                    style={{ transitionDelay: menuOpen ? `${60 + i * 45}ms` : '0ms' }}
                    tabIndex={menuOpen ? 0 : -1}
                  >
                    <FlipLabel text={label} />
                  </Link>
                ))}
              </nav>

              <a
                href="https://labs.bluebook.blue/"
                className="site-nav__labs"
                data-page-transition
                style={{ transitionDelay: menuOpen ? `${60 + links.length * 45}ms` : '0ms' }}
                tabIndex={menuOpen ? 0 : -1}
                onClick={() => setMenuOpen(false)}
              >
                <span>Labs</span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M3.5 8h9M8.5 3.5 13 8l-4.5 4.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
