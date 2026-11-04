import * as THREE from 'three';
import { STREETS, TRAFFIC_LOOPS, type Street } from '@/city/layout';
import { mulberry32, range } from '@/city/engine/rng';
import { randomCarColor } from '@/city/engine/buildCity';

const SAMPLE = 0.5;
const CAR_LEN = 4.4;
const MIN_GAP = 2.6;
const HEADWAY = 1.1;
const ACCEL = 2.4;
const BRAKE = 6.5;
const COMFORT = 3.2;
const LATERAL = 2.4;
const FILLET = 7;
const CYCLE = 26;
const GREEN = 11;
const ALL_RED = 2;

type Group = 'x' | 'z';
type Stop = { s: number; group: Group; node: number };

type Lane = {
  length: number;
  count: number;
  px: Float32Array;
  pz: Float32Array;
  yaw: Float32Array;
  limit: Float32Array;
  stops: Stop[];
  s: Float32Array;
  v: Float32Array;
  vmax: Float32Array;
  first: number;
};

type Node = { x0: number; x1: number; z0: number; z1: number; offset: number };

function streetAt(axis: 'x' | 'z', at: number): Street | undefined {
  return STREETS.find((s) => s.axis === axis && Math.abs(s.at - at) < 0.01);
}

function laneOffset(street: Street | undefined) {
  if (!street) return 2;
  return street.half >= 6 ? 2.6 : 1.6;
}

/** Closed loop through street corners → lane centreline with filleted corners. */
function lanePath(corners: [number, number][]) {
  const n = corners.length;
  const dirs: THREE.Vector2[] = [];
  const offs: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = corners[i];
    const b = corners[(i + 1) % n];
    const d = new THREE.Vector2(b[0] - a[0], b[1] - a[1]).normalize();
    dirs.push(d);
    const street = Math.abs(d.y) < 0.5 ? streetAt('x', a[1]) : streetAt('z', a[0]);
    offs.push(laneOffset(street));
  }
  // Right of travel is (-dz, dx) in (x, z).
  const right = (d: THREE.Vector2) => new THREE.Vector2(-d.y, d.x);
  const pts = corners.map((c, i) => {
    const prev = (i - 1 + n) % n;
    return new THREE.Vector2(c[0], c[1])
      .add(right(dirs[prev]).multiplyScalar(offs[prev]))
      .add(right(dirs[i]).multiplyScalar(offs[i]));
  });
  const path = new THREE.CurvePath<THREE.Vector3>();
  const v3 = (p: THREE.Vector2) => new THREE.Vector3(p.x, 0, p.y);
  const arcEnds = pts.map((p, i) => {
    const prev = (i - 1 + n) % n;
    const lenIn = p.distanceTo(pts[prev]);
    const lenOut = p.distanceTo(pts[(i + 1) % n]);
    const r = Math.min(FILLET, lenIn * 0.45, lenOut * 0.45);
    return {
      a: p.clone().addScaledVector(dirs[prev], -r),
      b: p.clone().addScaledVector(dirs[i], r),
      c: p,
    };
  });
  for (let i = 0; i < n; i += 1) {
    const next = arcEnds[(i + 1) % n];
    path.add(new THREE.LineCurve3(v3(arcEnds[i].b), v3(next.a)));
    path.add(new THREE.QuadraticBezierCurve3(v3(next.a), v3(next.c), v3(next.b)));
  }
  return path;
}

function intersections(): Node[] {
  const nodes: Node[] = [];
  const xs = STREETS.filter((s) => s.axis === 'x');
  const zs = STREETS.filter((s) => s.axis === 'z');
  for (const sx of xs) {
    for (const sz of zs) {
      if (sx.at < sz.from || sx.at > sz.to || sz.at < sx.from || sz.at > sx.to) continue;
      const mx = sz.half + 4.8;
      const mz = sx.half + 4.8;
      nodes.push({
        x0: sz.at - mx,
        x1: sz.at + mx,
        z0: sx.at - mz,
        z1: sx.at + mz,
        offset: (nodes.length * 7.3) % CYCLE,
      });
    }
  }
  return nodes;
}

function green(node: Node, group: Group, time: number) {
  const t = (time + node.offset) % CYCLE;
  return group === 'x' ? t < GREEN : t >= GREEN + ALL_RED && t < GREEN * 2 + ALL_RED;
}

export class Traffic {
  readonly mesh: THREE.InstancedMesh;
  private lanes: Lane[] = [];
  private nodes = intersections();
  private time: number;
  private dummy = new THREE.Object3D();

  constructor(geometry: THREE.BufferGeometry, material: THREE.Material) {
    const rng = mulberry32(915);
    this.time = rng() * CYCLE;
    let first = 0;
    for (const loop of TRAFFIC_LOOPS) {
      const path = lanePath(loop.corners);
      const length = path.getLength();
      const samples = Math.ceil(length / SAMPLE);
      const px = new Float32Array(samples);
      const pz = new Float32Array(samples);
      const yaw = new Float32Array(samples);
      const p = new THREE.Vector3();
      const t = new THREE.Vector3();
      for (let i = 0; i < samples; i += 1) {
        const u = i / samples;
        path.getPointAt(u, p);
        path.getTangentAt(u, t);
        px[i] = p.x;
        pz[i] = p.z;
        yaw[i] = Math.atan2(-t.z, t.x);
      }
      const limit = new Float32Array(samples);
      for (let i = 0; i < samples; i += 1) {
        let turn = Math.abs(yaw[(i + 1) % samples] - yaw[i]);
        if (turn > Math.PI) turn = Math.PI * 2 - turn;
        const curvature = turn / SAMPLE;
        limit[i] = curvature > 1e-4 ? Math.sqrt(LATERAL / curvature) : 99;
      }
      // Brake ahead of corners: propagate limits backwards around the loop.
      for (let pass = 0; pass < 2; pass += 1) {
        for (let i = samples - 1; i >= 0; i -= 1) {
          const ahead = limit[(i + 1) % samples];
          limit[i] = Math.min(limit[i], Math.sqrt(ahead * ahead + 2 * COMFORT * SAMPLE));
        }
      }

      const stops: Stop[] = [];
      const inside = (i: number, node: Node) =>
        px[i] >= node.x0 && px[i] <= node.x1 && pz[i] >= node.z0 && pz[i] <= node.z1;
      this.nodes.forEach((node, k) => {
        for (let i = 0; i < samples; i += 1) {
          const prev = (i - 1 + samples) % samples;
          if (inside(i, node) && !inside(prev, node)) {
            const tx = Math.cos(yaw[i]);
            const tz = -Math.sin(yaw[i]);
            stops.push({ s: i * SAMPLE, group: Math.abs(tx) > Math.abs(tz) ? 'x' : 'z', node: k });
          }
        }
      });
      stops.sort((a, b) => a.s - b.s);

      const count = loop.cars;
      const s = new Float32Array(count);
      const v = new Float32Array(count);
      const vmax = new Float32Array(count);
      const spacing = length / count;
      for (let i = 0; i < count; i += 1) {
        s[i] = (i * spacing + range(rng, -0.2, 0.2) * spacing + length) % length;
        vmax[i] = loop.speed * range(rng, 0.85, 1.12);
        v[i] = vmax[i] * 0.6;
      }
      // Keep cars ordered along the loop so each car's leader is the next index.
      const order = [...s].sort((a, b) => a - b);
      order.forEach((value, i) => (s[i] = value));
      this.lanes.push({ length: samples * SAMPLE, count, px, pz, yaw, limit, stops, s, v, vmax, first });
      first += count;
    }

    this.mesh = new THREE.InstancedMesh(geometry, material, first);
    this.mesh.name = 'traffic';
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    for (let i = 0; i < first; i += 1) this.mesh.setColorAt(i, randomCarColor(rng));
    this.update(0);
  }

  update(dt: number) {
    const step = Math.min(dt, 0.1);
    this.time += step;
    const dummy = this.dummy;
    for (const lane of this.lanes) {
      const { s, v, vmax, count, length, stops } = lane;
      for (let i = 0; i < count; i += 1) {
        const leader = (i + 1) % count;
        let gap = (s[leader] - s[i] + length) % length;
        if (count === 1) gap = length;
        gap -= CAR_LEN;
        let target = Math.min(vmax[i], Math.max(0, (gap - MIN_GAP) / HEADWAY));
        const idx = Math.floor(s[i] / SAMPLE) % lane.limit.length;
        target = Math.min(target, lane.limit[idx]);
        for (const stop of stops) {
          const ds = (stop.s - CAR_LEN / 2 - 0.6 - s[i] + length) % length;
          if (ds > 60) continue;
          if (green(this.nodes[stop.node], stop.group, this.time)) continue;
          // Already too close to stop comfortably: carry on through.
          const committed = ds < (v[i] * v[i]) / (2 * BRAKE) && v[i] > 1;
          if (committed) continue;
          target = Math.min(target, Math.sqrt(2 * COMFORT * Math.max(0, ds - 0.2)));
        }
        const dv = target - v[i];
        v[i] = Math.max(0, v[i] + Math.max(-BRAKE * step, Math.min(ACCEL * step, dv)));
      }
      for (let i = 0; i < count; i += 1) {
        s[i] = (s[i] + v[i] * step) % length;
        const f = s[i] / SAMPLE;
        const i0 = Math.floor(f) % lane.px.length;
        const i1 = (i0 + 1) % lane.px.length;
        const k = f - Math.floor(f);
        dummy.position.set(
          lane.px[i0] + (lane.px[i1] - lane.px[i0]) * k,
          0,
          lane.pz[i0] + (lane.pz[i1] - lane.pz[i0]) * k,
        );
        dummy.rotation.set(0, lane.yaw[i0], 0);
        dummy.updateMatrix();
        this.mesh.setMatrixAt(lane.first + i, dummy.matrix);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.mesh.dispose();
  }
}
