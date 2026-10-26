import { useEffect, useRef } from 'react';
import { HOME_BOOT_EVENT, isHomeBootComplete } from '@/motion/HomePreloader';
import { registerHeroSequence, type HeroStep } from '@/motion/heroSequence';

const OPENING_SRC = '/assets/bluebook/Opening.mp4';
const LOOP_SRC = '/assets/bluebook/Tree Looping.mp4';
const NEXT_SRC = '/assets/bluebook/video 2.mp4';
const SHARD_SRC = '/assets/bluebook/shard_looping.mp4';
const FADE_MS = 1150;

type Phase = 'boot' | 'loop' | 'out' | 'forward' | 'hold' | 'back' | 'to-shard' | 'shard';

function arm(video: HTMLVideoElement) {
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
}

/** Wait until the element has a decoded picture we can show. */
function whenPainted(video: HTMLVideoElement) {
  return new Promise<void>((resolve) => {
    if (video.videoWidth > 0 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      const rvfc = (
        video as HTMLVideoElement & {
          requestVideoFrameCallback?: (cb: () => void) => number;
        }
      ).requestVideoFrameCallback;
      if (typeof rvfc === 'function') {
        rvfc.call(video, () => resolve());
        return;
      }
      resolve();
      return;
    }
    const onReady = () => {
      if (video.videoWidth === 0) return;
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('playing', onReady);
      const rvfc = (
        video as HTMLVideoElement & {
          requestVideoFrameCallback?: (cb: () => void) => number;
        }
      ).requestVideoFrameCallback;
      if (typeof rvfc === 'function') rvfc.call(video, () => resolve());
      else resolve();
    };
    video.addEventListener('loadeddata', onReady);
    video.addEventListener('playing', onReady);
  });
}

/**
 * Hero backdrop.
 * Opening → Tree Loop (title fades in). Scroll down fades the title out and
 * plays video 2. When video 2 ends, shard_looping starts and the statement
 * fades in. Scroll up fades that text out and reverses video 2.
 */
export default function HeroBackground({
  onLoopStart,
  onCopyChange,
  onStatementChange,
}: {
  onLoopStart?: () => void;
  onCopyChange?: (visible: boolean) => void;
  onStatementChange?: (visible: boolean) => void;
}) {
  const openingRef = useRef<HTMLVideoElement>(null);
  const loopRef = useRef<HTMLVideoElement>(null);
  const nextRef = useRef<HTMLVideoElement>(null);
  const shardRef = useRef<HTMLVideoElement>(null);
  const onLoopStartRef = useRef(onLoopStart);
  const onCopyChangeRef = useRef(onCopyChange);
  const onStatementChangeRef = useRef(onStatementChange);
  onLoopStartRef.current = onLoopStart;
  onCopyChangeRef.current = onCopyChange;
  onStatementChangeRef.current = onStatementChange;

  useEffect(() => {
    const opening = openingRef.current;
    const loop = loopRef.current;
    const next = nextRef.current;
    const shard = shardRef.current;
    if (!opening || !loop || !next || !shard) return;

    const hero = opening.closest('.hm-hero');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    arm(opening);
    arm(loop);
    arm(next);
    arm(shard);
    loop.hidden = true;
    next.hidden = true;
    shard.hidden = true;

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

    const setStatement = (visible: boolean) => {
      hero?.classList.toggle('is-shard', visible);
      onStatementChangeRef.current?.(visible);
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
      shard.pause();
      shard.hidden = true;
      opening.hidden = true;
      loop.hidden = false;
      if (loop.paused) void loop.play().catch(() => {});
    };

    const restoreLoop = () => {
      stopReverse();
      setStatement(false);
      showLoop();
      setCopy(true);
      setPhase('loop');
    };

    const revealNext = () => {
      if (stopped || next.videoWidth === 0) return;
      if (phase !== 'forward' && phase !== 'hold' && phase !== 'back') return;
      next.hidden = false;
      opening.hidden = true;
      shard.hidden = true;
      if (!loop.hidden) {
        loop.pause();
        loop.hidden = true;
      }
    };

    const revealShard = () => {
      if (stopped || shard.videoWidth === 0) return;
      if (phase !== 'to-shard' && phase !== 'shard') return;
      // Keep video 2's last frame until the shard element is un-hidden, so the
      // swap never drops to the black .hm-hero-bg layer.
      shard.hidden = false;
      opening.hidden = true;
      if (!loop.hidden) {
        loop.pause();
        loop.hidden = true;
      }
      next.pause();
      next.hidden = true;
    };

    const primeNext = () => {
      if (next.getAttribute('src')) return;
      next.preload = 'auto';
      next.src = encodeURI(NEXT_SRC);
      arm(next);
    };

    const primeShard = () => {
      if (shard.getAttribute('src')) return;
      shard.preload = 'auto';
      shard.src = encodeURI(SHARD_SRC);
      arm(shard);
    };

    const showVideo2End = () => {
      stopReverse();
      setStatement(false);
      shard.pause();
      shard.hidden = true;
      primeNext();
      const place = () => {
        if (stopped) return;
        if (next.videoWidth === 0 || !Number.isFinite(next.duration) || next.duration <= 0) {
          restoreLoop();
          return;
        }
        next.currentTime = Math.max(0, next.duration - 0.05);
        next.pause();
        setPhase('hold');
        revealNext();
      };
      if (next.readyState >= HTMLMediaElement.HAVE_METADATA) place();
      else next.addEventListener('loadedmetadata', place, { once: true });
    };

    const playForward = (resetToStart: boolean, my: number) => {
      if (stopped || my !== epoch || failed) return;
      stopReverse();
      setStatement(false);
      setPhase('forward');
      primeNext();
      // Warm the shard decoder while video 2 plays so the cut is not a cold start.
      primeShard();
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
      setStatement(false);
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
      setStatement(false);
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
      setStatement(false);
      if (next.currentTime <= 0.05 || next.videoWidth === 0) {
        playForward(true, my);
        return;
      }
      setPhase('forward');
      arm(next);
      next.playbackRate = 1;
      void next.play().then(revealNext).catch(() => {});
    };

    const enterShard = () => {
      const my = ++epoch;
      stopReverse();
      setCopy(false);
      setPhase('to-shard');
      // Hold video 2 on its last painted frame until the shard has one.
      next.pause();
      next.hidden = false;
      primeShard();
      arm(shard);
      shard.loop = true;
      if (shard.currentTime > 0.02) shard.currentTime = 0;

      const show = () => {
        if (stopped || my !== epoch) return;
        if (phase !== 'to-shard' && phase !== 'shard') return;
        if (shard.videoWidth === 0) return;
        revealShard();
        setPhase('shard');
        setStatement(true);
      };

      const start = () => {
        if (stopped || my !== epoch) return;
        arm(shard);
        void shard
          .play()
          .then(async () => {
            if (stopped || my !== epoch) return;
            await whenPainted(shard);
            if (stopped || my !== epoch) return;
            show();
          })
          .catch(() => {});
      };

      if (shard.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && shard.videoWidth > 0) start();
      else shard.addEventListener('loadeddata', start, { once: true });
      start();

      window.setTimeout(() => {
        if (stopped || my !== epoch) return;
        if (phase !== 'to-shard' && phase !== 'shard') return;
        if (shard.videoWidth > 0) {
          show();
          return;
        }
        // Missing or undecodable file: keep video 2 on the last frame.
        setPhase('hold');
        showVideo2End();
      }, 8000);
    };

    const leaveShard = () => {
      const my = ++epoch;
      window.clearTimeout(fadeTimer);
      setStatement(false);

      const statement = hero?.querySelector<HTMLElement>('.hm-statement');
      const opacity = statement ? Number.parseFloat(getComputedStyle(statement).opacity) : 0;
      const go = () => {
        if (stopped || my !== epoch) return;
        showVideo2End();
      };

      if (reduce || opacity < 0.04) {
        go();
        return;
      }

      let fired = false;
      const onEnd = (event: TransitionEvent) => {
        if (event.propertyName !== 'opacity') return;
        if (fired) return;
        fired = true;
        statement?.removeEventListener('transitionend', onEnd);
        go();
      };
      statement?.addEventListener('transitionend', onEnd);
      fadeTimer = window.setTimeout(() => {
        if (fired) return;
        fired = true;
        statement?.removeEventListener('transitionend', onEnd);
        go();
      }, FADE_MS + 80);
    };

    const onEnded = () => {
      if (phase !== 'forward') return;
      // Freeze the last decoded frame of video 2, then cut only after shard paints.
      next.pause();
      enterShard();
    };

    const onError = () => {
      failed = true;
      epoch += 1;
      stopReverse();
      window.clearTimeout(fadeTimer);
      setStatement(false);
      if (phase === 'boot' || phase === 'loop') return;
      restoreLoop();
    };

    const onShardError = () => {
      if (phase !== 'to-shard' && phase !== 'shard') return;
      epoch += 1;
      window.clearTimeout(fadeTimer);
      setStatement(false);
      showVideo2End();
    };

    next.addEventListener('ended', onEnded);
    next.addEventListener('error', onError);
    next.addEventListener('playing', revealNext);
    shard.addEventListener('error', onShardError);
    shard.addEventListener('playing', revealShard);

    const onStep = (direction: HeroStep) => {
      if (stopped) return false;
      if (direction > 0) {
        if (failed) return false;
        if (phase === 'loop') {
          beginExit();
          return true;
        }
        if (phase === 'out' || phase === 'forward' || phase === 'to-shard') return true;
        if (phase === 'back') {
          resumeForward();
          return true;
        }
        if (phase === 'hold') {
          enterShard();
          return true;
        }
        if (phase === 'shard') return false;
        return false;
      }
      if (phase === 'loop' || phase === 'boot') return false;
      if (phase === 'out') {
        epoch += 1;
        window.clearTimeout(fadeTimer);
        restoreLoop();
        return true;
      }
      if (phase === 'to-shard' || phase === 'shard') {
        leaveShard();
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
      if (phase === 'shard' || phase === 'to-shard') {
        setPhase('shard');
        setStatement(true);
        if (shard.paused) void shard.play().catch(() => {});
        return;
      }
      next.pause();
      setPhase('hold');
    };

    const onReturn = () => {
      stopReverse();
      window.clearTimeout(fadeTimer);
      setCopy(false);
      enterShard();
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
        if (
          phase === 'forward' ||
          phase === 'hold' ||
          phase === 'back' ||
          phase === 'to-shard' ||
          phase === 'shard'
        ) {
          return;
        }
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

    const onNextTime = () => {
      if (!next.duration) return;
      if (next.duration - next.currentTime < 1.2) primeShard();
    };

    opening.addEventListener('canplay', onCanPlay);
    opening.addEventListener('timeupdate', onTime);
    opening.addEventListener('ended', playLoop);
    next.addEventListener('timeupdate', onNextTime);

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
      next.removeEventListener('timeupdate', onNextTime);
      shard.removeEventListener('error', onShardError);
      shard.removeEventListener('playing', revealShard);
      window.removeEventListener(HOME_BOOT_EVENT, onBoot);
      opening.pause();
      loop.pause();
      next.pause();
      shard.pause();
    };
  }, []);

  return (
    <div className="hm-hero-bg" aria-hidden="true">
      <video ref={openingRef} src={OPENING_SRC} muted playsInline preload="auto" />
      <video ref={loopRef} muted playsInline preload="none" hidden />
      <video ref={nextRef} muted playsInline preload="none" hidden />
      <video ref={shardRef} muted playsInline preload="none" hidden />
    </div>
  );
}
