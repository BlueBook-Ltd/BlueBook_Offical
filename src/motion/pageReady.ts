import { useEffect } from 'react';

/**
 * Readiness contract for the route transition.
 *
 * Pages here mount their shell immediately and load content in an effect: a
 * listing renders its heading and an empty grid, then fills it ~1.5s later.
 * From the outside that shell is indistinguishable from a finished page — it
 * has content, and an empty grid has no images outstanding — so the transition
 * used to uncover it while it was still blank.
 *
 * Any page that fetches after mount must hold a gate open until its data is in.
 * Pages whose content is present at first render need nothing.
 */
let pending = 0;

export function beginPageLoad(): void {
  pending += 1;
}

export function endPageLoad(): void {
  pending = Math.max(0, pending - 1);
}

export function isPageContentReady(): boolean {
  return pending === 0;
}

/** Escape hatch — a stuck gate must not trap a visitor behind the curtain. */
export function resetPageLoads(): void {
  pending = 0;
}

/**
 * Holds the transition open while `loaded` is false.
 *
 * Pass the same flag the component uses to decide whether it has real content.
 * The cleanup releases the gate both when loading finishes and when the
 * component unmounts mid-flight, so an abandoned navigation cannot leak.
 */
export function usePageContentGate(loaded: boolean): void {
  useEffect(() => {
    if (loaded) return undefined;
    beginPageLoad();
    return endPageLoad;
  }, [loaded]);
}
