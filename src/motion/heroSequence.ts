export type HeroStep = 1 | -1;

/**
 * The hero owns scroll steps through the video sequence. Directed scroll asks
 * before it changes scenes, and notifies when the pin stack is entered or left.
 */
export type HeroSequence = {
  /** Return true when this step stays on the hero. */
  onStep: (direction: HeroStep) => boolean;
  onLeave: () => void;
  onReturn: () => void;
  /**
   * Leaving the last pin panel toward later scenes.
   * Return true to hold on the hero (e.g. play Video End) before advancing.
   */
  onAfterPins?: () => boolean | void;
  /** Returning onto the pin stack from a later scene. */
  onEnterPins?: () => void;
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

/** Fired on `.home-stage` when city girl is painted and pin panels should fade in. */
export const HM_ENTER_CITY_PIN = 'hm-enter-city-pin';

/** Fired when the post–Girl_Loop finale (`Video End`) has finished. */
export const HM_VIDEO_END_DONE = 'hm-video-end-done';
