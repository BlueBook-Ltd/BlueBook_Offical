import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { PALETTE, PLACES, SUN, VIDEO_CAMERA } from '@/city/layout';
import { buildCity, type BuildingInfo, type CityBuild } from '@/city/engine/buildCity';
import { Traffic } from '@/city/engine/traffic';
import { CameraDirector, type Pose } from '@/city/engine/cameraDirector';
import { detectQuality, type CityAssets } from '@/city/engine/assets';

export type CityEngineOptions = {
  host: HTMLElement;
  reducedMotion: boolean;
  /** Photo materials and sky lighting; without them the city uses its procedural fallback. */
  assets?: CityAssets | null;
  onPick?: (placeId: string) => void;
  onContextLost?: () => void;
};

export type ScreenRect = { left: number; top: number; right: number; bottom: number };

type Anchor = {
  id: string;
  building: BuildingInfo;
  position: THREE.Vector3;
  el: HTMLElement | null;
  visible: boolean;
  forcedHidden: boolean;
  halfWidth: number;
  votes: number;
  occluded: boolean;
  lastTest: number;
};

const UP = new THREE.Vector3(0, 1, 0);
const deg = THREE.MathUtils.degToRad;
/** Hotspots stay out of the header band and away from the edges. */
const SAFE = { top: 96, side: 28, bottom: 28 };
const PAN_LIMIT = 70;
/** Hotspot pills sit above their anchor (height + gap in bluebook-city.css). */
const PILL_RISE = 50;

export class CityEngine {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private city: CityBuild;
  private traffic: Traffic;
  private director: CameraDirector;
  private timer = new THREE.Timer();
  private fog: THREE.Fog;
  private raf = 0;
  private wantRunning = false;
  private dirty = true;
  private width = 1;
  private height = 1;
  private anchors: Anchor[] = [];
  private resizeObserver: ResizeObserver;
  private mode: { kind: 'overview' } | { kind: 'place'; id: string } | { kind: 'video' } = { kind: 'video' };
  private interactive = false;
  private drag: { id: number; start: THREE.Vector3; moved: number; x: number; y: number } | null = null;
  private panOrigin = new THREE.Vector3();
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private tmp = new THREE.Vector3();
  private disposed = false;
  private lost = false;
  private cover: ScreenRect | null = null;
  private environment: THREE.WebGLRenderTarget | null = null;
  private composer: EffectComposer | null = null;

  constructor(private opts: CityEngineOptions) {
    const assets = opts.assets ?? null;
    const quality = assets?.quality ?? detectQuality();
    this.renderer = new THREE.WebGLRenderer({
      // The high tier renders through a multisampled composer target instead.
      antialias: quality === 'high' && !assets,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'hm-city__canvas';
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 1.75 : 1.25));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;

    this.scene.background = new THREE.Color(PALETTE.fog);
    this.fog = new THREE.Fog(PALETTE.fog, 300, 900);
    this.scene.fog = this.fog;

    this.camera = new THREE.PerspectiveCamera(VIDEO_CAMERA.vfov, 16 / 9, 2, 2400);

    const center = new THREE.Vector3(5, 0, -17);
    const sun = new THREE.DirectionalLight('#ffcf9c', 3.4);
    const az = deg(SUN.azimuth);
    const el = deg(SUN.elevation);
    const sunDir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    sun.position.copy(center).addScaledVector(sunDir, 650);
    sun.target.position.copy(center);
    sun.castShadow = true;
    const size = quality === 'high' ? 4096 : 2048;
    sun.shadow.mapSize.set(size, size);
    const shadowCam = sun.shadow.camera;
    shadowCam.left = -250;
    shadowCam.right = 250;
    shadowCam.top = 160;
    shadowCam.bottom = -160;
    shadowCam.near = 300;
    shadowCam.far = 1050;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.05;
    sun.shadow.radius = 2.5;
    this.scene.add(sun, sun.target);
    if (assets) {
      // Sky light from the HDRI (sun disc removed offline; the shadowed directional light is the sun).
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.environment = pmrem.fromEquirectangular(assets.sky);
      pmrem.dispose();
      this.scene.environment = this.environment.texture;
      this.scene.environmentIntensity = 0.7;
    } else {
      this.scene.add(new THREE.HemisphereLight('#c9d4e2', '#7a6250', 1.15));
    }

    if (assets && quality === 'high') {
      // Ambient occlusion where walls meet the street and roofs, which the shadow map alone can't give.
      const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
      this.composer = new EffectComposer(this.renderer, target);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      const ao = new GTAOPass(this.scene, this.camera, 1, 1);
      ao.updateGtaoMaterial({ radius: 3.5, distanceExponent: 1.4, thickness: 6, distanceFallOff: 1, scale: 1.1, samples: 16 });
      ao.updatePdMaterial({ radius: 6 });
      ao.blendIntensity = 0.85;
      this.composer.addPass(ao);
      this.composer.addPass(new OutputPass());
    }

    this.city = buildCity(assets);
    this.scene.add(this.city.group);
    this.traffic = new Traffic(this.city.carGeometry, this.city.carMaterial);
    this.scene.add(this.traffic.mesh);

    const roofline = Math.max(...this.city.buildings.filter((b) => b.core).map((b) => b.top));
    this.director = new CameraDirector(this.camera, roofline, () => this.onCameraChange());

    for (const place of PLACES) {
      const building = this.city.byId.get(place.building);
      if (!building) continue;
      const [x0, x1, z0, z1] = building.rect;
      this.anchors.push({
        id: place.id,
        building,
        position: new THREE.Vector3((x0 + x1) / 2, building.top + 5, (z0 + z1) / 2),
        el: null,
        visible: false,
        forcedHidden: false,
        halfWidth: 0,
        votes: 0,
        occluded: false,
        lastTest: 0,
      });
    }

    opts.host.appendChild(this.canvas);
    this.timer.connect(document);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(opts.host);
    this.resize();
    this.director.set(this.videoPose());

    this.canvas.addEventListener('webglcontextlost', this.onContextLost);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  /** Compile shaders and upload textures before the city is revealed. */
  async warm() {
    const materials = new Set<THREE.Material>();
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => materials.add(m));
    });
    materials.forEach((m) => {
      const { map, normalMap, roughnessMap, alphaMap } = m as THREE.MeshStandardMaterial;
      [map, normalMap, roughnessMap, alphaMap].forEach((t) => t && this.renderer.initTexture(t));
    });
    await this.renderer.compileAsync(this.scene, this.camera);
    if (this.disposed) return;
    this.render();
    this.render();
  }

  get flying() {
    return this.director.flying;
  }

  start() {
    this.wantRunning = true;
    if (!this.raf && !document.hidden && !this.lost) {
      this.timer.reset();
      this.raf = requestAnimationFrame(this.loop);
    }
  }

  stop() {
    this.wantRunning = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  setInteractive(on: boolean) {
    this.interactive = on;
    if (!on) this.drag = null;
    this.canvas.classList.toggle('is-interactive', on);
  }

  bindHotspot(id: string, el: HTMLElement | null) {
    const anchor = this.anchors.find((a) => a.id === id);
    if (!anchor) return;
    anchor.el = el;
    anchor.visible = false;
    anchor.halfWidth = 0;
    el?.classList.add('is-hidden');
    this.dirty = true;
  }

  /** Hide the hotspot of the place currently in focus. */
  setFocused(id: string | null) {
    this.anchors.forEach((a) => (a.forcedHidden = a.id === id));
    this.dirty = true;
  }

  /** Screen area (host pixels) covered by UI; hotspots under it are hidden. */
  setCover(rect: ScreenRect | null) {
    this.cover = rect;
    this.dirty = true;
  }

  /** Pose that reproduces the last frame of Video End. */
  videoPose(): Pose {
    const yaw = deg(VIDEO_CAMERA.yaw);
    const pitch = deg(VIDEO_CAMERA.pitch);
    const forward = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    const position = new THREE.Vector3(...VIDEO_CAMERA.position);
    return { position, target: position.clone().addScaledVector(forward, -position.y / forward.y) };
  }

  /**
   * Same framing as the video on 16:9 and wider. Narrower screens crop the
   * video's sides, so the overview pulls back until every place fits.
   */
  overviewPose(): Pose {
    const base = this.videoPose();
    const aspect = this.width / this.height;
    if (aspect >= VIDEO_CAMERA.aspect * 0.98 || !this.anchors.length) return base;
    const centroid = this.anchors.reduce((acc, a) => acc.add(a.position), new THREE.Vector3()).divideScalar(this.anchors.length);
    centroid.y = 0;
    const target = base.target.clone().lerp(centroid, 0.6);
    const back = base.position.clone().sub(base.target);
    const probe = this.camera.clone();
    for (let k = 1; k <= 3.4; k += 0.1) {
      probe.position.copy(target).addScaledVector(back, k);
      probe.lookAt(target);
      probe.updateMatrixWorld();
      const fits = this.anchors.every((a) => {
        this.tmp.copy(a.position).project(probe);
        return Math.abs(this.tmp.x) < 0.78 && this.tmp.y < 0.62 && this.tmp.y > -0.8;
      });
      if (fits) return { position: probe.position.clone(), target };
    }
    return { position: target.clone().addScaledVector(back, 3.4), target };
  }

  placePose(id: string): Pose | null {
    const place = PLACES.find((p) => p.id === id);
    const building = place && this.city.byId.get(place.building);
    if (!place || !building) return null;
    const [x0, x1, z0, z1] = building.rect;
    const center = new THREE.Vector3((x0 + x1) / 2, building.height * 0.5, (z0 + z1) / 2);
    const yaw = deg(place.view.yaw);
    const pitch = deg(place.view.pitch);
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    const aspect = this.width / this.height;
    const vfov = deg(this.camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    const fit = Math.min(vfov, hfov * (aspect > 1.1 ? 0.62 : 1));
    const radius = Math.max(x1 - x0, z1 - z0, building.top) * 0.8;
    const distance = Math.max(place.view.radius, radius / Math.sin(fit / 2));
    const position = center.clone().addScaledVector(dir, distance);
    const target = center.clone();
    const forward = dir.clone().negate();
    const right = new THREE.Vector3().crossVectors(forward, UP).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();
    // Leave room for the panel: building sits left of centre on wide screens, high on narrow ones.
    const shift =
      aspect > 1.1
        ? right.multiplyScalar(distance * Math.tan(hfov / 2) * 0.36)
        : up.multiplyScalar(-distance * Math.tan(vfov / 2) * 0.32);
    position.add(shift);
    target.add(shift);
    return { position, target };
  }

  showVideoPose() {
    this.mode = { kind: 'video' };
    this.panOrigin.set(0, 0, 0);
    this.director.set(this.videoPose());
  }

  overview(opts: { instant?: boolean } = {}) {
    this.mode = { kind: 'overview' };
    this.panOrigin.set(0, 0, 0);
    const pose = this.overviewPose();
    if (opts.instant || this.opts.reducedMotion) {
      this.director.set(pose);
      return Promise.resolve(true);
    }
    return this.director.fly(pose);
  }

  focus(id: string, opts: { instant?: boolean } = {}) {
    const pose = this.placePose(id);
    if (!pose) return Promise.resolve(false);
    this.mode = { kind: 'place', id };
    if (opts.instant || this.opts.reducedMotion) {
      this.director.set(pose);
      return Promise.resolve(true);
    }
    return this.director.fly(pose);
  }

  private onCameraChange() {
    const distance = this.director.current.position.distanceTo(this.director.current.target);
    this.fog.near = Math.max(280, distance * 1.45);
    this.fog.far = this.fog.near + 620;
    this.dirty = true;
  }

  private resize() {
    const w = Math.max(1, this.opts.host.clientWidth);
    const h = Math.max(1, this.opts.host.clientHeight);
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.anchors.forEach((a) => (a.halfWidth = 0));
    this.renderer.setSize(w, h, false);
    this.composer?.setPixelRatio(this.renderer.getPixelRatio());
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    const aspect = w / h;
    const v = VIDEO_CAMERA.vfov;
    // object-fit: cover keeps the video's vertical FOV until the screen is wider than 16:9.
    this.camera.fov =
      aspect <= VIDEO_CAMERA.aspect
        ? v
        : THREE.MathUtils.radToDeg(2 * Math.atan((Math.tan(deg(v) / 2) * VIDEO_CAMERA.aspect) / aspect));
    this.camera.updateProjectionMatrix();
    if (this.director.flying) return;
    if (this.mode.kind === 'video') this.director.set(this.videoPose());
    else if (this.mode.kind === 'overview') this.director.set(this.overviewPose());
    else {
      const pose = this.placePose(this.mode.id);
      if (pose) this.director.set(pose);
    }
    this.dirty = true;
  }

  private loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop);
    this.timer.update(now);
    const dt = this.timer.getDelta();
    if (!this.opts.reducedMotion) {
      this.traffic.update(dt);
      this.dirty = true;
    }
    if (this.director.flying) this.dirty = true;
    if (!this.dirty) return;
    this.dirty = false;
    this.render(now);
  };

  private render(now = performance.now()) {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
    this.updateAnchors(now);
  }

  private updateAnchors(now: number) {
    const ray = this.raycaster.ray;
    for (const anchor of this.anchors) {
      if (!anchor.el) continue;
      const v = this.tmp.copy(anchor.position).project(this.camera);
      const behind = v.z > 1 || v.z < -1;
      const x = ((v.x + 1) / 2) * this.width;
      const y = ((1 - v.y) / 2) * this.height;
      const offscreen = x < SAFE.side || x > this.width - SAFE.side || y < SAFE.top || y > this.height - SAFE.bottom;
      if (!behind && !offscreen && now - anchor.lastTest > 160) {
        anchor.lastTest = now;
        const origin = this.camera.position;
        const toAnchor = anchor.position.clone().sub(origin);
        const reach = toAnchor.length();
        ray.set(origin, toAnchor.normalize());
        const blocked = this.city.buildings.some((b) => {
          if (b === anchor.building) return false;
          const hit = ray.intersectBox(b.box, this.tmp);
          return hit !== null && hit.distanceTo(origin) < reach - 2;
        });
        anchor.votes = THREE.MathUtils.clamp(anchor.votes + (blocked ? 1 : -1), -2, 2);
        if (anchor.votes >= 2) anchor.occluded = true;
        if (anchor.votes <= -2) anchor.occluded = false;
      }
      // Keep the whole pill on screen even when its anchor sits near an edge.
      anchor.halfWidth ||= anchor.el.offsetWidth / 2;
      const edge = anchor.halfWidth + 12;
      const px = this.width > edge * 2 ? THREE.MathUtils.clamp(x, edge, this.width - edge) : x;
      const cover = this.cover;
      const covered =
        cover !== null &&
        px + anchor.halfWidth > cover.left &&
        px - anchor.halfWidth < cover.right &&
        y > cover.top &&
        y - PILL_RISE < cover.bottom;
      const visible = !behind && !offscreen && !covered && !anchor.occluded && !anchor.forcedHidden;
      anchor.el.style.transform = `translate3d(${px.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      if (visible !== anchor.visible) {
        anchor.visible = visible;
        anchor.el.classList.toggle('is-hidden', !visible);
        anchor.el.tabIndex = visible ? 0 : -1;
        anchor.el.setAttribute('aria-hidden', String(!visible));
      }
    }
  }

  private groundAt(clientX: number, clientY: number, out: THREE.Vector3) {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const { origin, direction } = this.raycaster.ray;
    if (direction.y > -0.05) return null;
    return out.copy(origin).addScaledVector(direction, -origin.y / direction.y);
  }

  private onPointerDown = (event: PointerEvent) => {
    if (!this.interactive || event.button !== 0) return;
    const start = this.groundAt(event.clientX, event.clientY, new THREE.Vector3());
    if (!start) return;
    this.drag = { id: event.pointerId, start, moved: 0, x: event.clientX, y: event.clientY };
  };

  private onPointerMove = (event: PointerEvent) => {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.id) return;
    drag.moved = Math.max(drag.moved, Math.hypot(event.clientX - drag.x, event.clientY - drag.y));
    // Panning is a mouse affordance; touch swipes belong to directed scroll.
    if (event.pointerType !== 'mouse' || this.mode.kind !== 'overview' || this.director.flying || drag.moved < 4) return;
    const now = this.groundAt(event.clientX, event.clientY, new THREE.Vector3());
    if (!now) return;
    const delta = drag.start.clone().sub(now);
    delta.y = 0;
    const next = this.panOrigin.clone().add(delta);
    if (next.length() > PAN_LIMIT) next.setLength(PAN_LIMIT);
    const applied = next.clone().sub(this.panOrigin);
    this.panOrigin.copy(next);
    this.director.pan(applied);
    this.canvas.classList.add('is-dragging');
  };

  private onPointerUp = (event: PointerEvent) => {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.id) return;
    this.drag = null;
    this.canvas.classList.remove('is-dragging');
    if (drag.moved < 6 && event.type === 'pointerup') this.pick(event.clientX, event.clientY);
  };

  private pick(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    let nearest: BuildingInfo | null = null;
    let nearestD = Infinity;
    for (const b of this.city.buildings) {
      const hit = this.raycaster.ray.intersectBox(b.box, this.tmp);
      if (!hit) continue;
      const d = hit.distanceTo(this.raycaster.ray.origin);
      if (d < nearestD) {
        nearestD = d;
        nearest = b;
      }
    }
    const anchor = this.anchors.find((a) => a.building === nearest);
    if (anchor) this.opts.onPick?.(anchor.id);
  }

  private onVisibility = () => {
    if (document.hidden) {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
    } else if (this.wantRunning) {
      this.start();
    }
  };

  private onContextLost = (event: Event) => {
    event.preventDefault();
    this.lost = true;
    this.stop();
    this.opts.onContextLost?.();
  };

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.director.dispose();
    this.resizeObserver.disconnect();
    this.timer.dispose();
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.traffic.dispose();
    this.city.dispose();
    this.environment?.dispose();
    this.composer?.passes.forEach((pass) => pass.dispose());
    this.composer?.dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }
}
