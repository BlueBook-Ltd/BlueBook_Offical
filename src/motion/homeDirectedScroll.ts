import { gsap } from 'gsap';
import { heroSequence, HM_ENTER_CITY_PIN } from '@/motion/heroSequence';
import { HM_JUMP_TO_SCENE, sceneHooks, type SceneStep } from '@/motion/sceneHooks';

/**
 * Homepage does not scroll while the hero + service pin stack are active.
 * Wheel, touch, and arrow keys step through those scenes. The hero cannot be
 * left until its looping video is playing.
 *
 * Each hero video block is atomic: a one-shot clip must play through once,
 * and a loop hold must complete ≥1 play, before the next block can start
 * (scroll during a block is queued / absorbed). Sequence:
 * Tree Looping → Tree_To_Shard_Cropped → shard_floating → City_To_Girl →
 * Girl_Loop under hm-pin until every pin panel has been stepped through.
 *
 * Panel 04 stays on the same pinned video as 01–03. The next downward scroll
 * after 04 unlocks native scrolling into Contact Us + footer. Scrolling back
 * up to the top of that tail re-enters directed mode at 04, then 03 → 02 → 01.
 */
export function mountDirectedScroll(root: HTMLElement, canAdvance: () => boolean) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('hm-home', 'hm-directed');

  let index = 0;
  let busy = false;
  let touchY = 0;
  let released = false;

  const scenes = () => [...root.querySelectorAll<HTMLElement>('[data-scene]')];

  const pinRange = (list: HTMLElement[]) => {
    const pins = list
      .map((scene, i) => (scene.classList.contains('hm-panel') ? i : -1))
      .filter((i) => i >= 0);
    return {
      first: pins[0] ?? -1,
      last: pins.length ? pins[pins.length - 1] : -1,
    };
  };

  const lastPinEl = () => scenes().filter((scene) => scene.classList.contains('hm-panel')).at(-1);

  const show = (next: number, from: SceneStep | 0 = 0) => {
    if (released) return;
    const list = scenes();
    if (!list.length) return;
    const previous = index;
    index = Math.max(0, Math.min(list.length - 1, next));
    root.dataset.sceneIndex = String(index);
    root.classList.toggle('is-step-back', from < 0);
    if (previous !== index) sceneHooks(list[previous])?.onLeave?.();
    const previousScene = list[previous];
    if (previous !== index && previousScene?.classList.contains('hm-panel')) {
      previousScene.classList.remove('is-active');
      if (!reduce) {
        previousScene.classList.add('is-leaving');
        window.setTimeout(() => previousScene.classList.remove('is-leaving'), 1200);
      }
    }
    list.forEach((scene, i) => {
      const active = i === index;
      if (active && scene.classList.contains('hm-panel') && !scene.classList.contains('is-active') && !reduce) {
        scene.classList.add('is-entering', 'is-active');
        void scene.offsetWidth;
        scene.classList.remove('is-entering');
        return;
      }
      scene.classList.toggle('is-active', active);
      if (!active || scene.classList.contains('hm-panel') || scene.dataset.scenePlayed === '1' || reduce) return;
      scene.dataset.scenePlayed = '1';
      const lines = scene.querySelectorAll('.hm-line');
      if (!lines.length) return;
      gsap.fromTo(
        lines,
        { yPercent: 110 },
        { yPercent: 0, duration: 0.9, ease: 'expo.out', stagger: 0.06, overwrite: 'auto' },
      );
    });
    const onHero = list[index]?.classList.contains('hm-hero') ?? false;
    root.classList.toggle('is-on-hero', onHero || root.classList.contains('is-city-pin'));
    if (previous !== index || from === 0) sceneHooks(list[index])?.onEnter?.(from);
  };

  const lock = (ms = reduce ? 0 : 1100) => {
    busy = true;
    window.setTimeout(() => {
      busy = false;
    }, ms);
  };

  const detachDirectedInput = () => {
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('keydown', onKey);
    root.removeEventListener(HM_ENTER_CITY_PIN, onCityReady);
    root.removeEventListener(HM_JUMP_TO_SCENE, onJump);
  };

  const attachDirectedInput = () => {
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('keydown', onKey);
    root.addEventListener(HM_ENTER_CITY_PIN, onCityReady);
    root.addEventListener(HM_JUMP_TO_SCENE, onJump);
  };

  const detachFreeInput = () => {
    window.removeEventListener('wheel', onFreeWheel);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove', onFreeTouchMove);
    window.removeEventListener('keydown', onFreeKey);
  };

  const attachFreeInput = () => {
    window.addEventListener('wheel', onFreeWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onFreeTouchMove, { passive: false });
    window.addEventListener('keydown', onFreeKey);
  };

  /** Native scroll for Contact/footer only. Panel 04 stays on the city-girl clip. */
  const unlock = () => {
    if (released) return;
    released = true;
    busy = true;

    const list = scenes();
    const { last: lastPin } = pinRange(list);
    const pin = lastPin >= 0 ? list[lastPin] : lastPinEl();
    index = lastPin >= 0 ? lastPin : index;

    detachDirectedInput();
    // Keep Girl_Loop under 04 — never release the pin stack on unlock.
    heroSequence()?.onEnterPins?.();
    document.documentElement.classList.remove('hm-directed');
    root.classList.remove('is-directed', 'is-step-back');
    root.classList.add('is-free-scroll');
    root.dataset.sceneIndex = String(index);

    list.forEach((scene, i) => {
      const isPin = scene.classList.contains('hm-panel');
      const isHero = scene.classList.contains('hm-hero');
      const isTail = !isPin && !isHero;
      scene.classList.toggle('is-active', i === index || isTail || isHero);
      scene.classList.remove('is-entering', 'is-leaving');
      scene.classList.toggle('is-pin-tail', isPin && i === lastPin);
      scene.classList.toggle('is-pin-prior', isPin && i !== lastPin);
    });

    window.scrollTo(0, 0);
    attachFreeInput();
    window.setTimeout(() => {
      busy = false;
    }, reduce ? 0 : 200);
  };

  /** Scroll back into the pin stack — directed steps 04 → 03 → 02 → 01. */
  const relock = () => {
    if (!released) return;
    released = false;
    busy = true;
    detachFreeInput();

    window.scrollTo(0, 0);
    document.documentElement.classList.add('hm-directed');
    root.classList.add('is-directed');
    root.classList.remove('is-free-scroll');

    const list = scenes();
    const { last: lastPin } = pinRange(list);
    index = lastPin >= 0 ? lastPin : index;
    root.dataset.sceneIndex = String(index);

    list.forEach((scene) => {
      scene.classList.remove('is-pin-tail', 'is-pin-prior');
      scene.classList.remove('is-entering', 'is-leaving');
    });

    heroSequence()?.onEnterPins?.();
    attachDirectedInput();
    show(index, 0);
    window.setTimeout(() => {
      busy = false;
    }, reduce ? 0 : 200);
  };

  const atFreeTop = () => window.scrollY <= 2;

  const onFreeWheel = (event: WheelEvent) => {
    if (!released) return;
    if (atFreeTop() && event.deltaY < -8) {
      event.preventDefault();
      if (!busy) relock();
      return;
    }
    // Otherwise native scrolling into Contact / footer.
  };

  const onFreeTouchMove = (event: TouchEvent) => {
    if (!released) return;
    const y = event.touches[0]?.clientY ?? touchY;
    const delta = touchY - y;
    if (Math.abs(delta) < 48) return;
    touchY = y;
    if (atFreeTop() && delta < 0) {
      event.preventDefault();
      if (!busy) relock();
    }
  };

  const onFreeKey = (event: KeyboardEvent) => {
    if (!released) return;
    const prev = ['ArrowUp', 'PageUp'].includes(event.key);
    if (!prev) return;
    if (!atFreeTop()) return;
    event.preventDefault();
    if (!busy) relock();
  };

  const step = (direction: SceneStep) => {
    if (released || busy) return;
    const list = scenes();
    const heroIndex = list.findIndex((scene) => scene.classList.contains('hm-hero'));
    if (index === heroIndex && !canAdvance()) return;
    const { first: firstPin, last: lastPin } = pinRange(list);
    const sequence = heroSequence();
    if (sceneHooks(list[index])?.onStep?.(direction)) {
      lock(reduce ? 0 : 140);
      return;
    }
    if (sequence && index === heroIndex) {
      if (sequence.onStep(direction > 0 ? 1 : -1)) {
        // Hero owns pacing (loop flush / one-shots). A long lock here swallows the
        // follow-up scrolls that queue leaving shard_floating — soft-locking the block.
        lock(reduce ? 0 : 140);
        return;
      }
    }

    // Still on 04 with the girl clip — next downward scroll opens the free tail.
    if (lastPin >= 0 && index === lastPin && direction > 0) {
      unlock();
      return;
    }

    const next = index + direction;
    if (next < 0 || next >= list.length) return;
    // Tail scene exists after pins but is only reached via unlock, never via step.
    if (lastPin >= 0 && next > lastPin) return;

    if (sequence && next === heroIndex && direction < 0) sequence.onReturn();
    if (sequence && index === heroIndex && direction > 0) sequence.onLeave();
    if (sequence && lastPin >= 0 && index === lastPin && direction > 0 && next > lastPin) {
      sequence.onAfterPins?.();
    }
    if (sequence && lastPin >= 0 && next === lastPin && direction < 0 && index > lastPin) {
      sequence.onEnterPins?.();
    }
    if (
      sequence &&
      firstPin >= 0 &&
      index === firstPin &&
      direction < 0 &&
      next === heroIndex
    ) {
      // onReturn already ran above; keep city girl under the hero again.
    }
    lock();
    show(next, direction);
  };

  const onJump = (event: Event) => {
    if (released) return;
    const target = (event as CustomEvent<HTMLElement>).detail;
    const list = scenes();
    const next = list.indexOf(target);
    if (next < 0 || next === index) return;
    const heroIndex = list.findIndex((scene) => scene.classList.contains('hm-hero'));
    if (index === heroIndex) heroSequence()?.onLeave();
    if (list[next]?.classList.contains('hm-panel')) heroSequence()?.onEnterPins?.();
    lock();
    show(next, 0);
  };

  const onCityReady = () => {
    if (released || busy) return;
    const list = scenes();
    const heroIndex = list.findIndex((scene) => scene.classList.contains('hm-hero'));
    if (heroIndex < 0 || index !== heroIndex) return;
    const sequence = heroSequence();
    sequence?.onLeave();
    lock();
    show(heroIndex + 1, 1);
  };

  const onWheel = (event: WheelEvent) => {
    if (released) return;
    event.preventDefault();
    if (Math.abs(event.deltaY) < 8) return;
    step(event.deltaY > 0 ? 1 : -1);
  };

  const onTouchStart = (event: TouchEvent) => {
    touchY = event.touches[0]?.clientY ?? 0;
  };

  const onTouchMove = (event: TouchEvent) => {
    if (released) return;
    event.preventDefault();
    const y = event.touches[0]?.clientY ?? touchY;
    const delta = touchY - y;
    if (Math.abs(delta) < 48) return;
    touchY = y;
    step(delta > 0 ? 1 : -1);
  };

  const onKey = (event: KeyboardEvent) => {
    if (released) return;
    const next = ['ArrowDown', 'PageDown', ' '].includes(event.key);
    const prev = ['ArrowUp', 'PageUp'].includes(event.key);
    if (!next && !prev) return;
    event.preventDefault();
    step(next ? 1 : -1);
  };

  attachDirectedInput();
  show(0);

  return () => {
    document.documentElement.classList.remove('hm-home', 'hm-directed');
    detachDirectedInput();
    detachFreeInput();
  };
}
