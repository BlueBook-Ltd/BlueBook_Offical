import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SUN } from '@/city/layout';
import { buildCity, type CityBuild } from '@/city/engine/buildCity';
import { detectQuality, type CityAssets } from '@/city/engine/assets';
import type { CityMeasure, LabSettings } from '@/city/lab/settings';

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

const CLOUD_FOG = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    inverseProjection: { value: new THREE.Matrix4() },
    inverseView: { value: new THREE.Matrix4() },
    center: { value: new THREE.Vector2() },
    range: { value: 160 },
    density: { value: 1 },
    fogColor: { value: new THREE.Color('#f4f6f7') },
    time: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform mat4 inverseProjection;
    uniform mat4 inverseView;
    uniform vec2 center;
    uniform float range;
    uniform float density;
    uniform vec3 fogColor;
    uniform float time;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      mat2 m = mat2(0.8, -0.6, 0.6, 0.8);
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p = m * p * 2.05;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float depth = texture2D(tDepth, vUv).x;
      vec4 clip = vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
      vec4 view = inverseProjection * clip;
      view /= view.w;
      vec3 world = (inverseView * vec4(view.xyz, 1.0)).xyz;

      vec2 xz = world.xz - center;
      float dist = length(xz);
      float drift = time * 0.018;
      float puff = fbm(xz * 0.011 + drift) * 2.0 - 1.0;
      float puff2 = fbm(xz * 0.028 - drift * 1.4 + 3.7) * 2.0 - 1.0;
      float edge = range + (puff * 0.34 + puff2 * 0.12) * range;
      float width = max(48.0, range * 0.55);
      float fog = smoothstep(edge, edge + width, dist);
      float clouds = mix(0.96, 1.0, fbm(xz * 0.016 + 9.0));
      float alpha = clamp(fog * density, 0.0, 1.0);
      gl_FragColor = vec4(mix(color.rgb, fogColor * clouds, alpha), color.a);
    }
  `,
};

export type CityLabViewOptions = {
  host: HTMLElement;
  reducedMotion: boolean;
  onBuilt: (measure: CityMeasure) => void;
  onContextLost?: () => void;
};

/**
 * Standalone Bluebook City for the lab page. The homepage engine is left
 * alone: this view only rebuilds the city, orbits a camera, and draws the
 * white cloud ring.
 */
export class CityLabView {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;
  private fogPass: ShaderPass;
  private city: CityBuild | null = null;
  private assets: CityAssets | null = null;
  private assetsReady = false;
  private settings: LabSettings | null = null;
  private builtCount = -1;
  private rebuildTimer = 0;
  private raf = 0;
  private fogTime = 0;
  private disposed = false;
  private environment: THREE.WebGLRenderTarget | null = null;
  private fillLight: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private sunDir: THREE.Vector3;
  private target = new THREE.Vector3();
  private center = new THREE.Vector2(12, -16);
  private resizeObserver: ResizeObserver;
  private dragging: { x: number; y: number; pan: boolean } | null = null;
  private locked = false;
  private handoff: { from: LabSettings; to: LabSettings; start: number } | null = null;
  onHandoffDone: () => void = () => {};

  constructor(private opts: CityLabViewOptions) {
    const quality = detectQuality();
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', stencil: false });
    this.canvas = this.renderer.domElement;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 1.5 : 1.25));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.setClearColor('#f7f8f9');
    this.scene.background = new THREE.Color('#f7f8f9');

    this.camera = new THREE.PerspectiveCamera(32, 1, 1.5, 4000);

    const depthTexture = new THREE.DepthTexture(1, 1);
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthTexture });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.fogPass = new ShaderPass(CLOUD_FOG);
    // RenderPass draws into the composer's read buffer and does not swap, so the
    // scene depth lives on renderTarget2. Sampling the write buffer's depth is a
    // feedback loop and clears the frame.
    this.fogPass.uniforms.tDepth.value = this.composer.renderTarget2.depthTexture;
    this.composer.addPass(this.fogPass);
    this.composer.addPass(new OutputPass());

    const center = new THREE.Vector3(12, 0, -16);
    const az = THREE.MathUtils.degToRad(SUN.azimuth);
    const el = THREE.MathUtils.degToRad(SUN.elevation);
    this.sunDir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    this.sun = new THREE.DirectionalLight(SUN.color, SUN.intensity);
    this.sun.position.copy(center).addScaledVector(this.sunDir, 650);
    this.sun.target.position.copy(center);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(quality === 'high' ? 4096 : 2048, quality === 'high' ? 4096 : 2048);
    const shadowCam = this.sun.shadow.camera;
    shadowCam.left = -250;
    shadowCam.right = 250;
    shadowCam.top = 160;
    shadowCam.bottom = -160;
    shadowCam.near = 300;
    shadowCam.far = 1050;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.05;
    this.sun.shadow.radius = 2.5;
    this.scene.add(this.sun, this.sun.target);
    this.fillLight = new THREE.HemisphereLight('#c9d4e2', '#7a6250', 1.15);
    this.scene.add(this.fillLight);

    opts.host.appendChild(this.canvas);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(opts.host);
    this.resize();

    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.canvas.addEventListener('webglcontextlost', this.onContextLost);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.raf = requestAnimationFrame(this.loop);
  }

  setAssets(assets: CityAssets | null) {
    this.assets = assets;
    this.assetsReady = true;
    if (assets) {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.environment?.dispose();
      this.environment = pmrem.fromEquirectangular(assets.sky);
      pmrem.dispose();
      this.scene.environment = this.environment.texture;
      this.scene.environmentRotation.y = THREE.MathUtils.degToRad(SUN.azimuth - SUN.bakedAzimuth);
      this.scene.environmentIntensity = 0.42;
      this.fillLight.intensity = 0.16;
    }
    this.builtCount = -1;
    if (this.settings) this.apply(this.settings);
  }

  /** Camera and fog apply immediately. A new building count rebuilds the city. */
  apply(settings: LabSettings) {
    // The handoff owns the camera until it finishes. A React render of an
    // in-between pose would otherwise snap the flight backwards.
    if (this.handoff) return;
    this.settings = settings;
    this.updateCamera();
    this.updateFog();
    if (!this.assetsReady || settings.buildings === this.builtCount) return;
    window.clearTimeout(this.rebuildTimer);
    this.rebuildTimer = window.setTimeout(() => this.rebuild(), this.builtCount < 0 ? 0 : 160);
  }

  private rebuild() {
    const settings = this.settings;
    if (!settings || this.disposed) return;
    const count = settings.buildings;
    this.builtCount = count;
    const next = buildCity(this.assets, { buildingCount: count, fit: true });
    if (this.city) {
      this.scene.remove(this.city.group);
      this.city.dispose();
    }
    this.city = next;
    this.scene.add(next.group);
    this.publishMeasure();
    this.renderer.shadowMap.needsUpdate = true;
    this.updateFog();
  }

  private publishMeasure() {
    const buildings = this.city?.buildings ?? [];
    if (!buildings.length) return;
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    let sx = 0;
    let sz = 0;
    for (const building of buildings) {
      const [a, b, c, d] = building.rect;
      x0 = Math.min(x0, a);
      x1 = Math.max(x1, b);
      z0 = Math.min(z0, c);
      z1 = Math.max(z1, d);
      sx += (a + b) / 2;
      sz += (c + d) / 2;
    }
    this.center.set(sx / buildings.length, sz / buildings.length);
    const reach = Math.max(x1 - x0, z1 - z0) * 0.9;
    const shadowCam = this.sun.shadow.camera;
    shadowCam.left = -reach;
    shadowCam.right = reach;
    shadowCam.top = reach;
    shadowCam.bottom = -reach;
    shadowCam.near = 50;
    shadowCam.far = 1600;
    shadowCam.updateProjectionMatrix();
    this.sun.target.position.set(this.center.x, 0, this.center.y);
    this.sun.position.copy(this.sun.target.position).addScaledVector(this.sunDir, 650);
    this.sun.target.updateMatrixWorld();
    this.opts.onBuilt({
      count: buildings.length,
      width: Math.round(x1 - x0),
      depth: Math.round(z1 - z0),
      centerX: this.center.x,
      centerZ: this.center.y,
      radius: 0.5 * Math.hypot(x1 - x0, z1 - z0),
    });
  }

  private updateCamera() {
    const s = this.settings;
    if (!s) return;
    const yaw = THREE.MathUtils.degToRad(s.yaw);
    const pitch = THREE.MathUtils.degToRad(s.pitch);
    const horizontal = Math.cos(pitch);
    this.target.set(s.targetX, 0, s.targetZ);
    this.camera.position.set(
      s.targetX + Math.sin(yaw) * horizontal * s.distance,
      Math.sin(pitch) * s.distance,
      s.targetZ + Math.cos(yaw) * horizontal * s.distance,
    );
    this.camera.fov = s.fov;
    this.camera.aspect = Math.max(0.2, this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight));
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }

  private updateFog() {
    const s = this.settings;
    if (!s) return;
    const uniforms = this.fogPass.uniforms;
    uniforms.range.value = s.fogRange;
    uniforms.density.value = s.fogDensity;
    uniforms.fogColor.value.set(s.fogColor);
    uniforms.center.value.copy(this.center);
  }

  private resize() {
    const w = Math.max(1, this.opts.host.clientWidth);
    const h = Math.max(1, this.opts.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.updateCamera();
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    if (document.hidden) return;
    if (!this.opts.reducedMotion) this.fogTime += 0.016;
    this.stepHandoff();
    this.render();
  };

  private stepHandoff() {
    const flight = this.handoff;
    if (!flight || !this.settings) return;
    const elapsed = performance.now() - flight.start;
    // The dissolve has already finished on the video pose. Move to the saved
    // view with the fog still off, then bring the fog in.
    const move = easeInOut(clamp01(elapsed / 1700));
    const fog = easeInOut(clamp01((elapsed - 1700) / 900));
    const mix = (a: number, b: number, t: number) => a + (b - a) * t;
    const { from, to } = flight;
    const next: LabSettings = {
      ...to,
      buildings: from.buildings,
      yaw: mix(from.yaw, to.yaw, move),
      pitch: mix(from.pitch, to.pitch, move),
      distance: mix(from.distance, to.distance, move),
      fov: mix(from.fov, to.fov, move),
      targetX: mix(from.targetX, to.targetX, move),
      targetZ: mix(from.targetZ, to.targetZ, move),
      fogDensity: mix(from.fogDensity, to.fogDensity, fog),
    };
    this.settings = next;
    this.updateCamera();
    this.updateFog();
    if (elapsed > 2700) {
      this.handoff = null;
      this.locked = false;
      this.onCamera(next);
      this.onHandoffDone();
    } else if (Math.round(elapsed / 120) !== Math.round((elapsed - 16) / 120)) {
      this.onCamera(next);
    }
  }

  private render() {
    const uniforms = this.fogPass.uniforms;
    uniforms.inverseProjection.value.copy(this.camera.projectionMatrixInverse);
    uniforms.inverseView.value.copy(this.camera.matrixWorld);
    uniforms.time.value = this.fogTime;
    uniforms.center.value.copy(this.center);
    this.composer.render();
  }

  private emit(patch: Partial<LabSettings>) {
    if (!this.settings) return;
    this.settings = { ...this.settings, ...patch };
    this.updateCamera();
    this.onCamera(this.settings);
  }

  /** Assigned by the page so a drag updates the sliders without importing React here. */
  onCamera: (settings: LabSettings) => void = () => {};

  /** Ignore orbiting while Video End is handing off to the saved view. */
  setLocked(on: boolean) {
    this.locked = on;
    if (on) this.dragging = null;
  }

  /**
   * After the video has dissolved, ease from its pose to the saved view and
   * bring the fog in. Runs on the render loop so a slow React update cannot stall it.
   */
  beginHandoff(from: LabSettings, to: LabSettings) {
    this.locked = true;
    this.dragging = null;
    if (this.opts.reducedMotion) {
      this.handoff = null;
      this.settings = to;
      this.updateCamera();
      this.updateFog();
      this.locked = false;
      this.onCamera(to);
      this.onHandoffDone();
      return;
    }
    this.handoff = { from, to, start: performance.now() };
    this.settings = from;
    this.updateCamera();
    this.updateFog();
    this.onCamera(from);
  }

  private onPointerDown = (event: PointerEvent) => {
    if (this.locked || !this.settings || event.button > 2) return;
    this.dragging = { x: event.clientX, y: event.clientY, pan: event.button === 2 || event.shiftKey || event.button === 1 };
    this.canvas.setPointerCapture(event.pointerId);
  };

  private onPointerMove = (event: PointerEvent) => {
    const drag = this.dragging;
    const s = this.settings;
    if (!drag || !s) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (drag.pan || event.shiftKey) {
      const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
      const back = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 2);
      right.y = 0;
      back.y = 0;
      if (right.lengthSq() < 1e-6 || back.lengthSq() < 1e-6) return;
      right.normalize();
      back.normalize();
      const scale = s.distance * 0.0016;
      this.emit({
        targetX: s.targetX - (right.x * dx - back.x * dy) * scale,
        targetZ: s.targetZ - (right.z * dx - back.z * dy) * scale,
      });
      return;
    }
    this.emit({
      yaw: s.yaw + dx * 0.22,
      pitch: THREE.MathUtils.clamp(s.pitch - dy * 0.16, 18, 88),
    });
  };

  private onPointerUp = (event: PointerEvent) => {
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    this.dragging = null;
  };

  private onWheel = (event: WheelEvent) => {
    if (this.locked || !this.settings) return;
    event.preventDefault();
    const next = THREE.MathUtils.clamp(this.settings.distance * Math.exp(event.deltaY * 0.0011), 40, 1200);
    this.emit({ distance: next });
  };

  private onVisibility = () => {
    if (!document.hidden && !this.raf) this.raf = requestAnimationFrame(this.loop);
  };

  private onContextLost = (event: Event) => {
    event.preventDefault();
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.opts.onContextLost?.();
  };

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    window.clearTimeout(this.rebuildTimer);
    if (this.raf) cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.city?.dispose();
    this.environment?.dispose();
    this.composer.passes.forEach((pass) => pass.dispose());
    this.composer.dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }
}
