import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from './springConfig';
import '@/styles/components/home-preloader.css';

type Phase = 'loading' | 'leaving' | 'done';

let bootComplete = false;

export const HOME_BOOT_EVENT = 'bb-home-boot-done';

export function isHomeBootComplete() {
  return bootComplete;
}

function finishBoot() {
  bootComplete = true;
  window.dispatchEvent(new Event(HOME_BOOT_EVENT));
}

const STREAM_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function pad3(n: number) {
  return String(Math.min(100, Math.max(0, n))).padStart(3, '0');
}

function streamChunk(seed: number, length: number) {
  let out = '';
  let value = (seed * 1103515245 + 12345) >>> 0;
  for (let i = 0; i < length; i += 1) {
    value = (value * 1664525 + 1013904223) >>> 0;
    out += STREAM_CHARS[value % STREAM_CHARS.length];
  }
  return out;
}

function streamLines(percent: number) {
  const seed = Math.max(1, percent) * 97;
  return [streamChunk(seed, 52), streamChunk(seed + 17, 52)] as const;
}

function PreloaderRail() {
  return (
    <div className="home-preloader__rail" aria-hidden="true">
      <span className="home-preloader__rail-line" />
      <span className="home-preloader__rail-gap" />
      <span className="home-preloader__rail-line" />
    </div>
  );
}

/** Media dominates, because that is what the visitor actually waits to see. */
const WEIGHT = { dom: 10, fonts: 10, media: 60, load: 20 };

/**
 * React mounts content in bursts. Once everything tracked has settled we still
 * wait this long for the DOM to stop producing new media before calling it done.
 */
const MEDIA_QUIET_MS = 300;

/** A hung or very slow asset must not trap the visitor behind a black screen. */
const SAFETY_MS = 12000;

/** Beat on a full 100 so it reads as finished before the overlay leaves. */
const HOLD_MS = 260;

/**
 * Boot overlay — black field with a centered HUD loading frame (label, framed
 * progress bar, percent readout, and a scrambling data stream).
 *
 * Progress reaches 100 only once the page's media has genuinely loaded:
 * every eager image decoded, every video's first frame ready, every inline
 * background image fetched, plus fonts and the window load event. Images marked
 * loading="lazy" are excluded by design — the browser will not fetch them until
 * they near the viewport, so the page cannot wait on them.
 *
 * window.load alone is not enough here. This is a single-page app, so the load
 * event fires when the HTML shell is done — before React has mounted the hero
 * and requested any of its images.
 */
export default function HomePreloader() {
  const [phase, setPhase] = useState<Phase>(() => (bootComplete ? 'done' : 'loading'));
  const [percent, setPercent] = useState(0);
  const reduce = useRef(prefersReducedMotion());

  /**
   * The exit timers live outside the main effect on purpose. Setting phase to
   * 'leaving' changes that effect's dependency, so React runs its cleanup — and
   * if these were in the effect's own timer list, that cleanup would cancel the
   * timeout that unmounts the overlay, leaving it on screen forever.
   */
  const leaveTimers = useRef<number[]>([]);

  useEffect(
    () => () => {
      leaveTimers.current.forEach((id) => window.clearTimeout(id));
    },
    [],
  );

  useEffect(() => {
    // Only the loading phase drives the counter. Without this guard the effect
    // re-runs when phase flips to 'leaving' and restarts the count from zero,
    // so the number keeps rolling after it has already reached 100.
    if (phase !== 'loading' || bootComplete) return;

    if (reduce.current) {
      finishBoot();
      setPercent(100);
      setPhase('done');
      return;
    }

    let raf = 0;
    let shown = 0;
    let settled = false;
    let forced = false;
    const timers: number[] = [];
    const done = { dom: false, fonts: false, load: false };

    // ── Media tracking ──────────────────────────────────────────────────────
    let total = 0;
    let ready = 0;
    let lastPendingAt = performance.now();
    const seenNodes = new WeakSet<Element>();
    const seenUrls = new Set<string>();

    const markReady = () => {
      ready += 1;
    };

    /** Anything still downloading pushes the quiet window out. */
    const markPending = () => {
      lastPendingAt = performance.now();
    };

    const trackImage = (img: HTMLImageElement) => {
      if (seenNodes.has(img)) return;
      if (!img.currentSrc && !img.getAttribute('src')) return;
      // loading="lazy" is the page declaring this image is not needed for the
      // first view. The browser defers the request until the image nears the
      // viewport, so waiting on one blocks until the safety timeout — measured
      // on the homepage, 12 of these never resolved and pinned the counter at
      // 99. Deferred media is deliberately out of scope for the preloader.
      if (img.loading === 'lazy') return;

      seenNodes.add(img);
      total += 1;
      if (img.complete) {
        ready += 1;
        return;
      }
      markPending();
      // A broken file counts as settled — a 404 must not hold the page hostage.
      img.addEventListener('load', markReady, { once: true });
      img.addEventListener('error', markReady, { once: true });
    };

    const trackVideo = (video: HTMLVideoElement) => {
      // Only Opening (and any other intentionally eager clip) should block boot.
      // preload="none", missing src, or deferred pipeline videos are out of scope.
      if (seenNodes.has(video) || video.preload === 'none') return;
      if (!video.currentSrc && !video.getAttribute('src')) return;

      seenNodes.add(video);
      total += 1;
      // HAVE_CURRENT_DATA: the first frame is decoded, which is what "loaded"
      // means for a poster-style video. Waiting for the whole file would be
      // minutes on a large clip.
      if (video.readyState >= 2) {
        ready += 1;
        return;
      }
      markPending();
      video.addEventListener('loadeddata', markReady, { once: true });
      video.addEventListener('error', markReady, { once: true });
    };

    /** Inline background-image urls — invisible to document.images. */
    const trackBackground = (el: HTMLElement) => {
      const raw = el.style?.backgroundImage;
      if (!raw || raw === 'none') return;

      for (const match of raw.matchAll(/url\((['"]?)(.*?)\1\)/g)) {
        const url = match[2];
        if (!url || url.startsWith('data:') || seenUrls.has(url)) continue;
        seenUrls.add(url);
        total += 1;
        markPending();
        const probe = new Image();
        probe.addEventListener('load', markReady, { once: true });
        probe.addEventListener('error', markReady, { once: true });
        probe.src = url;
      }
    };

    const inspect = (el: Element) => {
      if (el.tagName === 'IMG') trackImage(el as HTMLImageElement);
      else if (el.tagName === 'VIDEO') trackVideo(el as HTMLVideoElement);
      if (el instanceof HTMLElement && el.style?.backgroundImage) trackBackground(el);
    };

    const scan = (root: ParentNode) => {
      if (root instanceof Element) inspect(root);
      root.querySelectorAll?.('img, video, [style*="background-image"]').forEach(inspect);
    };

    // React mounts most of the page after the load event, so new media has to be
    // picked up as it appears rather than counted once up front.
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (node.nodeType === 1) scan(node as Element);
        });
      }
    });

    const mediaProgress = () => {
      if (!done.dom) return 0; // too early to know what the page even wants
      return total === 0 ? 1 : ready / total;
    };

    const mediaSettled = () =>
      ready >= total && performance.now() - lastPendingAt > MEDIA_QUIET_MS;

    /** What has genuinely finished, as a percentage. */
    const realProgress = () => {
      if (forced) return 100;

      const everythingReady = done.dom && done.fonts && done.load && mediaSettled();
      if (everythingReady) return 100;

      let value = 0;
      if (done.dom) value += WEIGHT.dom;
      if (done.fonts) value += WEIGHT.fonts;
      if (done.load) value += WEIGHT.load;
      value += WEIGHT.media * mediaProgress();
      // Never show a full 100 while anything is still outstanding.
      return Math.min(99, value);
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      setPercent(100); // final value — nothing writes to it after this
      leaveTimers.current.push(
        window.setTimeout(() => {
          setPhase('leaving');
          leaveTimers.current.push(
            window.setTimeout(() => {
              finishBoot();
              setPhase('done');
            }, 720),
          );
        }, HOLD_MS),
      );
    };

    /**
     * Browsers pause requestAnimationFrame in a background tab. Falling back to
     * a timer there keeps the overlay from sitting frozen at 000 over the page
     * until the visitor happens to look at it.
     */
    const scheduleTick = () => {
      if (document.hidden) timers.push(window.setTimeout(tick, 100));
      else raf = requestAnimationFrame(tick);
    };

    function tick() {
      const target = realProgress();
      // Nobody is watching a hidden tab, so close the gap instead of easing.
      const step = document.hidden
        ? Math.max(target - shown, 1)
        : Math.max(0.3, (target - shown) * 0.12);
      // Math.max keeps it monotonic: as React mounts more media the target can
      // dip, and a counter that counts backwards looks broken.
      shown = Math.max(shown, Math.min(target, shown + step));

      const next = Math.floor(shown);
      setPercent(next);

      // realProgress only returns 100 when everything has actually loaded.
      if (next >= 100) {
        finish();
        return;
      }
      scheduleTick();
    }

    const markDom = () => {
      done.dom = true;
      scan(document.body);
    };
    const markLoad = () => {
      done.load = true;
      scan(document.body);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', markDom, { once: true });
    } else {
      markDom();
    }

    if (document.readyState === 'complete') {
      done.load = true;
    } else {
      window.addEventListener('load', markLoad, { once: true });
    }

    if (document.fonts?.ready) {
      document.fonts.ready.then(
        () => {
          done.fonts = true;
        },
        () => {
          done.fonts = true;
        },
      );
    } else {
      done.fonts = true;
    }

    timers.push(
      window.setTimeout(() => {
        forced = true;
      }, SAFETY_MS),
    );

    // Coming back to the tab should resume the smooth loop immediately.
    const onVisibility = () => {
      if (!document.hidden && !settled) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    observer.observe(document.documentElement, { childList: true, subtree: true });
    scan(document.body);
    scheduleTick();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      timers.forEach((id) => window.clearTimeout(id));
      document.removeEventListener('DOMContentLoaded', markDom);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('load', markLoad);
    };
  }, [phase]);

  if (phase === 'done') return null;

  const [streamA, streamB] = streamLines(percent);

  return (
    <div
      className={`home-preloader${phase === 'leaving' ? ' is-leaving' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy={phase === 'loading'}
      aria-label={`Loading ${percent}%`}
    >
      <div className="home-preloader__stage">
        <p className="home-preloader__label">LOADING</p>
        <PreloaderRail />
        <div className="home-preloader__track" aria-hidden="true">
          <span className="home-preloader__bar-fill" style={{ width: `${Math.max(percent, 2)}%` }} />
        </div>
        <PreloaderRail />
        <p className="home-preloader__percent" aria-hidden="true">
          {pad3(percent)}
          <span className="home-preloader__percent-unit">%</span>
        </p>
        <div className="home-preloader__stream" aria-hidden="true">
          <span>{streamA}</span>
          <span>{streamB}</span>
        </div>
      </div>
    </div>
  );
}
