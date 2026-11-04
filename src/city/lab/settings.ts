import { cityWithinRadius } from '@/city/engine/buildCity';
import { VIDEO_CAMERA } from '@/city/layout';

export type LabSettings = {
  buildings: number;
  yaw: number;
  pitch: number;
  distance: number;
  fov: number;
  targetX: number;
  targetZ: number;
  fogRange: number;
  fogDensity: number;
  /** sRGB hex, including the leading #. */
  fogColor: string;
};

export type CityMeasure = {
  count: number;
  width: number;
  depth: number;
  centerX: number;
  centerZ: number;
  radius: number;
};

export const LAB_LIMITS = {
  yaw: [-180, 540] as const,
  pitch: [18, 88] as const,
  distance: [40, 1200] as const,
  fov: [18, 70] as const,
  target: [-240, 260] as const,
  fogRange: [30, 520] as const,
  fogDensity: [0, 1] as const,
};

const CORE = cityWithinRadius(0.7);

/**
 * Final view, locked 31 Oct 2026. The still without the editor is
 * `public/assets/bluebook/city/final-view.jpg`, for regenerating the video.
 * 還原 returns to this set.
 */
export const SAVED_LOOK: LabSettings = {
  buildings: 182,
  yaw: 39.5,
  pitch: 40,
  distance: 773,
  fov: 30,
  targetX: 69,
  targetZ: -31,
  fogRange: 147,
  fogDensity: 1,
  fogColor: '#ffffff',
};

export const SAVED_CITY = CORE;

export function defaultLabSettings(buildingTotal: number): LabSettings {
  return { ...SAVED_LOOK, buildings: Math.min(buildingTotal, SAVED_LOOK.buildings) };
}

/** Lab settings that reproduce the last frame of Video End. Fog stays off so the cut can match. */
export function videoPoseSettings(aspect: number, base: LabSettings): LabSettings {
  const yaw = (VIDEO_CAMERA.yaw * Math.PI) / 180;
  const pitch = (VIDEO_CAMERA.pitch * Math.PI) / 180;
  const forwardX = -Math.sin(yaw) * Math.cos(pitch);
  const forwardY = Math.sin(pitch);
  const forwardZ = -Math.cos(yaw) * Math.cos(pitch);
  const [px, py, pz] = VIDEO_CAMERA.position;
  const reach = -py / forwardY;
  const targetX = px + forwardX * reach;
  const targetZ = pz + forwardZ * reach;
  const offsetX = px - targetX;
  const offsetZ = pz - targetZ;
  const distance = Math.hypot(offsetX, py, offsetZ);
  const labPitch = (Math.asin(py / distance) * 180) / Math.PI;
  const labYaw = (Math.atan2(offsetX, offsetZ) * 180) / Math.PI;
  const vertical = (VIDEO_CAMERA.vfov * Math.PI) / 180;
  const fov =
    aspect <= VIDEO_CAMERA.aspect
      ? VIDEO_CAMERA.vfov
      : (2 * Math.atan((Math.tan(vertical / 2) * VIDEO_CAMERA.aspect) / aspect) * 180) / Math.PI;
  return {
    ...base,
    yaw: labYaw,
    pitch: labPitch,
    distance,
    fov,
    targetX,
    targetZ,
    fogRange: SAVED_LOOK.fogRange,
    fogDensity: 0,
    fogColor: SAVED_LOOK.fogColor,
  };
}

export function normalizeFogColor(value: string) {
  const trimmed = value.trim();
  if (!/^#?[0-9a-fA-F]{6}$/.test(trimmed)) return null;
  return (trimmed.startsWith('#') ? trimmed : `#${trimmed}`).toLowerCase();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function readLabSettings(total: number): LabSettings {
  const base = defaultLabSettings(total);
  const q = new URLSearchParams(window.location.search);
  const num = (key: string, fallback: number, min: number, max: number) => {
    if (!q.has(key)) return fallback;
    const value = Number(q.get(key));
    return Number.isFinite(value) ? clamp(value, min, max) : fallback;
  };
  return {
    buildings: Math.round(num('buildings', base.buildings, 1, total)),
    yaw: num('yaw', base.yaw, LAB_LIMITS.yaw[0], LAB_LIMITS.yaw[1]),
    pitch: num('pitch', base.pitch, LAB_LIMITS.pitch[0], LAB_LIMITS.pitch[1]),
    distance: num('distance', base.distance, LAB_LIMITS.distance[0], LAB_LIMITS.distance[1]),
    fov: num('fov', base.fov, LAB_LIMITS.fov[0], LAB_LIMITS.fov[1]),
    targetX: num('tx', base.targetX, LAB_LIMITS.target[0], LAB_LIMITS.target[1]),
    targetZ: num('tz', base.targetZ, LAB_LIMITS.target[0], LAB_LIMITS.target[1]),
    fogRange: num('fog', base.fogRange, LAB_LIMITS.fogRange[0], LAB_LIMITS.fogRange[1]),
    fogDensity: num('density', base.fogDensity, LAB_LIMITS.fogDensity[0], LAB_LIMITS.fogDensity[1]),
    fogColor: normalizeFogColor(q.get('fogc') ?? '') ?? base.fogColor,
  };
}

export function writeLabSettings(settings: LabSettings) {
  const q = new URLSearchParams({
    buildings: String(Math.round(settings.buildings)),
    yaw: settings.yaw.toFixed(1),
    pitch: settings.pitch.toFixed(1),
    distance: settings.distance.toFixed(1),
    fov: settings.fov.toFixed(1),
    tx: settings.targetX.toFixed(1),
    tz: settings.targetZ.toFixed(1),
    fog: settings.fogRange.toFixed(1),
    density: settings.fogDensity.toFixed(2),
    fogc: settings.fogColor.replace('#', ''),
  });
  const next = `${window.location.pathname}?${q}`;
  if (`${window.location.pathname}${window.location.search}` !== next) window.history.replaceState(null, '', next);
}

/** Pull the camera back until the current city fits, and aim it at the middle. */
export function frameCity(settings: LabSettings, measure: CityMeasure): LabSettings {
  const pitch = Math.max(settings.pitch, 48);
  const distance = measure.radius / Math.tan((settings.fov * Math.PI) / 360) / Math.sin((pitch * Math.PI) / 180);
  return {
    ...settings,
    pitch,
    targetX: measure.centerX,
    targetZ: measure.centerZ,
    distance: clamp(distance * 0.92, LAB_LIMITS.distance[0], LAB_LIMITS.distance[1]),
  };
}
