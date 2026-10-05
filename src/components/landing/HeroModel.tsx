import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Open book in the hero slot. Transparent canvas so the wordmark shows around it.
 */
export default function HeroModel() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = window.matchMedia('(hover: none), (pointer: coarse)').matches;

    const renderer = new THREE.WebGLRenderer({
      antialias: !coarse,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.25 : 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
    camera.position.set(0.05, 3.4, 4.6);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xf4f7fb, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(2.4, 4.2, 3.2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x8ec8ff, 0.7);
    rim.position.set(-3.2, 1.4, -1.6);
    scene.add(rim);

    const book = new THREE.Group();
    book.position.set(-0.28, 0.05, 0);
    book.rotation.x = -0.15;
    book.rotation.z = 0.02;
    book.scale.setScalar(0.96);
    scene.add(book);

    const coverMat = new THREE.MeshStandardMaterial({
      color: 0x14181c,
      roughness: 0.46,
      metalness: 0.12,
    });
    const pageMat = new THREE.MeshStandardMaterial({
      color: 0xf6f3ee,
      roughness: 0.82,
      metalness: 0,
    });
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0x005bc1,
      roughness: 0.4,
      metalness: 0.05,
    });

    const coverGeo = new THREE.BoxGeometry(1.42, 0.045, 1.92);
    const pageGeo = new THREE.BoxGeometry(1.28, 0.012, 1.78);

    const leftHinge = new THREE.Group();
    const rightHinge = new THREE.Group();
    book.add(leftHinge, rightHinge);

    const leftCover = new THREE.Mesh(coverGeo, coverMat);
    leftCover.castShadow = true;
    leftCover.position.set(-0.71, 0, 0);
    leftHinge.add(leftCover);

    const rightCover = new THREE.Mesh(coverGeo, coverMat);
    rightCover.castShadow = true;
    rightCover.position.set(0.71, 0, 0);
    rightHinge.add(rightCover);

    for (let i = 0; i < 7; i += 1) {
      const page = new THREE.Mesh(pageGeo, pageMat);
      page.castShadow = true;
      page.receiveShadow = true;
      const side = i < 4 ? leftHinge : rightHinge;
      const n = i < 4 ? i : i - 4;
      page.position.set(i < 4 ? -0.66 : 0.66, 0.03 + n * 0.014, 0.01);
      page.rotation.y = (i < 4 ? 1 : -1) * (0.04 + n * 0.015);
      side.add(page);
    }

    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.02, 1.55), edgeMat);
    mark.position.set(0.42, 0.08, 0.02);
    rightHinge.add(mark);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(1.6, 32),
      new THREE.ShadowMaterial({ opacity: 0.12 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.42;
    ground.receiveShadow = true;
    scene.add(ground);

    const pointer = { x: 0, y: 0 };
    const onMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove);

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

    let frame = 0;
    let destroyed = false;
    const clock = new THREE.Clock();
    let spin = 0.55;

    const render = () => {
      if (destroyed) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const open = reduced ? 1 : Math.min(1, clock.elapsedTime / 1.1);
      const eased = 1 - (1 - open) ** 3;
      leftHinge.rotation.y = THREE.MathUtils.lerp(0.08, 1.05, eased);
      rightHinge.rotation.y = THREE.MathUtils.lerp(-0.08, -0.95, eased);
      if (!reduced) spin += dt * 0.18;
      const tiltY = reduced ? 0 : pointer.x * 0.18;
      const tiltX = reduced ? 0 : pointer.y * 0.08;
      book.rotation.y = 0.35 + spin * 0.15 + tiltY;
      book.rotation.x = -0.15 + tiltX;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    render();

    return () => {
      destroyed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('pointermove', onMove);
      coverGeo.dispose();
      pageGeo.dispose();
      mark.geometry.dispose();
      ground.geometry.dispose();
      coverMat.dispose();
      pageMat.dispose();
      edgeMat.dispose();
      (ground.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div className="hm-model" ref={hostRef} aria-hidden="true" />;
}
