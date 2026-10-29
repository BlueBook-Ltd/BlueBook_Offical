import * as THREE from 'three';
import type { FacadeStyle } from '@/city/layout';
import { mulberry32, range, type Rng } from '@/city/engine/rng';

/**
 * Procedural canvas textures. They carry albedo only — no baked light or
 * shadow — so the runtime sun and shadows stay the single source of lighting.
 */

export const BAY_W = 3.4;
export const FLOOR_H = 3.3;
export const BASE_H = 4.6;
/** One facade tile covers 4 bays × 4 floors. */
export const FACADE_TILE: readonly [number, number] = [BAY_W * 4, FLOOR_H * 4];
export const ROOF_TILE = 8;
export const PAVING_TILE = 6;
export const ASPHALT_TILE = 10;

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

function toTexture(el: HTMLCanvasElement, srgb = true) {
  const tex = new THREE.CanvasTexture(el);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
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
