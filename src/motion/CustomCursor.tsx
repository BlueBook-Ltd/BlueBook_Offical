import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { prefersReducedMotion } from './springConfig';
import '@/styles/components/custom-cursor.css';

const HOVER_TARGETS = 'a, button, [role="button"], input, textarea, select, [data-cursor-hover]';

/**
 * A small trailing cursor: an instant dot plus a softer ring that lags
 * slightly behind, expanding over anything clickable. Desktop/fine-pointer
 * only — untouched on mobile, touch, and reduced-motion.
 */
export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (typeof window === 'undefined') return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    document.body.classList.add('has-custom-cursor');

    const dotX = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power2.out' });
    const dotY = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power2.out' });
    const ringX = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3.out' });
    const ringY = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3.out' });

    const onMove = (e: PointerEvent) => {
      dotX(e.clientX);
      dotY(e.clientY);
      ringX(e.clientX);
      ringY(e.clientY);
    };
    const onDown = () => ring.classList.add('is-pressed');
    const onUp = () => ring.classList.remove('is-pressed');
    const onOver = (e: PointerEvent) => {
      const target = (e.target as HTMLElement)?.closest(HOVER_TARGETS);
      ring.classList.toggle('is-hovering', Boolean(target));
    };
    const onLeaveWindow = () => {
      dot.style.opacity = '0';
      ring.style.opacity = '0';
    };
    const onEnterWindow = () => {
      dot.style.opacity = '1';
      ring.style.opacity = '1';
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointermove', onOver);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    document.addEventListener('mouseleave', onLeaveWindow);
    document.addEventListener('mouseenter', onEnterWindow);

    return () => {
      document.body.classList.remove('has-custom-cursor');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointermove', onOver);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.removeEventListener('mouseleave', onLeaveWindow);
      document.removeEventListener('mouseenter', onEnterWindow);
    };
  }, []);

  return (
    <div className="custom-cursor" aria-hidden="true">
      <div ref={ringRef} className="custom-cursor__ring" />
      <div ref={dotRef} className="custom-cursor__dot" />
    </div>
  );
}
