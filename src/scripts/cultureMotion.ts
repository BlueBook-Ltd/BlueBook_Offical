import { bootMotion, gsap } from "./motion/bootMotion";

declare global {
  interface Window {
    __bbCultureMotion?: boolean;
  }
}

/**
 * Culture & Code listing — editorial masonry entrance + filter restagger.
 * Respects data-news-pending (CSS opacity:0 until intro completes).
 */
const rootEarly = document.querySelector<HTMLElement>("[data-news]");
if (rootEarly && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  rootEarly.removeAttribute("data-news-pending");
}

bootMotion("[data-news]", (root) => {
  if (window.__bbCultureMotion || root.dataset.cultureMotion === "1") return;
  window.__bbCultureMotion = true;
  root.dataset.cultureMotion = "1";

  const heading = root.querySelector<HTMLElement>("[data-news-heading]");
  const filters = Array.from(
    root.querySelectorAll<HTMLElement>("[data-filters] [data-filter]"),
  );
  const pins = Array.from(root.querySelectorAll<HTMLElement>("[data-grid] [data-card]"));
  const thumbs = pins
    .map((p) => p.querySelector<HTMLElement>(".news__thumb img"))
    .filter(Boolean) as HTMLElement[];

  const intro = [heading, ...filters].filter(Boolean) as HTMLElement[];

  gsap.set([...intro, ...pins], { opacity: 0, y: 16, force3D: true });
  if (thumbs.length) gsap.set(thumbs, { scale: 1.06 });

  const tl = gsap.timeline({
    defaults: { ease: "power3.out" },
    onComplete: () => {
      root.removeAttribute("data-news-pending");
      gsap.set([...intro, ...pins], { clearProps: "transform" });
      if (thumbs.length) gsap.set(thumbs, { clearProps: "transform" });
    },
  });

  if (heading) {
    tl.to(heading, { opacity: 1, y: 0, duration: 0.7 }, 0);
  }
  if (filters.length) {
    tl.to(
      filters,
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.05 },
      heading ? 0.12 : 0,
    );
  }
  if (pins.length) {
    tl.to(
      pins,
      {
        opacity: 1,
        y: 0,
        duration: 0.65,
        stagger: { each: 0.055, from: "start" },
      },
      0.22,
    );
  }
  if (thumbs.length) {
    tl.to(
      thumbs,
      {
        scale: 1,
        duration: 0.9,
        stagger: { each: 0.055, from: "start" },
        ease: "power2.out",
      },
      0.22,
    );
  }

  if (!intro.length && !pins.length) root.removeAttribute("data-news-pending");

  function visiblePins(): HTMLElement[] {
    return pins.filter((p) => p.style.display !== "none");
  }

  /** Restagger pins after tag filter changes. */
  root.addEventListener("bb:culture-filter", () => {
    const shown = visiblePins();
    if (!shown.length) return;

    const shownThumbs = shown
      .map((p) => p.querySelector<HTMLElement>(".news__thumb img"))
      .filter(Boolean) as HTMLElement[];

    gsap.killTweensOf(shown);
    gsap.set(shown, { opacity: 0, y: 18 });
    gsap.to(shown, {
      opacity: 1,
      y: 0,
      duration: 0.5,
      stagger: { each: 0.045, from: "start" },
      ease: "power2.out",
      clearProps: "transform",
    });
    if (shownThumbs.length) {
      gsap.set(shownThumbs, { scale: 1.04 });
      gsap.to(shownThumbs, {
        scale: 1,
        duration: 0.65,
        stagger: { each: 0.045, from: "start" },
        ease: "power2.out",
        clearProps: "transform",
      });
    }
  });
});
