import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

/** Gate on page root + reduced-motion; run setup in gsap.context; revert on pagehide. */
export function bootMotion(rootSelector: string, setup: (root: HTMLElement) => void) {
  const root = document.querySelector<HTMLElement>(rootSelector);
  if (!root) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    root.removeAttribute("data-motion-pending");
    return;
  }

  const context = gsap.context(() => {
    setup(root);
    // After gsap.set in setup owns opacity — drop CSS pending hide.
    root.removeAttribute("data-motion-pending");
  }, root);
  window.addEventListener("pagehide", () => context.revert(), { once: true });
}

type AxisOpts = {
  y?: number;
  x?: number;
  duration?: number;
  stagger?: number | gsap.StaggerVars;
  ease?: string;
  delay?: number;
};

/**
 * Load entrance: set hidden state NOW (avoids visible→0 jump), then animate in.
 */
export function enterLoad(target: gsap.TweenTarget, opts: AxisOpts = {}) {
  if (!target || (typeof target !== "string" && (target as NodeList).length === 0)) return;

  const { y = 32, duration = 0.9, ease = "power3.out", stagger, delay = 0, x } = opts;
  const from: gsap.TweenVars = { opacity: 0, y, ...(x !== undefined ? { x } : {}) };
  gsap.set(target, from);
  return gsap.to(target, {
    opacity: 1,
    y: 0,
    ...(x !== undefined ? { x: 0 } : {}),
    duration,
    ease,
    stagger,
    delay,
    clearProps: "transform",
    onComplete: () => {
      gsap.set(target, { opacity: 1, clearProps: "transform" });
    },
  });
}

/**
 * Scroll reveal — hide immediately on create, play to() when in view.
 * (fromTo + immediateRender:false caused a visible snap/jump on enter.)
 */
export function reveal(
  target: gsap.TweenTarget,
  opts: AxisOpts & {
    start?: string;
    trigger?: string | Element;
  } = {},
) {
  if (!target || (typeof target !== "string" && (target as NodeList).length === 0)) return;

  const {
    y = 36,
    duration = 0.8,
    ease = "power3.out",
    start = "top 84%",
    trigger,
    stagger,
    x,
  } = opts;

  let triggerEl: string | Element | undefined = trigger;
  if (!triggerEl && typeof target === "string") triggerEl = target;
  else if (!triggerEl && target instanceof Element) triggerEl = target;

  const from: gsap.TweenVars = { opacity: 0, y, ...(x !== undefined ? { x } : {}) };
  gsap.set(target, from);

  return gsap.to(target, {
    opacity: 1,
    y: 0,
    ...(x !== undefined ? { x: 0 } : {}),
    duration,
    ease,
    stagger,
    clearProps: "transform",
    onComplete: () => {
      gsap.set(target, { opacity: 1, clearProps: "transform" });
    },
    scrollTrigger: {
      trigger: triggerEl,
      start,
      once: true,
      toggleActions: "play none none none",
    },
  });
}

/** Batch stagger reveal with a shared section trigger. */
export function revealBatch(
  selector: string,
  opts: {
    trigger: string | Element;
    start?: string;
    y?: number;
    x?: number | ((i: number) => number);
    duration?: number;
    stagger?: number;
    ease?: string;
  },
) {
  const {
    trigger,
    start = "top 80%",
    y = 34,
    duration = 0.7,
    ease = "power3.out",
    stagger = 0.1,
    x,
  } = opts;

  gsap.set(selector, { opacity: 0, y, ...(typeof x === "number" ? { x } : {}) });

  return gsap.to(selector, {
    opacity: 1,
    y: 0,
    ...(typeof x === "number" ? { x: 0 } : x !== undefined ? { x } : {}),
    duration,
    ease,
    stagger,
    clearProps: "transform",
    scrollTrigger: {
      trigger,
      start,
      once: true,
    },
  });
}
