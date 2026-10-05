import { Controller } from '@react-spring/web';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { prefersReducedMotion, springReveal } from './springConfig';

/** Owned by React Spring component trees — don't double-bind. */
const SKIP = '.figma-landing, .home-stage, [data-spring-own], footer, .site-footer, .git, .hero, [data-no-spring]';

function springElement(el: HTMLElement, fromY = 36) {
  el.style.opacity = '0';
  el.style.transform = `translate3d(0, ${fromY}px, 0)`;
  el.style.willChange = 'opacity, transform';

  const ctrl = new Controller({ opacity: 0, y: fromY });
  const run = () => {
    void ctrl.start({
      opacity: 1,
      y: 0,
      config: springReveal,
      onChange: ({ value }) => {
        const v = value as { opacity: number; y: number };
        el.style.opacity = String(v.opacity);
        el.style.transform = `translate3d(0, ${v.y}px, 0)`;
      },
      onRest: () => {
        el.style.opacity = '';
        el.style.transform = '';
        el.style.willChange = '';
      },
    });
  };

  return { ctrl, run };
}

/**
 * Site-wide React Spring scroll physics.
 * Sections (and pending hero bits) settle with mass/tension/friction.
 */
export default function SpringPageMotion() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Lift CSS hide-gates so springs own visibility
    document.querySelectorAll('[data-motion-pending]').forEach((el) => {
      if (el.classList.contains('figma-landing') || el.hasAttribute('data-spring-own')) return;
      el.removeAttribute('data-motion-pending');
    });

    if (prefersReducedMotion()) return;

    const cleanups: Array<() => void> = [];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement & { __runSpring?: () => void };
          el.__runSpring?.();
          observer.unobserve(el);
        }
      },
      { rootMargin: '-6% 0px -12% 0px', threshold: 0.1 },
    );

    const bind = (el: HTMLElement, fromY?: number) => {
      if (el.dataset.springBound === '1') return;
      if (el.matches(SKIP) || el.closest(SKIP)) return;
      el.dataset.springBound = '1';
      const { ctrl, run } = springElement(el, fromY);
      (el as HTMLElement & { __runSpring?: () => void }).__runSpring = run;
      observer.observe(el);
      cleanups.push(() => {
        ctrl.stop(true);
        delete el.dataset.springBound;
        delete (el as HTMLElement & { __runSpring?: () => void }).__runSpring;
        el.style.opacity = '';
        el.style.transform = '';
        el.style.willChange = '';
      });
    };

    document
      .querySelectorAll<HTMLElement>(
        [
          '#main-content section',
          '#main-content .cu-hero',
          '#main-content .cu-split',
          '#main-content .insights',
          '#main-content [data-news-detail]',
        ].join(', '),
      )
      .forEach((s) => bind(s, 40));

    // Card/list items get a lighter settle after the section
    document
      .querySelectorAll<HTMLElement>(
        '#main-content .insights__item, #main-content .nd-more__card',
      )
      .forEach((el, i) => bind(el, 24 + (i % 3) * 4));

    return () => {
      observer.disconnect();
      cleanups.forEach((fn) => fn());
    };
  }, [pathname]);

  return null;
}
