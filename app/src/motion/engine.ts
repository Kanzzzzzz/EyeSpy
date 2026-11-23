/**
 * A tiny motion-graphics toolkit: easing curves, timeline segments and
 * drawing helpers. Scenes run one requestAnimationFrame clock that drives a
 * canvas layer and DOM layers together, so everything stays in sync at 60 fps
 * without React re-rendering every frame.
 */

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
/** Progress 0..1 of `t` through the window [a, b]. */
export const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export const ease = {
  outExpo: (k: number) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k)),
  inExpo: (k: number) => (k <= 0 ? 0 : Math.pow(2, 10 * k - 10)),
  outCubic: (k: number) => 1 - Math.pow(1 - k, 3),
  inOutCubic: (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  outBack: (k: number) => {
    const c = 1.9;
    return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
  },
  /** A damped swing (pendulums, scales). */
  swing: (k: number, freq = 3, damp = 4) => Math.exp(-damp * k) * Math.cos(freq * Math.PI * 2 * k),
};

/** Seeded random so a scene looks the same every time it plays. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A tapered blade streak with a coloured glow and a white-hot core. */
export function blade(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, width: number, glow: string, k: number) {
  const x = lerp(x1, x2, k);
  const y = lerp(y1, y2, k);
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const nx = Math.cos(ang + Math.PI / 2);
  const ny = Math.sin(ang + Math.PI / 2);
  ctx.save();
  ctx.shadowColor = glow;
  ctx.shadowBlur = width * 3;
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(lerp(x1, x, 0.5) + nx * width, lerp(y1, y, 0.5) + ny * width);
  ctx.lineTo(x, y);
  ctx.lineTo(lerp(x1, x, 0.5) - nx * width, lerp(y1, y, 0.5) - ny * width);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(lerp(x1, x, 0.5) + nx * width * 0.3, lerp(y1, y, 0.5) + ny * width * 0.3);
  ctx.lineTo(x, y);
  ctx.lineTo(lerp(x1, x, 0.5) - nx * width * 0.3, lerp(y1, y, 0.5) - ny * width * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Kinetic title type: slams in from a large scale with ghost trails, then
 * settles. Drawn on canvas with the bundled display font.
 */
export function slamText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  k: number,
  fill: string,
  shadow: string,
) {
  if (k <= 0) return;
  const s = lerp(2.6, 1, ease.outExpo(k));
  const a = clamp(k * 3);
  ctx.save();
  ctx.font = `400 ${size}px Anton, Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  // Ghost trails while it's still moving.
  for (let i = 3; i >= 1 && k < 0.5; i--) {
    ctx.save();
    ctx.globalAlpha = a * 0.15 * (1 - k * 2);
    ctx.translate(x, y);
    ctx.scale(s + i * 0.18, s + i * 0.18);
    ctx.fillStyle = fill;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = a;
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineWidth = size * 0.14;
  ctx.strokeStyle = '#000';
  ctx.fillStyle = shadow;
  ctx.strokeText(text, size * 0.06, size * 0.06);
  ctx.fillText(text, size * 0.06, size * 0.06);
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = fill;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** Drive a scene: calls `frame(t)` every animation frame until `duration`, then `done`. `from` starts it part-way. */
export function runScene(duration: number, frame: (t: number) => void, done: () => void, from = 0): () => void {
  let raf = 0;
  const start = performance.now();
  const loop = (now: number) => {
    const t = from + (now - start) / 1000;
    frame(Math.min(t, duration));
    if (t >= duration) {
      done();
      return;
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
}

/** Size a canvas to the screen at device resolution and return its 2D context. */
export function fitCanvas(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; w: number; h: number } {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}
