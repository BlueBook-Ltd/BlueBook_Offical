import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

const CLEAR = 0x010308;
/** Texture loops per second along the river. 0.2 slow, 0.8 fast. */
const FLOW_SPEED = 0.38;

const BITS = [
  "01010110101100101010010100101101",
  "const data = stream.buffer;",
  "function parse(signal) { return true; }",
  '<node id="stream_07" active="1">',
  "packet.transfer(0xA93F);",
  '{ status: "sync", value: 2048 }',
  "while (queue.length) dispatch();",
  "AI_MODEL_ROUTE::ACCESS_GRANTED",
  "0xFF 0xA1 0x90 0x33 0x7C",
  "await agent.route(payload);",
  "ocr.extract(buf) => { conf: 0.97 }",
  "POST /v1/messages 200  42ms",
];

export function widthAt(t: number, near: number, far: number) {
  return near + (far - near) * t;
}

function assertRibbonMath() {
  if (Math.abs(widthAt(0, 12, 2) - 12) > 1e-9) throw new Error("widthAt(0)");
  if (Math.abs(widthAt(1, 12, 2) - 2) > 1e-9) throw new Error("widthAt(1)");
  if (Math.abs(widthAt(0.5, 12, 2) - 7) > 1e-9) throw new Error("widthAt(0.5)");
}

function hash(n: number) {
  return ((Math.sin(n * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1;
}

function createCodeTexture() {
  const w = 1024;
  const h = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("[data-river] 2d canvas unavailable");

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.font = "700 20px ui-monospace, SFMono-Regular, Consolas, monospace";
  ctx.textBaseline = "top";

  for (let y = 0; y < h; y += 28) {
    let x = 6;
    let k = y;
    while (x < w) {
      const text = BITS[k % BITS.length];
      ctx.shadowColor = "rgba(160, 210, 255, 0.55)";
      ctx.shadowBlur = 6;
      ctx.fillStyle = `rgba(200, 230, 255, ${0.55 + hash(k) * 0.45})`;
      ctx.fillText(text, x, y);
      x += ctx.measureText(text).width + 28;
      k += 3;
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(7, 48);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

function createRiverGeometry() {
  const geo = new THREE.PlaneGeometry(18, 140, 80, 280);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const bend = Math.sin(y * 0.035) * 3.2;
    const valley = Math.pow(Math.abs(x) / 9, 1.8) * 1.5;
    const wall = x > 0 ? Math.pow(x / 9, 2) * 5.2 : 0;
    pos.setX(i, x + bend);
    pos.setZ(i, valley + wall);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function createSun() {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe6a8, toneMapped: false }),
  );
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(3.4, 32, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffaa44,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  group.add(core, glow);
  group.position.set(-2, 1.4, -52);
  return {
    group,
    geos: [core.geometry, glow.geometry],
    mats: [core.material, glow.material],
  };
}

function createDust(count: number) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 40;
    positions[i * 3 + 1] = Math.random() * 10 - 1;
    positions[i * 3 + 2] = Math.random() * -80 + 20;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0x8eb4d4,
    size: 0.06,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    sizeAttenuation: true,
  });
  return { points: new THREE.Points(geo, mat), geo, mat };
}

function startRiver(host: HTMLElement) {
  assertRibbonMath();

  const touch = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  const renderer = new THREE.WebGLRenderer({
    antialias: !touch,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(CLEAR, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, touch ? 1 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(CLEAR, 0.018);

  const camera = new THREE.PerspectiveCamera(82, 1, 0.05, 400);
  const camBase = new THREE.Vector3(6.2, 0.48, 46);
  const lookBase = new THREE.Vector3(-2.2, 0.55, -34);
  camera.position.copy(camBase);
  camera.lookAt(lookBase);

  const texture = createCodeTexture();
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    color: new THREE.Color(0xc8e6ff),
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

  const river = new THREE.Mesh(createRiverGeometry(), material);
  river.rotation.x = -Math.PI / 2;
  scene.add(river);

  const sun = createSun();
  scene.add(sun.group);
  scene.add(new THREE.PointLight(0xffcc66, 7, 90).translateZ(-52).translateY(1.5));

  const dust = createDust(touch ? 400 : 900);
  scene.add(dust.points);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.42, 0.45, 0.22));

  let destroyed = false;
  let frame = 0;
  const clock = new THREE.Clock();

  const resize = () => {
    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const dpr = Math.min(window.devicePixelRatio, touch ? 1 : 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    composer.setPixelRatio(dpr);
    composer.setSize(width, height);
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(host);

  const render = () => {
    if (destroyed) return;
    const delta = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;
    texture.offset.y -= delta * FLOW_SPEED;
    camera.position.set(
      camBase.x + Math.sin(time * 0.55) * 0.15,
      camBase.y + Math.sin(time * 0.9) * 0.04,
      camBase.z,
    );
    camera.lookAt(lookBase.x, lookBase.y + Math.sin(time * 0.35) * 0.05, lookBase.z);
    composer.render();
    frame = requestAnimationFrame(render);
  };
  render();

  return () => {
    destroyed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    river.geometry.dispose();
    material.dispose();
    for (const geo of sun.geos) geo.dispose();
    for (const mat of sun.mats) mat.dispose();
    dust.geo.dispose();
    dust.mat.dispose();
    texture.dispose();
    composer.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}

export default function DataRiver() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    return startRiver(host);
  }, []);

  return (
    <section className="data-river" aria-label="Bluebook streaming code river">
      <div ref={hostRef} className="data-river__host" role="img" aria-label="Cinematic code river" />
      <div className="data-river__label">
        <p>BLUEBOOK / CHAPTER 5</p>
        <h1>Streaming code river</h1>
        <span>Homepage hero study — hard-refresh if the old map view is cached.</span>
      </div>
    </section>
  );
}
