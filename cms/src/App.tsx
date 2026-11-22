import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionInfo } from '@shared/types';
import * as api from './api';
import { ApiError } from './api';
import Login from './components/Login';
import Shell from './components/Shell';
import PostList from './components/PostList';
import PostEditor from './components/PostEditor';
import MediaLibrary from './components/MediaLibrary';
import ToastStack, { type ToastItem, type ToastTone } from './components/Toast';

export type Route =
  | { name: 'posts' }
  | { name: 'new' }
  | { name: 'edit'; slug: string }
  | { name: 'media' };

function parseHash(): Route {
  const path = (window.location.hash.replace(/^#/, '') || '/posts').replace(/\/+$/, '');
  if (path === '/media') return { name: 'media' };
  if (path === '/posts/new') return { name: 'new' };
  const match = /^\/posts\/([^/]+)$/.exec(path);
  if (match) {
    try {
      return { name: 'edit', slug: decodeURIComponent(match[1]) };
    } catch {
      return { name: 'posts' };
    }
  }
  return { name: 'posts' };
}

function useHashRoute(): [Route, (path: string) => void] {
  const [route, setRoute] = useState<Route>(parseHash);

  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((path: string) => {
    const target = path.startsWith('#') ? path : `#${path}`;
    if (window.location.hash === target) {
      setRoute(parseHash());
      return;
    }
    window.location.hash = path;
  }, []);

  return [route, navigate];
}

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-screen__brand">
        <span className="brand__mark" aria-hidden="true">B</span>
        <span className="brand__name">BLUEBOOK</span>
        <span className="brand__tag">CMS</span>
      </div>
      <span className="spinner" aria-label="Loading" />
    </div>
  );
}

export default function App() {
  const siteOrigin = import.meta.env.VITE_SITE_ORIGIN || 'https://www.bluebook.blue';
  const [route, navigate] = useHashRoute();
  const [token, setToken] = useState<string>(() => api.readStoredToken());
  const [session, setSession] = useState<SessionInfo | null | undefined>(undefined);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);

  const notify = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const setDirtyState = useCallback((value: boolean) => {
    dirtyRef.current = value;
    setDirty(value);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .getSession(token)
      .then((nextSession) => {
        if (!cancelled) setSession(nextSession);
      })
      .catch(() => {
        if (cancelled) return;
        api.clearStoredToken();
        setSession(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    dirtyRef.current = false;
    setDirty(false);
  }, [route]);

  const handleUnauthorized = useCallback(() => {
    api.clearStoredToken();
    setToken('');
    setSession(null);
    notify('Session expired. Sign in again.', 'error');
  }, [notify]);

  const handleApiError = useCallback(
    (err: unknown, fallback = 'Something went wrong.') => {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          handleUnauthorized();
          return;
        }
        notify(err.message || fallback, 'error');
        return;
      }
      notify(fallback, 'error');
    },
    [handleUnauthorized, notify],
  );

  const guardNavigate = useCallback(
    (path: string) => {
      if (dirtyRef.current && !window.confirm('Discard unsaved changes?')) return;
      dirtyRef.current = false;
      setDirty(false);
      navigate(path);
    },
    [navigate],
  );

  async function handleLogin(value: string) {
    const nextSession = await api.getSession(value);
    api.storeToken(value);
    setToken(value);
    setSession(nextSession);
  }

  function handleLogout() {
    if (session?.mode === 'access') {
      window.location.assign('/cdn-cgi/access/logout');
      return;
    }
    api.clearStoredToken();
    setToken('');
    setSession(null);
  }

  if (session === undefined) return <LoadingScreen />;

  if (session === null) {
    return (
      <>
        <Login onSubmit={handleLogin} />
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  let content;
  if (route.name === 'posts') {
    content = (
      <PostList
        token={token}
        siteOrigin={siteOrigin}
        navigate={guardNavigate}
        notify={notify}
        onError={handleApiError}
      />
    );
  } else if (route.name === 'media') {
    content = (
      <MediaLibrary token={token} notify={notify} onError={handleApiError} />
    );
  } else {
    const slug = route.name === 'edit' ? route.slug : null;
    content = (
      <PostEditor
        key={slug || 'new'}
        token={token}
        slug={slug}
        siteOrigin={siteOrigin}
        navigate={guardNavigate}
        notify={notify}
        onError={handleApiError}
        onDirtyChange={setDirtyState}
      />
    );
  }

  return (
    <>
      <Shell
        session={session}
        route={route}
        siteOrigin={siteOrigin}
        navigate={guardNavigate}
        onLogout={handleLogout}
      >
        {content}
      </Shell>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      {dirty && <span className="sr-only" aria-live="polite">You have unsaved changes.</span>}
    </>
  );
}
