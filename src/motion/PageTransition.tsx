import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { prefersReducedMotion } from './springConfig';
import { trackMediaProgress } from './trackMediaProgress';
import '@/styles/components/page-transition.css';

type Phase = 'idle' | 'hiding' | 'waiting' | 'loading' | 'showing';

const HIDE_S = 0.9;
const SHOW_S = 0.9;
const FADE_IN_S = 0.32;
const FADE_OUT_S = 0.38;

function expoInOut(t: number) {
  if (t === 0 || t === 1) return t;
  const x = t * 2;
  if (x < 1) return 0.5 * 1024 ** (x - 1);
  return 0.5 * (-(2 ** (-10 * (x - 1))) + 2);
}

function pad3(n: number) {
  return String(Math.min(100, Math.max(0, n))).padStart(3, '0');
}

function isInternalNav(anchor: HTMLAnchorElement, from: Location | URL) {
  if (anchor.target === '_blank' || anchor.hasAttribute('download')) return null;
  let url: URL;
  try {
    url = new URL(anchor.href, from.href);
  } catch {
    return null;
  }
  if (url.origin !== from.origin) return null;
  if (url.pathname === from.pathname && url.search === from.search) return null;
  if (url.pathname.startsWith('/backend')) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

function RollingDigits({ value }: { value: number }) {
  const digits = pad3(value).split('');
  return (
    <div className="page-transition__counter" aria-hidden="true">
      {digits.map((d, i) => (
        <span key={i} className="page-transition__digit">
          <span
            className="page-transition__digit-strip"
            style={{ transform: `translate3d(0, ${-Number(d)}em, 0)` }}
          >
            {Array.from({ length: 10 }, (_, n) => (
              <span key={n}>{n}</span>
            ))}
          </span>
        </span>
      ))}
    </div>
  );
}

/**
 * Route transition: fade in, cover with a rotating mark, wait on real media,
 * then reverse the mark and fade out.
 */
export default function PageTransition() {
  const navigate = useNavigate();
  const location = useLocation();
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<Phase>('idle');
  const pendingHref = useRef<string | null>(null);
  const pendingExternal = useRef(false);
  const ratios = useRef({ hide: 0, show: 1 });
  const skip = useRef(prefersReducedMotion());
  const tweenRef = useRef<gsap.core.Tween | gsap.core.Timeline | null>(null);
  const stopTrack = useRef<(() => void) | null>(null);
  const watchdog = useRef<number | null>(null);
  const [percent, setPercent] = useState(0);
  const [counting, setCounting] = useState(false);

  const sizeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth + 2;
    const h = window.innerHeight + 2;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  };

  const paint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (phaseRef.current === 'idle') return;

    const hide = ratios.current.hide;
    const show = ratios.current.show;
    const active = Math.min(1 - show, hide);

    const dpr = canvas.width / (window.innerWidth + 2);
    const vw = window.innerWidth + 2;
    const vh = window.innerHeight + 2;
    const unit = Math.max(8, Math.min(42, vw / 30));
    const diag = Math.hypot(vw, vh) / unit;
    const f = expoInOut(1 - Math.max(0, Math.min(1, active)));
    const scale = (1 + f * diag) * unit;
    const turningIn = show === 0;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, vw, vh);

    ctx.save();
    ctx.translate(vw * 0.5, vh * 0.5);
    ctx.rotate(f * (turningIn ? -1 : 1));
    ctx.translate(unit * f * diag, -unit * 0.5 * f * diag);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#fff';
    ctx.fillRect(-2, -0.32, 4, 0.64);
    ctx.fillRect(-0.32, -2, 0.64, 4);
    ctx.restore();
  };

  const setIdle = () => {
    phaseRef.current = 'idle';
    ratios.current = { hide: 0, show: 1 };
    pendingHref.current = null;
    pendingExternal.current = false;
    if (watchdog.current !== null) {
      window.clearTimeout(watchdog.current);
      watchdog.current = null;
    }
    stopTrack.current?.();
    stopTrack.current = null;
    setCounting(false);
    setPercent(0);
    document.documentElement.classList.remove('is-page-transitioning');
    const root = rootRef.current;
    if (root) {
      gsap.set(root, { autoAlpha: 0 });
    }
  };

  const startShow = () => {
    if (phaseRef.current !== 'loading' && phaseRef.current !== 'waiting') return;
    phaseRef.current = 'showing';
    setCounting(false);
    ratios.current.hide = 1;
    ratios.current.show = 0;
    paint();

    const root = rootRef.current;
    tweenRef.current?.kill();
    const tl = gsap.timeline({
      onComplete: setIdle,
    });
    tl.to(
      ratios.current,
      {
        show: 1,
        duration: SHOW_S,
        ease: 'none',
        onUpdate: paint,
      },
      0,
    );
    tl.to(
      root,
      { autoAlpha: 0, duration: FADE_OUT_S, ease: 'power2.out' },
      Math.max(0, SHOW_S - FADE_OUT_S),
    );
    tweenRef.current = tl;
  };

  /**
   * External destination (Labs): keep the black cover up, run the counter to
   * 100, then hand the tab to the new origin while the screen is still black.
   * A reveal would only uncover the page we are leaving.
   */
  const startExternalLoad = (href: string) => {
    phaseRef.current = 'loading';
    setCounting(true);
    setPercent(0);
    const counter = { value: 0 };
    tweenRef.current?.kill();
    tweenRef.current = gsap
      .timeline({
        onComplete: () => {
          pendingHref.current = null;
          pendingExternal.current = false;
          window.location.assign(href);
        },
      })
      .to(
        counter,
        {
          value: 100,
          duration: 0.75,
          ease: 'none',
          onUpdate: () => setPercent(Math.floor(counter.value)),
        },
        0,
      )
      // Let 100 settle and read for a beat before the tab leaves.
      .to({}, { duration: 0.26 }, 0.75);
  };

  useEffect(() => {
    if (skip.current) return;
    sizeCanvas();
    const onResize = () => {
      sizeCanvas();
      paint();
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      tweenRef.current?.kill();
      stopTrack.current?.();
    };
  }, []);

  useEffect(() => {
    if (skip.current) return;

    const onClick = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (phaseRef.current !== 'idle') return;

      const anchor = (e.target as HTMLElement)?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const internalHref = isInternalNav(anchor, window.location);
      const externalHref =
        !internalHref &&
        anchor.hasAttribute('data-page-transition') &&
        anchor.target !== '_blank' &&
        !anchor.hasAttribute('download')
          ? anchor.href
          : null;
      const href = internalHref ?? externalHref;
      if (!href) return;
      const external = !internalHref;

      e.preventDefault();
      e.stopPropagation();

      // GSAP runs on requestAnimationFrame, which browsers pause in a
      // background tab. The cover timeline would never reach onComplete, so
      // navigate() would never fire and the phase would stay stuck — leaving
      // every later link click to fall through to a full page reload. Nothing
      // is visible to animate here anyway, so just go.
      if (document.hidden) {
        setIdle();
        if (external) window.location.assign(href);
        else navigate(href);
        return;
      }
      pendingHref.current = href;
      pendingExternal.current = external;
      phaseRef.current = 'hiding';
      document.documentElement.classList.add('is-page-transitioning');

      // This overlay covers the whole viewport. If anything stalls the sequence
      // — a backgrounded tab pausing GSAP mid-animation, a tween that never
      // completes — the visitor is left staring at a black screen with no way
      // out, and every later link click falls through to a full reload. Force
      // the navigation through rather than ever leaving them stranded.
      if (watchdog.current !== null) window.clearTimeout(watchdog.current);
      watchdog.current = window.setTimeout(() => {
        if (phaseRef.current === 'idle') return;
        const stranded = pendingHref.current;
        const strandedExternal = pendingExternal.current;
        tweenRef.current?.kill();
        setIdle();
        if (stranded) {
          if (strandedExternal) window.location.assign(stranded);
          else navigate(stranded);
        }
      }, 12000);
      ratios.current = { hide: 0, show: 0 };
      setPercent(0);
      setCounting(true);
      sizeCanvas();
      paint();

      const root = rootRef.current;
      tweenRef.current?.kill();
      const tl = gsap.timeline({
        onComplete: () => {
          const next = pendingHref.current;
          if (!next) return;
          if (pendingExternal.current) {
            startExternalLoad(next);
            return;
          }
          pendingHref.current = null;
          phaseRef.current = 'waiting';
          navigate(next);
        },
      });
      gsap.set(root, { autoAlpha: 0 });
      tl.to(root, { autoAlpha: 1, duration: FADE_IN_S, ease: 'power2.out' }, 0);
      tl.to(
        ratios.current,
        {
          hide: 1,
          duration: HIDE_S,
          ease: 'none',
          onUpdate: paint,
        },
        0,
      );
      tweenRef.current = tl;
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [navigate]);

  useEffect(() => {
    if (skip.current) return;
    if (phaseRef.current !== 'waiting') return;

    phaseRef.current = 'loading';
    window.scrollTo(0, 0);
    setPercent(0);

    stopTrack.current?.();
    stopTrack.current = trackMediaProgress({
      getRoot: () => document.getElementById('main-content'),
      onProgress: setPercent,
      onComplete: startShow,
    });

    return () => {
      stopTrack.current?.();
      stopTrack.current = null;
    };
  }, [location.pathname, location.search]);

  if (skip.current) return null;

  return (
    <div
      ref={rootRef}
      className={`page-transition${counting ? ' is-counting' : ''}`}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="page-transition__canvas" />
      <RollingDigits value={percent} />
    </div>
  );
}
