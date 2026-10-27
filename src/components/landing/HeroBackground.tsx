import { useEffect, useRef } from 'react';
import { HOME_BOOT_EVENT, isHomeBootComplete } from '@/motion/HomePreloader';
import { registerHeroSequence, HM_ENTER_CITY_PIN, type HeroStep } from '@/motion/heroSequence';

const OPENING_SRC = '/assets/bluebook/Opening.mp4';
const LOOP_SRC = '/assets/bluebook/Tree Looping.mp4';
const NEXT_SRC = '/assets/bluebook/video 2.mp4';
const SHARD_SRC = '/assets/bluebook/shard_floating.mp4';
const SHARD_FALLBACK = '/assets/bluebook/shard_looping.mp4';
const TO_CITY_SRC = '/assets/bluebook/shard_to_city.mp4';
const CITY_SRC = '/assets/bluebook/city_girl.mp4';
const CITY_FALLBACK = '/assets/bluebook/Tree Looping.mp4';
const FADE_MS = 1150;

type Phase =
  | 'boot'
  | 'loop'
  | 'out'
  | 'forward'
  | 'hold'
  | 'back'
  | 'to-shard'
  | 'shard'
  | 'to-city'
  | 'city'
  | 'city-pin';

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

function srcName(path: string) {
  return path.split('/').pop() ?? path;
}

function hasSrc(video: HTMLVideoElement, path: string) {
  const name = srcName(path);
  const attr = video.getAttribute('src') ?? '';
  const current = decodeURIComponent(video.currentSrc || video.src || '');
  return attr === encodeURI(path) || current.includes(name);
}

/** Set src; on 404/decode failure walk the fallback list. */
function assignSrc(video: HTMLVideoElement, primary: string, fallback?: string) {
  const chain = fallback ? [primary, fallback] : [primary];
  if (chain.some((path) => hasSrc(video, path)) && video.videoWidth > 0) return;

  let index = 0;
  const apply = () => {
    if (index >= chain.length) return;
    const path = chain[index++];
    video.preload = 'auto';
    video.src = encodeURI(path);
    arm(video);
  };

  const onErr = () => {
    if (index < chain.length) {
      apply();
      return;
    }
    video.removeEventListener('error', onErr);
  };

  video.addEventListener('error', onErr);
  apply();
}

/**
 * Resolve once a source in the chain has decoded dimensions.
 * Does not wait for a painted frame — that needs play() first
 * (requestVideoFrameCallback never fires on a paused element).
 */
function loadPainted(video: HTMLVideoElement, primary: string, fallback?: string) {
  const chain = fallback ? [primary, fallback] : [primary];
  return new Promise<void>((resolve, reject) => {
    let index = 0;
    let settled = false;

    const fail = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener('error', onErr);
      video.removeEventListener('loadeddata', onReady);
      reject(new Error(`no playable source for ${srcName(primary)}`));
    };

    const succeed = () => {
      if (settled) return;
      if (video.videoWidth === 0) return;
      settled = true;
      video.removeEventListener('error', onErr);
      video.removeEventListener('loadeddata', onReady);
      resolve();
    };

    const onReady = () => succeed();

    const onErr = () => {
      if (settled) return;
      if (index < chain.length) {
        apply();
        return;
      }
      fail();
    };

    const apply = () => {
      if (index >= chain.length) {
        fail();
        return;
      }
      const path = chain[index++];
      video.preload = 'auto';
      video.src = encodeURI(path);
      arm(video);
      try {
        video.load();
      } catch {
        /* ignore */
      }
    };

    video.addEventListener('error', onErr);
    video.addEventListener('loadeddata', onReady);
    if (chain.some((path) => hasSrc(video, path)) && video.videoWidth > 0) {
      succeed();
      return;
    }
    apply();
  });
}

function seekToStart(video: HTMLVideoElement) {
  if (video.currentTime <= 0.02) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const done = () => {
      video.removeEventListener('seeked', done);
      resolve();
    };
    video.addEventListener('seeked', done);
    try {
      video.currentTime = 0;
    } catch {
      resolve();
    }
    window.setTimeout(done, 600);
  });
}

/**
 * Hero backdrop sequence:
 * Opening → Tree Loop → video 2 → shard floating loop (statement) →
 * shard-to-city → city girl loop. City girl keeps looping under hm-pin
 * until every pin panel has been stepped through.
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
  const toCityRef = useRef<HTMLVideoElement>(null);
  const cityRef = useRef<HTMLVideoElement>(null);
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
    const toCity = toCityRef.current;
    const city = cityRef.current;
    if (!opening || !loop || !next || !shard || !toCity || !city) return;

    const hero = opening.closest('.hm-hero');
    const stage = opening.closest('.home-stage');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    arm(opening);
    arm(loop);
    arm(next);
    arm(shard);
    arm(toCity);
    arm(city);
    loop.hidden = true;
    next.hidden = true;
    shard.hidden = true;
    toCity.hidden = true;
    city.hidden = true;

    let stopped = false;
    let bootDone = isHomeBootComplete();
    let usingLoop = false;
    let failed = false;
    let phase: Phase = 'boot';
    let epoch = 0;
    let fadeTimer = 0;
    let reverseRaf = 0;
    let reverseWatch = 0;
    let leftFrom: 'shard' | 'city' | null = null;

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

    const setCityPin = (active: boolean) => {
      stage?.classList.toggle('is-city-pin', active);
      if (active) stage?.classList.add('is-on-hero');
    };

    const stopReverse = () => {
      if (reverseRaf) cancelAnimationFrame(reverseRaf);
      reverseRaf = 0;
      window.clearTimeout(reverseWatch);
      reverseWatch = 0;
    };

    const hideAllBut = (keep: HTMLVideoElement | null) => {
      [opening, loop, next, shard, toCity, city].forEach((video) => {
        if (video === keep) return;
        video.pause();
        video.hidden = true;
      });
    };

    const showLoop = () => {
      hideAllBut(loop);
      loop.hidden = false;
      if (loop.paused) void loop.play().catch(() => {});
    };

    const restoreLoop = () => {
      stopReverse();
      setCityPin(false);
      setStatement(false);
      leftFrom = null;
      showLoop();
      setCopy(true);
      setPhase('loop');
    };

    const revealNext = () => {
      if (stopped || next.videoWidth === 0) return;
      if (phase !== 'forward' && phase !== 'hold' && phase !== 'back') return;
      next.hidden = false;
      hideAllBut(next);
      next.hidden = false;
    };

    const revealShard = () => {
      if (stopped || shard.videoWidth === 0) return;
      if (phase !== 'to-shard' && phase !== 'shard') return;
      shard.hidden = false;
      hideAllBut(shard);
      shard.hidden = false;
    };

    const revealToCity = () => {
      if (stopped || toCity.videoWidth === 0) return;
      if (phase !== 'to-city' && phase !== 'back') return;
      toCity.hidden = false;
      hideAllBut(toCity);
      toCity.hidden = false;
    };

    const revealCity = () => {
      if (stopped || city.videoWidth === 0) return;
      if (phase !== 'city' && phase !== 'city-pin') return;
      city.hidden = false;
      hideAllBut(city);
      city.hidden = false;
    };

    const primeNext = () => assignSrc(next, NEXT_SRC);
    const primeShard = () => assignSrc(shard, SHARD_SRC, SHARD_FALLBACK);
    const primeToCity = () => assignSrc(toCity, TO_CITY_SRC);
    const primeCity = () => assignSrc(city, CITY_SRC, CITY_FALLBACK);

    const showVideo2End = () => {
      stopReverse();
      setCityPin(false);
      setStatement(false);
      hideAllBut(null);
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

    const showToCityEnd = () => {
      stopReverse();
      setCityPin(false);
      setStatement(false);
      hideAllBut(null);
      primeToCity();
      const place = () => {
        if (stopped) return;
        if (toCity.videoWidth === 0 || !Number.isFinite(toCity.duration) || toCity.duration <= 0) {
          enterShard();
          return;
        }
        toCity.currentTime = Math.max(0, toCity.duration - 0.05);
        toCity.pause();
        setPhase('hold');
        toCity.hidden = false;
        hideAllBut(toCity);
        toCity.hidden = false;
        // Reuse hold + reverse path via a dedicated reverse of to-city.
        startToCityReverse();
      };
      if (toCity.readyState >= HTMLMediaElement.HAVE_METADATA) place();
      else toCity.addEventListener('loadedmetadata', place, { once: true });
    };

    const playForward = (resetToStart: boolean, my: number) => {
      if (stopped || my !== epoch || failed) return;
      stopReverse();
      setCityPin(false);
      setStatement(false);
      setPhase('forward');
      primeNext();
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

    const startToCityReverse = () => {
      if (toCity.videoWidth === 0 || toCity.currentTime <= 0.05) {
        enterShard();
        return;
      }
      const my = ++epoch;
      stopReverse();
      setStatement(false);
      setCityPin(false);
      toCity.pause();
      setPhase('back');
      toCity.hidden = false;
      hideAllBut(toCity);
      toCity.hidden = false;
      const started = performance.now();
      let last = 0;
      let carry = 0;

      const finish = () => {
        if (my !== epoch) return;
        toCity.currentTime = 0;
        enterShard();
      };

      const tick = (now: number) => {
        if (stopped || my !== epoch || phase !== 'back') return;
        if (!last) last = now;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        carry += dt;
        if (toCity.seeking) {
          reverseRaf = requestAnimationFrame(tick);
          return;
        }
        const target = toCity.currentTime - carry;
        carry = 0;
        if (target <= 0.04) {
          finish();
          return;
        }
        toCity.currentTime = target;
        reverseRaf = requestAnimationFrame(tick);
      };

      reverseRaf = requestAnimationFrame(tick);
      const limit = (Number.isFinite(toCity.duration) ? toCity.duration : 4) * 1000 + 1500;
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
      setCityPin(false);
      setCopy(false);
      setPhase('to-shard');
      // Hold video 2's last frame until shard (or its fallback) paints.
      next.pause();
      next.hidden = false;
      arm(shard);
      shard.loop = true;

      const show = () => {
        if (stopped || my !== epoch) return;
        if (phase !== 'to-shard' && phase !== 'shard') return;
        if (shard.videoWidth === 0) return;
        revealShard();
        setPhase('shard');
        setStatement(true);
        primeToCity();
      };

      void loadPainted(shard, SHARD_SRC, SHARD_FALLBACK)
        .then(async () => {
          if (stopped || my !== epoch) return;
          arm(shard);
          shard.loop = true;
          await seekToStart(shard);
          if (stopped || my !== epoch) return;
          try {
            await shard.play();
          } catch {
            /* muted autoplay should work; retry once */
            arm(shard);
            await shard.play().catch(() => {});
          }
          if (stopped || my !== epoch) return;
          await whenPainted(shard);
          if (stopped || my !== epoch) return;
          if (shard.paused) void shard.play().catch(() => {});
          show();
        })
        .catch(() => {
          if (stopped || my !== epoch) return;
          setPhase('hold');
          showVideo2End();
        });

      window.setTimeout(() => {
        if (stopped || my !== epoch) return;
        if (phase !== 'to-shard' && phase !== 'shard') return;
        if (shard.videoWidth > 0) {
          if (shard.paused) void shard.play().catch(() => {});
          show();
          return;
        }
        setPhase('hold');
        showVideo2End();
      }, 5000);
    };

    const leaveShard = () => {
      const my = ++epoch;
      window.clearTimeout(fadeTimer);
      setStatement(false);

      const statement = hero?.querySelector<HTMLElement>('.hm-statement');
      const opacity = statement ? Number.parseFloat(getComputedStyle(statement).opacity) : 0;
      const go = () => {
        if (stopped || my !== epoch) return;
        playToCity(my);
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

    const playToCity = (my: number) => {
      if (stopped || my !== epoch) return;
      stopReverse();
      setCityPin(false);
      setStatement(false);
      setPhase('to-city');
      shard.pause();
      shard.hidden = false;
      arm(toCity);
      toCity.loop = false;
      toCity.playbackRate = 1;
      primeCity();

      const show = () => {
        if (stopped || my !== epoch || phase !== 'to-city') return;
        if (toCity.videoWidth === 0) return;
        revealToCity();
      };

      void loadPainted(toCity, TO_CITY_SRC)
        .then(async () => {
          if (stopped || my !== epoch || phase !== 'to-city') return;
          arm(toCity);
          toCity.loop = false;
          await seekToStart(toCity);
          if (stopped || my !== epoch || phase !== 'to-city') return;
          try {
            await toCity.play();
          } catch {
            arm(toCity);
            await toCity.play().catch(() => {});
          }
          if (stopped || my !== epoch || phase !== 'to-city') return;
          await whenPainted(toCity);
          if (stopped || my !== epoch || phase !== 'to-city') return;
          show();
        })
        .catch(() => {
          if (stopped || my !== epoch) return;
          // Missing transition: jump straight into city girl.
          enterCity(true);
        });

      window.setTimeout(() => {
        if (stopped || my !== epoch || phase !== 'to-city') return;
        if (toCity.videoWidth > 0) {
          if (toCity.paused) void toCity.play().catch(() => {});
          show();
          return;
        }
        enterCity(true);
      }, 4000);
    };

    const enterCity = (announcePin: boolean) => {
      const my = ++epoch;
      stopReverse();
      setCopy(false);
      setStatement(false);
      setPhase('city');
      toCity.pause();
      toCity.hidden = false;
      arm(city);
      city.loop = true;

      const show = () => {
        if (stopped || my !== epoch) return;
        if (phase !== 'city' && phase !== 'city-pin') return;
        if (city.videoWidth === 0) return;
        revealCity();
        if (announcePin && phase === 'city') {
          stage?.dispatchEvent(new CustomEvent(HM_ENTER_CITY_PIN));
        }
      };

      void loadPainted(city, CITY_SRC, CITY_FALLBACK)
        .then(async () => {
          if (stopped || my !== epoch) return;
          arm(city);
          city.loop = true;
          await seekToStart(city);
          if (stopped || my !== epoch) return;
          try {
            await city.play();
          } catch {
            arm(city);
            await city.play().catch(() => {});
          }
          if (stopped || my !== epoch) return;
          await whenPainted(city);
          if (stopped || my !== epoch) return;
          if (city.paused) void city.play().catch(() => {});
          show();
        })
        .catch(() => {
          if (stopped || my !== epoch) return;
          // Still open pins over the last painted frame.
          setPhase('city');
          if (announcePin) stage?.dispatchEvent(new CustomEvent(HM_ENTER_CITY_PIN));
        });

      window.setTimeout(() => {
        if (stopped || my !== epoch) return;
        if (phase !== 'city' && phase !== 'city-pin') return;
        if (city.videoWidth > 0) {
          if (city.paused) void city.play().catch(() => {});
          show();
          return;
        }
        setPhase('city');
        if (announcePin) stage?.dispatchEvent(new CustomEvent(HM_ENTER_CITY_PIN));
      }, 4000);
    };

    const leaveCity = () => {
      const my = ++epoch;
      window.clearTimeout(fadeTimer);
      setCityPin(false);
      setStatement(false);
      if (stopped || my !== epoch) return;
      showToCityEnd();
    };

    const keepCityUnderPins = () => {
      leftFrom = 'city';
      setPhase('city-pin');
      setCityPin(true);
      setCopy(false);
      setStatement(false);
      primeCity();
      arm(city);
      city.loop = true;
      city.hidden = false;
      hideAllBut(city);
      city.hidden = false;
      if (city.paused) void city.play().catch(() => {});
    };

    const releaseCityPins = () => {
      leftFrom = null;
      setCityPin(false);
      city.pause();
    };

    const onEnded = () => {
      if (phase !== 'forward') return;
      next.pause();
      enterShard();
    };

    const onToCityEnded = () => {
      if (phase !== 'to-city') return;
      toCity.pause();
      enterCity(true);
    };

    const onError = () => {
      failed = true;
      epoch += 1;
      stopReverse();
      window.clearTimeout(fadeTimer);
      setStatement(false);
      setCityPin(false);
      if (phase === 'boot' || phase === 'loop') return;
      restoreLoop();
    };

    const onShardError = () => {
      // loadPainted / assignSrc already walk shard_floating → shard_looping.
      // Only freeze on video 2 if every candidate failed and we are still stuck.
      if (phase !== 'to-shard' && phase !== 'shard') return;
      if (shard.videoWidth > 0) return;
      if (hasSrc(shard, SHARD_SRC) && SHARD_FALLBACK) {
        assignSrc(shard, SHARD_FALLBACK);
        arm(shard);
        shard.loop = true;
        void shard.play().catch(() => {});
        return;
      }
      epoch += 1;
      window.clearTimeout(fadeTimer);
      setStatement(false);
      showVideo2End();
    };

    const onToCityError = () => {
      if (phase !== 'to-city') return;
      enterCity(true);
    };

    const onCityError = () => {
      if (phase !== 'city' && phase !== 'city-pin') return;
      assignSrc(city, CITY_FALLBACK);
      arm(city);
      city.loop = true;
      void city.play().catch(() => {});
    };

    next.addEventListener('ended', onEnded);
    next.addEventListener('error', onError);
    next.addEventListener('playing', revealNext);
    shard.addEventListener('error', onShardError);
    shard.addEventListener('playing', revealShard);
    toCity.addEventListener('ended', onToCityEnded);
    toCity.addEventListener('error', onToCityError);
    toCity.addEventListener('playing', revealToCity);
    city.addEventListener('error', onCityError);
    city.addEventListener('playing', revealCity);

    const onStep = (direction: HeroStep) => {
      if (stopped) return false;
      if (direction > 0) {
        if (failed) return false;
        if (phase === 'loop') {
          beginExit();
          return true;
        }
        if (phase === 'out' || phase === 'forward' || phase === 'to-shard' || phase === 'to-city') {
          return true;
        }
        if (phase === 'back') {
          // If reversing to-city, resume forward to-city; if reversing video 2, resume that.
          if (!toCity.hidden && toCity.videoWidth > 0 && next.hidden) {
            const my = ++epoch;
            stopReverse();
            setPhase('to-city');
            arm(toCity);
            toCity.playbackRate = 1;
            void toCity.play().then(revealToCity).catch(() => {});
            void my;
            return true;
          }
          resumeForward();
          return true;
        }
        if (phase === 'hold') {
          if (!toCity.hidden && toCity.videoWidth > 0 && next.hidden) {
            playToCity(++epoch);
            return true;
          }
          enterShard();
          return true;
        }
        if (phase === 'shard') {
          leaveShard();
          return true;
        }
        if (phase === 'city' || phase === 'city-pin') return false;
        return false;
      }
      if (phase === 'loop' || phase === 'boot') return false;
      if (phase === 'out') {
        epoch += 1;
        window.clearTimeout(fadeTimer);
        restoreLoop();
        return true;
      }
      if (phase === 'to-city') {
        leaveCity();
        return true;
      }
      if (phase === 'city' || phase === 'city-pin') {
        leaveCity();
        return true;
      }
      if (phase === 'to-shard' || phase === 'shard') {
        // From shard, scroll up returns to video 2 (previous behavior).
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
          return true;
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
        return true;
      }
      if (phase === 'forward' || phase === 'hold' || phase === 'back') {
        if (phase !== 'back') {
          if (!toCity.hidden && toCity.videoWidth > 0 && next.hidden) startToCityReverse();
          else startReverse();
        }
        return true;
      }
      return false;
    };

    const onLeave = () => {
      epoch += 1;
      stopReverse();
      window.clearTimeout(fadeTimer);
      if (phase === 'city' || phase === 'city-pin' || phase === 'to-city') {
        keepCityUnderPins();
        return;
      }
      if (phase === 'shard' || phase === 'to-shard') {
        // Should not normally leave hero from shard without going through city.
        leftFrom = 'shard';
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
      if (leftFrom === 'city' || phase === 'city-pin') {
        setCityPin(false);
        setPhase('city');
        leftFrom = 'city';
        primeCity();
        arm(city);
        city.loop = true;
        city.hidden = false;
        hideAllBut(city);
        city.hidden = false;
        if (city.paused) void city.play().catch(() => {});
        return;
      }
      enterShard();
    };

    const onAfterPins = () => {
      releaseCityPins();
    };

    const onEnterPins = () => {
      keepCityUnderPins();
    };

    const unregister = registerHeroSequence({
      onStep,
      onLeave,
      onReturn,
      onAfterPins,
      onEnterPins,
    });

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
          phase === 'shard' ||
          phase === 'to-city' ||
          phase === 'city' ||
          phase === 'city-pin'
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

    const onShardTime = () => {
      if (!shard.duration) return;
      // Warm the transition while the float loop plays.
      primeToCity();
    };

    const onToCityTime = () => {
      if (!toCity.duration) return;
      if (toCity.duration - toCity.currentTime < 1.2) primeCity();
    };

    opening.addEventListener('canplay', onCanPlay);
    opening.addEventListener('timeupdate', onTime);
    opening.addEventListener('ended', playLoop);
    next.addEventListener('timeupdate', onNextTime);
    shard.addEventListener('timeupdate', onShardTime);
    toCity.addEventListener('timeupdate', onToCityTime);

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
      setCityPin(false);
      opening.removeEventListener('canplay', onCanPlay);
      opening.removeEventListener('timeupdate', onTime);
      opening.removeEventListener('ended', playLoop);
      next.removeEventListener('ended', onEnded);
      next.removeEventListener('error', onError);
      next.removeEventListener('playing', revealNext);
      next.removeEventListener('timeupdate', onNextTime);
      shard.removeEventListener('error', onShardError);
      shard.removeEventListener('playing', revealShard);
      shard.removeEventListener('timeupdate', onShardTime);
      toCity.removeEventListener('ended', onToCityEnded);
      toCity.removeEventListener('error', onToCityError);
      toCity.removeEventListener('playing', revealToCity);
      toCity.removeEventListener('timeupdate', onToCityTime);
      city.removeEventListener('error', onCityError);
      city.removeEventListener('playing', revealCity);
      window.removeEventListener(HOME_BOOT_EVENT, onBoot);
      opening.pause();
      loop.pause();
      next.pause();
      shard.pause();
      toCity.pause();
      city.pause();
    };
  }, []);

  return (
    <div className="hm-hero-bg" aria-hidden="true">
      <video ref={openingRef} src={OPENING_SRC} muted playsInline preload="auto" />
      <video ref={loopRef} muted playsInline preload="none" hidden />
      <video ref={nextRef} muted playsInline preload="none" hidden />
      <video ref={shardRef} muted playsInline preload="none" hidden />
      <video ref={toCityRef} muted playsInline preload="none" hidden />
      <video ref={cityRef} muted playsInline preload="none" hidden />
    </div>
  );
}
