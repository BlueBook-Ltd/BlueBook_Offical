import type { ReactNode } from 'react';
import type { SessionInfo } from '@shared/types';
import type { Route } from '../App';
import { initials } from '../utils';
import {
  ExternalIcon,
  FileTextIcon,
  ImageIcon,
  LogOutIcon,
} from './Icons';

interface Props {
  session: SessionInfo;
  route: Route;
  siteOrigin: string;
  navigate: (path: string) => void;
  onLogout: () => void;
  children: ReactNode;
}

export default function Shell({
  session,
  route,
  siteOrigin,
  navigate,
  onLogout,
  children,
}: Props) {
  const onPosts = route.name === 'posts' || route.name === 'new' || route.name === 'edit';
  const onMedia = route.name === 'media';

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__inner">
          <button type="button" className="brand" onClick={() => navigate('/posts')}>
            <span className="brand__mark" aria-hidden="true">B</span>
            <span className="brand__name">BLUEBOOK</span>
            <span className="brand__tag">CMS</span>
          </button>

          <nav className="nav" aria-label="CMS sections">
            <button
              type="button"
              className={`nav__link${onPosts ? ' is-active' : ''}`}
              onClick={() => navigate('/posts')}
            >
              <FileTextIcon size={16} />
              Posts
            </button>
            <button
              type="button"
              className={`nav__link${onMedia ? ' is-active' : ''}`}
              onClick={() => navigate('/media')}
            >
              <ImageIcon size={16} />
              Media
            </button>
          </nav>

          <div className="topbar__right">
            <a
              className="topbar__site"
              href={siteOrigin}
              target="_blank"
              rel="noopener noreferrer"
            >
              View site
              <ExternalIcon size={14} />
            </a>
            <span className="topbar__divider" aria-hidden="true" />
            <span className="user" title={session.email || 'Token session'}>
              <span className="user__avatar">{initials(session.email)}</span>
              <span className="user__meta">
                <span className="user__name">{session.email || 'Admin token'}</span>
                <span className="user__mode">
                  {session.mode === 'access' ? 'Cloudflare Access' : 'Token session'}
                </span>
              </span>
            </span>
            <button
              type="button"
              className="icon-btn icon-btn--dark"
              onClick={onLogout}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOutIcon size={17} />
            </button>
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
