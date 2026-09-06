export const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uPixelRatio;
uniform float uSize;
uniform float uIntro;
uniform float uHoverStrength;
uniform vec3 uMouse;
uniform float uSmokeBoost;
uniform float uPageTurn;
uniform float uTurnSpeed;
uniform float uTurnPageCount;
uniform float uRepelRadius;
uniform float uRepelStrength;

attribute vec3 aRandom;
attribute vec3 aColor;
attribute float aRole;
attribute vec3 aTarget;
attribute vec3 aFlip;
attribute float aPageTurn;

varying vec3 vColor;
varying float vAlpha;
varying float vRole;

void main() {
  vColor = aColor;
  vRole = aRole;

  // Page-turn animation disabled — each sheet is posed at a different open angle in shapes.ts
  vec3 rest = aTarget;

  vec3 scattered = aRandom * 18.0;
  scattered.y *= 0.7;
  vec3 pos = mix(scattered, rest, uIntro);

  float drift = uTime * (0.06 + abs(aRandom.x) * 0.08);
  pos.x += sin(drift + aRandom.y * 6.28) * 0.01;
  pos.y += cos(drift * 0.7 + aRandom.z * 6.28) * 0.008;
  pos.z += sin(drift * 0.5 + aRandom.x * 5.0) * 0.008;

  if (aRole > 3.5 && aRole < 4.5) {
    float pulse = 0.85 + 0.15 * sin(uTime * 2.4 + aRandom.x * 8.0);
    vAlpha = (0.85 + abs(aRandom.y) * 0.15) * pulse;
  } else if (aRole > 2.5 && aRole < 3.5) {
    float life = fract(uTime * (0.12 + abs(aRandom.x) * 0.08) + abs(aRandom.y) * 0.9);
    float rise = life * (1.8 + uSmokeBoost);
    float noise = sin(uTime * 0.7 + aRandom.z * 14.0) * cos(uTime * 0.4 + aRandom.x * 10.0);
    pos.y += rise * 0.85;
    pos.x += noise * life * 0.28;
    pos.z += cos(uTime * 0.5 + aRandom.y * 9.0) * life * 0.18;
    vAlpha = (0.35 + abs(aRandom.z) * 0.45) * (1.0 - smoothstep(0.5, 1.0, life)) * smoothstep(0.0, 0.08, life);
  } else if (aRole > 1.5 && aRole < 2.5) {
    float life = fract(uTime * (0.05 + abs(aRandom.x) * 0.04) + abs(aRandom.y) * 0.7);
    pos.y += life * 1.0;
    pos.x += sin(uTime * 0.35 + aRandom.z * 8.0) * life * 0.4;
    vAlpha = (0.12 + abs(aRandom.z) * 0.28) * (1.0 - life);
  } else if ((aRole > 0.5 && aRole < 1.5) || aRole > 5.5) {
    float pulse = 0.8 + 0.2 * sin(uTime * 2.8 + aRandom.x * 16.0);
    vAlpha = (0.82 + abs(aRandom.y) * 0.18) * pulse;
    if (aRole > 6.5) vAlpha = 0.9 + 0.1 * sin(uTime * 3.0 + aRandom.x * 10.0);
  } else {
    vAlpha = 0.78 + abs(aRandom.y) * 0.22;
    if (aRole > 4.5) vAlpha *= 0.9;
  }

  // Repulsion field: push away from cursor, then settle back to rest (no chasing)
  vec3 away = pos - uMouse;
  float distanceToMouse = length(away);
  float influence = smoothstep(uRepelRadius, uRepelRadius * 0.15, distanceToMouse) * uHoverStrength;
  vec3 direction = distanceToMouse > 0.0001
    ? normalize(away)
    : normalize(vec3(aRandom.xy, aRandom.z * 0.35) + 0.001);
  // Burst outward with a little vertical kick — still relative to rest pose
  pos += direction * influence * uRepelStrength * (0.85 + abs(aRandom.z) * 0.5);
  pos.y += influence * 0.35;

  vec4 viewPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * viewPosition;

  float sizeMul = 0.55 + abs(aRandom.x) * 0.28;
  if (aRole > 3.5 && aRole < 4.5) sizeMul = 0.85 + abs(aRandom.x) * 0.35;
  else if (aRole > 2.5 && aRole < 3.5) sizeMul = 0.7 + abs(aRandom.x) * 0.55;
  else if (aRole > 1.5 && aRole < 2.5) sizeMul = 0.9 + abs(aRandom.x) * 0.85;
  else if (aRole > 0.5) sizeMul = 0.65 + abs(aRandom.x) * 0.3;

  float size = uSize * uPixelRatio * sizeMul * (100.0 / max(-viewPosition.z, 0.001));
  float maxSize = aRole > 1.5 && aRole < 2.5 ? 5.5 : aRole > 2.5 && aRole < 3.5 ? 3.8 : 3.2;
  gl_PointSize = clamp(size, 0.5, maxSize);
}
`;

export const fragmentShader = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vRole;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float distanceToCenter = length(uv);
  float alpha;

  if (vRole > 1.5 && vRole < 2.5) {
    float soft = exp(-distanceToCenter * distanceToCenter * 6.5);
    float haze = smoothstep(0.55, 0.0, distanceToCenter);
    alpha = (soft * 0.85 + haze * 0.25) * vAlpha * 0.7;
    if (alpha < 0.015) discard;
    gl_FragColor = vec4(vColor * (0.55 + soft * 0.7), alpha);
  } else {
    float core = smoothstep(0.26, 0.0, distanceToCenter);
    float halo = smoothstep(0.5, 0.1, distanceToCenter);
    alpha = (core + halo * 0.5) * vAlpha;
    if (alpha < 0.02) discard;
    float boost = vRole > 3.5 && vRole < 4.5 ? 1.25 : vRole > 2.5 && vRole < 3.5 ? 1.15 : 1.0;
    gl_FragColor = vec4(vColor * (0.95 + core * 0.9) * boost, alpha);
  }
}
`;
