/**
 * Bluebook City layout. Units are metres, Y is up, ground is y = 0.
 *
 * The grid is axis-aligned: Avenue A runs along X at z = 0, Street B runs
 * along Z at x = 0 (origin = their intersection). The diagonal look of the
 * Video End frame comes from the overview camera yaw, not from the layout.
 * Core buildings were placed by projecting them onto the last frame of
 * `Video End.mp4`; everything else is seeded filler.
 */

export type Vec3 = readonly [number, number, number];
/** [x0, x1, z0, z1] */
export type Rect = readonly [number, number, number, number];

export type FacadeStyle = 'brick' | 'tan' | 'cream' | 'stone' | 'umber' | 'grey';
export type RoofKind = 'plain' | 'penthouse' | 'court';

export type Street = {
  id: string;
  /** 'x' runs along X (constant z = at); 'z' runs along Z (constant x = at). */
  axis: 'x' | 'z';
  at: number;
  from: number;
  to: number;
  /** Curb-to-centreline distance. */
  half: number;
  sidewalk: number;
  centerLine: 'yellow' | 'none';
  /** Draw crosswalks where this street meets others (only near the camera). */
  crosswalks: boolean;
  parking: boolean;
};

export type CoreBuilding = {
  id: string;
  rect: Rect;
  height: number;
  style: FacadeStyle;
  roof: RoofKind;
};

export type Place = {
  id: string;
  label: string;
  building: string;
  /** Camera orbit around the building for the focused view (degrees / metres). */
  view: { yaw: number; pitch: number; radius: number };
};

export const CITY_BOUNDS: Rect = [-210, 240, -215, 190];

export const STREETS: Street[] = [
  { id: 'avenue-a', axis: 'x', at: 0, from: -260, to: 290, half: 7, sidewalk: 5, centerLine: 'yellow', crosswalks: true, parking: true },
  { id: 'avenue-n', axis: 'x', at: -150, from: -260, to: 290, half: 6, sidewalk: 4, centerLine: 'yellow', crosswalks: false, parking: true },
  { id: 'avenue-s', axis: 'x', at: 122, from: -260, to: 290, half: 6, sidewalk: 4, centerLine: 'yellow', crosswalks: false, parking: true },
  { id: 'street-b', axis: 'z', at: 0, from: -265, to: 240, half: 4.5, sidewalk: 3.5, centerLine: 'none', crosswalks: true, parking: true },
  { id: 'avenue-c', axis: 'z', at: 63, from: -265, to: 240, half: 7, sidewalk: 4.5, centerLine: 'yellow', crosswalks: true, parking: true },
  { id: 'street-d', axis: 'z', at: -66, from: -265, to: 0, half: 5, sidewalk: 3.5, centerLine: 'none', crosswalks: true, parking: true },
  { id: 'street-e', axis: 'z', at: 140, from: -265, to: 240, half: 6, sidewalk: 4, centerLine: 'none', crosswalks: false, parking: true },
  { id: 'street-f', axis: 'z', at: -140, from: -265, to: 240, half: 6, sidewalk: 4, centerLine: 'none', crosswalks: false, parking: true },
];

/** Building lots between streets (inside the sidewalks). */
export const BLOCKS: Rect[] = (() => {
  const northX: [number, number][] = [[-210, -150], [-130, -74.5], [-57.5, -8], [8, 51.5], [74.5, 130], [150, 240]];
  const southX: [number, number][] = [[-210, -150], [-130, -8], [8, 51.5], [74.5, 130], [150, 240]];
  const rows: { z: [number, number]; xs: [number, number][] }[] = [
    { z: [-215, -160], xs: northX },
    { z: [-140, -12], xs: northX },
    { z: [12, 112], xs: southX },
    { z: [132, 190], xs: southX },
  ];
  return rows.flatMap(({ z, xs }) => xs.map(([x0, x1]) => [x0, x1, z[0], z[1]] as const));
})();

export const CORE_BUILDINGS: CoreBuilding[] = [
  { id: 'nw1', rect: [-56, -36, -36, -12], height: 26, style: 'stone', roof: 'penthouse' },
  { id: 'nw2', rect: [-30, -10, -34, -12], height: 46, style: 'cream', roof: 'plain' },
  { id: 'nw3', rect: [-30, -10, -58, -37], height: 36, style: 'umber', roof: 'plain' },
  { id: 'nw4', rect: [-56, -34, -62, -39], height: 28, style: 'brick', roof: 'plain' },
  { id: 'ne1', rect: [9, 26, -30, -12], height: 30, style: 'stone', roof: 'penthouse' },
  { id: 'ne2', rect: [26, 34, -30, -12], height: 24, style: 'umber', roof: 'plain' },
  { id: 'ne3', rect: [35, 51, -28, -12], height: 28, style: 'cream', roof: 'plain' },
  { id: 'ne4', rect: [10, 28, -56, -33], height: 38, style: 'tan', roof: 'plain' },
  { id: 'ne5', rect: [32, 51, -52, -32], height: 30, style: 'brick', roof: 'plain' },
  { id: 'ne6', rect: [31, 51, -82, -55], height: 32, style: 'stone', roof: 'penthouse' },
  { id: 'ne7', rect: [10, 28, -80, -59], height: 30, style: 'tan', roof: 'plain' },
  { id: 'e1', rect: [75, 100, -38, -12], height: 34, style: 'brick', roof: 'court' },
  { id: 'e2', rect: [104, 127, -42, -12], height: 30, style: 'tan', roof: 'plain' },
  { id: 'e3', rect: [75, 100, -82, -44], height: 38, style: 'grey', roof: 'penthouse' },
  { id: 'e4', rect: [76, 99, -116, -88], height: 40, style: 'tan', roof: 'plain' },
  { id: 'sw1', rect: [-56, -35, 12, 38], height: 30, style: 'grey', roof: 'plain' },
  { id: 'sw2', rect: [-30, -10, 12, 34], height: 28, style: 'stone', roof: 'penthouse' },
  { id: 'sw3', rect: [-32, -10, 39, 63], height: 36, style: 'brick', roof: 'plain' },
  { id: 'sw4', rect: [-30, -12, 67, 86], height: 24, style: 'tan', roof: 'plain' },
  { id: 'sw5', rect: [-80, -60, 12, 34], height: 26, style: 'umber', roof: 'plain' },
  { id: 'se1', rect: [9, 31, 14, 34], height: 30, style: 'cream', roof: 'penthouse' },
  { id: 'se2', rect: [9, 31, 38, 57], height: 26, style: 'grey', roof: 'plain' },
  { id: 'se3', rect: [36, 51, 14, 34], height: 28, style: 'stone', roof: 'plain' },
  { id: 'se4', rect: [75, 93, 14, 34], height: 24, style: 'brick', roof: 'plain' },
];

/** Placeholder places until real content is provided. */
export const PLACES: Place[] = [
  { id: 'services', label: 'Services', building: 'ne1', view: { yaw: -24, pitch: 54, radius: 104 } },
  { id: 'practice', label: 'Practice', building: 'e1', view: { yaw: -50, pitch: 44, radius: 100 } },
  { id: 'contact', label: 'Contact', building: 'se1', view: { yaw: -120, pitch: 52, radius: 104 } },
];

/**
 * Camera that reproduces the last frame of `Video End.mp4` (1920×1080,
 * object-fit: cover). Euler order YXZ, degrees.
 */
export const VIDEO_CAMERA = {
  position: [51.9, 186.4, 33.4] as Vec3,
  yaw: 30.57,
  pitch: -74.17,
  vfov: 35,
  aspect: 16 / 9,
};

/** Low sun from the south-west, matching the warm light on south/west facades in the frame. */
export const SUN = { azimuth: 213, elevation: 27 };

/**
 * Closed traffic loops along street centrelines (corner points). Cars drive
 * on the right; each lane is used by exactly one loop so loops never collide.
 */
export const TRAFFIC_LOOPS: { id: string; corners: [number, number][]; cars: number; speed: number }[] = [
  { id: 'loop-a-east', corners: [[-66, 0], [63, 0], [63, -150], [-66, -150]], cars: 11, speed: 10 },
  { id: 'loop-a-west', corners: [[140, 0], [-140, 0], [-140, 122], [140, 122]], cars: 16, speed: 11 },
  { id: 'loop-c-south', corners: [[0, 122], [0, -150], [63, -150], [63, 122]], cars: 12, speed: 9 },
];

export const PALETTE = {
  ground: '#e2dcd4',
  sidewalk: '#cbbfae',
  lot: '#6f675d',
  curb: '#b4ab9d',
  fog: '#d9d0c3',
  veil: '#eeece7',
};
