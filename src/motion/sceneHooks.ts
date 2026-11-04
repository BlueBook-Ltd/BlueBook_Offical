export type SceneStep = 1 | -1;

/**
 * Optional per-scene hooks for directed scroll. A scene registers its own
 * element; directed scroll consults the active scene before changing scenes.
 */
export type SceneHooks = {
  /** Return true to keep this step inside the scene. */
  onStep?: (direction: SceneStep) => boolean;
  /** The scene became active. `from` is the step direction, or 0 for a jump. */
  onEnter?: (from: SceneStep | 0) => void;
  onLeave?: () => void;
};

const hooks = new WeakMap<HTMLElement, SceneHooks>();

export function registerSceneHooks(scene: HTMLElement, sceneHooks: SceneHooks) {
  hooks.set(scene, sceneHooks);
  return () => {
    if (hooks.get(scene) === sceneHooks) hooks.delete(scene);
  };
}

export function sceneHooks(scene: HTMLElement | undefined) {
  return scene ? hooks.get(scene) : undefined;
}

/** Dispatch on `.home-stage` with the target scene element as `detail` to jump straight to it. */
export const HM_JUMP_TO_SCENE = 'hm-jump-to-scene';
