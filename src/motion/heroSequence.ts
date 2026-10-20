export type HeroStep = 1 | -1;

/**
 * The hero owns the first scroll step after the loop: fade, then video 2.
 * Directed scroll asks before it changes scenes.
 */
export type HeroSequence = {
  /** Return true when this step stays on the hero. */
  onStep: (direction: HeroStep) => boolean;
  onLeave: () => void;
  onReturn: () => void;
};

let current: HeroSequence | null = null;

export function registerHeroSequence(sequence: HeroSequence) {
  current = sequence;
  return () => {
    if (current === sequence) current = null;
  };
}

export function heroSequence() {
  return current;
}
