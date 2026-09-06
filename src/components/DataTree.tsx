import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

const CLEAR = 0x010503;
const FLOW = 0.22;
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
];

type Fiber = { pts: THREE.Vector3[]; radius: number };

function hash(n: number) {
  return ((Math.sin(n * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1;
}

function assertGrow() {
  const fibers: Fiber[] = [];
  const tips: THREE.Vector3[] = [];
  grow(new THREE.Vector3(), new THREE.Vector3(0, 1, 0), 2, 0.12, 2, 1, fibers, tips, false);
  if (fibers.length < 4) throw new Error("tree too thin");
  if (tips.length < 2) throw new Error("no canopy tips");
}

function grow(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  length: number,
  radius: number,
  depth: number,
  seed: number,
  fibers: Fiber[],
  tips: THREE.Vector3[],
  isRoot: boolean,
) {
  const steps = isRoot ? 7 : 6;
  const pts = [origin.clone()];
  let pos = origin.clone();
  let d = dir.clone().normalize();
  for (let i = 0; i < steps; i++) {
    const t = seed + i * 17;
    const wobble = new THREE.Vector3(hash(t) - 0.5, isRoot ? 0.04 : hash(t + 3) * 0.32, hash(t + 1) - 0.5);
    d.addScaledVector(wobble, isRoot ? 0.32 : 0.2).normalize();
    if (isRoot) d.y = 0.015;
    else if (d.y < 0.18) d.y = 0.18;
    d.normalize();
    pos = pos.clone().addScaledVector(d, length / steps);
    if (isRoot) pos.y = 0.035 + hash(t + 9) * 0.04;
    pts.push(pos.clone());
  }
  fibers.push({ pts, radius });
  if (depth <= 0) {
    tips.push(pts[pts.length - 1].clone());
    return;
  }
  const kids = depth > 2 ? 2 : 3;
  for (let k = 0; k < kids; k++) {
    const t = seed + k * 41 + depth * 13;
    const child = d
      .clone()
      .add(new THREE.Vector3(hash(t) - 0.5, isRoot ? 0 : hash(t + 2) * 0.55, hash(t + 1) - 0.5).multiplyScalar(isRoot ? 0.95 : 0.72))
      .normalize();
    grow(pts[pts.length - 1], child, length * (0.56 + hash(t + 5) * 0.14), radius * 0.64, depth - 1, t, fibers, tips, isRoot);
  }
}

function makeGreenCode() {
  const w = 1024;
  const h = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("[data-tree] canvas");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.font = "700 20px ui-monospace, Consolas, monospace";
  ctx.textBaseline = "top";
  for (let y = 0; y < h; y += 26) {
    let x = -((y * 3) % 140);
    let k = y;
    while (x < w) {
      const text = BITS[k % BITS.length];
      ctx.shadowColor = "rgba(40, 255, 90, 0.7)";
      ctx.shadowBlur = 8;
      ctx.fillStyle = `rgba(90, 255, 120, ${0.5 + hash(k) * 0.5})`;
      ctx.fillText(text, x, y);
      x += ctx.measureText(text).width + 20 + hash(k + 2) * 28;
      k += 3;
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 10);
  tex.needsUpdate = true;
  return tex;
}

function makeCircuit() {
  const w = 512;
  const h = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("[data-tree] circuit");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(80, 255, 110, 0.85)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 48; i++) {
    const x = 8 + hash(i) * (w - 16);
    let y = hash(i + 4) * h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 6; s++) {
      y += 40 + hash(i * 9 + s) * 70;
      const nx = Math.max(6, Math.min(w - 6, x + (hash(i + s) > 0.5 ? 28 : -28)));
      ctx.lineTo(hash(i + s + 3) > 0.45 ? nx : x, y);
      ctx.lineTo(nx, y);
    }
    ctx.stroke();
    ctx.fillStyle = "rgba(140, 255, 160, 0.95)";
    ctx.beginPath();
    ctx.arc(x, hash(i + 8) * h, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 4);
  tex.needsUpdate = true;
  return tex;
}

function tube(fiber: Fiber, radial: number) {
  const curve = new THREE.CatmullRomCurve3(fiber.pts, false, "catmullrom", 0.15);
  return new THREE.TubeGeometry(curve, Math.max(12, fiber.pts.length * 4), fiber.radius, radial, false);
}

function startTree(host: HTMLElement) {
  assertGrow();
  const touch = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ antialias: !touch, alpha: false, powerPreference: "high-performance" });
  renderer.setClearColor(CLEAR, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, touch ? 1 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(CLEAR, 0.055);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.08, 80);
  camera.position.set(7.2, 3.4, 10.4);
  camera.lookAt(0, 2.6, 0);

  const code = makeGreenCode();
  const circuit = makeCircuit();
  code.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const codeMat = new THREE.MeshBasicMaterial({
    map: code,
    color: 0x66ff88,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const circuitMat = codeMat.clone();
  circuitMat.map = circuit;

  const fibers: Fiber[] = [];
  const tips: THREE.Vector3[] = [];
  grow(new THREE.Vector3(0, 0.02, 0), new THREE.Vector3(0, 1, 0), 2.4, 0.13, 3, 2, fibers, tips, false);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    grow(
      new THREE.Vector3(Math.cos(a) * 0.12, 0.02, Math.sin(a) * 0.12),
      new THREE.Vector3(Math.cos(a) * 0.12, 1, Math.sin(a) * 0.12),
      2.1,
      0.055,
      2,
      20 + i * 9,
      fibers,
      tips,
      false,
    );
  }
  const roots: Fiber[] = [];
  const rootTips: THREE.Vector3[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + hash(i) * 0.2;
    grow(new THREE.Vector3(Math.cos(a) * 0.2, 0.04, Math.sin(a) * 0.2), new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), 2.4, 0.028, 2, 80 + i, roots, rootTips, true);
  }

  const geos: THREE.BufferGeometry[] = [];
  const group = new THREE.Group();
  for (const [i, fiber] of fibers.entries()) {
    const geo = tube(fiber, touch ? 5 : 7);
    geos.push(geo);
    group.add(new THREE.Mesh(geo, i % 3 === 0 ? circuitMat : codeMat));
  }
  for (const fiber of roots) {
    const geo = tube(fiber, 5);
    geos.push(geo);
    group.add(new THREE.Mesh(geo, circuitMat));
  }
  scene.add(group);

  const cardGeo = new THREE.PlaneGeometry(0.55, 0.32);
  const cardMat = codeMat.clone();
  cardMat.side = THREE.DoubleSide;
  cardMat.opacity = 0.8;
  const cardCount = touch ? 28 : 48;
  const cards = new THREE.InstancedMesh(cardGeo, cardMat, cardCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < cardCount; i++) {
    const tip = tips[i % tips.length];
    dummy.position.copy(tip).add(new THREE.Vector3((hash(i) - 0.5) * 1.4, hash(i + 2) * 0.8, (hash(i + 1) - 0.5) * 1.4));
    dummy.rotation.set(hash(i + 4) * 0.6 - 0.3, hash(i + 5) * Math.PI * 2, hash(i + 6) * 0.5 - 0.25);
    dummy.scale.setScalar(0.7 + hash(i + 7) * 0.9);
    dummy.updateMatrix();
    cards.setMatrixAt(i, dummy.matrix);
  }
  scene.add(cards);

  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x3dff6a,
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const beamGeo = new THREE.CylinderGeometry(0.07, 0.11, 7.5, 10);
  geos.push(beamGeo);
  for (const [x, z] of [
    [-1.4, 0.3],
    [1.3, 0.5],
    [0.15, -1.5],
    [0.25, 1.6],
  ]) {
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(x, 7.1, z);
    scene.add(beam);
  }

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(16, 48),
    new THREE.MeshBasicMaterial({ color: 0x050a06 }),
  );
  ground.rotation.x = -Math.PI / 2;
  geos.push(ground.geometry);
  scene.add(ground);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), touch ? 0.7 : 1.15, 0.55, 0.08));

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
    const speed = reduced ? 0.03 : FLOW;
    code.offset.y -= delta * speed;
    circuit.offset.y -= delta * speed * 0.7;
    if (!reduced) {
      camera.position.x = 7.2 + Math.sin(time * 0.18) * 0.55;
      camera.position.z = 10.4 + Math.cos(time * 0.16) * 0.45;
      camera.lookAt(0, 2.6 + Math.sin(time * 0.12) * 0.08, 0);
    }
    composer.render();
    frame = requestAnimationFrame(render);
  };
  render();

  return () => {
    destroyed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    geos.forEach((g) => g.dispose());
    cardGeo.dispose();
    codeMat.dispose();
    circuitMat.dispose();
    cardMat.dispose();
    beamMat.dispose();
    ground.material.dispose();
    code.dispose();
    circuit.dispose();
    composer.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}

export default function DataTree() {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    return startTree(host);
  }, []);

  return (
    <section className="data-tree" aria-label="Bluebook data tree">
      <div ref={hostRef} className="data-tree__host" role="img" aria-label="Neon green data tree" />
      <div className="data-tree__label">
        <p>BLUEBOOK / STUDY</p>
        <h1>Data tree</h1>
        <span>Three.js study — hard-refresh if the last shot is cached.</span>
      </div>
    </section>
  );
}
