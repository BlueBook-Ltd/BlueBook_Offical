import { bootMotion, gsap, reveal, ScrollTrigger } from "./motion/bootMotion";

declare global {
  interface Window {
    __bbWaMotion?: boolean;
  }
}

/** Parse "40%", "3×", "12hrs" style metric labels into a tweenable number + suffix. */
function parseMetric(raw: string): { end: number; suffix: string; decimals: number } | null {
  const m = raw.trim().match(/^([\d.]+)\s*(.*)$/);
  if (!m) return null;
  const end = Number(m[1]);
  if (!Number.isFinite(end)) return null;
  const suffix = m[2] ?? "";
  const decimals = m[1].includes(".") ? m[1].split(".")[1].length : 0;
  return { end, suffix, decimals };
}

/**
 * WhatsApp AI Agent page motion — hero load + section beats.
 * Safe reveals only (once + clearProps); no section-wide autoAlpha.
 */
bootMotion(".wa", (root) => {
  if (window.__bbWaMotion || root.dataset.waMotion === "1") return;
  window.__bbWaMotion = true;
  root.dataset.waMotion = "1";

  /* —— Hero —— */
  const heroBits = root.querySelectorAll<HTMLElement>(
    ".wa-hero__copy > .wa-kicker, .wa-hero__copy > h1, .wa-hero__lead, .wa-hero__cta",
  );
  const heroVisual = root.querySelector<HTMLElement>(".wa-hero__visual");
  const heroShot = root.querySelector<HTMLElement>(".wa-hero__shot");

  const heroTl = gsap.timeline({ defaults: { ease: "power3.out" } });
  if (heroBits.length) {
    gsap.set(heroBits, { opacity: 0, y: 34 });
    heroTl.to(heroBits, {
      opacity: 1,
      y: 0,
      duration: 0.9,
      stagger: 0.11,
      clearProps: "transform",
      onComplete: () => gsap.set(heroBits, { opacity: 1, clearProps: "transform" }),
    });
  }
  if (heroVisual) {
    gsap.set(heroVisual, { opacity: 0, x: 44, scale: 0.97 });
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
      0.14,
    );
  }
  if (heroShot) {
    gsap.to(heroShot, {
      y: -14,
      ease: "none",
      scrollTrigger: {
        trigger: root.querySelector(".wa-hero"),
        start: "top top",
        end: "bottom top",
        scrub: 0.7,
      },
    });
  }

  /* —— Problem —— */
  const problem = root.querySelector<HTMLElement>(".wa-problem");
  if (problem) {
    reveal(problem.querySelectorAll(".wa-problem__intro > *"), {
      trigger: problem,
      y: 30,
      stagger: 0.1,
      start: "top 80%",
    });
    problem.querySelectorAll<HTMLElement>(".wa-pain").forEach((pain, i) => {
      reveal(pain, {
        trigger: pain,
        y: 28,
        x: 18 + i * 6,
        duration: 0.75,
        start: "top 88%",
      });
    });
  }

  /* —— Solution + diagram —— */
  const solution = root.querySelector<HTMLElement>(".wa-solution");
  if (solution) {
    reveal(solution.querySelectorAll(".wa-solution__head > *"), {
      trigger: solution,
      y: 28,
      stagger: 0.09,
      start: "top 80%",
    });
    const diagram = solution.querySelector<HTMLElement>(".wa-diagram");
    if (diagram) {
      gsap.set(diagram, { opacity: 0, y: 40, scale: 0.98 });
      gsap.to(diagram, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 1,
        ease: "power3.out",
        clearProps: "transform",
        onComplete: () => gsap.set(diagram, { opacity: 1, clearProps: "transform" }),
        scrollTrigger: {
          trigger: diagram,
          start: "top 82%",
          once: true,
        },
      });
    }
  }

  /* —— Capabilities (left / right) —— */
  const caps = root.querySelector<HTMLElement>(".wa-caps");
  if (caps) {
    reveal(caps.querySelectorAll(".wa-caps__head > *"), {
      trigger: caps,
      y: 22,
      stagger: 0.08,
      start: "top 80%",
    });
    caps.querySelectorAll<HTMLElement>(".wa-cap").forEach((cap) => {
      const fromRight = cap.classList.contains("wa-cap--right");
      reveal(cap, {
        trigger: cap,
        y: 22,
        x: fromRight ? 32 : -32,
        duration: 0.78,
        start: "top 88%",
      });
    });
  }

  /* —— Use cases —— */
  const cases = root.querySelector<HTMLElement>(".wa-cases");
  if (cases) {
    reveal(cases.querySelectorAll(".wa-cases__head > *"), {
      trigger: cases,
      y: 26,
      stagger: 0.09,
      start: "top 80%",
    });
    reveal(cases.querySelectorAll(".wa-case"), {
      trigger: cases,
      y: 30,
      stagger: 0.09,
      duration: 0.75,
      start: "top 74%",
    });
  }

  /* —— Steps —— */
  const steps = root.querySelector<HTMLElement>(".wa-steps");
  if (steps) {
    reveal(steps.querySelectorAll(".wa-steps__head > *"), {
      trigger: steps,
      y: 22,
      stagger: 0.08,
      start: "top 80%",
    });
    steps.querySelectorAll<HTMLElement>(".wa-steps__grid > li").forEach((step) => {
      const copy = step.querySelectorAll<HTMLElement>(".wa-step__copy > *");
      const media = step.querySelector<HTMLElement>(".wa-step__media");
      if (copy.length) {
        reveal(copy, {
          trigger: step,
          y: 24,
          stagger: 0.07,
          start: "top 86%",
        });
      }
      if (media) {
        reveal(media, {
          trigger: step,
          y: 28,
          x: 20,
          duration: 0.85,
          start: "top 86%",
        });
      }
    });
  }

  /* —— Impact: metrics count-up + quotes —— */
  const impact = root.querySelector<HTMLElement>(".wa-impact");
  if (impact) {
    const title = impact.querySelector<HTMLElement>(".wa-shell > h2");
    if (title) reveal(title, { trigger: impact, y: 24, start: "top 80%" });

    const metricEls = impact.querySelectorAll<HTMLElement>(".wa-metrics > *");
    if (metricEls.length) {
      reveal(metricEls, {
        trigger: impact,
        y: 28,
        stagger: 0.1,
        start: "top 74%",
      });

      metricEls.forEach((article) => {
        const strong = article.querySelector("strong");
        if (!strong) return;
        const parsed = parseMetric(strong.textContent || "");
        if (!parsed) return;

        const state = { n: 0 };
        gsap.to(state, {
          n: parsed.end,
          duration: 1.25,
          ease: "power2.out",
          onUpdate: () => {
            strong.textContent = `${state.n.toFixed(parsed.decimals)}${parsed.suffix}`;
          },
          scrollTrigger: {
            trigger: article,
            start: "top 85%",
            once: true,
          },
        });
      });
    }

    reveal(impact.querySelectorAll(".wa-quotes > *"), {
      trigger: impact.querySelector(".wa-quotes") ?? impact,
      y: 22,
      stagger: 0.12,
      start: "top 85%",
    });
  }

  window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true });
});
