import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { prefersReducedMotion } from './springConfig';
import '@/styles/components/custom-cursor.css';

const HOVER_TARGETS = 'a, button, [role="button"], input, textarea, select, [data-cursor-hover]';

/** Sample at most this often while the pointer moves. */
const SAMPLE_INTERVAL_MS = 80;
/** Above this relative luminance the surface counts as light, so the cursor flips to black. */
const LIGHT_THRESHOLD = 0.62;
/**
 * Fixed, near-white fluid field painted behind the whole app. It is a sibling
 * of the content (z-index: -1), not an ancestor, so hit-testing never finds it
 * — but it is what the pointer is actually resting on.
 */
const PAGE_BACKDROP = '.shader-preview--background';

interface Sample {
  light: boolean;
  at: number;
}

const sampleCache = new WeakMap<Element, Sample>();

function parseRgba(value: string): { r: number; g: number; b: number; a: number } | null {
  const match = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i);
  if (!match) return null;
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: match[4] === undefined ? 1 : Number(match[4]),
  };
}

/** sRGB relative luminance, 0 (black) to 1 (white). */
function luminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Explicit override, so a surface can opt out of background detection.
 * `light` means "paint over a light surface" → black cursor; `dark` means the
 * opposite. Sources, nearest wins:
 *   1. `data-cursor-tone="light|dark"` on the element or an ancestor.
 *   2. The inherited `--cursor-tone` custom property, for state-dependent
 *      cases that CSS already knows about (e.g. a transparent header floating
 *      over the hero film, whose light page background would otherwise leak).
 */
function forcedTone(target: Element | null): boolean | null {
  if (!target) return null;

  const marker = target.closest('[data-cursor-tone]')?.getAttribute('data-cursor-tone');
  if (marker === 'light') return true;
  if (marker === 'dark') return false;

  const inherited = getComputedStyle(target).getPropertyValue('--cursor-tone').trim();
  if (inherited === 'light') return true;
  if (inherited === 'dark') return false;

  return null;
}

/**
 * Walks up from the element under the pointer to the first painted background
 * and reports whether it is light. Transparent layers fall through, so a white
 * card inside a dark page still reads as light.
 */
function surfaceIsLight(target: Element | null): boolean {
  if (!target) return false;

  const forced = forcedTone(target);
  if (forced !== null) return forced;

  const cached = sampleCache.get(target);
  if (cached && performance.now() - cached.at < 500) return cached.light;

  let light = false;
  let found = false;
  let node: Element | null = target;
  while (node && node !== document.documentElement) {
    const background = parseRgba(getComputedStyle(node).backgroundColor);
    if (background && background.a > 0.5) {
      light = luminance(background) > LIGHT_THRESHOLD;
      found = true;
      break;
    }
    node = node.parentElement;
  }

  // Nothing opaque behind the pointer: the page is showing the fixed fluid
  // shader field, which is near-white but is not an ancestor of the content
  // (so the walk above can never reach it). Read it as a light page instead of
  // defaulting to a white cursor that would vanish on it.
  if (!found) light = Boolean(document.querySelector(PAGE_BACKDROP));

  sampleCache.set(target, { light, at: performance.now() });
  return light;
}

/**
 * A small trailing cursor: an instant dot plus a softer ring that lags
 * slightly behind, expanding over anything clickable. Desktop/fine-pointer
 * only — untouched on mobile, touch, and reduced-motion.
 */
export default function CustomCursor() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (typeof window === 'undefined') return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const wrapper = wrapperRef.current;
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!wrapper || !dot || !ring) return;

    document.body.classList.add('has-custom-cursor');

    const dotX = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power2.out' });
    const dotY = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power2.out' });
    const ringX = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3.out' });
    const ringY = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3.out' });

    // The dot is white by default; over a light surface (white cards, light
    // sections) it flips to black so it stays visible.
    let lastSample = 0;
    const onMove = (e: PointerEvent) => {
      dotX(e.clientX);
      dotY(e.clientY);
      ringX(e.clientX);
      ringY(e.clientY);

      const now = performance.now();
      if (now - lastSample < SAMPLE_INTERVAL_MS) return;
      lastSample = now;
      const target = document.elementFromPoint(e.clientX, e.clientY);
      wrapper.classList.toggle('is-on-light', surfaceIsLight(target));
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
    <div ref={wrapperRef} className="custom-cursor" aria-hidden="true">
      <div ref={ringRef} className="custom-cursor__ring" />
      <div ref={dotRef} className="custom-cursor__dot" />
    </div>
  );
}
