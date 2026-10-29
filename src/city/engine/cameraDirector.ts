import * as THREE from 'three';
import { gsap } from 'gsap';

export type Pose = { position: THREE.Vector3; target: THREE.Vector3 };

export const clonePose = (pose: Pose): Pose => ({ position: pose.position.clone(), target: pose.target.clone() });

/**
 * Moves the camera between poses. A new flight always starts from where the
 * camera is right now, so rapid clicks retarget smoothly instead of queueing.
 * Paths arc upward so they clear the roofline between two low views.
 */
export class CameraDirector {
  private tween: gsap.core.Tween | null = null;
  private flight = 0;
  private settle: ((done: boolean) => void) | null = null;
  readonly current: Pose;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private roofline: number,
    private onChange: () => void,
  ) {
    this.current = { position: camera.position.clone(), target: new THREE.Vector3() };
  }

  get flying() {
    return this.tween !== null;
  }

  set(pose: Pose) {
    this.cancel();
    this.current.position.copy(pose.position);
    this.current.target.copy(pose.target);
    this.apply();
  }

  /** Resolves true when the flight lands, false if another flight or cancel interrupts it. */
  fly(to: Pose, opts: { duration?: number; ease?: string } = {}): Promise<boolean> {
    this.cancel();
    const id = ++this.flight;
    const fromPos = this.current.position.clone();
    const fromTarget = this.current.target.clone();
    const distance = fromPos.distanceTo(to.position);
    if (distance < 0.5 && fromTarget.distanceTo(to.target) < 0.5) {
      this.set(to);
      return Promise.resolve(true);
    }
    const lowest = Math.min(fromPos.y, to.position.y);
    const lift = Math.min(70, distance * 0.16) + Math.max(0, this.roofline + 12 - lowest);
    const control = fromPos.clone().lerp(to.position, 0.5);
    control.y = Math.max(control.y, (fromPos.y + to.position.y) / 2 + lift);
    const curve = new THREE.QuadraticBezierCurve3(fromPos, control, to.position.clone());
    const duration = opts.duration ?? THREE.MathUtils.clamp(1.1 + distance / 160, 1.3, 2.6);
    const state = { t: 0 };
    return new Promise<boolean>((resolve) => {
      this.settle = resolve;
      this.tween = gsap.to(state, {
        t: 1,
        duration,
        ease: opts.ease ?? 'power2.inOut',
        onUpdate: () => {
          if (id !== this.flight) return;
          curve.getPoint(state.t, this.current.position);
          this.current.target.lerpVectors(fromTarget, to.target, state.t);
          this.apply();
        },
        onComplete: () => {
          if (id !== this.flight) return;
          this.tween = null;
          this.settle = null;
          resolve(true);
        },
      });
    });
  }

  cancel() {
    if (this.tween) {
      this.tween.kill();
      this.tween = null;
    }
    this.flight += 1;
    const settle = this.settle;
    this.settle = null;
    settle?.(false);
  }

  /** Shift camera and target together (limited drag panning). */
  pan(delta: THREE.Vector3) {
    this.current.position.add(delta);
    this.current.target.add(delta);
    this.apply();
  }

  apply() {
    this.camera.position.copy(this.current.position);
    this.camera.lookAt(this.current.target);
    this.camera.updateMatrixWorld();
    this.onChange();
  }

  dispose() {
    this.cancel();
  }
}
