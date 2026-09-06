import { bootMotion, enterLoad, gsap, reveal, ScrollTrigger } from "./motion/bootMotion";

declare global {
  interface Window {
    __bbContactMotion?: boolean;
  }
}

/**
 * Contact page — hero load, info + form card, then map.
 * Keep fields interactive: animate wrappers, not input values.
 */
bootMotion(".contact-page", (root) => {
  if (window.__bbContactMotion || root.dataset.contactMotion === "1") return;
  window.__bbContactMotion = true;
  root.dataset.contactMotion = "1";

  /* —— Hero —— */
  const heroBits = root.querySelectorAll<HTMLElement>(".cu-hero .cu-rail > *");
  if (heroBits.length) {
    enterLoad(heroBits, { y: 36, duration: 0.9, stagger: 0.12 });
  }

  /* —— Split: info + form —— */
  const split = root.querySelector<HTMLElement>(".cu-split");
  if (split) {
    const blocks = split.querySelectorAll<HTMLElement>(".cu-block");
    if (blocks.length) {
      reveal(blocks, {
        trigger: split,
        y: 28,
        x: -16,
        stagger: 0.14,
        duration: 0.8,
        start: "top 78%",
      });
    }

    const card = split.querySelector<HTMLElement>(".cu-form-card");
    if (card) {
      gsap.set(card, { opacity: 0, y: 40, scale: 0.985 });
      gsap.to(card, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.95,
        ease: "power3.out",
        clearProps: "transform",
        onComplete: () => gsap.set(card, { opacity: 1, clearProps: "transform" }),
        scrollTrigger: {
          trigger: split,
          start: "top 76%",
          once: true,
        },
      });

      const rows = card.querySelectorAll<HTMLElement>(
        ".cu-form__row, .cu-field--full, .cu-form__foot",
      );
      if (rows.length) {
        reveal(rows, {
          trigger: card,
          y: 18,
          stagger: 0.08,
          duration: 0.6,
          start: "top 80%",
        });
      }
    }
  }

  /* —— Map —— */
  const mapSection = root.querySelector<HTMLElement>(".cu-map-section");
  const map = root.querySelector<HTMLElement>(".cu-map");
  if (mapSection && map) {
    gsap.set(map, { opacity: 0, y: 32 });
    gsap.to(map, {
      opacity: 1,
      y: 0,
      duration: 0.9,
      ease: "power3.out",
      clearProps: "transform",
      onComplete: () => gsap.set(map, { opacity: 1, clearProps: "transform" }),
      scrollTrigger: {
        trigger: mapSection,
        start: "top 85%",
        once: true,
      },
    });
  }

  /* —— Success state (when form swaps) —— */
  const success = root.querySelector<HTMLElement>("#formSuccess");
  if (success) {
    const observer = new MutationObserver(() => {
      if (success.hidden) return;
      const paras = success.querySelectorAll("p");
      gsap.set(paras, { opacity: 0, y: 16 });
      gsap.to(paras, {
        opacity: 1,
        y: 0,
        duration: 0.65,
        stagger: 0.1,
        ease: "power3.out",
        clearProps: "transform",
      });
      observer.disconnect();
    });
    observer.observe(success, { attributes: true, attributeFilter: ["hidden"] });
  }

  window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true });
});
