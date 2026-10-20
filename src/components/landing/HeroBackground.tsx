import { useEffect, useRef } from 'react';
import { HOME_BOOT_EVENT, isHomeBootComplete } from '@/motion/HomePreloader';

const OPENING_SRC = '/assets/bluebook/Opening.mp4';
const LOOP_SRC = '/assets/bluebook/Tree%20Looping.mp4';

/**
 * Full-bleed hero backdrop.
 * Opening plays once the boot overlay has left. Tree Looping then repeats.
 */
export default function HeroBackground() {
  const openingRef = useRef<HTMLVideoElement>(null);
  const loopRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const opening = openingRef.current;
    const loop = loopRef.current;
    if (!opening || !loop) return;

    let cancelled = false;
    let bootStarted = false;
    let openingReady = opening.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;

    const arm = (video: HTMLVideoElement) => {
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
    };

    arm(opening);
    arm(loop);

    const playLoop = () => {
      if (cancelled) return;
      opening.pause();
      opening.hidden = true;
      loop.hidden = false;
      arm(loop);
      loop.loop = true;
      void loop.play().catch(() => {});
    };

    const playOpening = () => {
      if (cancelled) return;
      arm(opening);
      void opening.play().catch(() => {
        // A browser that blocks the first play() will allow it once a frame exists.
        if (opening.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          arm(opening);
          void opening.play().catch(() => playLoop());
        }
      });
    };

    const onOpeningReady = () => {
      openingReady = true;
      if (bootStarted) playOpening();
    };

    const onBoot = () => {
      if (bootStarted) return;
      bootStarted = true;
      if (openingReady) playOpening();
    };

    opening.addEventListener('loadeddata', onOpeningReady);
    opening.addEventListener('canplay', onOpeningReady);
    opening.addEventListener('ended', playLoop);

    if (isHomeBootComplete()) onBoot();
    else window.addEventListener(HOME_BOOT_EVENT, onBoot);

    return () => {
      cancelled = true;
      opening.removeEventListener('loadeddata', onOpeningReady);
      opening.removeEventListener('canplay', onOpeningReady);
      opening.removeEventListener('ended', playLoop);
      window.removeEventListener(HOME_BOOT_EVENT, onBoot);
      opening.pause();
      loop.pause();
    };
  }, []);

  return (
    <div className="hm-hero-bg" aria-hidden="true">
      <video ref={openingRef} src={OPENING_SRC} muted playsInline preload="auto" />
      <video ref={loopRef} src={LOOP_SRC} muted playsInline preload="auto" hidden />
    </div>
  );
}
