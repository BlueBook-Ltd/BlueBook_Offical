import { bootMotion, gsap, reveal, ScrollTrigger } from "./motion/bootMotion";

declare global {
  interface Window {
    __bbOcrMotion?: boolean;
  }
}

/**
 * AI OCR page motion — product-page pacing: hero load, then section beats.
 * Safe reveals only (once + clearProps); no section-wide autoAlpha.
 */
bootMotion(".ocr", (root) => {
  if (window.__bbOcrMotion || root.dataset.ocrMotion === "1") return;
  window.__bbOcrMotion = true;
  root.dataset.ocrMotion = "1";

  /* —— Hero —— */
  const kickerRule = root.querySelector<HTMLElement>(".ocr-kicker__rule");
  const heroBits = root.querySelectorAll<HTMLElement>(
    ".ocr-hero__copy > .ocr-kicker, .ocr-hero__copy > h1, .ocr-hero__lead, .ocr-hero__copy > .ocr-btn",
  );
  const heroVisual = root.querySelector<HTMLElement>(".ocr-hero__visual");

  const heroTl = gsap.timeline({ defaults: { ease: "power3.out" } });
  if (kickerRule) {
    gsap.set(kickerRule, { transformOrigin: "left center", scaleX: 0 });
    heroTl.to(kickerRule, { scaleX: 1, duration: 0.55 }, 0);
  }
  if (heroBits.length) {
    gsap.set(heroBits, { opacity: 0, y: 34 });
    heroTl.to(
      heroBits,
      {
        opacity: 1,
        y: 0,
        duration: 0.9,
        stagger: 0.11,
        clearProps: "transform",
        onComplete: () => gsap.set(heroBits, { opacity: 1, clearProps: "transform" }),
      },
      0.05,
    );
  }
  if (heroVisual) {
    gsap.set(heroVisual, { opacity: 0, x: 40, scale: 0.98 });
    heroTl.to(
      heroVisual,
      {
        opacity: 1,
        x: 0,
        scale: 1,
        duration: 1.05,
        clearProps: "transform",
        onComplete: () => gsap.set(heroVisual, { opacity: 1, clearProps: "transform" }),
      },
      0.18,
    );
  }

  /* —— Problem —— */
  const problem = root.querySelector<HTMLElement>(".ocr-problem");
  if (problem) {
    reveal(problem.querySelectorAll(".ocr-problem__head > *"), {
      trigger: problem,
      y: 32,
      stagger: 0.1,
      start: "top 80%",
    });
    reveal(problem.querySelectorAll(".ocr-problem__list > li"), {
      trigger: problem,
      y: 26,
      x: -12,
      stagger: 0.12,
      start: "top 70%",
    });
  }

  /* —— Solution + accuracy badge —— */
  const solution = root.querySelector<HTMLElement>(".ocr-solution");
  if (solution) {
    const visual = solution.querySelector<HTMLElement>(".ocr-solution__visual");
    const badge = solution.querySelector<HTMLElement>(".ocr-solution__badge");
    const badgeValue = badge?.querySelector("strong");

    if (visual) {
      reveal(visual, { trigger: solution, y: 32, x: -28, duration: 0.95, start: "top 78%" });
    }
    reveal(solution.querySelectorAll(".ocr-solution__copy > *"), {
      trigger: solution,
      y: 28,
      stagger: 0.09,
      start: "top 78%",
    });

    if (badge && badgeValue) {
      const state = { n: 0 };
      gsap.set(badge, { opacity: 0, y: 16, scale: 0.92 });
      gsap.to(badge, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.7,
        ease: "power3.out",
        clearProps: "transform",
        onComplete: () => gsap.set(badge, { opacity: 1, clearProps: "transform" }),
        scrollTrigger: {
          trigger: solution,
          start: "top 70%",
          once: true,
        },
      });
      gsap.to(state, {
        n: 99.8,
        duration: 1.4,
        ease: "power2.out",
        delay: 0.15,
        onUpdate: () => {
          badgeValue.textContent = `${state.n.toFixed(1)}%`;
        },
        scrollTrigger: {
          trigger: solution,
          start: "top 70%",
          once: true,
        },
      });
    }
  }

  /* —— Applied intelligence —— */
  const applied = root.querySelector<HTMLElement>(".ocr-applied");
  if (applied) {
    reveal(applied.querySelectorAll(".ocr-applied__head > *"), {
      trigger: applied,
      y: 24,
      stagger: 0.08,
      start: "top 80%",
    });
    applied.querySelectorAll<HTMLElement>(".ocr-applied__item").forEach((item, i) => {
      reveal(item, {
        trigger: item,
        y: 36,
        duration: 0.8,
        start: "top 88%",
        // slight alternate feel via x
        x: i % 2 === 0 ? -16 : 16,
      });
    });
  }

  /* —— Industries —— */
  const industries = root.querySelector<HTMLElement>(".ocr-industries");
  if (industries) {
    reveal(industries.querySelectorAll(".ocr-industries__head > *"), {
      trigger: industries,
      y: 26,
      stagger: 0.09,
      start: "top 80%",
    });
    reveal(industries.querySelectorAll(".ocr-industry"), {
      trigger: industries,
      y: 40,
      stagger: 0.14,
      duration: 0.85,
      start: "top 72%",
    });
  }

  /* —— Features —— */
  const features = root.querySelector<HTMLElement>(".ocr-features");
  if (features) {
    const title = features.querySelector<HTMLElement>(".ocr-features__title");
    if (title) reveal(title, { trigger: features, y: 24, start: "top 80%" });
    reveal(features.querySelectorAll(".ocr-features__grid > li"), {
      trigger: features,
      y: 28,
      stagger: 0.09,
      start: "top 74%",
    });
  }

  /* —— Steps: sequential —— */
  const steps = root.querySelector<HTMLElement>(".ocr-steps");
  if (steps) {
    const label = steps.querySelector<HTMLElement>(".ocr-steps__label");
    if (label) reveal(label, { trigger: steps, y: 18, start: "top 84%" });
    reveal(steps.querySelectorAll(".ocr-steps__grid > li"), {
      trigger: steps,
      y: 30,
      stagger: 0.14,
      duration: 0.75,
      start: "top 78%",
    });
  }

  /* —— Demo —— */
  const demo = root.querySelector<HTMLElement>(".ocr-demo");
  if (demo) {
    reveal(demo.querySelectorAll(".ocr-kicker, h2"), {
      trigger: demo,
      y: 24,
      stagger: 0.1,
      start: "top 82%",
    });
    const frame = demo.querySelector<HTMLElement>(".ocr-demo__frame");
    if (frame) {
      gsap.set(frame, { opacity: 0, y: 36, scale: 0.97 });
      gsap.to(frame, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.95,
        ease: "power3.out",
        clearProps: "transform",
        onComplete: () => gsap.set(frame, { opacity: 1, clearProps: "transform" }),
        scrollTrigger: {
          trigger: demo,
          start: "top 78%",
          once: true,
        },
      });
    }
  }

  window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true });
});
