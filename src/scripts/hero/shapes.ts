import * as THREE from "three";

/**
 * Roles:
 * 0 page surface (blue/cyan)
 * 1 gold edge / outline
 * 2 mist
 * 3 beam / sparkle
 * 4 power icon
 * 5 turning page surface
 * 6 turning page gold edge
 * 7 center spine glow
 */
export type ShapeBuffers = {
  positions: Float32Array;
  flipPositions: Float32Array;
  colors: Float32Array;
  randoms: Float32Array;
  roles: Float32Array;
  pageTurn: Float32Array;
  count: number;
};

function hash(index: number, salt: number): number {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Presentation for elevated front view:
 * - Spine at lower-front (closest to viewer)
 * - Pages open upward / backward so insides face the camera
 * - Corrects the previous 180°-flipped / inverted-V look
 */
function present(x: number, y: number, z: number): [number, number, number] {
  // Keep transforms mild so the book stays in front of the camera.
  // pitch: elevated view · yaw: slight three-quarter
  const pitch = 0.6;
  const yaw = -0.9;

  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const y1 = y * cosP - z * sinP;
  const z1 = y * sinP + z * cosP;

  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const x2 = x * cosY + z1 * sinY;
  const z2 = -x * sinY + z1 * cosY;

  return [x2, y1, z2];
}

/**
 * One curved page sheet on a table plane.
 * u: 0 spine → 1 outer
 * v: 0 front (toward viewer) → 1 back
 * openAngle: radians from horizontal (shallow = table book, not upright wings)
 */
function pageLocal(
  side: number,
  u: number,
  v: number,
  sheet: number,
  openAngle: number,
): [number, number, number] {
  const pageW = 2.85;
  const pageD = 3.4;
  // Clear stacked thickness between the 5 sheets per side
  const sheetGap = 0.04;

  let x = side * (0.03 + u * pageW);
  let y = sheet * sheetGap;
  // Front edge toward +Z before present(); after 180° yaw it faces the camera
  let z = (v - 0.5) * pageD;

  // Soft curl: outer edge lifts; front lip slightly lower so stack reads at bottom
  const curl = Math.sin(u * Math.PI * 0.5) * (0.14 + sheet * 0.012) + u * u * 0.09;
  y += curl;
  y += (1 - v) * 0.015;
  // Upper sheets lift a touch more (open fan)
  y += sheet * 0.018;

  // Open around spine (Z): pages rise into a wide shallow V facing up
  const angle = side * openAngle;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rx = x * cos - y * sin;
  const ry = x * sin + y * cos;
  return [rx, ry, z];
}

function writePresented(out: Float32Array, offset: number, x: number, y: number, z: number) {
  const [px, py, pz] = present(x, y, z);
  out[offset] = px;
  out[offset + 1] = py;
  out[offset + 2] = pz;
}

type PageDef = {
  side: number;
  sheet: number;
};

/** 10 pages: 5 left + 5 right, each sheet fanned at a different open angle. */
const PAGES: PageDef[] = [
  { side: -1, sheet: 0 },
  { side: -1, sheet: 1 },
  { side: -1, sheet: 2 },
  { side: -1, sheet: 3 },
  { side: -1, sheet: 4 },
  { side: 1, sheet: 0 },
  { side: 1, sheet: 1 },
  { side: 1, sheet: 2 },
  { side: 1, sheet: 3 },
  { side: 1, sheet: 4 },
];

/** Kept for particleSystem uniforms; page-turn animation is disabled. */
export const TURNING_PAGE_COUNT = 0;

/** Bottom sheet flatter; upper sheets fan more upright (~0.28 → ~0.84 rad). */
function sheetOpenAngle(side: number, sheet: number): number {
  const base = 0.28;
  const step = 0.14;
  // Slight left/right asymmetry so the fan reads clearly
  const bias = side < 0 ? 0.04 : 0;
  return base + sheet * step + bias;
}

function copyRest(flip: Float32Array, rest: Float32Array, i: number) {
  const o = i * 3;
  flip[o] = rest[o];
  flip[o + 1] = rest[o + 1];
  flip[o + 2] = rest[o + 2];
}

function buildBook(
  count: number,
  roles: Float32Array,
  pageTurn: Float32Array,
  flipPositions: Float32Array,
): Float32Array {
  const output = new Float32Array(count * 3);

  // Budget: most particles go into the 10 page sheets
  const pageBudget = Math.floor(count * 0.78);
  const spineCount = Math.floor(count * 0.06);
  const beamCount = Math.floor(count * 0.08);
  const mistCount = Math.floor(count * 0.04);
  const iconCount = count - pageBudget - spineCount - beamCount - mistCount;

  const perPage = Math.floor(pageBudget / PAGES.length);
  let i = 0;

  for (let p = 0; p < PAGES.length; p++) {
    const page = PAGES[p];
    const openAngle = sheetOpenAngle(page.side, page.sheet);
    const start = i;
    const end = p === PAGES.length - 1 ? pageBudget : start + perPage;
    const pageParticles = end - start;
    // ~60% surface, ~40% gold border per sheet
    const surfaceCount = Math.floor(pageParticles * 0.6);
    const edgeCount = pageParticles - surfaceCount;

    for (let s = 0; s < surfaceCount; s++, i++) {
      const u = Math.pow(hash(i, 61 + p), 0.8);
      const v = hash(i, 62 + p);
      const [x, y, z] = pageLocal(page.side, u, v, page.sheet, openAngle);
      writePresented(output, i * 3, x, y, z);
      copyRest(flipPositions, output, i);
      roles[i] = 0;
      pageTurn[i] = 0;
    }

    for (let e = 0; e < edgeCount; e++, i++) {
      const kind = hash(i, 70 + p);
      let u: number;
      let v: number;
      if (kind < 0.4) {
        // Outer rim
        u = 0.9 + hash(i, 71) * 0.1;
        v = hash(i, 72);
      } else if (kind < 0.7) {
        // Front / back edge
        u = hash(i, 73);
        v = kind < 0.55 ? 0.02 : 0.98;
      } else {
        // Bottom stacked lip (front) — shows page thickness
        u = 0.08 + hash(i, 74) * 0.8;
        v = 0.02 + hash(i, 75) * 0.1;
      }

      const [x, y, z] = pageLocal(page.side, u, v, page.sheet, openAngle);
      writePresented(output, i * 3, x, y - 0.005, z);
      copyRest(flipPositions, output, i);
      roles[i] = 1;
      pageTurn[i] = 0;
    }
  }

  // Bright cyan-white center spine / fold
  for (let s = 0; s < spineCount; s++, i++) {
    const t = hash(i, 90);
    const along = t;
    const x = (hash(i, 91) - 0.5) * 0.12;
    const y = 0.02 + Math.sin(along * Math.PI) * 0.05 + hash(i, 92) * 0.04;
    const z = (along - 0.5) * 3.25;
    writePresented(output, i * 3, x, y, z);
    flipPositions[i * 3] = output[i * 3];
    flipPositions[i * 3 + 1] = output[i * 3 + 1];
    flipPositions[i * 3 + 2] = output[i * 3 + 2];
    roles[i] = 7;
    pageTurn[i] = 0;
  }

  for (let b = 0; b < beamCount; b++, i++) {
    const h = Math.pow(hash(i, 100), 0.72);
    const spread = (0.03 + h * h * 0.4) * (0.35 + hash(i, 101));
    const angle = hash(i, 102) * Math.PI * 2;
    writePresented(
      output,
      i * 3,
      Math.cos(angle) * spread,
      0.2 + h * 3.6,
      Math.sin(angle) * spread * 0.4,
    );
    flipPositions[i * 3] = output[i * 3];
    flipPositions[i * 3 + 1] = output[i * 3 + 1];
    flipPositions[i * 3 + 2] = output[i * 3 + 2];
    roles[i] = 3;
    pageTurn[i] = 0;
  }

  for (let m = 0; m < mistCount; m++, i++) {
    const life = hash(i, 110);
    const swirl = hash(i, 111) * Math.PI * 2;
    const radius = 0.2 + life * 1.5;
    writePresented(
      output,
      i * 3,
      Math.cos(swirl) * radius,
      0.15 + life * 3.0,
      Math.sin(swirl) * radius * 0.6,
    );
    flipPositions[i * 3] = output[i * 3];
    flipPositions[i * 3 + 1] = output[i * 3 + 1];
    flipPositions[i * 3 + 2] = output[i * 3 + 2];
    roles[i] = 2;
    pageTurn[i] = 0;
  }

  for (let p = 0; p < iconCount; p++, i++) {
    const t = hash(i, 120);
    let lx: number;
    let ly: number;
    let lz: number;
    if (t < 0.7) {
      let a = hash(i, 121) * Math.PI * 2;
      if (a > Math.PI * 0.5 - 0.38 && a < Math.PI * 0.5 + 0.38) {
        a += a < Math.PI * 0.5 ? -0.5 : 0.5;
      }
      const r = 0.36 + (hash(i, 122) - 0.5) * 0.03;
      lx = Math.cos(a) * r;
      ly = 2.4 + Math.sin(a) * r;
      lz = (hash(i, 123) - 0.5) * 0.03;
    } else {
      lx = (hash(i, 124) - 0.5) * 0.03;
      ly = 2.45 + hash(i, 125) * 0.8;
      lz = (hash(i, 126) - 0.5) * 0.02;
    }
    writePresented(output, i * 3, lx, ly, lz);
    flipPositions[i * 3] = output[i * 3];
    flipPositions[i * 3 + 1] = output[i * 3 + 1];
    flipPositions[i * 3 + 2] = output[i * 3 + 2];
    roles[i] = 4;
    pageTurn[i] = 0;
  }

  return output;
}

function buildBookColors(count: number, roles: Float32Array): Float32Array {
  const colors = new Float32Array(count * 3);
  const cyan = new THREE.Color("#4de2ff");
  const electric = new THREE.Color("#2bb8ff");
  const ice = new THREE.Color("#f2fcff");
  const gold = new THREE.Color("#f6c453");
  const amber = new THREE.Color("#ffb03a");
  const deep = new THREE.Color("#0a3d5c");
  const spine = new THREE.Color("#e8fbff");

  for (let i = 0; i < count; i++) {
    const role = roles[i];
    let color: THREE.Color;
    if (role >= 6.5) {
      color = spine.clone().lerp(cyan, hash(i, 28) * 0.35);
    } else if (role >= 5.5) {
      color = gold.clone().lerp(amber, hash(i, 29) * 0.4);
    } else if (role >= 4.5) {
      color = electric.clone().lerp(cyan, hash(i, 30) * 0.5).lerp(ice, 0.2);
    } else if (role >= 3.5) {
      color = cyan.clone().lerp(ice, hash(i, 31) * 0.65);
    } else if (role >= 2.5) {
      color = cyan.clone().lerp(spine, hash(i, 32) * 0.75);
    } else if (role >= 1.5) {
      color = electric.clone().lerp(cyan, hash(i, 33));
    } else if (role >= 0.5) {
      color =
        hash(i, 35) > 0.88
          ? spine.clone().lerp(cyan, 0.3)
          : gold.clone().lerp(amber, hash(i, 36) * 0.45).lerp(ice, 0.1);
    } else {
      color = electric
        .clone()
        .lerp(cyan, hash(i, 37) * 0.75)
        .lerp(deep, hash(i, 38) * 0.15)
        .lerp(ice, hash(i, 39) > 0.9 ? 0.3 : 0);
    }
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  return colors;
}

export function createShapeBuffers(count: number): ShapeBuffers {
  const roles = new Float32Array(count);
  const pageTurn = new Float32Array(count);
  const flipPositions = new Float32Array(count * 3);
  const positions = buildBook(count, roles, pageTurn, flipPositions);
  const randoms = new Float32Array(count * 3);
  for (let i = 0; i < randoms.length; i++) randoms[i] = hash(i, 99) * 2 - 1;

  return {
    positions,
    flipPositions,
    colors: buildBookColors(count, roles),
    randoms,
    roles,
    pageTurn,
    count,
  };
}
