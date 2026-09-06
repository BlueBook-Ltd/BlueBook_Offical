import * as THREE from "three";
import { createShapeBuffers, TURNING_PAGE_COUNT } from "./shapes";
import { fragmentShader, vertexShader } from "./shaders";

export type ParticleSystem = {
  points: THREE.Points;
  group: THREE.Group;
  material: THREE.ShaderMaterial;
  setIntro: (progress: number) => void;
  setHover: (strength: number) => void;
  setMouseLocal: (point: THREE.Vector3) => void;
  setPixelRatio: (pixelRatio: number) => void;
  setSmokeBoost: (value: number) => void;
  setPageTurn: (value: number) => void;
  dispose: () => void;
};

export type AmbientField = {
  points: THREE.Points;
  update: (dt: number, pointer: THREE.Vector2) => void;
  dispose: () => void;
};

export function createParticleSystem(count: number): ParticleSystem {
  const buffers = createShapeBuffers(count);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(buffers.positions.slice(), 3));
  geometry.setAttribute("aTarget", new THREE.BufferAttribute(buffers.positions, 3));
  geometry.setAttribute("aFlip", new THREE.BufferAttribute(buffers.flipPositions, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(buffers.colors, 3));
  geometry.setAttribute("aRandom", new THREE.BufferAttribute(buffers.randoms, 3));
  geometry.setAttribute("aRole", new THREE.BufferAttribute(buffers.roles, 1));
  geometry.setAttribute("aPageTurn", new THREE.BufferAttribute(buffers.pageTurn, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uSize: { value: 0.62 },
      uIntro: { value: 0 },
      uHoverStrength: { value: 0 },
      uMouse: { value: new THREE.Vector3(999, 999, 999) },
      uSmokeBoost: { value: 1 },
      uPageTurn: { value: 0 },
      uTurnSpeed: { value: 0 },
      uTurnPageCount: { value: TURNING_PAGE_COUNT },
      uRepelRadius: { value: 2 },
      uRepelStrength: { value: 0.2 },
    },
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  const group = new THREE.Group();
  group.add(points);

  return {
    points,
    group,
    material,
    setIntro(progress) {
      material.uniforms.uIntro.value = THREE.MathUtils.clamp(progress, 0, 1);
    },
    setHover(strength) {
      material.uniforms.uHoverStrength.value = strength;
    },
    setMouseLocal(point) {
      material.uniforms.uMouse.value.copy(point);
    },
    setPixelRatio(pixelRatio) {
      material.uniforms.uPixelRatio.value = pixelRatio;
    },
    setSmokeBoost(value) {
      material.uniforms.uSmokeBoost.value = value;
    },
    setPageTurn(value) {
      material.uniforms.uPageTurn.value = value;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

export function createAmbientField(count: number): AmbientField {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const cyan = new THREE.Color("#6ed8ff");
  const teal = new THREE.Color("#1f7f9a");
  const ice = new THREE.Color("#f2f9ff");
  const gold = new THREE.Color("#efc07a");

  for (let i = 0; i < count; i++) {
    const o = i * 3;
    positions[o] = (Math.random() - 0.5) * 32;
    positions[o + 1] = (Math.random() - 0.5) * 18;
    positions[o + 2] = -2 - Math.random() * 22;
    velocities[o] = (Math.random() - 0.5) * 0.18;
    velocities[o + 1] = (Math.random() - 0.5) * 0.14;
    velocities[o + 2] = (Math.random() - 0.5) * 0.08;
    const pick = Math.random();
    const color =
      pick > 0.93 ? gold : pick > 0.5 ? cyan.clone().lerp(ice, Math.random() * 0.65) : teal.clone().lerp(cyan, Math.random());
    const dim = 0.28 + Math.random() * 0.5;
    colors[o] = color.r * dim;
    colors[o + 1] = color.g * dim;
    colors[o + 2] = color.b * dim;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 0.028,
    vertexColors: true,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = -1;

  return {
    points,
    update(dt, pointer) {
      const attr = geometry.getAttribute("position") as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < count; i++) {
        const o = i * 3;
        arr[o] += velocities[o] * dt;
        arr[o + 1] += velocities[o + 1] * dt;
        arr[o + 2] += velocities[o + 2] * dt;
        if (arr[o] > 16) arr[o] = -16;
        if (arr[o] < -16) arr[o] = 16;
        if (arr[o + 1] > 9) arr[o + 1] = -9;
        if (arr[o + 1] < -9) arr[o + 1] = 9;
        if (arr[o + 2] > -1) arr[o + 2] = -24;
        if (arr[o + 2] < -24) arr[o + 2] = -2;
      }
      attr.needsUpdate = true;
      points.position.x = pointer.x * 0.35;
      points.position.y = pointer.y * 0.2;
      points.rotation.y = pointer.x * 0.04;
      points.rotation.x = pointer.y * 0.025;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
