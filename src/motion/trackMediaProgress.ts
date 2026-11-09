import { isPageContentReady } from './pageReady';

export type TrackMediaHandlers = {
  getRoot: () => HTMLElement | null;
  onProgress: (percent: number) => void;
  onComplete: () => void;
  /** Don't finish before this — keeps the counter readable. */
  minMs?: number;
  /** Finish anyway if a request hangs. */
  safetyMs?: number;
  /** No new media/content and everything ready for this long → done. */
  quietMs?: number;
};

/**
 * True load progress for a mounted page: its content arriving, then images,
 * video and fonts. The value never runs ahead of what has actually finished,
 * and never goes backwards if more appears after the first paint.
 */
export function trackMediaProgress({
  getRoot,
  onProgress,
  onComplete,
  minMs = 320,
  safetyMs = 8000,
  quietMs = 220,
}: TrackMediaHandlers): () => void {
  let raf = 0;
  let shown = 0;
  let settled = false;
  let fontsReady = !document.fonts;
  const started = performance.now();
  let lastChange = started;
  let lastMediaCount = 0;
  let lastSize = -1;
  const timers: number[] = [];
  const seen = new WeakSet<Element>();

  const bindMedia = (root: HTMLElement) => {
    root.querySelectorAll('img').forEach((img) => {
      if (seen.has(img)) return;
      seen.add(img);
      if (img.complete) return;
      const bump = () => {
        lastChange = performance.now();
      };
      img.addEventListener('load', bump, { once: true });
      img.addEventListener('error', bump, { once: true });
    });
    root.querySelectorAll('video').forEach((video) => {
      if (seen.has(video)) return;
      seen.add(video);
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return;
      const bump = () => {
        lastChange = performance.now();
      };
      video.addEventListener('loadeddata', bump, { once: true });
      video.addEventListener('canplay', bump, { once: true });
      video.addEventListener('error', bump, { once: true });
    });
  };

  const inFirstScreen = (el: Element) => {
    const rect = el.getBoundingClientRect();
    return rect.top < window.innerHeight * 1.4;
  };

  const mediaRatio = (root: HTMLElement) => {
    const images = Array.from(root.querySelectorAll('img')).filter((img) => {
      const src = img.currentSrc || img.getAttribute('src') || '';
      if (src.length === 0) return false;
      // Off-screen lazy images never start during a covered transition.
      if (img.loading === 'lazy' && !img.complete && !inFirstScreen(img)) return false;
      return true;
    });
    const videos = Array.from(root.querySelectorAll('video')).filter((video) => {
      // Staged clips (hero sequence) start with preload="none" and no source.
      // They cannot load during the covered transition, so counting them pins
      // the wait to the safety timeout while the hero plays underneath.
      if (video.preload === 'none' && video.readyState === 0) {
        const src = video.currentSrc || video.getAttribute('src') || '';
        if (!src) return false;
      }
      if (video.preload === 'none' && video.readyState === 0 && !inFirstScreen(video)) {
        return false;
      }
      return true;
    });
    const total = images.length + videos.length;
    if (total === 0) return 1;

    let ready = 0;
    for (const img of images) {
      if (img.complete && img.naturalWidth > 0) ready += 1;
    }
    for (const video of videos) {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) ready += 1;
    }
    return ready / total;
  };

  const realProgress = () => {
    const root = getRoot();
    // Route chunks can paint a frame late — don't treat an empty tree as 100%.
    if (!root || root.childElementCount === 0) return 0;
    bindMedia(root);

    // Content still arriving restarts the quiet window, so a shell that fills
    // in later can't be mistaken for a finished page.
    const size = root.querySelectorAll('*').length + (root.textContent?.length ?? 0);
    if (size !== lastSize) {
      lastSize = size;
      lastChange = performance.now();
    }

    const media = mediaRatio(root);
    const count = root.querySelectorAll('img, video').length;
    if (count !== lastMediaCount) {
      lastMediaCount = count;
      lastChange = performance.now();
    }

    let value = media * 88;
    if (fontsReady) value += 12;

    // The page says it is still loading its content. Nothing about the
    // half-built DOM can be trusted to mean "finished" while that is true.
    if (!isPageContentReady()) return Math.min(92, value);
    if (media < 1 || !fontsReady) return Math.min(99, value);
    return 100;
  };

  const finish = () => {
    if (settled) return;
    settled = true;
    shown = 100;
    onProgress(100);
    // Hold the 100 so it reads as finished before the overlay leaves.
    timers.push(window.setTimeout(onComplete, 240));
  };

  const tick = () => {
    if (settled) return;
    const now = performance.now();
    const target = realProgress();
    const step = Math.max(0.25, (target - shown) * 0.14);
    shown = Math.max(shown, Math.min(target, shown + step));
    onProgress(Math.min(99, Math.floor(shown)));

    const quiet = now - lastChange >= quietMs;
    const longEnough = now - started >= minMs;
    const allReady = target >= 100 && shown >= 99.2;

    if (allReady && quiet && longEnough) {
      finish();
      return;
    }
    raf = requestAnimationFrame(tick);
  };

  if (document.fonts?.ready) {
    document.fonts.ready.then(
      () => {
        fontsReady = true;
        lastChange = performance.now();
      },
      () => {
        fontsReady = true;
      },
    );
  } else {
    fontsReady = true;
  }

  // Re-resolved every tick, but observing the root we have now catches early
  // mutations; the tick's own size check covers a root that appears later.
  const root = getRoot();
  const observer =
    root &&
    new MutationObserver(() => {
      lastChange = performance.now();
    });
  observer?.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['src', 'srcset', 'poster'],
  });

  timers.push(window.setTimeout(finish, safetyMs));
  raf = requestAnimationFrame(tick);

  return () => {
    settled = true;
    cancelAnimationFrame(raf);
    observer?.disconnect();
    timers.forEach((id) => window.clearTimeout(id));
  };
}
