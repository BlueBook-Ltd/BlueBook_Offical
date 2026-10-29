import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import type { FacadeStyle } from '@/city/layout';

/**
 * Photographic PBR sources, CC0 from Poly Haven. Facade maps are composited at
 * runtime with windows; ground maps are used directly at world scale.
 *
 * red_brick, red_brick_03, yellow_brick, grey_plaster, aerial_asphalt_01 — Rob Tuytel
 * beige_wall_001, concrete_floor_worn_001 — Dimitrios Savva, Rico Cilliers
 * concrete_wall_008 — Dario Barresi, Charlotte Baglioni
 * concrete_pavement — Charlotte Baglioni
 * qwantani_late_afternoon_puresky — Greg Zaal, Jarod Guest
 */

export type Quality = 'high' | 'low';

const BASE = '/assets/bluebook/city/textures/';
const STYLES: readonly FacadeStyle[] = ['brick', 'tan', 'cream', 'stone', 'umber', 'grey'];
const SURFACES = ['asphalt', 'paving', 'roof'] as const;
type Surface = (typeof SURFACES)[number];

export type MapSet = { diff: HTMLImageElement; nor: HTMLImageElement; arm: HTMLImageElement };

export type CityAssets = {
  quality: Quality;
  walls: Record<FacadeStyle, MapSet>;
  surfaces: Record<Surface, MapSet>;
  concrete: HTMLImageElement;
  sky: THREE.DataTexture;
};

export function detectQuality(): Quality {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.screen.width, window.screen.height) < 700;
  const cores = navigator.hardwareConcurrency ?? 8;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  return coarse || small || cores <= 4 || memory <= 4 ? 'low' : 'high';
}

const loader = new THREE.ImageLoader();
const image = (name: string) => loader.loadAsync(`${BASE}${name}.jpg`);

async function mapSet(prefix: string): Promise<MapSet> {
  const [diff, nor, arm] = await Promise.all([image(`${prefix}-diff`), image(`${prefix}-nor`), image(`${prefix}-arm`)]);
  return { diff, nor, arm };
}

async function record<K extends string, V>(keys: readonly K[], load: (key: K) => Promise<V>) {
  const values = await Promise.all(keys.map(load));
  return Object.fromEntries(keys.map((k, i) => [k, values[i]])) as Record<K, V>;
}

let pending: Promise<CityAssets> | null = null;

/** Shared across engine instances; a failed load is retried next time. */
export function loadCityAssets(quality: Quality = detectQuality()) {
  pending ??= Promise.all([
    record(STYLES, (s) => mapSet(`wall-${s}`)),
    record(SURFACES, (s) => mapSet(s)),
    image('concrete-diff'),
    new HDRLoader().loadAsync(`${BASE}sky.hdr`),
  ])
    .then(([walls, surfaces, concrete, sky]) => ({ quality, walls, surfaces, concrete, sky }))
    .catch((error) => {
      pending = null;
      throw error;
    });
  return pending;
}
