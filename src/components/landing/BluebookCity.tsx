import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { PLACES } from '@/city/layout';
import { PLACE_CONTENT } from '@/city/content';
import type { CityEngine } from '@/city/engine/CityEngine';
import { HM_JUMP_TO_SCENE, registerSceneHooks } from '@/motion/sceneHooks';
import { prefersReducedMotion } from '@/motion/springConfig';
import '@/styles/bluebook-city.css';

const VIDEO_SRC = encodeURI('/assets/bluebook/Video End.mp4');
const STILL_SRC = '/assets/bluebook/city/video-end-last.jpg';
const READY_TIMEOUT_MS = 15000;
const STALL_MS = 8000;

type Stage = 'idle' | 'intro' | 'handoff' | 'city' | 'fallback';

type Controller = {
  applyUrl: (placeId: string | null) => void;
};

function placeFrom(search: string) {
  const id = new URLSearchParams(search).get('place');
  return id && PLACES.some((place) => place.id === id) ? id : null;
}

function withTimeout<T>(promise: Promise<T | null>, ms: number) {
  return new Promise<T | null>((resolve) => {
    const timer = window.setTimeout(() => resolve(null), ms);
    promise.then((value) => {
      window.clearTimeout(timer);
      resolve(value);
    });
  });
}

function frames(count: number) {
  return new Promise<void>((resolve) => {
    const tick = (left: number) => (left <= 0 ? resolve() : requestAnimationFrame(() => tick(left - 1)));
    tick(count);
  });
}

/**
 * Last homepage scene: Video End plays, a warm veil covers the cut, and the
 * interactive city takes over from the video's final camera. Places only
 * move the camera and the `?place=` query; the route never changes.
 */
export default function BluebookCity({ ready }: { ready: boolean }) {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const engineRef = useRef<CityEngine | null>(null);
  const hotspotEls = useRef(new Map<string, HTMLButtonElement>());
  const controllerRef = useRef<Controller | null>(null);
  const focusPanelRef = useRef(false);
  const returnFocusRef = useRef<string | null>(null);
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const routeRef = useRef({ pathname, navigate });
  const placeId = placeFrom(search);
  const [stage, setStage] = useState<Stage>('idle');
  const [shownPlace, setShownPlace] = useState<string | null>(null);
  const [panelPlace, setPanelPlace] = useState<string | null>(null);

  useEffect(() => {
    routeRef.current = { pathname, navigate };
  }, [pathname, navigate]);

  const goTo = useCallback((id: string | null) => {
    if (id === placeFrom(window.location.search)) return;
    const { pathname: path, navigate: go } = routeRef.current;
    // Retargeting mid-flight replaces the entry so rapid clicks do not stack history.
    go({ pathname: path, search: id ? `?place=${id}` : '' }, { replace: engineRef.current?.flying ?? false });
  }, []);

  const hotspotRef = useMemo(
    () =>
      Object.fromEntries(
        PLACES.map((place) => [
          place.id,
          (el: HTMLButtonElement | null) => {
            if (el) hotspotEls.current.set(place.id, el);
            else hotspotEls.current.delete(place.id);
            engineRef.current?.bindHotspot(place.id, el);
          },
        ]),
      ),
    [],
  );

  useEffect(() => {
    const section = sectionRef.current;
    const video = videoRef.current;
    const host = stageRef.current;
    const veil = veilRef.current;
    const root = section?.closest<HTMLElement>('.home-stage');
    if (!section || !video || !host || !veil || !root) return;

    const reduced = prefersReducedMotion();
    let disposed = false;
    let token = 0;
    let stageNow: Stage = 'idle';
    let target: string | null = null;
    let enginePromise: Promise<CityEngine | null> | null = null;
    let veilTween: gsap.core.Tween | null = null;
    let introSeen = false;
    let preloaded = false;
    let stallTimer = 0;
    let idleHandle = 0;

    const setStageNow = (next: Stage) => {
      stageNow = next;
      setStage(next);
      root.classList.toggle('is-city-intro', next === 'intro');
    };

    const isActive = () => section.classList.contains('is-active');

    const showPanel = (id: string | null) => {
      setShownPlace(id);
      if (id) setPanelPlace(id);
    };

    const ensureEngine = () => {
      enginePromise ??= import('@/city/engine/CityEngine')
        .then(async ({ CityEngine: Engine }) => {
          if (disposed) return null;
          const engine = new Engine({
            host,
            reducedMotion: reduced,
            onPick: (id) => goTo(id),
            onContextLost: () => fallback(),
          });
          engine.canvas.setAttribute('aria-hidden', 'true');
          engineRef.current = engine;
          hotspotEls.current.forEach((el, id) => engine.bindHotspot(id, el));
          await engine.warm();
          return disposed || engineRef.current !== engine ? null : engine;
        })
        .catch(() => null);
      return enginePromise;
    };

    const tweenVeil = (opacity: number, duration: number) =>
      new Promise<void>((resolve) => {
        veilTween?.kill();
        veilTween = null;
        if (reduced || duration === 0) {
          gsap.set(veil, { opacity });
          resolve();
          return;
        }
        veilTween = gsap.to(veil, {
          opacity,
          duration,
          ease: 'power2.inOut',
          onComplete: resolve,
          onInterrupt: resolve,
        });
      });

    const syncToPlace = (id: string | null) => {
      showPanel(id);
      const engine = engineRef.current;
      if (!engine || stageNow !== 'city') return;
      engine.setFocused(id);
      if (id) {
        void engine.focus(id);
        return;
      }
      void engine.overview().then((landed) => {
        const back = returnFocusRef.current;
        returnFocusRef.current = null;
        const el = back ? hotspotEls.current.get(back) : null;
        if (landed && el && !el.classList.contains('is-hidden')) el.focus({ preventScroll: true });
      });
    };

    const fallback = () => {
      enginePromise = Promise.resolve(null);
      engineRef.current?.dispose();
      engineRef.current = null;
      if (stageNow === 'idle' || stageNow === 'intro') return;
      const my = ++token;
      video.pause();
      setStageNow('fallback');
      void tweenVeil(0, 0.5).then(() => {
        if (my === token) showPanel(target);
      });
    };

    const handoff = async (my: number, fromVideo: boolean) => {
      window.clearTimeout(stallTimer);
      setStageNow('handoff');
      const engine = await withTimeout(ensureEngine(), READY_TIMEOUT_MS);
      if (my !== token) return;
      if (!engine) {
        fallback();
        return;
      }
      const place = target;
      if (fromVideo) engine.showVideoPose();
      else if (place) void engine.focus(place, { instant: true });
      else void engine.overview({ instant: true });
      engine.setFocused(place);
      engine.start();
      await tweenVeil(1, fromVideo ? 0.45 : 0);
      if (my !== token) return;
      video.pause();
      setStageNow('city');
      await frames(2);
      if (my !== token) return;
      engine.setInteractive(true);
      await tweenVeil(0, 0.7);
      if (my !== token) return;
      syncToPlace(target);
    };

    const finishIntro = () => {
      if (stageNow !== 'intro') return;
      introSeen = true;
      void handoff(token, true);
    };

    const armStall = () => {
      window.clearTimeout(stallTimer);
      stallTimer = window.setTimeout(finishIntro, STALL_MS);
    };

    const preloadVideo = () => {
      if (video.getAttribute('src')) return;
      video.preload = 'auto';
      video.src = VIDEO_SRC;
    };

    const playIntro = (my: number) => {
      preloadVideo();
      void ensureEngine();
      setStageNow('intro');
      gsap.set(veil, { opacity: 0 });
      delete video.dataset.playing;
      video.currentTime = 0;
      armStall();
      video.play().catch(() => {
        if (my === token) finishIntro();
      });
    };

    const showCity = (my: number) => {
      veilTween?.kill();
      gsap.set(veil, { opacity: 1 });
      void handoff(my, false);
    };

    const enter = (from: 1 | -1 | 0) => {
      root.classList.add('is-on-city');
      const my = ++token;
      if (from === 1 && !reduced && !target) playIntro(my);
      else showCity(my);
    };

    const leave = () => {
      token += 1;
      window.clearTimeout(stallTimer);
      veilTween?.kill();
      veilTween = null;
      video.pause();
      engineRef.current?.stop();
      engineRef.current?.setInteractive(false);
      setShownPlace(null);
      setStageNow('idle');
      root.classList.remove('is-on-city');
    };

    const unregister = registerSceneHooks(section, {
      onEnter: enter,
      onLeave: leave,
      onStep: (direction) => {
        if (stageNow === 'intro') {
          if (direction < 0) return false;
          if (introSeen) {
            video.pause();
            finishIntro();
          }
          return true;
        }
        if (stageNow === 'handoff' || engineRef.current?.flying) return true;
        if (target) {
          goTo(null);
          return true;
        }
        return false;
      },
    });

    const onVideoPlaying = () => {
      video.dataset.playing = '1';
    };
    const onVideoProgress = () => {
      if (stageNow === 'intro') armStall();
    };
    video.addEventListener('playing', onVideoPlaying);
    video.addEventListener('timeupdate', onVideoProgress);
    video.addEventListener('ended', finishIntro);
    video.addEventListener('error', finishIntro);

    /** Build the city and buffer Video End once the visitor scrolls past the pin stack. */
    const preload = () => {
      if (preloaded) return;
      preloaded = true;
      if (!reduced) preloadVideo();
      const run = () => void ensureEngine();
      if ('requestIdleCallback' in window) idleHandle = window.requestIdleCallback(run, { timeout: 1500 });
      else run();
    };
    const observer = new MutationObserver(() => {
      const scenes = [...root.querySelectorAll<HTMLElement>('[data-scene]')];
      const index = Number(root.dataset.sceneIndex || 0);
      const lastPin = scenes.reduce((last, scene, i) => (scene.classList.contains('hm-panel') ? i : last), -1);
      if (lastPin >= 0 && index > lastPin && index < scenes.indexOf(section)) preload();
    });
    observer.observe(root, { attributes: true, attributeFilter: ['data-scene-index'] });

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && target && isActive()) goTo(null);
    };
    window.addEventListener('keydown', onKey);

    controllerRef.current = {
      applyUrl: (id) => {
        target = id;
        if (!isActive()) {
          if (!id) return;
          void ensureEngine();
          root.dispatchEvent(new CustomEvent(HM_JUMP_TO_SCENE, { detail: section }));
          return;
        }
        if (stageNow === 'idle') enter(0);
        else if (stageNow === 'intro') finishIntro();
        else if (stageNow === 'city' || stageNow === 'fallback') syncToPlace(id);
      },
    };

    return () => {
      disposed = true;
      token += 1;
      controllerRef.current = null;
      unregister();
      observer.disconnect();
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(stallTimer);
      if (idleHandle && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleHandle);
      veilTween?.kill();
      video.removeEventListener('playing', onVideoPlaying);
      video.removeEventListener('timeupdate', onVideoProgress);
      video.removeEventListener('ended', finishIntro);
      video.removeEventListener('error', finishIntro);
      video.pause();
      root.classList.remove('is-on-city', 'is-city-intro');
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, [goTo]);

  useEffect(() => {
    if (ready) controllerRef.current?.applyUrl(placeId);
  }, [ready, placeId]);

  useEffect(() => {
    if (!shownPlace || !focusPanelRef.current) return;
    focusPanelRef.current = false;
    headingRef.current?.focus({ preventScroll: true });
  }, [shownPlace]);

  const content = panelPlace ? PLACE_CONTENT[panelPlace] : null;
  const open = shownPlace !== null && (stage === 'city' || stage === 'fallback');

  useEffect(() => {
    const engine = engineRef.current;
    const panel = panelRef.current;
    if (!engine || !panel) return;
    if (!open) {
      engine.setCover(null);
      return;
    }
    // offset* is the resting layout box, unaffected by the slide-in transform.
    const update = () =>
      engine.setCover({
        left: panel.offsetLeft,
        top: panel.offsetTop,
        right: panel.offsetLeft + panel.offsetWidth,
        bottom: panel.offsetTop + panel.offsetHeight,
      });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [open, panelPlace]);

  return (
    <section ref={sectionRef} className="hm-city" data-scene data-stage={stage} aria-label="Bluebook City">
      <div ref={stageRef} className="hm-city__stage" />
      <video ref={videoRef} className="hm-city__video" muted playsInline preload="none" aria-hidden="true" />
      {stage === 'fallback' ? (
        <>
          <img className="hm-city__still" src={STILL_SRC} alt="" loading="lazy" decoding="async" />
          <nav className="hm-city__places" aria-label="Places">
            {PLACES.map((place) => (
              <button
                key={place.id}
                type="button"
                className="hm-city__pill"
                aria-current={shownPlace === place.id ? 'true' : undefined}
                onClick={() => goTo(place.id)}
              >
                {place.label}
              </button>
            ))}
          </nav>
        </>
      ) : null}
      <div className="hm-city__hotspots">
        {PLACES.map((place) => (
          <button
            key={place.id}
            ref={hotspotRef[place.id]}
            type="button"
            className="hm-city__hotspot"
            onClick={() => {
              focusPanelRef.current = true;
              goTo(place.id);
            }}
          >
            {place.label}
          </button>
        ))}
      </div>
      <aside
        ref={panelRef}
        className="hm-city__panel"
        data-open={open ? 'true' : undefined}
        aria-hidden={!open}
        inert={!open}
      >
        {content ? (
          <>
            <h2 ref={headingRef} className="hm-city__title" tabIndex={-1}>
              {content.title}
            </h2>
            <p className="hm-city__body">{content.body}</p>
            <div className="hm-city__actions">
              {content.cta ? (
                <Link className="hm-btn" to={content.cta.to}>
                  {content.cta.label}
                </Link>
              ) : null}
              <button
                type="button"
                className="hm-city__pill"
                onClick={() => {
                  returnFocusRef.current = panelPlace;
                  goTo(null);
                }}
              >
                Overview
              </button>
            </div>
          </>
        ) : null}
      </aside>
      <div ref={veilRef} className="hm-city__veil" aria-hidden="true" />
    </section>
  );
}
