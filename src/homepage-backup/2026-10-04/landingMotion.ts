import { bootMotion, enterLoad, gsap, reveal, ScrollTrigger } from "./motion/bootMotion";

declare global {
  interface Window {
    __bbLandingMotion?: boolean;
  }
}

/**
 * Landing GSAP — restrained B2B motion.
 * Hero load + per-section scroll reveals (once). No section-wide autoAlpha
 * (that previously stuck whole strips after context.revert / double-boot).
 */
bootMotion(".figma-landing", (root) => {
  if (window.__bbLandingMotion || root.dataset.landingMotion === "1") return;
  window.__bbLandingMotion = true;
  root.dataset.landingMotion = "1";

  const one = (sel: string) => root.querySelector<HTMLElement>(sel);
  const all = (sel: string) => root.querySelectorAll<HTMLElement>(sel);

  /* —— Hero: load choreography —— */
  const heroBits = all(".hero__title, .hero__body, .hero__actions > a");
  if (heroBits.length) {
    enterLoad(heroBits, { y: 36, duration: 0.95, stagger: 0.12, delay: 0.1 });
  }

  /* —— Precision: type reveal + slow bg parallax —— */
  const precision = one(".precision");
  if (precision) {
    reveal(precision.querySelectorAll(".precision__title, .precision__body"), {
      trigger: precision,
      y: 44,
      stagger: 0.14,
      duration: 0.9,
      start: "top 78%",
    });
    const bg = precision.querySelector<HTMLElement>(".precision__bg");
    if (bg) {
      gsap.fromTo(
        bg,
        { y: 20 },
        {
          y: -24,
          ease: "none",
          scrollTrigger: {
            trigger: precision,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.7,
          },
        },
      );
    }
  }

  /* —— Mission: copy then art —— */
  const mission = one(".mission");
  if (mission) {
    reveal(mission.querySelectorAll(".mission__copy > *"), {
      trigger: mission,
      y: 32,
      stagger: 0.1,
      start: "top 80%",
    });
    const art = mission.querySelector<HTMLElement>(".mission__art");
    if (art) {
      reveal(art, { trigger: mission, y: 40, x: 28, duration: 0.95, start: "top 80%" });
    }
  }

  /* —— Shift: narrative + diagram nodes —— */
  const shift = one(".shift");
  if (shift) {
    reveal(shift.querySelectorAll(".shift__copy > *"), {
      trigger: shift,
      y: 28,
      stagger: 0.09,
      start: "top 80%",
    });
    const map = shift.querySelector<HTMLElement>(".shift__map");
    if (map) {
      const curve = map.querySelector<HTMLElement>(".shift__curve");
      if (curve) {
        reveal(curve, { trigger: map, y: 16, duration: 1, start: "top 82%" });
      }
      reveal(map.querySelectorAll(".shift__n, .shift__node"), {
        trigger: map,
        y: 22,
        stagger: 0.11,
        duration: 0.75,
        start: "top 82%",
      });
    }
  }

  /* —— Edge: each row on its own beat —— */
  all(".edge__row").forEach((row) => {
    const flip = row.classList.contains("edge__row--flip");
    reveal(row.querySelectorAll(".edge__copy > *, .edge__num"), {
      trigger: row,
      y: 30,
      x: flip ? -24 : 24,
      stagger: 0.08,
      duration: 0.75,
      start: "top 86%",
    });
  });

  /* —— Services: header, then list —— */
  const services = one(".services");
  if (services) {
    reveal(services.querySelectorAll(".services__head > *"), {
      trigger: services,
      y: 28,
      stagger: 0.08,
      start: "top 80%",
    });
    reveal(services.querySelectorAll(".services__row"), {
      trigger: services,
      y: 26,
      stagger: 0.09,
      duration: 0.7,
      start: "top 72%",
    });
  }

  /* —— Reviews: crescent portraits + message, then marquee rows —— */
  const reviews = one(".reviews");
  if (reviews) {
    const stage = reviews.querySelectorAll<HTMLElement>(".crescent__stage > i");
    if (stage.length) {
      gsap.set(stage, { opacity: 0, scale: 0.88, y: 18 });
      gsap.to(stage, {
        opacity: 1,
        scale: 1,
        y: 0,
        duration: 0.7,
        stagger: { each: 0.05, from: "center" },
        ease: "power3.out",
        clearProps: "transform",
        onComplete: () => gsap.set(stage, { opacity: 1, clearProps: "transform" }),
        scrollTrigger: {
          trigger: reviews.querySelector(".crescent") ?? reviews,
          start: "top 75%",
          once: true,
        },
      });
    }
    reveal(reviews.querySelectorAll(".crescent__msg > *"), {
      trigger: reviews.querySelector(".crescent") ?? reviews,
      y: 24,
      stagger: 0.1,
      start: "top 70%",
    });
    // Fade rows in only — CSS owns the track translateX marquee
    reveal(reviews.querySelectorAll(".reviews-marquee__row"), {
      trigger: reviews.querySelector(".reviews__body") ?? reviews,
      y: 20,
      stagger: 0.12,
      duration: 0.8,
      start: "top 85%",
    });
  }

  /* —— Editorial + Culture grids —— */
  for (const sel of [".editorial", ".culture"] as const) {
    const section = one(sel);
    if (!section) continue;
    reveal(section.querySelectorAll(".editorial__head > *"), {
      trigger: section,
      y: 24,
      stagger: 0.08,
      start: "top 80%",
    });
    const cards = section.querySelectorAll<HTMLElement>(
      sel === ".editorial" ? ".editorial__grid > a" : ".culture__grid > a",
    );
    if (cards.length) {
      reveal(cards, {
        trigger: section,
        y: 32,
        stagger: 0.08,
        duration: 0.7,
        start: "top 74%",
      });
    }
  }

  window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true });
});
