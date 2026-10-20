import { useEffect, useRef } from 'react';
import { HOME_BOOT_EVENT, isHomeBootComplete } from '@/motion/HomePreloader';
import { prefersReducedMotion } from '@/motion/springConfig';

const OPENING_SRC = '/assets/bluebook/Opening.mp4';
const LOOP_SRC = '/assets/bluebook/Tree Looping.mp4';

/**
 * Hero backdrop. Opening plays once after the boot overlay has left, then
 * Tree Looping takes over and repeats.
 */
export default function HeroBackground() {
  const openingRef = useRef<HTMLVideoElement>(null);
  const loopRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const opening = openingRef.current;
    const loop = loopRef.current;
    if (!opening || !loop) return;
    if (prefersReducedMotion()) return;

    let cancelled = false;

    const playLoop = () => {
      if (cancelled) return;
      opening.pause();
      opening.hidden = true;
      loop.hidden = false;
      loop.loop = true;
      void loop.play().catch(() => {});
    };

    const playOpening = () => {
      if (cancelled) return;
      opening.hidden = false;
      loop.hidden = true;
      const start = () => {
        if (cancelled) return;
        void opening.play().catch(() => {
          opening.addEventListener(
            'canplay',
            () => void opening.play().catch(() => playLoop()),
            { once: true },
          );
        });
      };
      if (opening.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) start();
      else opening.addEventListener('canplay', start, { once: true });
    };

    opening.addEventListener('ended', playLoop);

    if (isHomeBootComplete()) playOpening();
    else window.addEventListener(HOME_BOOT_EVENT, playOpening, { once: true });

    return () => {
      cancelled = true;
      opening.removeEventListener('ended', playLoop);
      opening.removeEventListener('error', playLoop);
      window.removeEventListener(HOME_BOOT_EVENT, playOpening);
      opening.pause();
      loop.pause();
    };
  }, []);

  return (
    <div className="hm-hero-bg" aria-hidden="true">
      <video
        ref={openingRef}
        src={OPENING_SRC}
        muted
        playsInline
        preload="auto"
      />
      <video
        ref={loopRef}
        src={LOOP_SRC}
        muted
        playsInline
        preload="auto"
        hidden
      />
    </div>
  );
}
