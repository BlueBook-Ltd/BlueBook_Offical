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
 * Hero backdrop. The opening clip stays visible, and it starts only after the
 * boot overlay has left. When it ends, Tree Looping takes over and repeats.
 */
export default function HeroBackground() {
  const openingRef = useRef<HTMLVideoElement>(null);
  const loopRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const opening = openingRef.current;
    const loop = loopRef.current;
    if (!opening || !loop) return;

    arm(opening);
    arm(loop);

    let stopped = false;
    let bootDone = isHomeBootComplete();
    let usingLoop = false;

    const playOpening = () => {
      if (stopped || usingLoop) return;
      arm(opening);
      if (opening.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      void opening.play().catch(() => {});
    };

    const playLoop = () => {
      if (stopped || usingLoop) return;
      usingLoop = true;
      opening.pause();
      opening.classList.remove('is-on');
      loop.classList.add('is-on');
      arm(loop);
      loop.loop = true;
      const start = () => {
        if (stopped) return;
        void loop.play().catch(() => {});
      };
      if (loop.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) start();
      else loop.addEventListener('loadeddata', start, { once: true });
    };

    const onBoot = () => {
      bootDone = true;
      playOpening();
    };

    const onOpeningReady = () => {
      if (bootDone) playOpening();
    };

    opening.addEventListener('loadeddata', onOpeningReady);
    opening.addEventListener('canplay', onOpeningReady);
    opening.addEventListener('ended', playLoop);

    if (bootDone) onBoot();
    else window.addEventListener(HOME_BOOT_EVENT, onBoot);

    // play() can be rejected once and then never retried. Keep asking until
    // the opening clip is actually running, or it has handed off to the loop.
    const retry = window.setInterval(() => {
      if (!bootDone || usingLoop || opening.ended) return;
      if (opening.paused) playOpening();
    }, 400);

    return () => {
      stopped = true;
      window.clearInterval(retry);
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
      <video ref={openingRef} className="is-on" src={OPENING_SRC} muted playsInline preload="auto" />
      <video ref={loopRef} src={LOOP_SRC} muted playsInline preload="auto" />
    </div>
  );
}
