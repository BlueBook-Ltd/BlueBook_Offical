import { gsap } from 'gsap';
import { heroSequence, HM_ENTER_CITY_PIN, HM_VIDEO_END_DONE } from '@/motion/heroSequence';

/**
 * Homepage does not scroll. Wheel, touch, and arrow keys step through the
 * preset scenes. Nothing advances until the looping hero video is playing.
 *
 * Each hero video block is atomic: a one-shot clip must play through once,
 * and a loop hold must complete ≥1 play, before the next block can start
 * (scroll during a block is queued / absorbed). Sequence:
 * Tree Looping → Tree_To_Shard_Cropped → shard_floating → City_To_Girl →
 * Girl_Loop under hm-pin → Video End → later scenes.
 */
export function mountDirectedScroll(root: HTMLElement, canAdvance: () => boolean) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('hm-directed');

  let index = 0;
  let busy = false;
  let touchY = 0;

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

  const show = (next: number) => {
    const list = scenes();
    if (!list.length) return;
    index = Math.max(0, Math.min(list.length - 1, next));
    root.dataset.sceneIndex = String(index);
    list.forEach((scene, i) => {
      const active = i === index;
      scene.classList.toggle('is-active', active);
      if (!active || scene.dataset.scenePlayed === '1' || reduce) return;
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
    root.classList.toggle(
      'is-on-hero',
      onHero || root.classList.contains('is-city-pin') || root.classList.contains('is-end-video'),
    );
  };

  const lock = (ms = reduce ? 0 : 850) => {
    busy = true;
    window.setTimeout(() => {
      busy = false;
    }, ms);
  };

  const step = (direction: number) => {
    if (!canAdvance() || busy) return;
    const list = scenes();
    const heroIndex = list.findIndex((scene) => scene.classList.contains('hm-hero'));
    const { first: firstPin, last: lastPin } = pinRange(list);
    const sequence = heroSequence();
    if (sequence && index === heroIndex) {
      if (sequence.onStep(direction > 0 ? 1 : -1)) {
        // Hero owns pacing (loop flush / one-shots). A long lock here swallows the
        // follow-up scrolls that queue leaving shard_floating — soft-locking the block.
        lock(reduce ? 0 : 140);
        return;
      }
    }
    const next = index + direction;
    if (next < 0 || next >= list.length) return;
    if (sequence && next === heroIndex && direction < 0) sequence.onReturn();
    if (sequence && index === heroIndex && direction > 0) sequence.onLeave();
    if (sequence && lastPin >= 0 && index === lastPin && direction > 0 && next > lastPin) {
      // Video End (or other finale) may hold before leaving the pin stack.
      if (sequence.onAfterPins?.()) {
        lock(reduce ? 0 : 140);
        return;
      }
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
    show(next);
  };

  const onCityReady = () => {
    if (busy) return;
    const list = scenes();
    const heroIndex = list.findIndex((scene) => scene.classList.contains('hm-hero'));
    if (heroIndex < 0 || index !== heroIndex) return;
    const sequence = heroSequence();
    sequence?.onLeave();
    lock();
    show(heroIndex + 1);
  };

  const onVideoEndDone = () => {
    if (busy) return;
    const list = scenes();
    const { last: lastPin } = pinRange(list);
    if (lastPin < 0 || index !== lastPin) return;
    const after = lastPin + 1;
    if (after >= list.length) return;
    lock();
    show(after);
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    if (Math.abs(event.deltaY) < 8) return;
    step(event.deltaY > 0 ? 1 : -1);
  };

  const onTouchStart = (event: TouchEvent) => {
    touchY = event.touches[0]?.clientY ?? 0;
  };

  const onTouchMove = (event: TouchEvent) => {
    event.preventDefault();
    const y = event.touches[0]?.clientY ?? touchY;
    const delta = touchY - y;
    if (Math.abs(delta) < 48) return;
    touchY = y;
    step(delta > 0 ? 1 : -1);
  };

  const onKey = (event: KeyboardEvent) => {
    const next = ['ArrowDown', 'PageDown', ' '].includes(event.key);
    const prev = ['ArrowUp', 'PageUp'].includes(event.key);
    if (!next && !prev) return;
    event.preventDefault();
    step(next ? 1 : -1);
  };

  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('keydown', onKey);
  root.addEventListener(HM_ENTER_CITY_PIN, onCityReady);
  root.addEventListener(HM_VIDEO_END_DONE, onVideoEndDone);
  show(0);

  return () => {
    document.documentElement.classList.remove('hm-directed');
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('keydown', onKey);
    root.removeEventListener(HM_ENTER_CITY_PIN, onCityReady);
    root.removeEventListener(HM_VIDEO_END_DONE, onVideoEndDone);
  };
}
