/**
 * ponytail: assert spring physics presets stay in a usable range.
 * Run: node scripts/check-spring-physics.mjs
 */
import assert from 'node:assert/strict';

const springScroll = { mass: 1.15, tension: 48, friction: 26 };
const springReveal = { mass: 1, tension: 170, friction: 22 };
const springParallax = { mass: 1.4, tension: 40, friction: 28 };

for (const [name, cfg] of Object.entries({ springScroll, springReveal, springParallax })) {
  assert.ok(cfg.mass >= 0.5 && cfg.mass <= 3, `${name}.mass out of range`);
  assert.ok(cfg.tension >= 20 && cfg.tension <= 400, `${name}.tension out of range`);
  assert.ok(cfg.friction >= 10 && cfg.friction <= 80, `${name}.friction out of range`);
  // Underdamped-ish feel: tension should exceed friction for bounce without chaos
  assert.ok(cfg.tension > cfg.friction * 0.8, `${name} too overdamped for scroll physics`);
}

console.log('ok: spring physics presets');
