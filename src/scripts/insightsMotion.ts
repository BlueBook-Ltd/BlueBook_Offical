import { bootMotion, enterLoad, gsap, reveal, ScrollTrigger } from "./motion/bootMotion";

declare global {
  interface Window {
    __bbInsightsMotion?: boolean;
  }
}

/**
 * News / Insights listing — featured hero load + publication list reveals.
 * Infinite-scroll rows animate via `bb:infinite-append` from infiniteArticles.
 */
bootMotion(".insights", (root) => {
  if (window.__bbInsightsMotion || root.dataset.insightsMotion === "1") return;
  window.__bbInsightsMotion = true;
  root.dataset.insightsMotion = "1";

  const hero = root.querySelector<HTMLElement>(".insights__hero");
  const heroImg = root.querySelector<HTMLElement>(".insights__hero-media img");
  const heroCopy = root.querySelectorAll<HTMLElement>(".insights__hero-copy > *");

  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

  if (hero) {
    gsap.set(hero, { opacity: 0, y: 28 });
    tl.to(hero, {
      opacity: 1,
      y: 0,
      duration: 0.85,
      clearProps: "transform",
      onComplete: () => gsap.set(hero, { opacity: 1, clearProps: "transform" }),
    });
  }
  if (heroImg) {
    gsap.set(heroImg, { scale: 1.08 });
    tl.to(
      heroImg,
      {
        scale: 1,
        duration: 1.15,
        ease: "power2.out",
        clearProps: "transform",
      },
      0,
    );
  }
  if (heroCopy.length) {
    gsap.set(heroCopy, { opacity: 0, y: 22 });
    tl.to(
      heroCopy,
      {
        opacity: 1,
        y: 0,
        duration: 0.75,
        stagger: 0.09,
        clearProps: "transform",
        onComplete: () => gsap.set(heroCopy, { opacity: 1, clearProps: "transform" }),
      },
      0.2,
    );
  }

  const listWrap = root.querySelector<HTMLElement>(".insights__list-wrap");
  const listLabel = root.querySelector<HTMLElement>(".insights__list-label");
  if (listLabel && listWrap) {
    reveal(listLabel, { trigger: listWrap, y: 18, duration: 0.65, start: "top 88%" });
  }

  const initialItems = root.querySelectorAll<HTMLElement>(".insights__item");
  if (initialItems.length && listWrap) {
    reveal(initialItems, {
      trigger: listWrap,
      y: 32,
      stagger: 0.12,
      duration: 0.8,
      start: "top 84%",
    });
  }

  // Newly appended infinite-scroll rows
  root.addEventListener("bb:infinite-append", ((e: CustomEvent<{ nodes: HTMLElement[] }>) => {
    const nodes = e.detail?.nodes?.filter(Boolean) ?? [];
    if (!nodes.length) return;
    enterLoad(nodes, { y: 28, duration: 0.7, stagger: 0.1 });
  }) as EventListener);

  window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true });
});
