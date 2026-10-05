import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function getParts(section: HTMLElement) {
  return {
    cards: gsap.utils.toArray<HTMLElement>(
      section.querySelectorAll(
        ":scope [data-reveal-card], :scope article, :scope .card, :scope .feature, :scope .step",
      ),
    ),
    headers: gsap.utils.toArray<HTMLElement>(
      section.querySelectorAll(
        ":scope [data-reveal-header], :scope [data-reveal-step], :scope h1, :scope h2, :scope h3, :scope .section-kicker, :scope .eyebrow",
      ),
    ),
    body: gsap.utils.toArray<HTMLElement>(
      section.querySelectorAll(
        ":scope [data-reveal-body], :scope p, :scope li, :scope .btn, :scope button",
      ),
    ),
  };
}

function setupSectionReveals() {
  const skip = ".hero, [data-compare], [data-story-scene]";

  document
    .querySelectorAll<HTMLElement>("#main-content section")
    .forEach((section) => {
    // Footer / get-in-touch stay solid — no scroll fade.
    if (
      section.matches("footer, .site-footer, .git") ||
      section.closest("footer, .site-footer, .git")
    ) {
      return;
    }
    // Landing / chrome / blog listings have their own motion (or none).
    if (
      section.closest(".figma-landing") ||
      section.closest("[data-news]") ||
      section.closest("[data-news-detail]") ||
      section.closest(".insights") ||
      section.closest(".contact-page")
    ) {
      return;
    }
    if (
      section.matches(skip) ||
      section.closest("[data-story-scene]") ||
      section.querySelector("[data-story-scene]")
    ) return;

    const { cards, headers, body } = getParts(section);

    // Hide now — avoids visible→0 jump when ScrollTrigger plays the timeline.
    gsap.set(section, { autoAlpha: 0, y: 36, clipPath: "inset(7% 0 7% 0 round 20px)" });
    if (cards.length) gsap.set(cards, { autoAlpha: 0, y: 28, clipPath: "inset(0 100% 0 0)" });
    if (headers.length) gsap.set(headers, { autoAlpha: 0, yPercent: 35, clipPath: "inset(0 0 100% 0)" });
    if (body.length) gsap.set(body, { autoAlpha: 0, y: 12 });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "top 78%",
        once: true,
        toggleActions: "play none none none",
      },
    });

    tl.to(section, {
      autoAlpha: 1,
      y: 0,
      clipPath: "inset(0% 0 0% 0 round 0px)",
      duration: 1,
      ease: "power3.out",
      clearProps: "clipPath,transform",
    });

    if (cards.length) {
      tl.to(
        cards,
        {
          autoAlpha: 1,
          y: 0,
          clipPath: "inset(0 0% 0 0)",
          duration: 0.8,
          stagger: 0.1,
          ease: "power3.out",
          clearProps: "clipPath,transform",
        },
        "-=0.5",
      );
    }

    if (headers.length) {
      tl.to(
        headers,
        {
          autoAlpha: 1,
          yPercent: 0,
          clipPath: "inset(0 0 0% 0)",
          duration: 0.72,
          stagger: 0.07,
          ease: "power3.out",
          clearProps: "clipPath,transform",
        },
        "-=0.42",
      );
    }

    if (body.length) {
      tl.to(
        body,
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.5,
          stagger: 0.035,
          ease: "power2.out",
          clearProps: "transform",
        },
        "-=0.32",
      );
    }
    });
}

function setupStoryIntro() {
  const intro = document.querySelector<HTMLElement>(".story__intro");
  if (!intro) return;

  const kids = intro.querySelectorAll("h2, p");
  gsap.set(intro, { autoAlpha: 0, clipPath: "inset(0 0 100% 0)", y: 30 });
  if (kids.length) gsap.set(kids, { autoAlpha: 0, y: 18 });

  gsap
    .timeline({
      scrollTrigger: {
        trigger: intro,
        start: "top 78%",
        once: true,
        toggleActions: "play none none none",
      },
    })
    .to(intro, {
      autoAlpha: 1,
      clipPath: "inset(0 0 0% 0)",
      y: 0,
      duration: 1,
      ease: "power3.out",
    })
    .to(
      kids,
      { autoAlpha: 1, y: 0, duration: 0.65, stagger: 0.09, ease: "power3.out" },
      "-=0.45",
    );
}

function setupCompareScene(scene: HTMLElement, pin: boolean) {
  const after = scene.querySelector<HTMLElement>("[data-compare-after]");
  const divider = scene.querySelector<HTMLElement>("[data-compare-divider]");
  const visual = scene.querySelector<HTMLElement>("[data-compare-visual]");
  if (!after || !divider || !visual) return;

  gsap.set(after, { clipPath: "inset(0 100% 0 0)" });
  gsap.set(divider, { x: 0 });

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: scene,
      start: pin ? "top top" : "top 72%",
      end: pin ? "+=110%" : "bottom 28%",
      scrub: 0.85,
      pin,
      anticipatePin: pin ? 1 : 0,
      invalidateOnRefresh: true,
    },
  });

  tl.to(after, { clipPath: "inset(0 0% 0 0)", ease: "none" }, 0).to(
    divider,
    { x: () => visual.clientWidth, ease: "none" },
    0,
  );
}

function setupCompareScenes(pin: boolean) {
  document
    .querySelectorAll<HTMLElement>("[data-compare]")
    .forEach((scene) => setupCompareScene(scene, pin));
}

function setupHeroTransition() {
  const hero = document.querySelector<HTMLElement>(".hero");
  const copy = hero?.querySelector<HTMLElement>(".hero__copy");
  const next = hero?.nextElementSibling as HTMLElement | null;
  // Figma landing keeps static hero layout — scroll clipPath would cut content.
  if (!hero || !copy || hero.hasAttribute("data-no-hero-transition")) return;

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: hero,
      start: "top top",
      end: "bottom top",
      scrub: 0.8,
    },
  });

  tl.to(
    copy,
    {
      yPercent: -24,
      autoAlpha: 0,
      clipPath: "inset(0 0 100% 0)",
      ease: "none",
    },
    0,
  ).to(hero, { clipPath: "inset(0 0 10% 0 round 0 0 34px 34px)", ease: "none" }, 0);

  if (next) {
    tl.fromTo(
      next,
      { clipPath: "inset(16% 0 0 0 round 30px 30px 0 0)" },
      { clipPath: "inset(0% 0 0 0 round 0px)", ease: "none" },
      0.08,
    );
  }
}

function addAmbientField() {
  if (document.querySelector(".motion-ambient")) return;
  const field = document.createElement("div");
  field.className = "motion-ambient";
  field.setAttribute("aria-hidden", "true");
  field.innerHTML = Array.from({ length: 14 }, () => "<i></i>").join("");
  document.body.prepend(field);
}

function boot() {
  document.documentElement.classList.add("motion-enabled");
  // Shader bg (or legacy landing surface) already owns the field.
  if (
    !document.querySelector(".shader-preview--background") &&
    !document.querySelector(".figma-landing")
  ) {
    addAmbientField();
  }

  if (reducedMotion.matches) {
    document.documentElement.classList.add("motion-reduced");
    return;
  }

  setupHeroTransition();
  setupSectionReveals();
  setupStoryIntro();

  const media = gsap.matchMedia();
  media.add("(min-width: 901px)", () => setupCompareScenes(true));
  media.add("(max-width: 900px)", () => setupCompareScenes(false));

  window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
