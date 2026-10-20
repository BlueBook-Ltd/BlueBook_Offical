import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function riseLines(lines: NodeListOf<Element> | Element[], trigger: Element, start = 'top 78%') {
  if (!lines.length) return;
  gsap.fromTo(
    lines,
    { yPercent: 110 },
    {
      yPercent: 0,
      duration: 1.05,
      ease: 'expo.out',
      stagger: 0.08,
      scrollTrigger: { trigger, start, once: true },
    },
  );
}

/** Hero, statement, pinned services, and the closing line. News mounts later. */
export function mountHomeStageMotion(root: HTMLElement) {
  if (reduced()) return () => {};

  const ctx = gsap.context(() => {
    const heroLines = root.querySelectorAll('.hm-hero .hm-line');
    gsap.fromTo(
      heroLines,
      { yPercent: 110 },
      { yPercent: 0, duration: 1.15, ease: 'expo.out', stagger: 0.12, delay: 0.12 },
    );

    const word = root.querySelector('.hm-word');
    if (word) {
      gsap.fromTo(word, { yPercent: 40 }, { yPercent: 0, duration: 1.35, ease: 'expo.out', delay: 0.02 });
    }

    const shift = root.querySelector('.hm-word-shift');
    if (shift) {
      gsap.to(shift, {
        yPercent: -18,
        ease: 'none',
        scrollTrigger: {
          trigger: root.querySelector('.hm-hero'),
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });
    }

    root.querySelectorAll<HTMLElement>('[data-hm-lines]').forEach((block) => {
      riseLines(block.querySelectorAll('.hm-line'), block);
    });

    const pin = root.querySelector('.hm-pin');
    const panels = gsap.utils.toArray<HTMLElement>(root.querySelectorAll('.hm-panel'));

    const mm = gsap.matchMedia();
    mm.add('(min-width: 960px)', () => {
      if (!pin || panels.length < 2) return;
      const firstLines = panels[0].querySelectorAll('.hm-line');
      gsap.fromTo(
        firstLines,
        { yPercent: 110 },
        {
          yPercent: 0,
          duration: 1.05,
          ease: 'expo.out',
          stagger: 0.08,
          scrollTrigger: { trigger: pin, start: 'top 72%', once: true },
        },
      );
      panels.slice(1).forEach((panel) => {
        gsap.set(panel, { autoAlpha: 0, y: 48 });
        gsap.set(panel.querySelectorAll('.hm-line'), { yPercent: 0 });
      });
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: pin,
          start: 'top top',
          end: () => `+=${(panels.length - 1) * window.innerHeight * 0.92}`,
          pin: true,
          scrub: 0.65,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });
      panels.forEach((panel, i) => {
        if (i === 0) return;
        tl.to(panels[i - 1], { autoAlpha: 0, y: -40, duration: 0.5 }, (i - 1) * 0.5)
          .fromTo(panel, { autoAlpha: 0, y: 56 }, { autoAlpha: 1, y: 0, duration: 0.5 }, '<0.08');
      });
    });

    mm.add('(max-width: 959px)', () => {
      panels.forEach((panel) => {
        riseLines(panel.querySelectorAll('.hm-line'), panel, 'top 84%');
      });
    });
  }, root);

  return () => ctx.revert();
}

/** News titles and culture lines arrive after the CMS fetch. */
export function mountHomeStageLateMotion(root: HTMLElement) {
  if (reduced()) return () => {};

  const ctx = gsap.context(() => {
    root.querySelectorAll<HTMLElement>('[data-hm-late-lines]').forEach((block) => {
      riseLines(block.querySelectorAll('.hm-line'), block);
    });
  }, root);

  ScrollTrigger.refresh();
  return () => ctx.revert();
}
