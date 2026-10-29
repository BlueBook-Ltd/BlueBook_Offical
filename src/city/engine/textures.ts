import * as THREE from 'three';
import type { FacadeStyle } from '@/city/layout';
import { mulberry32, range, type Rng } from '@/city/engine/rng';
import type { CityAssets, MapSet } from '@/city/engine/assets';

/**
 * Canvas textures. Albedo carries no baked light or shadow, so the runtime
 * sun and shadows stay the single source of lighting; only ambient occlusion
 * (which affects indirect light alone) is painted into the ARM maps.
 * The procedural albedo-only set below is the fallback when photo maps fail.
 */

export const BAY_W = 3.4;
export const FLOOR_H = 3.3;
export const BASE_H = 4.6;
/** One facade tile covers 4 bays × 4 floors. */
export const FACADE_TILE: readonly [number, number] = [BAY_W * 4, FLOOR_H * 4];
export const ROOF_TILE = 8;
export const PAVING_TILE = 6;
export const ASPHALT_TILE = 10;
/** Physical sizes of the photo surfaces, metres. */
export const PHOTO_TILE = { asphalt: 24, paving: 1.8, roof: 3, concrete: 2.7, paint: 4 };

type FacadeRecipe = {
  wall: string;
  trim: string;
  glass: [string, string];
  /** Windows per bay. */
  perBay: 1 | 2;
  windowW: number;
  windowH: number;
  brick?: boolean;
};

const FACADES: Record<FacadeStyle, FacadeRecipe> = {
  brick: { wall: '#8a5440', trim: '#c9b8a2', glass: ['#1d2329', '#353d45'], perBay: 1, windowW: 0.5, windowH: 0.58, brick: true },
  tan: { wall: '#b79c7d', trim: '#e0d3bf', glass: ['#1f252b', '#3a424a'], perBay: 1, windowW: 0.46, windowH: 0.56 },
  cream: { wall: '#d9cfbd', trim: '#f1ebdf', glass: ['#232a31', '#414950'], perBay: 2, windowW: 0.3, windowH: 0.6 },
  stone: { wall: '#a8a196', trim: '#d2ccc1', glass: ['#1e2328', '#363d44'], perBay: 1, windowW: 0.52, windowH: 0.56 },
  umber: { wall: '#6a4c3b', trim: '#b49d85', glass: ['#191e23', '#2f363c'], perBay: 1, windowW: 0.48, windowH: 0.58, brick: true },
  grey: { wall: '#8d8b87', trim: '#c4c1bb', glass: ['#1c2126', '#343a41'], perBay: 2, windowW: 0.32, windowH: 0.58 },
};

function canvas(w: number, h: number) {
  const el = document.createElement('canvas');
  el.width = w;
  el.height = h;
  const ctx = el.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return { el, ctx };
}

function speckle(ctx: CanvasRenderingContext2D, rng: Rng, w: number, h: number, count: number, light: string, dark: string) {
  for (let i = 0; i < count; i += 1) {
    ctx.fillStyle = rng() < 0.5 ? light : dark;
    ctx.globalAlpha = range(rng, 0.03, 0.09);
    const s = range(rng, 1, 3);
    ctx.fillRect(rng() * w, rng() * h, s, s);
  }
  ctx.globalAlpha = 1;
}

function toTexture(el: HTMLCanvasElement | HTMLImageElement, srgb = true) {
  const tex = el instanceof HTMLCanvasElement ? new THREE.CanvasTexture(el) : new THREE.Texture(el);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

export type PbrMaps = { map: THREE.Texture; normalMap: THREE.Texture; arm: THREE.Texture };

/** Photo map set used as-is (tiling is set by the geometry's UVs). */
export function surfaceMaps(set: MapSet): PbrMaps {
  return { map: toTexture(set.diff), normalMap: toTexture(set.nor, false), arm: toTexture(set.arm, false) };
}

export function imageTexture(img: HTMLImageElement, srgb = true) {
  return toTexture(img, srgb);
}

/**
 * Overlapping leaf clumps: albedo darkens into the gaps between clumps, and
 * the normal map is derived from the same height field so each clump catches
 * the sun on one side.
 */
export function foliageMaps(size = 256) {
  const rng = mulberry32(99);
  const height = canvas(size, size);
  const albedo = canvas(size, size);
  height.ctx.fillStyle = '#000';
  height.ctx.fillRect(0, 0, size, size);
  albedo.ctx.fillStyle = '#3a3a3a';
  albedo.ctx.fillRect(0, 0, size, size);
  const blob = (x: number, y: number, r: number, tone: number) => {
    // Draw wrapped copies so the map tiles.
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const cx = x + ox;
        const cy = y + oy;
        if (cx < -r || cx > size + r || cy < -r || cy > size + r) continue;
        const h = height.ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.25, 0, cx, cy, r);
        h.addColorStop(0, '#fff');
        h.addColorStop(0.7, '#9a9a9a');
        h.addColorStop(1, 'rgba(60,60,60,0)');
        height.ctx.fillStyle = h;
        height.ctx.beginPath();
        height.ctx.arc(cx, cy, r, 0, Math.PI * 2);
        height.ctx.fill();
        const v = Math.round(tone * 255);
        const a = albedo.ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        a.addColorStop(0, `rgb(${v},${v},${Math.round(v * 0.92)})`);
        a.addColorStop(0.75, `rgb(${Math.round(v * 0.82)},${Math.round(v * 0.82)},${Math.round(v * 0.74)})`);
        a.addColorStop(1, `rgba(${Math.round(v * 0.5)},${Math.round(v * 0.5)},${Math.round(v * 0.45)},0)`);
        albedo.ctx.fillStyle = a;
        albedo.ctx.beginPath();
        albedo.ctx.arc(cx, cy, r, 0, Math.PI * 2);
        albedo.ctx.fill();
      }
    }
  };
  const count = Math.round((size * size) / 70);
  for (let i = 0; i < count; i += 1) {
    blob(rng() * size, rng() * size, range(rng, size * 0.018, size * 0.045), range(rng, 0.62, 1));
  }

  const src = height.ctx.getImageData(0, 0, size, size).data;
  const out = canvas(size, size);
  const img = out.ctx.createImageData(size, size);
  const hAt = (x: number, y: number) => src[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
  const strength = 3.2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (hAt(x + 1, y) - hAt(x - 1, y)) * strength;
      // Canvas y grows downward; the texture's +v is up.
      const dy = (hAt(x, y - 1) - hAt(x, y + 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      img.data[i] = Math.round((-dx / len) * 127 + 128);
      img.data[i + 1] = Math.round((-dy / len) * 127 + 128);
      img.data[i + 2] = Math.round((1 / len) * 127 + 128);
      img.data[i + 3] = 255;
    }
  }
  out.ctx.putImageData(img, 0, 0);
  return { map: toTexture(albedo.el), normalMap: toTexture(out.el, false) };
}

/* ------------------------------------------------------------------ */
/* Photographic facades                                                 */
/* ------------------------------------------------------------------ */

type PhotoRecipe = {
  /** Physical size of the source photo, metres. */
  size: number;
  /** Multiplied over the photo albedo. */
  tint?: string;
  trim: string;
  frame: string;
  perBay: 1 | 2;
  windowW: number;
  windowH: number;
  /** Stone lintel over brick openings vs. a flat plaster surround. */
  lintel: boolean;
  /** Horizontal band at every floor slab. */
  band: boolean;
};

const PHOTO: Record<FacadeStyle, PhotoRecipe> = {
  brick: { size: 1.4, trim: '#cfc3b0', frame: '#c9c2b6', perBay: 1, windowW: 0.46, windowH: 0.56, lintel: true, band: false },
  umber: { size: 1.0, trim: '#b9a68f', frame: '#2b2a28', perBay: 1, windowW: 0.44, windowH: 0.58, lintel: true, band: false },
  tan: { size: 2.0, tint: '#f4ece2', trim: '#e3d7c3', frame: '#cfc8bc', perBay: 1, windowW: 0.44, windowH: 0.56, lintel: true, band: true },
  cream: { size: 3.0, tint: '#fbf3e6', trim: '#efe7d8', frame: '#3a3631', perBay: 2, windowW: 0.3, windowH: 0.6, lintel: false, band: true },
  stone: { size: 2.71, tint: '#ece6e2', trim: '#d8d1c5', frame: '#5d5a55', perBay: 1, windowW: 0.5, windowH: 0.56, lintel: false, band: true },
  grey: { size: 1.0, tint: '#e2e0de', trim: '#cfccc6', frame: '#26292c', perBay: 2, windowW: 0.32, windowH: 0.58, lintel: false, band: false },
};

/** Tangent-space normals (OpenGL, +v up) for flat faces and reveal sides. */
const N = {
  flat: 'rgb(128,128,255)',
  up: 'rgb(128,212,226)',
  down: 'rgb(128,44,226)',
  left: 'rgb(44,128,226)',
  right: 'rgb(212,128,226)',
};
const arm = (ao: number, rough: number, metal = 0) =>
  `rgb(${Math.round(ao * 255)},${Math.round(rough * 255)},${Math.round(metal * 255)})`;

type Layer = 'albedo' | 'normal' | 'arm';

class Painter {
  readonly layers: Record<Layer, { el: HTMLCanvasElement; ctx: CanvasRenderingContext2D }>;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.layers = { albedo: canvas(w, h), normal: canvas(w, h), arm: canvas(w, h) };
  }

  /** Tile a photo set over the whole canvas with an integer repeat count so it wraps. */
  tile(set: MapSet, nx: number, ny: number, tint?: string) {
    const sources: Record<Layer, HTMLImageElement> = { albedo: set.diff, normal: set.nor, arm: set.arm };
    (Object.keys(this.layers) as Layer[]).forEach((layer) => {
      const { ctx } = this.layers[layer];
      const img = sources[layer];
      const pattern = ctx.createPattern(img, 'repeat');
      if (!pattern) return;
      pattern.setTransform(new DOMMatrix().scale(this.w / nx / img.width, this.h / ny / img.height));
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, this.w, this.h);
    });
    if (tint) this.blend('albedo', 'multiply', tint, 0, 0, this.w, this.h);
  }

  fill(layer: Layer, style: string | CanvasGradient, x: number, y: number, w: number, h: number, alpha = 1) {
    const { ctx } = this.layers[layer];
    ctx.globalAlpha = alpha;
    ctx.fillStyle = style;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
  }

  blend(layer: Layer, op: GlobalCompositeOperation, style: string | CanvasGradient, x: number, y: number, w: number, h: number, alpha = 1) {
    const { ctx } = this.layers[layer];
    ctx.globalCompositeOperation = op;
    this.fill(layer, style, x, y, w, h, alpha);
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Same rect on every layer. `normal` / `arm` may be omitted to keep what's underneath. */
  rect(x: number, y: number, w: number, h: number, s: { albedo?: string | CanvasGradient; normal?: string; arm?: string }) {
    if (s.albedo) this.fill('albedo', s.albedo, x, y, w, h);
    if (s.normal) this.fill('normal', s.normal, x, y, w, h);
    if (s.arm) this.fill('arm', s.arm, x, y, w, h);
  }

  /** Raised strip: lit top edge, shaded lower edge, contact shadow beneath. */
  ledge(x: number, y: number, w: number, h: number, albedo: string, rough: number) {
    const e = Math.max(1, h * 0.3);
    this.rect(x, y, w, h, { albedo, normal: N.flat, arm: arm(1, rough) });
    this.rect(x, y, w, e, { normal: N.up });
    this.rect(x, y + h - e, w, e, { normal: N.down });
    // Contact shadow under the ledge. Only the AO channel — roughness and metalness stay put.
    this.scaleChannel('arm', 0, x, y + h, w, h * 1.6, (t) => 0.55 + 0.45 * t);
  }

  /** Multiply one channel (0=R) by `factor(t)` where t is 0 at the top of the rect. */
  private scaleChannel(
    layer: Layer,
    channel: number,
    x: number,
    y: number,
    w: number,
    h: number,
    factor: (t: number) => number,
  ) {
    const ctx = this.layers[layer].ctx;
    const ix = Math.max(0, Math.floor(x));
    const iy = Math.max(0, Math.floor(y));
    const iw = Math.min(this.w - ix, Math.ceil(x + w) - ix);
    const ih = Math.min(this.h - iy, Math.ceil(y + h) - iy);
    if (iw <= 0 || ih <= 0) return;
    const img = ctx.getImageData(ix, iy, iw, ih);
    for (let row = 0; row < ih; row += 1) {
      const k = factor(row / ih);
      for (let col = 0; col < iw; col += 1) {
        const i = (row * iw + col) * 4 + channel;
        img.data[i] = Math.round(img.data[i] * k);
      }
    }
    ctx.putImageData(img, ix, iy);
  }

  textures(): PbrMaps {
    return {
      map: toTexture(this.layers.albedo.el),
      normalMap: toTexture(this.layers.normal.el, false),
      arm: toTexture(this.layers.arm.el, false),
    };
  }
}

const GLASS = ['#1e252c', '#252c33', '#2c333a', '#181d22', '#323840', '#2a2a2c'];
const CURTAIN = ['#cfc6b6', '#bdb3a2', '#e2ddd2', '#a39885', '#d8cdb9'];

/** Opening with reveals, frame, glazing bars, and a pane that varies per window. */
function paintWindow(p: Painter, rng: Rng, x: number, y: number, w: number, h: number, m: number, frame: string, transom: boolean) {
  const reveal = Math.max(2, 0.14 * m);
  const fw = Math.max(1.5, 0.07 * m);
  // Reveals: the wall returns into the opening; the head is occluded, the sill is open to the sky.
  p.rect(x, y, reveal, h, { normal: N.right, arm: arm(0.72, 0.85) });
  p.rect(x + w - reveal, y, reveal, h, { normal: N.left, arm: arm(0.72, 0.85) });
  p.rect(x, y, w, reveal, { normal: N.down, arm: arm(0.5, 0.85) });
  p.rect(x, y + h - reveal, w, reveal, { normal: N.up, arm: arm(0.92, 0.85) });

  const ix = x + reveal;
  const iy = y + reveal;
  const iw = w - reveal * 2;
  const ih = h - reveal * 2;
  p.rect(ix, iy, iw, ih, { albedo: frame, normal: N.flat, arm: arm(0.85, 0.45) });

  const gx = ix + fw;
  const gy = iy + fw;
  const gw = iw - fw * 2;
  const gh = ih - fw * 2;
  // Each pane is a slightly different plane, so reflections break up like real glazing.
  const tilt = () => `rgb(${Math.round(128 + range(rng, -7, 7))},${Math.round(128 + range(rng, -7, 7))},254)`;
  const base = GLASS[Math.floor(rng() * GLASS.length)];
  const g = p.layers.albedo.ctx.createLinearGradient(0, gy, 0, gy + gh);
  g.addColorStop(0, base);
  g.addColorStop(1, '#0d1013');
  p.rect(gx, gy, gw, gh, { albedo: g, normal: tilt(), arm: arm(1, 0.06) });

  const r = rng();
  if (r < 0.34) {
    // Blind or curtain behind the glass: matte, light, reads through the reflection.
    const drop = gh * range(rng, 0.2, 0.75);
    p.rect(gx, gy, gw, drop, { albedo: CURTAIN[Math.floor(rng() * CURTAIN.length)], arm: arm(1, 0.35) });
  } else if (r < 0.42) {
    p.fill('albedo', '#6b5642', gx, gy + gh * 0.35, gw, gh * 0.65, 0.55);
  }

  // Glazing bars.
  const bar = Math.max(1.5, fw * 0.75);
  p.rect(gx + gw / 2 - bar / 2, gy, bar, gh, { albedo: frame, normal: N.flat, arm: arm(0.9, 0.45) });
  if (transom) p.rect(gx, gy + gh * 0.3, gw, bar, { albedo: frame, normal: N.flat, arm: arm(0.9, 0.45) });
}

/** Rain-washed dirt running down from a ledge. */
function streaks(p: Painter, rng: Rng, x: number, y: number, w: number, len: number) {
  const ctx = p.layers.albedo.ctx;
  const g = ctx.createLinearGradient(0, y, 0, y + len);
  g.addColorStop(0, 'rgba(40,34,28,0.22)');
  g.addColorStop(1, 'rgba(40,34,28,0)');
  p.fill('albedo', g, x, y, w, len);
  const n = 2 + Math.floor(rng() * 4);
  for (let i = 0; i < n; i += 1) {
    const sx = x + rng() * w;
    const sw = range(rng, 1, 3.5);
    const sl = len * range(rng, 0.8, 2.2);
    const s = ctx.createLinearGradient(0, y, 0, y + sl);
    s.addColorStop(0, 'rgba(30,26,22,0.3)');
    s.addColorStop(1, 'rgba(30,26,22,0)');
    p.fill('albedo', s, sx, y, sw, sl);
  }
}

/** Upper-floor facade: 4 bays × 4 floors, matching FACADE_TILE. */
export function photoFacadeMaps(style: FacadeStyle, assets: CityAssets): PbrMaps {
  const recipe = PHOTO[style];
  const rng = mulberry32(style.length * 7919 + style.charCodeAt(0) + 3);
  const px = assets.quality === 'high' ? 192 : 128;
  const p = new Painter(px * 4, px * 4);
  const m = px / BAY_W;
  p.tile(
    assets.walls[style],
    Math.max(1, Math.round(FACADE_TILE[0] / recipe.size)),
    Math.max(1, Math.round(FACADE_TILE[1] / recipe.size)),
    recipe.tint,
  );

  for (let floor = 0; floor < 4; floor += 1) {
    const top = floor * px;
    if (recipe.band) {
      // Slab line at the bottom of each floor.
      p.ledge(0, top + px - 0.24 * m, p.w, 0.24 * m, recipe.trim, 0.75);
    }
    for (let bay = 0; bay < 4; bay += 1) {
      for (let k = 0; k < recipe.perBay; k += 1) {
        const slot = px / recipe.perBay;
        const w = Math.round(px * recipe.windowW);
        const h = Math.round(px * recipe.windowH);
        const x = Math.round(bay * px + k * slot + (slot - w) / 2);
        const y = Math.round(top + px * 0.22);
        if (recipe.lintel) {
          const lh = 0.24 * m;
          p.ledge(x - 0.12 * m, y - lh, w + 0.24 * m, lh, recipe.trim, 0.8);
        } else {
          // Shallow plaster surround.
          const s = 0.09 * m;
          p.rect(x - s, y - s, w + s * 2, h + s * 2, { albedo: recipe.trim, arm: arm(1, 0.8) });
          p.rect(x - s, y - s, w + s * 2, Math.max(1, s * 0.5), { normal: N.up });
          p.rect(x - s, y - s, Math.max(1, s * 0.5), h + s * 2, { normal: N.left });
          p.rect(x + w + s * 0.5, y - s, Math.max(1, s * 0.5), h + s * 2, { normal: N.right });
        }
        paintWindow(p, rng, x, y, w, h, m, recipe.frame, recipe.perBay === 1);
        const sh = 0.12 * m;
        const sy = y + h;
        streaks(p, rng, x - 0.05 * m, sy + sh, w + 0.1 * m, px * 0.3);
        p.ledge(x - 0.1 * m, sy, w + 0.2 * m, sh, recipe.trim, 0.7);
      }
    }
  }
  return p.textures();
}

/** Ground floor shopfronts: 4 bays wide, BASE_H tall. */
export function photoStorefrontMaps(assets: CityAssets): PbrMaps {
  const rng = mulberry32(42);
  const px = assets.quality === 'high' ? 192 : 128;
  const m = px / BAY_W;
  const p = new Painter(px * 4, Math.round(BASE_H * m));
  const H = p.h;
  p.tile(assets.walls.stone, 5, 2, '#9a928a');
  const awnings = ['#2f3b33', '#5a2b28', '#26303d', '#1f1f1f', '#6b5536', '#3b3f45'];
  const paints = ['#1d2124', '#2c2a27', '#25302b', '#3a2a24', '#e8e3d8', '#4a4e52'];
  const yOf = (metres: number) => H - metres * m;

  for (let bay = 0; bay < 4; bay += 1) {
    const x0 = bay * px;
    const pier = 0.32 * m;
    const x = x0 + pier / 2;
    const w = px - pier;
    const paint = paints[Math.floor(rng() * paints.length)];
    const metal = paint === '#e8e3d8' ? 0 : 0.5;

    // Fascia / sign band.
    const fy = yOf(4.25);
    const fh = 0.75 * m;
    p.rect(x, fy, w, fh, { albedo: paint, normal: N.flat, arm: arm(1, 0.55, metal * 0.4) });
    p.rect(x, fy, w, 2, { normal: N.up });
    p.rect(x, fy + fh - 2, w, 2, { normal: N.down });
    if (rng() < 0.7) {
      // Lettering suggestion.
      const lw = w * range(rng, 0.35, 0.6);
      p.rect(x + (w - lw) / 2, fy + fh * 0.36, lw, fh * 0.28, { albedo: rng() < 0.5 ? '#d9c9a3' : '#efece6', arm: arm(1, 0.4, 0.6) });
    }

    // Shopfront opening.
    const oy = yOf(3.5);
    const oh = 3.5 * m;
    p.rect(x, oy, w, oh, { albedo: paint, normal: N.flat, arm: arm(0.9, 0.45, metal) });
    // Stall riser.
    const riser = 0.55 * m;
    p.rect(x, H - riser, w, riser, { albedo: '#3d3934', normal: N.flat, arm: arm(0.9, 0.7) });
    p.rect(x, H - riser, w, 2, { normal: N.up });

    const f = Math.max(2, 0.08 * m);
    const gx = x + f;
    const gy = oy + f;
    const gw = w - f * 2;
    const gh = oh - riser - f * 2;
    const g = p.layers.albedo.ctx.createLinearGradient(0, gy, 0, gy + gh);
    g.addColorStop(0, '#1e2328');
    g.addColorStop(1, '#0f1215');
    p.rect(gx, gy, gw, gh, { albedo: g, normal: N.flat, arm: arm(1, 0.05) });
    if (rng() < 0.55) {
      // Warm interior seen through the glass.
      const ctx = p.layers.albedo.ctx;
      const warm = ctx.createLinearGradient(0, gy + gh * 0.35, 0, gy + gh);
      warm.addColorStop(0, 'rgba(150,112,72,0)');
      warm.addColorStop(1, 'rgba(150,112,72,0.75)');
      p.fill('albedo', warm, gx, gy, gw, gh);
    }
    // Door at one side, transom above.
    const door = rng() < 0.5 ? gx : gx + gw - 0.95 * m;
    p.rect(door, gy + gh * 0.24, f, gh * 0.76, { albedo: paint, arm: arm(0.9, 0.45, metal) });
    p.rect(door + 0.95 * m - f, gy + gh * 0.24, f, gh * 0.76, { albedo: paint, arm: arm(0.9, 0.45, metal) });
    p.rect(gx, gy + gh * 0.22, gw, f, { albedo: paint, arm: arm(0.9, 0.45, metal) });

    // Awning over some shops: canvas pitched down and out, shadowing the fascia below it.
    if (rng() < 0.45) {
      const ay = yOf(3.65);
      const ah = 0.7 * m;
      const color = awnings[Math.floor(rng() * awnings.length)];
      p.rect(x - 2, ay, w + 4, ah, { albedo: color, normal: 'rgb(128,180,236)', arm: arm(1, 0.9) });
      p.rect(x - 2, ay + ah - 3, w + 4, 3, { normal: N.down, arm: arm(0.6, 0.9) });
      if (rng() < 0.5) {
        for (let s = 0; s < w; s += 0.5 * m) p.fill('albedo', '#e9e2d4', x + s, ay, 0.25 * m, ah, 0.85);
      }
      p.blend('arm', 'multiply', 'rgb(150,255,255)', x, ay + ah, w, 0.5 * m);
    }
  }
  return p.textures();
}

export function facadeTexture(style: FacadeStyle) {
  const recipe = FACADES[style];
  const rng = mulberry32(style.length * 7919 + style.charCodeAt(0));
  const px = 128;
  const { el, ctx } = canvas(px * 4, px * 4);
  ctx.fillStyle = recipe.wall;
  ctx.fillRect(0, 0, el.width, el.height);
  if (recipe.brick) {
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = '#2a1a12';
    for (let y = 0; y < el.height; y += 4) ctx.fillRect(0, y, el.width, 1);
    ctx.globalAlpha = 1;
  }
  speckle(ctx, rng, el.width, el.height, 2400, '#ffffff', '#000000');

  for (let floor = 0; floor < 4; floor += 1) {
    const top = floor * px;
    // Sill band under each row of windows.
    ctx.fillStyle = recipe.trim;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(0, top + px * 0.86, el.width, px * 0.035);
    ctx.globalAlpha = 1;
    for (let bay = 0; bay < 4; bay += 1) {
      for (let k = 0; k < recipe.perBay; k += 1) {
        const slot = px / recipe.perBay;
        const w = px * recipe.windowW;
        const h = px * recipe.windowH;
        const x = bay * px + k * slot + (slot - w) / 2;
        const y = top + px * 0.24;
        ctx.fillStyle = recipe.trim;
        ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
        const g = ctx.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, recipe.glass[1]);
        g.addColorStop(1, recipe.glass[0]);
        ctx.fillStyle = g;
        ctx.fillRect(x, y, w, h);
        const r = rng();
        if (r < 0.16) {
          // Blind pulled half way.
          ctx.fillStyle = '#9b9183';
          ctx.fillRect(x, y, w, h * range(rng, 0.25, 0.6));
        } else if (r < 0.2) {
          ctx.fillStyle = '#c99a62';
          ctx.globalAlpha = 0.85;
          ctx.fillRect(x, y, w, h);
          ctx.globalAlpha = 1;
        }
        // Mullion.
        ctx.fillStyle = recipe.trim;
        ctx.globalAlpha = 0.7;
        ctx.fillRect(x + w / 2 - 1.5, y, 3, h);
        ctx.globalAlpha = 1;
      }
    }
  }
  return toTexture(el);
}

export function storefrontTexture() {
  const rng = mulberry32(42);
  const px = 128;
  const { el, ctx } = canvas(px * 4, Math.round((px * BASE_H) / BAY_W));
  ctx.fillStyle = '#5a524b';
  ctx.fillRect(0, 0, el.width, el.height);
  speckle(ctx, rng, el.width, el.height, 600, '#ffffff', '#000000');
  const awnings = ['#2f3b33', '#4a2b2a', '#26303d', '#1f1f1f', '#5b4a32'];
  for (let bay = 0; bay < 4; bay += 1) {
    const x = bay * px;
    ctx.fillStyle = awnings[Math.floor(rng() * awnings.length)];
    ctx.fillRect(x + 4, el.height * 0.08, px - 8, el.height * 0.16);
    ctx.fillStyle = '#c8bca9';
    ctx.fillRect(x + 6, el.height * 0.28, px - 12, el.height * 0.66);
    const g = ctx.createLinearGradient(0, el.height * 0.3, 0, el.height);
    g.addColorStop(0, '#3b434a');
    g.addColorStop(1, '#161a1e');
    ctx.fillStyle = g;
    ctx.fillRect(x + 10, el.height * 0.31, px - 20, el.height * 0.6);
    if (rng() < 0.35) {
      ctx.fillStyle = '#d7a463';
      ctx.globalAlpha = 0.5;
      ctx.fillRect(x + 10, el.height * 0.5, px - 20, el.height * 0.41);
      ctx.globalAlpha = 1;
    }
  }
  return toTexture(el);
}

export function roofTexture() {
  const rng = mulberry32(7);
  const { el, ctx } = canvas(256, 256);
  ctx.fillStyle = '#cfccc6';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 26; i += 1) {
    ctx.fillStyle = '#5d5850';
    ctx.globalAlpha = range(rng, 0.03, 0.08);
    ctx.beginPath();
    ctx.ellipse(rng() * 256, rng() * 256, range(rng, 10, 46), range(rng, 6, 30), rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#8f8a82';
  for (let x = 0; x < 256; x += 32) ctx.fillRect(x, 0, 1.5, 256);
  ctx.globalAlpha = 1;
  speckle(ctx, rng, 256, 256, 1600, '#ffffff', '#000000');
  return toTexture(el);
}

export function pavingTexture() {
  const rng = mulberry32(11);
  const { el, ctx } = canvas(256, 256);
  ctx.fillStyle = '#d6d0c6';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, rng, 256, 256, 2200, '#ffffff', '#000000');
  ctx.fillStyle = '#7d766c';
  ctx.globalAlpha = 0.35;
  const step = 256 / 4;
  for (let i = 0; i <= 4; i += 1) {
    ctx.fillRect(i * step - 1, 0, 1.5, 256);
    ctx.fillRect(0, i * step - 1, 256, 1.5);
  }
  ctx.globalAlpha = 1;
  return toTexture(el);
}

export function asphaltTexture() {
  const rng = mulberry32(5);
  const { el, ctx } = canvas(256, 256);
  ctx.fillStyle = '#6b6560';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, rng, 256, 256, 5000, '#ffffff', '#000000');
  for (let i = 0; i < 14; i += 1) {
    ctx.fillStyle = '#1c1a18';
    ctx.globalAlpha = range(rng, 0.04, 0.1);
    ctx.beginPath();
    ctx.ellipse(rng() * 256, rng() * 256, range(rng, 8, 40), range(rng, 4, 16), rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return toTexture(el);
}
