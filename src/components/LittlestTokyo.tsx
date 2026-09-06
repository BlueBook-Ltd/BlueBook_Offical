import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const MODEL_URL = "/models/littlest-tokyo/LittlestTokyo.glb";

function startCity(host: HTMLElement, onProgress: (value: number) => void) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  const renderer = new THREE.WebGLRenderer({
    antialias: !coarsePointer,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarsePointer ? 1 : 1.5));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb9ded8);
  scene.fog = new THREE.Fog(0xb9ded8, 9, 24);

  const environment = new THREE.PMREMGenerator(renderer);
  scene.environment = environment.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(5.6, 3.2, 7.6);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 4.4;
  controls.maxDistance = 12;
  controls.minPolarAngle = Math.PI * 0.2;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.target.set(0.3, 1.15, 0);
  controls.autoRotate = !reducedMotion;
  controls.autoRotateSpeed = 0.42;
  controls.update();

  const draco = new DRACOLoader();
  draco.setDecoderPath("/vendor/draco/");
  draco.setDecoderConfig({ type: "js" });

  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  let mixer: THREE.AnimationMixer | undefined;
  let model: THREE.Object3D | undefined;
  loader.load(
    MODEL_URL,
    (gltf) => {
      model = gltf.scene;
      model.position.set(0.25, 0, 0);
      model.scale.setScalar(0.01);
      scene.add(model);
      if (gltf.animations[0] && !reducedMotion) {
        mixer = new THREE.AnimationMixer(model);
        mixer.clipAction(gltf.animations[0]).play();
      }
      onProgress(1);
    },
    (event) => onProgress(event.total ? event.loaded / event.total : 0.15),
    (error) => {
      console.error("[city] Littlest Tokyo failed to load", error);
      onProgress(-1);
    },
  );

  const clock = new THREE.Clock();
  let frame = 0;
  let destroyed = false;

  const resize = () => {
    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(host);

  const render = () => {
    if (destroyed) return;
    mixer?.update(Math.min(clock.getDelta(), 0.05));
    controls.update();
    renderer.render(scene, camera);
    frame = requestAnimationFrame(render);
  };
  render();

  return () => {
    destroyed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    controls.dispose();
    mixer?.stopAllAction();
    model?.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
    draco.dispose();
    environment.dispose();
    scene.environment?.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}

export default function LittlestTokyo() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    return startCity(host, setProgress);
  }, []);

  return (
    <main className="city-stage">
      <div ref={hostRef} className="city-stage__canvas" aria-label="Interactive miniature Tokyo city" />
      {progress < 1 && (
        <div className="city-stage__loader" role="status">
          <span>{progress < 0 ? "Model failed to load" : "Loading Tokyo"}</span>
          {progress >= 0 && <i style={{ transform: `scaleX(${Math.max(progress, 0.03)})` }} />}
        </div>
      )}
      <div className="city-stage__copy">
        <p>BLUEBOOK / CITY STUDY</p>
        <h1>A city in motion.</h1>
        <span>Drag to explore · Scroll to zoom</span>
      </div>
      <a className="city-stage__credit" href="https://www.artstation.com/artwork/1AGwX" target="_blank" rel="noreferrer">
        “Littlest Tokyo” by Glen Fox · CC BY
      </a>
    </main>
  );
}
