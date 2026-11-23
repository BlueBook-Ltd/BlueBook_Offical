/*
 * Swarm rebuild — a small, dependency-free homage to "Swarm Rebuild"
 * (github.com/DhvanilPatel/swarm-cursors, itself adapted from Joel Califa's
 * Swarm). That project is a Chrome extension: it screenshots the live tab and
 * reassembles it with flocks of cursors. It cannot be imported as a library,
 * so this toy rebuilds the *page it is attached to* instead: every
 * [data-swarm] block starts blank, a flock of cursors flies in, traces its
 * box, and the real DOM fades in behind the trace.
 */
(() => {
  const canvas = document.querySelector('.swarm');
  const hud = document.querySelector('.swarm-hud');
  const targets = [...document.querySelectorAll('[data-swarm]')];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (!canvas || !targets.length) return;

  const ctx = canvas.getContext('2d');
  const body = document.body;

  const AGENTS = 9;
  const PAD = 6;
  const ACCENT = '#005bc1';

  let runToken = 0;
  let width = 0;
  let height = 0;

  /* ── canvas plumbing ─────────────────────────────────────────────────── */

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function clear() {
    ctx.clearRect(0, 0, width, height);
  }

  /* ── geometry ────────────────────────────────────────────────────────── */

  function padRect(rect, padding) {
    return {
      x: rect.left - padding,
      y: rect.top - padding,
      w: rect.width + padding * 2,
      h: rect.height + padding * 2,
    };
  }

  /** Point at `distance` along the rectangle perimeter, plus its heading. */
  function pointAt(rect, distance) {
    const { x, y, w, h } = rect;
    const perimeter = 2 * (w + h);
    let d = ((distance % perimeter) + perimeter) % perimeter;

    if (d <= w) return { x: x + d, y, angle: 0 };
    d -= w;
    if (d <= h) return { x: x + w, y: y + d, angle: Math.PI / 2 };
    d -= h;
    if (d <= w) return { x: x + w - d, y: y + h, angle: Math.PI };
    d -= w;
    return { x, y: y + h - d, angle: -Math.PI / 2 };
  }

  function tracePerimeter(rect, distance) {
    const steps = Math.max(2, Math.ceil(distance / 6));
    ctx.beginPath();
    for (let i = 0; i <= steps; i += 1) {
      const p = pointAt(rect, (distance * i) / steps);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
  }

  /* ── drawing ─────────────────────────────────────────────────────────── */

  function drawCursor(x, y, angle, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 17);
    ctx.lineTo(4.4, 13.1);
    ctx.lineTo(7, 18.9);
    ctx.lineTo(9.9, 17.6);
    ctx.lineTo(7.3, 12);
    ctx.lineTo(12.8, 11.6);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.stroke();
    ctx.restore();
  }

  function drawFrame(rect, progress, fade) {
    const distance = (2 * (rect.w + rect.h)) * progress;

    tracePerimeter(rect, distance);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.85 * fade})`;
    ctx.stroke();

    // Faint accent copy, so the trace reads as a design tool, not a loading bar.
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(0, 91, 193, ${0.16 * fade})`;
    ctx.stroke();

    for (let i = 0; i < AGENTS; i += 1) {
      const lag = i * 22;
      if (distance - lag < 0) continue;
      const p = pointAt(rect, distance - lag);
      drawCursor(p.x, p.y, p.angle, i === 0 ? 1 : 0.72 + (i % 3) * 0.08);
    }

    if (progress > 0.55) {
      const label = `${Math.round(rect.w)} × ${Math.round(rect.h)}`;
      ctx.font = '500 11px Inter, Arial, sans-serif';
      ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * fade})`;
      ctx.fillText(label, rect.x + 8, rect.y - 8);
    }
  }

  /* ── timing ──────────────────────────────────────────────────────────── */

  const frame = () => new Promise((r) => requestAnimationFrame(r));

  async function animate(duration, onTick, token) {
    const start = performance.now();
    for (;;) {
      if (token !== runToken) return false;
      const t = Math.min(1, (performance.now() - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      onTick(eased);
      if (t >= 1) return true;
      await frame();
    }
  }

  function settleScroll() {
    return new Promise((resolve) => {
      let last = window.scrollY;
      let stable = 0;
      const tick = () => {
        if (window.scrollY === last) stable += 1;
        else {
          stable = 0;
          last = window.scrollY;
        }
        if (stable > 5) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      setTimeout(resolve, 1400);
    });
  }

  async function focusTarget(el, token) {
    const rect = el.getBoundingClientRect();
    const top = window.scrollY + rect.top - Math.max(24, (window.innerHeight - rect.height) / 2);
    if (Math.abs(top - window.scrollY) < 8) return true;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    await settleScroll();
    return token === runToken;
  }

  /* ── the build ───────────────────────────────────────────────────────── */

  async function buildTarget(el, token) {
    if (!(await focusTarget(el, token))) return false;

    const rect = padRect(el.getBoundingClientRect(), PAD);
    if (rect.w < 4 || rect.h < 4) {
      el.classList.add('is-built');
      return true;
    }

    const duration = 560 + Math.min(rect.w, 1000) * 0.32;

    if (!(await animate(duration, (p) => drawFrame(rect, p, 1), token))) return false;

    el.classList.add('is-built');

    // The trace lingers for a beat while the real block fades up behind it.
    if (!(await animate(320, (p) => drawFrame(rect, 1, 1 - p), token))) return false;

    clear();
    return true;
  }

  async function start() {
    runToken += 1;
    const token = runToken;

    body.classList.add('swarm-on');
    hud?.classList.add('is-running');
    targets.forEach((el) => el.classList.remove('is-built'));
    resize();

    for (const el of targets) {
      if (!(await buildTarget(el, token))) return;
    }

    if (token !== runToken) return;
    clear();
    body.classList.remove('swarm-on');
    targets.forEach((el) => el.classList.add('is-built'));
    hud?.classList.remove('is-running');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function skip() {
    runToken += 1;
    clear();
    body.classList.remove('swarm-on');
    targets.forEach((el) => el.classList.add('is-built'));
    hud?.classList.remove('is-running');
  }

  /* ── wiring ──────────────────────────────────────────────────────────── */

  resize();
  window.addEventListener('resize', resize);

  if (reduced || !finePointer) {
    targets.forEach((el) => el.classList.add('is-built'));
    canvas.remove();
    hud?.remove();
  } else {
    hud?.querySelector('[data-swarm-replay]')?.addEventListener('click', start);
    hud?.querySelector('[data-swarm-skip]')?.addEventListener('click', skip);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') skip();
    });
    start();
  }
})();
