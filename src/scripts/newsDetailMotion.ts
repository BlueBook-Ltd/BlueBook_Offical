import { bootMotion, enterLoad, gsap, reveal, ScrollTrigger } from "./motion/bootMotion";

/**
 * News + Culture & Code detail pages (shared NewsDetailContent).
 * Hero load → brief / case-study section beats → more articles.
 *
 * The dataset flag guards against running twice on the same root. It is
 * deliberately per-element rather than a global: each article renders a fresh
 * [data-news-detail] root, and a module-level flag would leave every article
 * after the first with its hero stuck behind the CSS pending-hide.
 */
function setupNewsDetailMotion(root: HTMLElement) {
  if (root.dataset.ndMotion === "1") return;
  root.dataset.ndMotion = "1";

  /* —— Hero —— */
  const heroItems = root.querySelectorAll<HTMLElement>("[data-nd-hero]");
  if (heroItems.length) {
    enterLoad(heroItems, { y: 30, duration: 0.85, stagger: 0.1 });
  }

  /* —— CMS / brief articles (default for culture + most news) —— */
  const brief = root.querySelector<HTMLElement>("[data-nd-brief]");
  if (brief) {
    const cover = brief.querySelector<HTMLElement>(".nd__callout--brief");
    const coverImg = cover?.querySelector("img");
    if (cover) {
      gsap.set(cover, { opacity: 0, y: 32 });
      gsap.to(cover, {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: "power3.out",
        clearProps: "transform",
        onComplete: () => gsap.set(cover, { opacity: 1, clearProps: "transform" }),
        scrollTrigger: { trigger: brief, start: "top 82%", once: true },
      });
    }
    if (coverImg) {
      gsap.set(coverImg, { scale: 1.06 });
      gsap.to(coverImg, {
        scale: 1,
        duration: 1.15,
        ease: "power2.out",
        clearProps: "transform",
        scrollTrigger: { trigger: brief, start: "top 82%", once: true },
      });
    }

    const proseKids = brief.querySelectorAll<HTMLElement>(".news-prose > *");
    if (proseKids.length) {
      reveal(proseKids, {
        trigger: brief,
        y: 22,
        stagger: 0.07,
        duration: 0.65,
        start: "top 78%",
      });
    } else {
      // Fallback summary paragraphs / CTA (no Markdoc body)
      const blocks = brief.querySelectorAll<HTMLElement>(
        "[data-nd-brief-item]:not(.nd__callout--brief)",
      );
      if (blocks.length) {
        reveal(blocks, {
          trigger: brief,
          y: 26,
          stagger: 0.1,
          duration: 0.7,
          start: "top 80%",
        });
      }
    }

    const cta = brief.querySelector<HTMLElement>(".nd__cta");
    if (cta && proseKids.length) {
      reveal(cta, { trigger: cta, y: 18, duration: 0.6, start: "top 92%" });
    }
  }

  /* —— Case-study layout —— */
  const sidebar = root.querySelector<HTMLElement>(".nd__sidebar");
  if (sidebar) {
    reveal(sidebar, { trigger: sidebar, y: 20, x: -16, duration: 0.75, start: "top 85%" });
  }

  root.querySelectorAll<HTMLElement>("[data-nd-reveal]").forEach((section) => {
    reveal(section, { trigger: section, y: 36, duration: 0.85, start: "top 84%" });

    const calloutImg = section.querySelector<HTMLElement>(".nd__callout img");
    if (calloutImg) {
      gsap.set(calloutImg, { scale: 1.05 });
      gsap.to(calloutImg, {
        scale: 1,
        duration: 1.1,
        ease: "power2.out",
        clearProps: "transform",
        scrollTrigger: { trigger: section, start: "top 80%", once: true },
      });
    }
  });

  const cards = root.querySelectorAll<HTMLElement>(".nd__cards .nd__card");
  if (cards.length) {
    reveal(cards, {
      trigger: root.querySelector(".nd__cards") ?? root,
      y: 28,
      stagger: 0.12,
      duration: 0.75,
      start: "top 84%",
    });
  }

  const rows = root.querySelectorAll<HTMLElement>(".nd__table tbody tr");
  if (rows.length) {
    reveal(rows, {
      trigger: root.querySelector(".nd__table-wrap") ?? root,
      y: 16,
      stagger: 0.08,
      duration: 0.55,
      start: "top 86%",
    });
  }

  const outcomes = root.querySelectorAll<HTMLElement>(".nd__outcomes .nd__outcome");
  if (outcomes.length) {
    reveal(outcomes, {
      trigger: root.querySelector(".nd__outcomes") ?? root,
      y: 24,
      stagger: 0.1,
      duration: 0.7,
      start: "top 86%",
    });
  }

  /* —— More articles —— */
  const more = root.querySelector<HTMLElement>(".nd-more");
  if (more) {
    const moreTitle = more.querySelector<HTMLElement>(".nd-more__title");
    if (moreTitle) reveal(moreTitle, { trigger: more, y: 20, start: "top 88%" });

    const moreCards = more.querySelectorAll<HTMLElement>(".nd-more__card");
    if (moreCards.length) {
      reveal(moreCards, {
        trigger: more,
        y: 28,
        stagger: 0.1,
        duration: 0.7,
        start: "top 84%",
      });
    }

    more.addEventListener("bb:infinite-append", ((e: CustomEvent<{ nodes: HTMLElement[] }>) => {
      const nodes = e.detail?.nodes?.filter(Boolean) ?? [];
      if (!nodes.length) return;
      enterLoad(nodes, { y: 24, duration: 0.65, stagger: 0.08 });
    }) as EventListener);
  }

  window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true });
}

/**
 * Must be called after the article has rendered. bootMotion resolves its root
 * with a single querySelector, so running this at import time — while the
 * article is still being fetched — finds nothing and silently does nothing,
 * leaving the hero hidden until the 2.5s fail-open timer.
 */
export function initNewsDetailMotion() {
  const boot = () => {
    const root = document.querySelector<HTMLElement>("[data-news-detail]");
    if (!root) return;
    // The fail-open timer may already have revealed the hero. Animating from
    // opacity 0 at this point would blink it back out before fading it in.
    if (!root.hasAttribute("data-motion-pending")) root.dataset.ndMotion = "1";
    bootMotion("[data-news-detail]", setupNewsDetailMotion);
  };

  if (!document.hidden) {
    boot();
    return;
  }

  // GSAP is driven by requestAnimationFrame, which browsers pause in a
  // background tab. Booting there would gsap.set() the hero to opacity 0 and
  // never run the tween that brings it back, so the headline would stay
  // invisible. Wait until the page is actually on screen.
  const onVisible = () => {
    if (document.hidden) return;
    document.removeEventListener("visibilitychange", onVisible);
    boot();
  };
  document.addEventListener("visibilitychange", onVisible);
}
