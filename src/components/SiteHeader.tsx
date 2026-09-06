import { useState } from 'react';
import { Link } from 'react-router-dom';
import '@/styles/components/site-header.css';

interface Props {
  currentPath?: string;
}

export default function SiteHeader({ currentPath = '' }: Props) {
  const prefix = '/en';
  const onServices = currentPath.startsWith(`${prefix}/services`);
  const onNews = currentPath.startsWith(`${prefix}/news`);
  const onCulture = currentPath.startsWith(`${prefix}/culture`);
  const onContact = currentPath.startsWith(`${prefix}/contact`);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const links = [
    { href: `${prefix}/services/`, label: 'Services', current: onServices },
    { href: `${prefix}/news/`, label: 'News', current: onNews },
    { href: `${prefix}/culture/`, label: 'Culture & Code', current: onCulture },
    { href: `${prefix}/contact/`, label: 'Contact', current: onContact },
  ] as const;

  return (
    <header className="nav" data-node-id="39:6530">
      <div className="nav__inner">
        <Link to={`${prefix}/`} className="nav__brand">
          <img src="/assets/figma/bluebook-wordmark.png" alt="BLUEBOOK" width={190} height={20} />
        </Link>
        <nav className="nav__links" aria-label="Primary">
          {links.map(({ href, label, current }) => (
            <Link key={href} to={href} aria-current={current ? 'page' : undefined}>{label}</Link>
          ))}
        </nav>
        <button
          className="nav__toggle"
          type="button"
          aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={drawerOpen}
          aria-controls="nav-drawer"
          onClick={() => setDrawerOpen((o) => !o)}
        >
          <span /><span /><span />
        </button>
      </div>
      <nav className="nav__drawer" id="nav-drawer" aria-label="Mobile" hidden={!drawerOpen}>
        {links.map(({ href, label, current }) => (
          <Link key={href} to={href} aria-current={current ? 'page' : undefined} onClick={() => setDrawerOpen(false)}>
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
