import { useEffect } from 'react';
import type { RefObject } from 'react';
import gsap from 'gsap';
import { prefersReducedMotion } from './springConfig';

interface MagneticOptions {
  /** How far the element travels relative to cursor offset (0–1). */
  strength?: number;
  /** Extra radius (px) added around the element's own box that still counts as "inside". */
  padding?: number;
  /** Hard cap on displacement, so the button always stays under the cursor. */
  maxShift?: number;
}

const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));

/**
 * Lusion-style magnetic hover: the element eases toward the pointer while it's
 * nearby, then springs back with an elastic ease on release. No-ops on touch
 * devices and when the user prefers reduced motion.
 */
export function useMagneticHover<T extends HTMLElement>(
  refs: Array<RefObject<T | null>>,
  { strength = 0.35, padding = 12, maxShift = 14 }: MagneticOptions = {},
) {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (typeof window === 'undefined') return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const cleanups: Array<() => void> = [];

    refs.forEach((ref) => {
      const el = ref.current;
      if (!el) return;

      const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });

      const onMove = (event: PointerEvent) => {
        // getBoundingClientRect() reports the element where it currently sits,
        // transform included. Measuring against that makes the button chase the
        // cursor a little further on every move until it slides out from under
        // it — the pointer then leaves, it springs back, and the click lands on
        // whatever is behind. Subtracting the live transform recovers the rest
        // position, and the clamp keeps it under the cursor regardless.
        const rect = el.getBoundingClientRect();
        const shiftX = Number(gsap.getProperty(el, 'x')) || 0;
        const shiftY = Number(gsap.getProperty(el, 'y')) || 0;
        const cx = rect.left + rect.width / 2 - shiftX;
        const cy = rect.top + rect.height / 2 - shiftY;

        xTo(clamp((event.clientX - cx) * strength, maxShift));
        yTo(clamp((event.clientY - cy) * strength, maxShift));

        const mx = ((event.clientX - rect.left) / rect.width) * 100;
        const my = ((event.clientY - rect.top) / rect.height) * 100;
        el.style.setProperty('--mx', `${mx}%`);
        el.style.setProperty('--my', `${my}%`);
      };

      const onLeave = () => {
        gsap.to(el, { x: 0, y: 0, duration: 0.65, ease: 'elastic.out(1, 0.4)' });
      };

      const area = el;
      area.style.setProperty('--magnetic-padding', `${padding}px`);
      area.addEventListener('pointermove', onMove);
      area.addEventListener('pointerleave', onLeave);

      cleanups.push(() => {
        area.removeEventListener('pointermove', onMove);
        area.removeEventListener('pointerleave', onLeave);
        gsap.set(el, { x: 0, y: 0 });
      });
    });

    return () => cleanups.forEach((fn) => fn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refs.length, strength, padding, maxShift]);
}
