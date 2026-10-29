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

export function defaultLabSettings(buildingTotal: number): LabSettings {
  return {
    buildings: buildingTotal,
    yaw: 32,
    pitch: 63,
    distance: 460,
    fov: 32,
    targetX: 12,
    targetZ: -16,
    fogRange: 160,
    fogDensity: 1,
  };
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
