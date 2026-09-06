import { config } from '@react-spring/web';

/** Shared spring physics — soft mass for scroll-linked lag, snappy for reveals. */
export const springScroll = {
  // ponytail: ceiling = document scroll only; upgrade = Lenis + scroll containers
  mass: 1.15,
  tension: 48,
  friction: 26,
  clamp: false,
} as const;

export const springReveal = {
  mass: 1,
  tension: 170,
  friction: 22,
  clamp: false,
} as const;

export const springHero = {
  mass: 1.2,
  tension: 120,
  friction: 24,
} as const;

export const springParallax = {
  mass: 1.4,
  tension: 40,
  friction: 28,
} as const;

export const springPresets = {
  scroll: springScroll,
  reveal: springReveal,
  hero: springHero,
  parallax: springParallax,
  gentle: config.gentle,
  soft: config.soft,
} as const;

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
