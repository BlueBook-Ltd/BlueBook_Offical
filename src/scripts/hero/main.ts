import gsap from "gsap";
import * as THREE from "three";
import { showCopyStage } from "./copyTimeline";
import { createAmbientField, createParticleSystem } from "./particleSystem";

const isReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isTouch = () => window.matchMedia("(hover: none), (pointer: coarse)").matches;

const DEG = Math.PI / 180;
const BASE_ROT_X = 0.15;
const BASE_ROT_Y = -0.2;
const BASE_ROT_Z = 0.04;
const MAX_TILT_X = 5 * DEG;
const MAX_TILT_Y = 6 * DEG;

// Book placement — right side of hero (camera is independent)
const BOOK_SCALE = 2;
const BOOK_X = 10;
const BOOK_Y = 2;
/** Layout reference; hero copy + book grow with window past this. */
const REF_W = 1280;
const REF_H = 800;

function heroScale(width: number, height: number) {
  // ponytail: soft ceiling ~1.65 so ultra-wide doesn't blow type; raise if art needs bigger
  return THREE.MathUtils.clamp(Math.min(width / REF_W, height / REF_H), 0.72, 1.65);
}

function particleCount() {
  if (isTouch()) return 14000;
  return (navigator.hardwareConcurrency || 4) <= 4 ? 40000 : 40000;
}

function ambientCount() {
  if (isTouch()) return 800;
  return (navigator.hardwareConcurrency || 4) <= 4 ? 14000 : 14000;
}

function boot() {
  const root = document.querySelector<HTMLElement>("[data-hero]");
  const host = root?.querySelector<HTMLElement>("[data-hero-canvas]");
  if (!root || !host) {
    console.warn("[hero] Missing [data-hero] / [data-hero-canvas]");
    return;
  }

  const reduced = isReducedMotion();
  const touch = isTouch();
  const stages = Array.from(root.querySelectorAll<HTMLElement>("[data-copy-stage]"));

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x061a2e, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  // Frontal elevated camera — book stays in frame
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0.4, 3.8, 9.5);

  const ambient = createAmbientField(ambientCount());
  scene.add(ambient.points);

  let particles: ReturnType<typeof createParticleSystem>;
  try {
    particles = createParticleSystem(particleCount());
  } catch (error) {
    console.error("[hero] Failed to create particle system", error);
    return;
  }

  particles.group.position.set(BOOK_X, BOOK_Y, 0);
  particles.group.scale.setScalar(BOOK_SCALE);
  particles.group.rotation.set(BASE_ROT_X, BASE_ROT_Y, BASE_ROT_Z);
  particles.group.visible = !root.hasAttribute("data-hero-ambient-only");
  scene.add(particles.group);

  particles.setSmokeBoost(1.1);
  particles.setPageTurn(0);
  showCopyStage(stages);

  if (!reduced) {
    const label = root.querySelector<HTMLElement>(".hero__label");
    const title = root.querySelector<HTMLElement>(".hero__title");
    const body = root.querySelector<HTMLElement>(".hero__body");
    if (label) gsap.set(label, { autoAlpha: 0, y: 14 });
    if (title) gsap.set(title, { autoAlpha: 0, yPercent: 34, clipPath: "inset(0 0 100% 0)" });
    if (body) gsap.set(body, { autoAlpha: 0, y: 16 });
    const heroTl = gsap.timeline({ defaults: { ease: "power3.out" } });
    if (label) heroTl.to(label, { autoAlpha: 1, y: 0, duration: 0.55 });
    if (title) {
      heroTl.to(
        title,
        {
          autoAlpha: 1,
          yPercent: 0,
          clipPath: "inset(0 0 0% 0)",
          duration: 0.95,
        },
        "-=0.25",
      );
    }
    if (body) heroTl.to(body, { autoAlpha: 1, y: 0, duration: 0.65 }, "-=0.35");
  }

  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0.4, 1).normalize(), 0);
  const targetPointer = new THREE.Vector2();
  const smoothPointer = new THREE.Vector2();
  const hit = new THREE.Vector3();
  const localMouse = new THREE.Vector3();
  const lookTarget = new THREE.Vector3(BOOK_X * 0.5, BOOK_Y + 2, 0);
  let hoverTarget = 0;
  let hover = 0;
  let destroyed = false;
  let frame = 0;
  let currentRotX = BASE_ROT_X;
  let currentRotY = BASE_ROT_Y;
  let bookScale = BOOK_SCALE;
  let bookX = BOOK_X;
  let bookY = BOOK_Y;

  const resize = () => {
    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const dpr = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    particles.setPixelRatio(dpr);

    const scale = heroScale(width, height);
    bookScale = BOOK_SCALE * scale;
    bookX = BOOK_X * (0.88 + 0.12 * scale);
    bookY = BOOK_Y;
    particles.group.scale.setScalar(bookScale);
    lookTarget.set(bookX * 0.5, bookY + 2, 0);
    root.style.setProperty("--hero-scale", scale.toFixed(3));
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(host);

  const onPointerMove = (event: PointerEvent) => {
    if (touch || reduced) return;
    const rect = renderer.domElement.getBoundingClientRect();
    targetPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    targetPointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(targetPointer, camera);
    plane.constant = 0;
    if (raycaster.ray.intersectPlane(plane, hit)) {
      particles.group.updateMatrixWorld(true);
      localMouse.copy(hit);
      particles.group.worldToLocal(localMouse);
      particles.setMouseLocal(localMouse);
      const distance = Math.hypot(localMouse.x, localMouse.y * 0.85, localMouse.z * 0.7);
      hoverTarget = THREE.MathUtils.clamp(gsap.utils.mapRange(3.6, 0.35, 0, 1.25, distance), 0, 1.25);
    }
  };

  const onPointerLeave = () => {
    hoverTarget = 0;
    targetPointer.set(0, 0);
    particles.setMouseLocal(new THREE.Vector3(999, 999, 999));
  };

  root.addEventListener("pointermove", onPointerMove, { passive: true });
  root.addEventListener("pointerleave", onPointerLeave);

  if (reduced) {
    particles.setIntro(1);
  } else {
    const intro = { t: 0 };
    particles.setIntro(0);
    gsap.to(intro, {
      t: 1,
      duration: 1.6,
      ease: "power2.out",
      onUpdate: () => particles.setIntro(intro.t),
      onComplete: () => particles.setIntro(1),
    });
  }

  const clock = new THREE.Clock();

  const render = () => {
    if (destroyed) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;
    particles.material.uniforms.uTime.value = time;

    hover += (hoverTarget - hover) * (hoverTarget > hover ? 0.14 : 0.07);
    particles.setHover(hover);
    smoothPointer.lerp(targetPointer, 0.06);

    const targetRotX = BASE_ROT_X + smoothPointer.y * MAX_TILT_X + Math.sin(time * 0.2) * 0.012;
    const targetRotY = BASE_ROT_Y + smoothPointer.x * MAX_TILT_Y + Math.sin(time * 0.15) * 0.015;
    currentRotX += (targetRotX - currentRotX) * 0.06;
    currentRotY += (targetRotY - currentRotY) * 0.06;
    particles.group.rotation.x = currentRotX;
    particles.group.rotation.y = currentRotY;
    particles.group.rotation.z = BASE_ROT_Z + Math.sin(time * 0.12) * 0.01;
    particles.group.position.set(bookX, bookY + Math.sin(time * 0.35) * 0.05, 0);

    ambient.update(dt, smoothPointer);

    camera.position.x = 0.4 + smoothPointer.x * 0.12;
    camera.position.y = 3.8 + smoothPointer.y * 0.1;
    camera.position.z = 9.5;
    camera.lookAt(lookTarget);
    renderer.render(scene, camera);
    frame = requestAnimationFrame(render);
  };
  render();

  // Surface shader compile problems in console
  const gl = renderer.getContext();
  const ext = gl.getExtension("WEBGL_debug_shaders");
  void ext;

  window.addEventListener(
    "pagehide",
    () => {
      destroyed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerleave", onPointerLeave);
      particles.dispose();
      ambient.dispose();
      renderer.dispose();
    },
    { once: true },
  );
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
else boot();
