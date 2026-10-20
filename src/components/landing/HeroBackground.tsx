import { useEffect, useRef } from 'react';
import { HOME_BOOT_EVENT, isHomeBootComplete } from '@/motion/HomePreloader';
import { registerHeroSequence, type HeroStep } from '@/motion/heroSequence';

const OPENING_SRC = '/assets/bluebook/Opening.mp4';
const LOOP_SRC = '/assets/bluebook/Tree Looping.mp4';
const NEXT_SRC = '/assets/bluebook/video 2.mp4';
const FADE_MS = 1150;

type Phase = 'boot' | 'loop' | 'out' | 'forward' | 'hold' | 'back';

function arm(video: HTMLVideoElement) {
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
}

/**
 * Hero backdrop.
 * Opening plays once the boot overlay has left. Tree Looping then repeats,
 * and the hero type fades in. The next scroll fades that type out, then
 * plays video 2. Scrolling up runs video 2 backward and fades the type in.
 */
export default function HeroBackground({
  onLoopStart,
  onCopyChange,
}: {
  onLoopStart?: () => void;
  onCopyChange?: (visible: boolean) => void;
}) {
  const openingRef = useRef<HTMLVideoElement>(null);
  const loopRef = useRef<HTMLVideoElement>(null);
  const nextRef = useRef<HTMLVideoElement>(null);
  const onLoopStartRef = useRef(onLoopStart);
  const onCopyChangeRef = useRef(onCopyChange);
  onLoopStartRef.current = onLoopStart;
  onCopyChangeRef.current = onCopyChange;

  useEffect(() => {
    const opening = openingRef.current;
    const loop = loopRef.current;
    const next = nextRef.current;
    if (!opening || !loop || !next) return;

    const hero = opening.closest('.hm-hero');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    arm(opening);
    arm(loop);
    arm(next);
    loop.hidden = true;
    next.hidden = true;

    let stopped = false;
    let bootDone = isHomeBootComplete();
    let usingLoop = false;
    let failed = false;
    let phase: Phase = 'boot';
    let epoch = 0;
    let fadeTimer = 0;
    let reverseRaf = 0;
    let reverseWatch = 0;

    const setPhase = (value: Phase) => {
      phase = value;
      hero?.setAttribute('data-hero-phase', value);
    };

    const setCopy = (visible: boolean) => {
      hero?.classList.toggle('is-looping', visible);
      onCopyChangeRef.current?.(visible);
    };

    const stopReverse = () => {
      if (reverseRaf) cancelAnimationFrame(reverseRaf);
      reverseRaf = 0;
      window.clearTimeout(reverseWatch);
      reverseWatch = 0;
    };

    const showLoop = () => {
      next.pause();
      next.hidden = true;
      opening.hidden = true;
      loop.hidden = false;
      if (loop.paused) void loop.play().catch(() => {});
    };

    const restoreLoop = () => {
      stopReverse();
      showLoop();
      setCopy(true);
      setPhase('loop');
    };

    const revealNext = () => {
      if (stopped || next.videoWidth === 0) return;
      if (phase !== 'forward' && phase !== 'hold' && phase !== 'back') return;
      next.hidden = false;
      opening.hidden = true;
      if (!loop.hidden) {
        loop.pause();
        loop.hidden = true;
      }
    };

    const primeNext = () => {
      if (next.getAttribute('src')) return;
      next.preload = 'auto';
      next.src = encodeURI(NEXT_SRC);
      arm(next);
    };

    const playForward = (resetToStart: boolean, my: number) => {
      if (stopped || my !== epoch || failed) return;
      stopReverse();
      setPhase('forward');
      primeNext();
      arm(next);
      next.loop = false;
      next.playbackRate = 1;

      let started = false;
      const start = () => {
        if (started || stopped || my !== epoch || phase !== 'forward') return;
        if (next.readyState < HTMLMediaElement.HAVE_METADATA) {
          void next.play().catch(() => {});
          return;
        }
        started = true;
        if (resetToStart) next.currentTime = 0;
        void next.play().then(revealNext).catch(() => {});
      };

      if (next.readyState < HTMLMediaElement.HAVE_METADATA) {
        next.addEventListener('loadeddata', start, { once: true });
      }
      start();

      window.setTimeout(() => {
        if (stopped || my !== epoch || phase !== 'forward' || next.videoWidth > 0) return;
        failed = true;
        restoreLoop();
      }, 8000);
    };

    const beginExit = () => {
      const my = ++epoch;
      setPhase('out');
      setCopy(false);
      primeNext();
      window.clearTimeout(fadeTimer);

      const word = hero?.querySelector<HTMLElement>('.hm-word-mask');
      const opacity = word ? Number.parseFloat(getComputedStyle(word).opacity) : 0;
      if (reduce || opacity < 0.04) {
        playForward(true, my);
        return;
      }

      let fired = false;
      const go = () => {
        if (fired) return;
        fired = true;
        word?.removeEventListener('transitionend', onEnd);
        if (stopped || my !== epoch) return;
        playForward(true, my);
      };
      const onEnd = (event: TransitionEvent) => {
        if (event.propertyName !== 'opacity') return;
        go();
      };
      word?.addEventListener('transitionend', onEnd);
      fadeTimer = window.setTimeout(go, FADE_MS + 80);
    };

    const startReverse = () => {
      if (failed || next.videoWidth === 0 || next.currentTime <= 0.05) {
        restoreLoop();
        return;
      }
      const my = ++epoch;
      stopReverse();
      next.pause();
      setPhase('back');
      revealNext();
      const started = performance.now();
      let last = 0;
      let carry = 0;

      const finish = () => {
        if (my !== epoch) return;
        next.currentTime = 0;
        restoreLoop();
      };

      const tick = (now: number) => {
        if (stopped || my !== epoch || phase !== 'back') return;
        if (!last) last = now;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        carry += dt;
        if (next.seeking) {
          reverseRaf = requestAnimationFrame(tick);
          return;
        }
        const target = next.currentTime - carry;
        carry = 0;
        if (target <= 0.04) {
          finish();
          return;
        }
        next.currentTime = target;
        reverseRaf = requestAnimationFrame(tick);
      };

      reverseRaf = requestAnimationFrame(tick);
      const limit = (Number.isFinite(next.duration) ? next.duration : 8) * 1000 + 1500;
      reverseWatch = window.setTimeout(() => {
        if (my === epoch && phase === 'back') finish();
      }, Math.max(1500, limit - (performance.now() - started)));
    };

    const resumeForward = () => {
      const my = ++epoch;
      stopReverse();
      if (next.currentTime <= 0.05 || next.videoWidth === 0) {
        playForward(true, my);
        return;
      }
      setPhase('forward');
      arm(next);
      next.playbackRate = 1;
      void next.play().then(revealNext).catch(() => {});
    };

    const onEnded = () => {
      if (phase !== 'forward') return;
      next.pause();
      revealNext();
      setPhase('hold');
    };

    const onError = () => {
      failed = true;
      epoch += 1;
      stopReverse();
      window.clearTimeout(fadeTimer);
      if (phase === 'boot' || phase === 'loop') return;
      restoreLoop();
    };

    next.addEventListener('ended', onEnded);
    next.addEventListener('error', onError);
    next.addEventListener('playing', revealNext);

    const onStep = (direction: HeroStep) => {
      if (stopped) return false;
      if (direction > 0) {
        if (failed) return false;
        if (phase === 'loop') {
          beginExit();
          return true;
        }
        if (phase === 'out' || phase === 'forward') return true;
        if (phase === 'back') {
          resumeForward();
          return true;
        }
        return false;
      }
      if (phase === 'loop' || phase === 'boot') return false;
      if (phase === 'out') {
        epoch += 1;
        window.clearTimeout(fadeTimer);
        restoreLoop();
        return true;
      }
      if (phase === 'forward' || phase === 'hold' || phase === 'back') {
        if (phase !== 'back') startReverse();
        return true;
      }
      return false;
    };

    const onLeave = () => {
      epoch += 1;
      stopReverse();
      window.clearTimeout(fadeTimer);
      next.pause();
      setPhase('hold');
    };

    const onReturn = () => {
      epoch += 1;
      stopReverse();
      window.clearTimeout(fadeTimer);
      setCopy(false);
      primeNext();
      const showEnd = () => {
        if (stopped) return;
        if (next.videoWidth === 0 || !Number.isFinite(next.duration) || next.duration <= 0) {
          restoreLoop();
          return;
        }
        setPhase('hold');
        next.currentTime = Math.max(0, next.duration - 0.05);
        next.pause();
        revealNext();
      };
      if (next.readyState >= HTMLMediaElement.HAVE_METADATA) showEnd();
      else next.addEventListener('loadedmetadata', showEnd, { once: true });
    };

    const unregister = registerHeroSequence({ onStep, onLeave, onReturn });

    const playOpening = () => {
      if (stopped || usingLoop) return;
      arm(opening);
      if (opening.ended) return;
      void opening.play().catch(() => {});
    };

    const primeLoop = () => {
      if (loop.getAttribute('src')) return;
      loop.preload = 'auto';
      loop.src = encodeURI(LOOP_SRC);
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
        if (phase === 'forward' || phase === 'hold' || phase === 'back') return;
        loop.hidden = false;
        if (phase !== 'boot') return;
        setPhase('loop');
        setCopy(true);
        onLoopStartRef.current?.();
      };

      const start = () => {
        if (stopped) return;
        arm(loop);
        void loop.play().then(reveal).catch(() => {});
      };

      if (loop.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && loop.videoWidth > 0) start();
      else loop.addEventListener('loadeddata', start, { once: true });
      start();
    };

    const onBoot = () => {
      bootDone = true;
      playOpening();
    };

    const onCanPlay = () => {
      if (bootDone) playOpening();
    };

    const onTime = () => {
      if (!opening.duration) return;
      if (opening.duration - opening.currentTime < 1.2) primeLoop();
    };

    opening.addEventListener('canplay', onCanPlay);
    opening.addEventListener('timeupdate', onTime);
    opening.addEventListener('ended', playLoop);

    if (bootDone) onBoot();
    else window.addEventListener(HOME_BOOT_EVENT, onBoot);

    const retry = window.setInterval(() => {
      if (!bootDone || usingLoop || opening.ended || !opening.paused) return;
      playOpening();
    }, 500);

    return () => {
      stopped = true;
      epoch += 1;
      stopReverse();
      window.clearTimeout(fadeTimer);
      window.clearInterval(retry);
      unregister();
      opening.removeEventListener('canplay', onCanPlay);
      opening.removeEventListener('timeupdate', onTime);
      opening.removeEventListener('ended', playLoop);
      next.removeEventListener('ended', onEnded);
      next.removeEventListener('error', onError);
      next.removeEventListener('playing', revealNext);
      window.removeEventListener(HOME_BOOT_EVENT, onBoot);
      opening.pause();
      loop.pause();
      next.pause();
    };
  }, []);

  return (
    <div className="hm-hero-bg" aria-hidden="true">
      <video ref={openingRef} src={OPENING_SRC} muted playsInline preload="auto" />
      <video ref={loopRef} muted playsInline preload="none" hidden />
      <video ref={nextRef} muted playsInline preload="none" hidden />
    </div>
  );
}
