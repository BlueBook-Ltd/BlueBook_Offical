import { bootMotion, enterLoad } from "./motion/bootMotion";

declare global {
  interface Window {
    __bbServicesMotion?: string;
  }
}

function onceGuard(key: string): boolean {
  if (window.__bbServicesMotion === key) return true;
  window.__bbServicesMotion = key;
  return false;
}

/** Services hub — title + cards. (OCR → ocrMotion, WhatsApp → waMotion) */
bootMotion(".svc", (root) => {
  if (onceGuard("svc") || root.dataset.servicesMotion === "1") return;
  root.dataset.servicesMotion = "1";

  const title = root.querySelector<HTMLElement>(".svc__title");
  const cards = root.querySelectorAll<HTMLElement>(".svc__card");

  if (title) enterLoad(title, { y: 28, duration: 0.85 });
  if (cards.length) enterLoad(cards, { y: 36, duration: 0.85, stagger: 0.14, delay: 0.12 });
});
