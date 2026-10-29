import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  BLOCKS,
  CITY_BOUNDS,
  CORE_BUILDINGS,
  PALETTE,
  STREETS,
  type FacadeStyle,
  type Rect,
  type RoofKind,
  type Street,
} from '@/city/layout';
import { MeshBuilder } from '@/city/engine/meshBuilder';
import { mulberry32, pick, range, weighted, type Rng } from '@/city/engine/rng';
import {
  ASPHALT_TILE,
  BASE_H,
  BAY_W,
  FACADE_TILE,
  FLOOR_H,
  PAVING_TILE,
  PHOTO_TILE,
  ROOF_TILE,
  asphaltTexture,
  facadeTexture,
  foliageMaps,
  imageTexture,
  pavingTexture,
  photoFacadeMaps,
  photoStorefrontMaps,
  roofTexture,
  storefrontTexture,
  surfaceMaps,
  type PbrMaps,
} from '@/city/engine/textures';
import type { CityAssets } from '@/city/engine/assets';

export type BuildingInfo = {
  id: string;
  rect: Rect;
  height: number;
  /** Highest point including rooftop structures. */
  top: number;
  box: THREE.Box3;
  core: boolean;
};

export type CityBuild = {
  group: THREE.Group;
  buildings: BuildingInfo[];
  byId: Map<string, BuildingInfo>;
  carGeometry: THREE.BufferGeometry;
  carMaterial: THREE.MeshStandardMaterial;
  dispose: () => void;
};

type Plan = {
  id: string;
  rect: Rect;
  floors: number;
  style: FacadeStyle;
  roof: RoofKind;
  core: boolean;
};

const STYLES: readonly (readonly [FacadeStyle, number])[] = [
  ['brick', 0.3],
  ['tan', 0.22],
  ['cream', 0.13],
  ['stone', 0.16],
  ['umber', 0.1],
  ['grey', 0.09],
];

const ROOF_TONES: Record<FacadeStyle, string[]> = {
  cream: ['#f3f1ec', '#dcd9d3', '#c9c6c0'],
  stone: ['#d4d2ce', '#b7b4ae', '#9d9a95'],
  tan: ['#c7c3bc', '#a9a59f', '#8e8b86'],
  brick: ['#a29f9a', '#83807b', '#6a6763'],
  umber: ['#7a7773', '#5e5c59', '#4c4a48'],
  grey: ['#a9a7a3', '#7e7c79', '#62605d'],
};

const COPING: Record<FacadeStyle, string> = {
  cream: '#e7dfd0',
  stone: '#c9c2b6',
  tan: '#d3c2a8',
  brick: '#b59a84',
  umber: '#9c836d',
  grey: '#bdb9b2',
};

const CAR_COLORS: readonly (readonly [string, number])[] = [
  ['#e9e7e2', 0.26],
  ['#b8bbbf', 0.2],
  ['#1c1e21', 0.18],
  ['#4b4f55', 0.14],
  ['#2a3850', 0.08],
  ['#8b7c67', 0.06],
  ['#7b2622', 0.05],
  ['#3d4a3b', 0.03],
];

const PARAPET_H = 1.05;
const PARAPET_T = 0.45;
const SIDEWALK_H = 0.15;
const LOT_H = 0.17;
const MARK_Y = 0.025;
const LANE_PARKING = 1.1;

/** Region the overview and focused views actually see. Detail outside it is reduced. */
const DETAIL: Rect = [-165, 175, -175, 140];
const inDetail = (x: number, z: number) => x >= DETAIL[0] && x <= DETAIL[1] && z >= DETAIL[2] && z <= DETAIL[3];

const overlaps = (a: Rect, b: Rect, pad = 0) =>
  a[0] < b[1] + pad && a[1] > b[0] - pad && a[2] < b[3] + pad && a[3] > b[2] - pad;

function split(a: number, b: number, min: number, max: number, rng: Rng) {
  const spans: [number, number][] = [];
  let x = a;
  while (b - x > max + min) {
    const w = range(rng, min, max);
    spans.push([x, x + w]);
    x += w;
  }
  if (b - x > max) {
    const mid = (x + b) / 2;
    spans.push([x, mid], [mid, b]);
  } else {
    spans.push([x, b]);
  }
  return spans;
}

const floorsFor = (height: number) => Math.max(2, Math.round((height - BASE_H) / FLOOR_H));
export const heightFor = (floors: number) => BASE_H + floors * FLOOR_H;

function planBuildings(rng: Rng): Plan[] {
  const core: Plan[] = CORE_BUILDINGS.map((b) => ({
    id: b.id,
    rect: b.rect,
    floors: floorsFor(b.height),
    style: b.style,
    roof: b.roof,
    core: true,
  }));
  const filler: Plan[] = [];
  BLOCKS.forEach((block, bi) => {
    const cols = split(block[0], block[1], 15, 25, rng);
    const rows = split(block[2], block[3], 17, 28, rng);
    cols.forEach(([x0, x1], i) => {
      rows.forEach(([z0, z1], j) => {
        const edge = i === 0 || j === 0 || i === cols.length - 1 || j === rows.length - 1;
        if (!edge && rng() < 0.45) return;
        const inset = () => (rng() < 0.18 ? range(rng, 1.4, 3) : 0.12);
        const rect: Rect = [x0 + inset(), x1 - inset(), z0 + inset(), z1 - inset()];
        if (rect[1] - rect[0] < 8 || rect[3] - rect[2] < 8) return;
        if (core.some((c) => overlaps(c.rect, rect, 1.2))) return;
        const floors = edge
          ? weighted(rng, [[5, 1], [6, 2], [7, 3], [8, 3], [9, 2], [10, 1.5], [11, 1]] as const)
          : weighted(rng, [[2, 1], [3, 2], [4, 2], [5, 1]] as const);
        const big = rect[1] - rect[0] > 18 && rect[3] - rect[2] > 18;
        filler.push({
          id: `b${bi}-${i}-${j}`,
          rect,
          floors,
          style: weighted(rng, STYLES),
          roof: big && rng() < 0.12 ? 'court' : rng() < 0.24 ? 'penthouse' : 'plain',
          core: false,
        });
      });
    });
  });
  return [...core, ...filler];
}

function tint(rng: Rng, amount: number) {
  const k = 1 + range(rng, -amount, amount);
  return new THREE.Color(k, k * range(rng, 0.985, 1.01), k * range(rng, 0.97, 1.0));
}

const color = (hex: string) => new THREE.Color(hex);

/** Curb line on each side of a block: the street whose building line matches the block edge. */
function curbRect(block: Rect): Rect {
  const find = (edge: number, axis: 'x' | 'z', sign: number) => {
    for (const s of STREETS) {
      if (s.axis !== (axis === 'x' ? 'z' : 'x')) continue;
      const line = s.at - sign * (s.half + s.sidewalk);
      if (Math.abs(line - edge) < 0.6) return s.at - sign * s.half;
    }
    return edge + sign * 4;
  };
  return [find(block[0], 'x', -1), find(block[1], 'x', 1), find(block[2], 'z', -1), find(block[3], 'z', 1)];
}

/** Crossing streets that actually meet `street` at their centreline. */
function crossings(street: Street) {
  return STREETS.filter(
    (o) => o.axis !== street.axis && street.at >= o.from && street.at <= o.to && o.at >= street.from && o.at <= street.to,
  );
}

function nearCrossing(street: Street, t: number, pad: number) {
  return crossings(street).some((o) => Math.abs(t - o.at) < o.half + o.sidewalk + pad);
}

/** Point on a street at distance `t` along it and lateral offset `side`. */
function streetPoint(street: Street, t: number, side: number): [number, number] {
  return street.axis === 'x' ? [t, street.at + side] : [street.at + side, t];
}

function addMarkings(marks: MeshBuilder, uvScale: number) {
  const white = color('#e9e6df');
  const yellow = color('#d9a531');
  const strip = (street: Street, t0: number, t1: number, offset: number, width: number, c: THREE.Color) => {
    const [ax, az] = streetPoint(street, t0, offset - width / 2);
    const [bx, bz] = streetPoint(street, t1, offset + width / 2);
    marks.top([Math.min(ax, bx), Math.max(ax, bx), Math.min(az, bz), Math.max(az, bz)], MARK_Y, c, uvScale);
  };
  const along = (street: Street, pad: number, fn: (t0: number, t1: number) => void) => {
    const cuts = crossings(street)
      .map((o) => [o.at - o.half - pad, o.at + o.half + pad] as const)
      .sort((a, b) => a[0] - b[0]);
    let t = street.from;
    for (const [c0, c1] of cuts) {
      if (c0 > t) fn(t, c0);
      t = Math.max(t, c1);
    }
    if (street.to > t) fn(t, street.to);
  };

  for (const street of STREETS) {
    if (street.centerLine === 'yellow') {
      along(street, 5, (t0, t1) => {
        strip(street, t0, t1, -0.2, 0.14, yellow);
        strip(street, t0, t1, 0.2, 0.14, yellow);
      });
    }
    if (street.parking && street.half >= 6) {
      along(street, 6, (t0, t1) => {
        strip(street, t0, t1, -(street.half - LANE_PARKING * 2.1), 0.12, white);
        strip(street, t0, t1, street.half - LANE_PARKING * 2.1, 0.12, white);
      });
    }
  }

  // Zebra crossings and stop lines where two crosswalk streets meet.
  for (const sx of STREETS.filter((s) => s.axis === 'x' && s.crosswalks)) {
    for (const sz of crossings(sx).filter((s) => s.crosswalks)) {
      for (const side of [-1, 1]) {
        // Across sx, beside sz.
        const cx = sz.at + side * (sz.half + 2.6);
        for (let z = sx.at - sx.half + 0.6; z < sx.at + sx.half - 0.4; z += 1.15) {
          marks.top([cx - 1.6, cx + 1.6, z, z + 0.55], MARK_Y, white, uvScale);
        }
        const stopX = sz.at + side * (sz.half + 4.8);
        const half: [number, number] = side < 0 ? [sx.at, sx.at + sx.half - 0.3] : [sx.at - sx.half + 0.3, sx.at];
        marks.top([stopX - 0.22, stopX + 0.22, half[0], half[1]], MARK_Y, white, uvScale);

        // Across sz, beside sx (only where sz continues).
        const cz = sx.at + side * (sx.half + 2.6);
        if (cz < sz.from || cz > sz.to) continue;
        for (let x = sz.at - sz.half + 0.6; x < sz.at + sz.half - 0.4; x += 1.15) {
          marks.top([x, x + 0.55, cz - 1.6, cz + 1.6], MARK_Y, white, uvScale);
        }
        const stopZ = sx.at + side * (sx.half + 4.8);
        const halfZ: [number, number] = side < 0 ? [sz.at - sz.half + 0.3, sz.at] : [sz.at, sz.at + sz.half - 0.3];
        marks.top([halfZ[0], halfZ[1], stopZ - 0.22, stopZ + 0.22], MARK_Y, white, uvScale);
      }
    }
  }
}

function carGeometry() {
  const b = new MeshBuilder();
  const paint = new THREE.Color(1, 1, 1);
  const glass = new THREE.Color(0.08, 0.09, 0.1);
  const dark = new THREE.Color(0.05, 0.05, 0.05);
  b.box([-1.95, 1.95, -0.85, 0.85], 0, 0.42, dark);
  b.box([-2.2, 2.2, -0.93, 0.93], 0.32, 1.02, paint);
  b.box([-1.35, 1.0, -0.8, 0.8], 1.02, 1.6, (face) => (face === 'top' ? paint : glass));
  return b.build();
}

/**
 * Breaks up visible repetition on large tiled surfaces: the same map, read
 * again much larger and rotated, modulates brightness at street-block scale.
 */
function antiTile(material: THREE.MeshStandardMaterial, strength: number) {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      {
        vec2 macroUv = mat2(0.8, -0.6, 0.6, 0.8) * vMapUv * 0.137 + 0.31;
        vec3 macro = texture2D(map, macroUv).rgb + texture2D(map, macroUv * 0.37 + 0.5).rgb;
        float k = dot(macro, vec3(0.5)) / max(dot(texture2D(map, vec2(0.5), 12.0).rgb, vec3(1.0)), 1e-3);
        diffuseColor.rgb *= clamp(mix(1.0, k, ${strength.toFixed(2)}), 0.6, 1.35);
      }`,
    );
  };
  material.customProgramCacheKey = () => `anti-tile-${strength}`;
}

/** Lumpy, smooth-shaded crown; the vertex colour darkens the underside and the folds between lobes. */
function canopyGeometry() {
  const geo = mergeVertices(new THREE.IcosahedronGeometry(1, 3).deleteAttribute('normal').deleteAttribute('uv'));
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i).normalize();
    const lobes =
      0.2 * Math.sin(3.3 * v.x + 1.3) * Math.sin(2.9 * v.y + 0.4) * Math.sin(3.1 * v.z + 2.1) +
      0.09 * Math.sin(7.7 * v.x + 2.2 * v.z) * Math.sin(6.9 * v.y - 1.7 * v.x + 0.6) +
      0.04 * Math.sin(15.3 * v.z + 4.1 * v.y) * Math.sin(13.7 * v.x + 0.9);
    const r = 1 + lobes;
    const y = v.y < -0.2 ? -0.2 + (v.y + 0.2) * 0.55 : v.y;
    pos.setXYZ(i, v.x * r, y * r, v.z * r);
    const fold = THREE.MathUtils.clamp(0.72 + lobes * 1.6, 0.35, 1.1);
    const height = 0.62 + 0.38 * THREE.MathUtils.smoothstep(v.y, -0.8, 0.9);
    const k = fold * height;
    colors.set([k * 1.04, k, k * 0.86], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  // Per-triangle spherical UVs for the foliage map, unwrapped across the seam.
  const flat = geo.toNonIndexed();
  geo.dispose();
  const p = flat.getAttribute('position');
  const uvs = new Float32Array(p.count * 2);
  for (let t = 0; t < p.count; t += 3) {
    const us: number[] = [];
    for (let k = 0; k < 3; k += 1) {
      v.fromBufferAttribute(p, t + k).normalize();
      us.push(Math.atan2(v.z, v.x) / (Math.PI * 2) + 0.5);
      uvs[(t + k) * 2 + 1] = (1 - Math.acos(THREE.MathUtils.clamp(v.y, -1, 1)) / Math.PI) * 3;
    }
    const max = Math.max(...us);
    us.forEach((u, k) => (uvs[(t + k) * 2] = (max - u > 0.5 ? u + 1 : u) * 6));
  }
  flat.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return flat;
}

export function buildCity(assets: CityAssets | null = null): CityBuild {
  const rng = mulberry32(20261028);
  const group = new THREE.Group();
  group.name = 'bluebook-city';
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(item: T) => {
    disposables.push(item);
    return item;
  };
  /** Standard material; with photo maps, roughness/metalness/AO all come from the ARM texture. */
  const standard = (params: THREE.MeshStandardMaterialParameters, maps: PbrMaps | null, normalScale = 1) => {
    const material = keep(new THREE.MeshStandardMaterial(params));
    if (maps) {
      material.map = keep(maps.map);
      material.normalMap = keep(maps.normalMap);
      material.normalScale.setScalar(normalScale);
      const armMap = keep(maps.arm);
      material.aoMap = armMap;
      material.roughnessMap = armMap;
      material.metalnessMap = armMap;
      material.roughness = params.roughness ?? 1;
      material.metalness = 1;
    }
    return material;
  };
  const surfaces = assets && {
    asphalt: surfaceMaps(assets.surfaces.asphalt),
    paving: surfaceMaps(assets.surfaces.paving),
    roof: surfaceMaps(assets.surfaces.roof),
  };

  // Ground.
  const pad = 700;
  const groundGeo = keep(new THREE.PlaneGeometry(CITY_BOUNDS[1] - CITY_BOUNDS[0] + pad * 2, CITY_BOUNDS[3] - CITY_BOUNDS[2] + pad * 2));
  groundGeo.rotateX(-Math.PI / 2);
  groundGeo.translate((CITY_BOUNDS[0] + CITY_BOUNDS[1]) / 2, 0, (CITY_BOUNDS[2] + CITY_BOUNDS[3]) / 2);
  const groundUv = groundGeo.getAttribute('uv');
  const groundPos = groundGeo.getAttribute('position');
  const asphaltTile = surfaces ? PHOTO_TILE.asphalt : ASPHALT_TILE;
  for (let i = 0; i < groundUv.count; i += 1) {
    groundUv.setXY(i, groundPos.getX(i) / asphaltTile, -groundPos.getZ(i) / asphaltTile);
  }
  const groundMaterial = surfaces
    ? standard({ color: new THREE.Color(1.3, 1.17, 1.0) }, surfaces.asphalt, 0.8)
    : standard({ color: PALETTE.ground, map: keep(asphaltTexture()), roughness: 0.96 }, null);
  if (surfaces) antiTile(groundMaterial, 0.55);
  const ground = new THREE.Mesh(groundGeo, groundMaterial);
  ground.receiveShadow = true;
  ground.name = 'ground';
  group.add(ground);

  const paving = new MeshBuilder();
  const lots = new MeshBuilder();
  const pavingTone = color(surfaces ? '#f2ede6' : PALETTE.sidewalk);
  for (const block of BLOCKS) {
    const curb = curbRect(block);
    paving.box(curb, 0, SIDEWALK_H, pavingTone, 1 / (surfaces ? PHOTO_TILE.paving : PAVING_TILE));
    lots.top(block, LOT_H, color(PALETTE.lot));
  }
  const pavingMaterial = surfaces
    ? standard({ vertexColors: true }, surfaces.paving)
    : standard({ map: keep(pavingTexture()), vertexColors: true, roughness: 0.92 }, null);
  if (surfaces) antiTile(pavingMaterial, 0.35);
  const pavingMesh = new THREE.Mesh(keep(paving.build()), pavingMaterial);
  pavingMesh.receiveShadow = true;
  group.add(pavingMesh);

  const marks = new MeshBuilder();
  addMarkings(marks, surfaces ? 1 / PHOTO_TILE.paint : 0);
  const marksMaterial = standard(
    {
      vertexColors: true,
      roughness: 0.8,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    },
    null,
  );
  if (assets && surfaces) {
    // Worn paint: the asphalt shows through where the concrete map is dark, and the paint follows its bumps.
    marksMaterial.alphaMap = keep(imageTexture(assets.surfaces.roof.diff, false));
    marksMaterial.transparent = true;
    marksMaterial.opacity = 0.95;
    marksMaterial.depthWrite = false;
    marksMaterial.normalMap = surfaces.asphalt.normalMap;
    marksMaterial.normalScale.setScalar(0.8);
  }
  const marksMesh = new THREE.Mesh(keep(marks.build()), marksMaterial);
  marksMesh.receiveShadow = true;
  group.add(marksMesh);

  // Buildings.
  const plans = planBuildings(rng);
  const facadeBuilders = new Map<FacadeStyle, MeshBuilder>();
  const storefronts = new MeshBuilder();
  const roofs = new MeshBuilder();
  const plain = lots;
  const plainUv = surfaces ? 1 / PHOTO_TILE.concrete : 0;
  const roofUv = 1 / (surfaces ? PHOTO_TILE.roof : ROOF_TILE);
  const clutter: { m: THREE.Matrix4; c: THREE.Color }[] = [];
  const tanks: THREE.Matrix4[] = [];
  const buildings: BuildingInfo[] = [];
  const dummy = new THREE.Object3D();
  const addClutter = (x: number, y: number, z: number, sx: number, sy: number, sz: number, c: THREE.Color, rot = 0) => {
    dummy.position.set(x, y + sy / 2, z);
    dummy.rotation.set(0, rot, 0);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    clutter.push({ m: dummy.matrix.clone(), c });
  };

  for (const plan of plans) {
    const [x0, x1, z0, z1] = plan.rect;
    const w = x1 - x0;
    const d = z1 - z0;
    const h = heightFor(plan.floors);
    const brng = mulberry32(Math.floor((x0 + 1000) * 131 + (z0 + 1000) * 17 + plan.floors));
    let builder = facadeBuilders.get(plan.style);
    if (!builder) {
      builder = new MeshBuilder();
      facadeBuilders.set(plan.style, builder);
    }
    const wallTint = tint(brng, 0.07);
    const u0 = Math.floor(brng() * 4) * BAY_W;
    const facadeUv = { u0, uScale: 1 / FACADE_TILE[0], v0: BASE_H, vScale: 1 / FACADE_TILE[1] };
    const baseUv = { u0, uScale: 1 / (BAY_W * 4), v0: 0, vScale: 1 / BASE_H };
    for (const face of ['north', 'south', 'east', 'west'] as const) {
      builder.wall(face, plan.rect, BASE_H, h, wallTint, facadeUv);
      storefronts.wall(face, plan.rect, 0, BASE_H, wallTint, baseUv);
    }

    // Roof deck and parapet.
    const roofTone = color(pick(brng, ROOF_TONES[plan.style])).multiply(tint(brng, 0.05));
    roofs.top([x0 + PARAPET_T, x1 - PARAPET_T, z0 + PARAPET_T, z1 - PARAPET_T], h, roofTone, roofUv);
    const coping = color(COPING[plan.style]).multiply(tint(brng, 0.04));
    const t = PARAPET_T;
    const ringTop = h + PARAPET_H;
    plain.box([x0, x1, z0, z0 + t], h, ringTop, coping, plainUv);
    plain.box([x0, x1, z1 - t, z1], h, ringTop, coping, plainUv);
    plain.box([x0, x0 + t, z0 + t, z1 - t], h, ringTop, coping, plainUv);
    plain.box([x1 - t, x1, z0 + t, z1 - t], h, ringTop, coping, plainUv);

    let top = ringTop;
    const bulk = color(pick(brng, ['#c8c2b8', '#b3ada3', '#9c968d', '#d6d1c8'])).multiply(tint(brng, 0.04));
    if (plan.roof === 'penthouse' && w > 12 && d > 12) {
      const fx = range(brng, 0.42, 0.62);
      const fz = range(brng, 0.42, 0.62);
      const cx = x0 + w * range(brng, 0.38, 0.62);
      const cz = z0 + d * range(brng, 0.38, 0.62);
      const pr: Rect = [cx - (w * fx) / 2, cx + (w * fx) / 2, cz - (d * fz) / 2, cz + (d * fz) / 2];
      const ph = range(brng, 3.2, 5.5);
      plain.box(pr, h, h + ph, (face) => (face === 'top' ? roofTone : bulk), plainUv);
      top = Math.max(top, h + ph);
    } else if (plan.roof === 'court') {
      const ix = w * 0.24;
      const iz = d * 0.24;
      const ir: Rect = [x0 + ix, x1 - ix, z0 + iz, z1 - iz];
      plain.box(ir, h, h + 2.6, (face) => (face === 'top' ? roofTone.clone().multiplyScalar(0.8) : bulk), plainUv);
      plain.box([ir[0], ir[1], ir[2], ir[2] + 0.35], h + 2.6, h + 3.3, coping, plainUv);
      plain.box([ir[0], ir[1], ir[3] - 0.35, ir[3]], h + 2.6, h + 3.3, coping, plainUv);
      top = Math.max(top, h + 3.3);
    }

    // Rooftop clutter: stair bulkhead, AC units, vents, sometimes a water tank.
    const detailed = inDetail((x0 + x1) / 2, (z0 + z1) / 2);
    if (detailed) {
      const margin = 1.6;
      const inner: Rect = [x0 + margin, x1 - margin, z0 + margin, z1 - margin];
      const iw = inner[1] - inner[0];
      const idp = inner[3] - inner[2];
      if (iw > 3 && idp > 3) {
        const at = () => [inner[0] + brng() * iw, inner[2] + brng() * idp] as const;
        if (plan.roof !== 'penthouse') {
          const [bx, bz] = at();
          addClutter(bx, h, bz, range(brng, 3, 4.6), range(brng, 2.6, 3.6), range(brng, 3, 4.2), bulk);
          top = Math.max(top, h + 3.6);
        }
        const units = Math.min(22, Math.round((iw * idp) / range(brng, 26, 48)));
        const metal = color(pick(brng, ['#cfd0cf', '#b9bab9', '#a5a6a5', '#dcdad5']));
        for (let k = 0; k < units; k += 1) {
          const [ax, az] = at();
          const big = brng() < 0.3;
          addClutter(
            ax,
            h,
            az,
            big ? range(brng, 2.2, 3.4) : range(brng, 0.9, 1.6),
            big ? range(brng, 1.2, 1.8) : range(brng, 0.6, 1.1),
            big ? range(brng, 1.6, 2.4) : range(brng, 0.9, 1.4),
            metal.clone().multiply(tint(brng, 0.06)),
            brng() < 0.5 ? 0 : Math.PI / 2,
          );
        }
        // Duct run.
        if (brng() < 0.45) {
          const [dx, dz] = at();
          const along = brng() < 0.5;
          addClutter(dx, h, dz, along ? range(brng, 4, 9) : 0.7, 0.6, along ? 0.7 : range(brng, 4, 9), metal.clone());
        }
        if (brng() < 0.18 && iw > 8 && idp > 8) {
          const [tx, tz] = at();
          const r = range(brng, 1.4, 2.0);
          dummy.position.set(tx, h + 1.4, tz);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(r, range(brng, 2.6, 3.4), r);
          dummy.updateMatrix();
          tanks.push(dummy.matrix.clone());
          top = Math.max(top, h + 5.5);
        }
      }
    }

    const info: BuildingInfo = {
      id: plan.id,
      rect: plan.rect,
      height: h,
      top,
      box: new THREE.Box3(new THREE.Vector3(x0, 0, z0), new THREE.Vector3(x1, top, z1)),
      core: plan.core,
    };
    buildings.push(info);
  }

  const facadeMaterials: THREE.MeshStandardMaterial[] = [];
  facadeBuilders.forEach((builder, style) => {
    const material = assets
      ? standard({ vertexColors: true }, photoFacadeMaps(style, assets))
      : standard({ map: keep(facadeTexture(style)), vertexColors: true, roughness: 0.88 }, null);
    facadeMaterials.push(material);
    const mesh = new THREE.Mesh(keep(builder.build()), material);
    mesh.name = `facade-${style}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });

  const storefrontMesh = new THREE.Mesh(
    keep(storefronts.build()),
    assets
      ? standard({ vertexColors: true }, photoStorefrontMaps(assets))
      : standard({ map: keep(storefrontTexture()), vertexColors: true, roughness: 0.82 }, null),
  );
  storefrontMesh.castShadow = true;
  storefrontMesh.receiveShadow = true;
  group.add(storefrontMesh);

  const roofMaterial = surfaces
    ? standard({ vertexColors: true }, surfaces.roof)
    : standard({ map: keep(roofTexture()), vertexColors: true, roughness: 0.95 }, null);
  if (surfaces) antiTile(roofMaterial, 1.1);
  const roofMesh = new THREE.Mesh(keep(roofs.build()), roofMaterial);
  roofMesh.receiveShadow = true;
  group.add(roofMesh);

  const plainMaterial = standard({ vertexColors: true, roughness: 0.9 }, null);
  if (assets && surfaces) {
    plainMaterial.map = keep(imageTexture(assets.concrete));
    plainMaterial.normalMap = surfaces.roof.normalMap;
    plainMaterial.aoMap = surfaces.roof.arm;
    antiTile(plainMaterial, 0.9);
  }
  const plainMesh = new THREE.Mesh(keep(plain.build()), plainMaterial);
  plainMesh.castShadow = true;
  plainMesh.receiveShadow = true;
  group.add(plainMesh);

  const unitBox = keep(new THREE.BoxGeometry(1, 1, 1));
  const clutterMesh = new THREE.InstancedMesh(
    unitBox,
    (() => {
      const material = standard({ roughness: 0.55, metalness: 0.35 }, null);
      if (assets && surfaces) {
        material.map = keep(imageTexture(assets.concrete));
        material.normalMap = surfaces.roof.normalMap;
        material.normalScale.setScalar(0.6);
      }
      return material;
    })(),
    Math.max(1, clutter.length),
  );
  clutter.forEach(({ m, c }, i) => {
    clutterMesh.setMatrixAt(i, m);
    clutterMesh.setColorAt(i, c);
  });
  clutterMesh.count = clutter.length;
  clutterMesh.castShadow = true;
  clutterMesh.receiveShadow = true;
  clutterMesh.computeBoundingSphere();
  group.add(clutterMesh);

  const tankGeo = (() => {
    const body = new THREE.CylinderGeometry(1, 1, 1, 14, 1);
    body.translate(0, 0.5, 0);
    const cap = new THREE.ConeGeometry(1.05, 0.45, 14, 1);
    cap.translate(0, 1.22, 0);
    const legs = new THREE.CylinderGeometry(0.7, 0.75, 1.4 / 3, 6, 1);
    legs.translate(0, -0.23, 0);
    const parts = [body, cap, legs];
    const merged = new THREE.BufferGeometry();
    const positions: number[] = [];
    const normals: number[] = [];
    for (const part of parts) {
      const nonIndexed = part.toNonIndexed();
      positions.push(...(nonIndexed.getAttribute('position').array as Float32Array));
      normals.push(...(nonIndexed.getAttribute('normal').array as Float32Array));
      nonIndexed.dispose();
      part.dispose();
    }
    merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    return merged;
  })();
  keep(tankGeo);
  const tankMesh = new THREE.InstancedMesh(
    tankGeo,
    keep(new THREE.MeshStandardMaterial({ color: '#5d4c40', roughness: 0.9 })),
    Math.max(1, tanks.length),
  );
  tanks.forEach((m, i) => tankMesh.setMatrixAt(i, m));
  tankMesh.count = tanks.length;
  tankMesh.castShadow = true;
  tankMesh.computeBoundingSphere();
  group.add(tankMesh);

  // Street trees.
  const treeMatrices: THREE.Matrix4[] = [];
  const treeColors: THREE.Color[] = [];
  const trunkMatrices: THREE.Matrix4[] = [];
  const leaf = ['#6b7c44', '#7a8a50', '#5d6e3c', '#849254', '#6f8047'];
  for (const street of STREETS) {
    const spacing = street.half >= 6 ? 9 : 12;
    if (!street.crosswalks && street.half < 6) continue;
    for (const side of [-1, 1]) {
      const offset = side * (street.half + street.sidewalk * 0.55);
      for (let t = street.from + spacing / 2; t < street.to; t += spacing) {
        const tj = t + range(rng, -1.2, 1.2);
        if (rng() < 0.14 || nearCrossing(street, tj, 3)) continue;
        const [x, z] = streetPoint(street, tj, offset);
        if (!inDetail(x, z)) continue;
        const s = range(rng, 2.4, 3.3);
        dummy.position.set(x, 4.2 + s * 0.6, z);
        dummy.rotation.set(0, rng() * Math.PI, 0);
        dummy.scale.set(s, s * 0.82, s);
        dummy.updateMatrix();
        treeMatrices.push(dummy.matrix.clone());
        treeColors.push(color(pick(rng, leaf)).multiply(tint(rng, 0.08)));
        dummy.position.set(x, 2.2, z);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        trunkMatrices.push(dummy.matrix.clone());
      }
    }
  }
  const canopyGeo = keep(canopyGeometry());
  const foliage = foliageMaps(assets?.quality === 'low' ? 128 : 256);
  const canopy = new THREE.InstancedMesh(
    canopyGeo,
    standard({ roughness: 0.82, vertexColors: true, map: keep(foliage.map), normalMap: keep(foliage.normalMap) }, null),
    Math.max(1, treeMatrices.length),
  );
  treeMatrices.forEach((m, i) => {
    canopy.setMatrixAt(i, m);
    canopy.setColorAt(i, treeColors[i]);
  });
  canopy.count = treeMatrices.length;
  canopy.castShadow = true;
  canopy.receiveShadow = true;
  canopy.computeBoundingSphere();
  group.add(canopy);

  const trunkGeo = keep(new THREE.CylinderGeometry(0.16, 0.22, 4.4, 6, 1));
  const trunks = new THREE.InstancedMesh(
    trunkGeo,
    keep(new THREE.MeshStandardMaterial({ color: '#4a3b2e', roughness: 1 })),
    Math.max(1, trunkMatrices.length),
  );
  trunkMatrices.forEach((m, i) => trunks.setMatrixAt(i, m));
  trunks.count = trunkMatrices.length;
  trunks.computeBoundingSphere();
  group.add(trunks);

  // Parked cars.
  const carGeo = keep(carGeometry());
  // Metallic base under a clear coat, like automotive paint; the dark glass and trim get the coat too.
  const carMaterial = keep(
    new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.38,
      metalness: 0.45,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
    }),
  );
  const parked: { m: THREE.Matrix4; c: THREE.Color }[] = [];
  for (const street of STREETS.filter((s) => s.parking)) {
    for (const side of [-1, 1]) {
      const offset = side * (street.half - LANE_PARKING);
      // Right-hand traffic: which way a car parked on this side faces.
      const dir = street.axis === 'x' ? (side > 0 ? 1 : -1) : side > 0 ? -1 : 1;
      const yaw = street.axis === 'x' ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      let t = street.from + range(rng, 0, 4);
      while (t < street.to) {
        const len = 4.4 + range(rng, 1.0, 2.4);
        if (!nearCrossing(street, t, 7) && rng() > 0.28) {
          const [x, z] = streetPoint(street, t, offset);
          if (inDetail(x, z)) {
            dummy.position.set(x, 0, z);
            dummy.rotation.set(0, yaw + range(rng, -0.03, 0.03), 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            parked.push({ m: dummy.matrix.clone(), c: color(weighted(rng, CAR_COLORS)) });
          }
        }
        t += len;
      }
    }
  }
  const parkedMesh = new THREE.InstancedMesh(carGeo, carMaterial, Math.max(1, parked.length));
  parked.forEach(({ m, c }, i) => {
    parkedMesh.setMatrixAt(i, m);
    parkedMesh.setColorAt(i, c);
  });
  parkedMesh.count = parked.length;
  parkedMesh.receiveShadow = true;
  parkedMesh.computeBoundingSphere();
  group.add(parkedMesh);

  group.traverse((obj) => {
    obj.matrixAutoUpdate = false;
    obj.updateMatrix();
  });

  return {
    group,
    buildings,
    byId: new Map(buildings.map((b) => [b.id, b])),
    carGeometry: carGeo,
    carMaterial,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
      clutterMesh.dispose();
      tankMesh.dispose();
      canopy.dispose();
      trunks.dispose();
      parkedMesh.dispose();
    },
  };
}

export function randomCarColor(rng: Rng) {
  return color(weighted(rng, CAR_COLORS));
}
