import { gsap } from 'gsap';
import { heroSequence } from '@/motion/heroSequence';

/**
 * Homepage does not scroll. Wheel, touch, and arrow keys step through the
 * preset scenes. Nothing advances until the looping hero video is playing.
 * The first step down from that loop stays on the hero: the type fades out,
 * then video 2 plays. When video 2 ends, the shard loop starts and the
 * statement fades in. Scrolling up fades that statement out and reverses
 * video 2.
 */
export function mountDirectedScroll(root: HTMLElement, canAdvance: () => boolean) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('hm-directed');

  let index = 0;
  let busy = false;
  let touchY = 0;

  const scenes = () => [...root.querySelectorAll<HTMLElement>('[data-scene]')];

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
    root.classList.toggle('is-on-hero', list[index]?.classList.contains('hm-hero') ?? false);
  };

  const lock = () => {
    busy = true;
    window.setTimeout(() => {
      busy = false;
    }, reduce ? 0 : 850);
  };

  const step = (direction: number) => {
    if (!canAdvance() || busy) return;
    const list = scenes();
    const heroIndex = list.findIndex((scene) => scene.classList.contains('hm-hero'));
    const sequence = heroSequence();
    if (sequence && index === heroIndex) {
      if (sequence.onStep(direction > 0 ? 1 : -1)) {
        lock();
        return;
      }
    }
    const next = index + direction;
    if (next < 0 || next >= list.length) return;
    if (sequence && next === heroIndex && direction < 0) sequence.onReturn();
    if (sequence && index === heroIndex && direction > 0) sequence.onLeave();
    lock();
    show(next);
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
  show(0);

  return () => {
    document.documentElement.classList.remove('hm-directed');
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('keydown', onKey);
  };
}
