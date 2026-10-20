import { useEffect, useRef } from 'react';
import { HOME_BOOT_EVENT, isHomeBootComplete } from '@/motion/HomePreloader';

const OPENING_SRC = '/assets/bluebook/Opening.mp4';
const LOOP_SRC = '/assets/bluebook/Tree%20Looping.mp4';

function arm(video: HTMLVideoElement) {
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
}

/**
 * Hero backdrop.
 * Opening is the only visible clip until it finishes. It starts after the
 * boot overlay has left. Tree Looping then replaces it and repeats.
 */
export default function HeroBackground({ onLoopStart }: { onLoopStart?: () => void }) {
  const openingRef = useRef<HTMLVideoElement>(null);
  const loopRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const opening = openingRef.current;
    const loop = loopRef.current;
    if (!opening || !loop) return;

    arm(opening);
    arm(loop);
    loop.hidden = true;

    let stopped = false;
    let bootDone = isHomeBootComplete();
    let usingLoop = false;

    const playOpening = () => {
      if (stopped || usingLoop) return;
      arm(opening);
      if (opening.ended) return;
      void opening.play().catch(() => {});
    };

    const primeLoop = () => {
      if (loop.getAttribute('src')) return;
      loop.preload = 'auto';
      loop.src = encodeURI('/assets/bluebook/Tree Looping.mp4');
    };

    const playLoop = () => {
      if (stopped || usingLoop) return;
      usingLoop = true;
      primeLoop();
      arm(loop);
      loop.loop = true;

      const reveal = () => {
        if (stopped || loop.videoWidth === 0) return;
        opening.pause();
        opening.hidden = true;
        loop.hidden = false;
        onLoopStart?.();
      };

      const start = () => {
        if (stopped) return;
        arm(loop);
        void loop.play().then(reveal).catch(() => {});
      };

      if (loop.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && loop.videoWidth > 0) start();
      else {
        loop.addEventListener('loadeddata', start, { once: true });
        start();
      }
    };

    const onBoot = () => {
      bootDone = true;
      playOpening();
    };

    opening.addEventListener('canplay', () => {
      if (bootDone) playOpening();
    });
    opening.addEventListener('timeupdate', () => {
      if (!opening.duration) return;
      if (opening.duration - opening.currentTime < 1.2) primeLoop();
    });
    opening.addEventListener('ended', playLoop);

    if (bootDone) onBoot();
    else window.addEventListener(HOME_BOOT_EVENT, onBoot);

    const retry = window.setInterval(() => {
      if (!bootDone || usingLoop || opening.ended || !opening.paused) return;
      playOpening();
    }, 500);

    return () => {
      stopped = true;
      window.clearInterval(retry);
      opening.removeEventListener('ended', playLoop);
      window.removeEventListener(HOME_BOOT_EVENT, onBoot);
      opening.pause();
      loop.pause();
    };
  }, []);

  return (
    <div className="hm-hero-bg" aria-hidden="true">
      <video ref={openingRef} src={OPENING_SRC} muted playsInline preload="auto" />
      <video ref={loopRef} muted playsInline preload="none" hidden />
    </div>
  );
}
