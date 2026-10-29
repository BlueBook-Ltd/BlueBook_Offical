import * as THREE from 'three';

type V3 = readonly [number, number, number];
type UV = readonly [number, number];
export type Face = 'top' | 'bottom' | 'north' | 'south' | 'east' | 'west';

/**
 * Accumulates quads into one indexed BufferGeometry so a whole material's
 * worth of city ends up as a single draw call.
 */
export class MeshBuilder {
  private pos: number[] = [];
  private nor: number[] = [];
  private uv: number[] = [];
  private col: number[] = [];
  private idx: number[] = [];

  get empty() {
    return this.idx.length === 0;
  }

  /** Vertices in counter-clockwise order seen from the front: BL, BR, TR, TL. */
  quad(v: readonly [V3, V3, V3, V3], normal: V3, uvs: readonly [UV, UV, UV, UV], color: THREE.Color) {
    const base = this.pos.length / 3;
    for (let i = 0; i < 4; i += 1) {
      this.pos.push(v[i][0], v[i][1], v[i][2]);
      this.nor.push(normal[0], normal[1], normal[2]);
      this.uv.push(uvs[i][0], uvs[i][1]);
      this.col.push(color.r, color.g, color.b);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /**
   * Vertical wall on one side of an axis-aligned rect. `u0` shifts the
   * texture along the wall; `uScale`/`vScale` convert metres to UV.
   */
  wall(
    face: Exclude<Face, 'top' | 'bottom'>,
    rect: readonly [number, number, number, number],
    y0: number,
    y1: number,
    color: THREE.Color,
    uv: { u0?: number; uScale?: number; v0?: number; vScale?: number } = {},
  ) {
    const [x0, x1, z0, z1] = rect;
    const { u0 = 0, uScale = 1, v0 = 0, vScale = 1 } = uv;
    const len = face === 'north' || face === 'south' ? x1 - x0 : z1 - z0;
    const ua = u0 * uScale;
    const ub = (u0 + len) * uScale;
    const va = (y0 - v0) * vScale;
    const vb = (y1 - v0) * vScale;
    const uvs = [[ua, va], [ub, va], [ub, vb], [ua, vb]] as const;
    switch (face) {
      case 'south':
        this.quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], uvs, color);
        break;
      case 'north':
        this.quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], uvs, color);
        break;
      case 'east':
        this.quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], uvs, color);
        break;
      case 'west':
        this.quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], uvs, color);
        break;
    }
  }

  /** Horizontal rect facing up at height y. UVs are world metres × `uvScale`. */
  top(rect: readonly [number, number, number, number], y: number, color: THREE.Color, uvScale = 0) {
    const [x0, x1, z0, z1] = rect;
    const s = uvScale;
    this.quad(
      [[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]],
      [0, 1, 0],
      [[x0 * s, -z1 * s], [x1 * s, -z1 * s], [x1 * s, -z0 * s], [x0 * s, -z0 * s]],
      color,
    );
  }

  /** Closed box without a bottom. `faceColor` may vary per face. */
  box(
    rect: readonly [number, number, number, number],
    y0: number,
    y1: number,
    faceColor: THREE.Color | ((face: Face) => THREE.Color),
    uvScale = 0,
  ) {
    const colorOf = typeof faceColor === 'function' ? faceColor : () => faceColor;
    this.top(rect, y1, colorOf('top'), uvScale);
    const uv = { uScale: uvScale, v0: 0, vScale: uvScale };
    this.wall('south', rect, y0, y1, colorOf('south'), uv);
    this.wall('north', rect, y0, y1, colorOf('north'), uv);
    this.wall('east', rect, y0, y1, colorOf('east'), uv);
    this.wall('west', rect, y0, y1, colorOf('west'), uv);
  }

  build() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    geometry.setIndex(this.idx);
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    return geometry;
  }
}
