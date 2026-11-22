import { color, font } from '../design/tokens';

/**
 * Sakuga effects: one canvas over the whole app that draws impact bursts,
 * slashes, smoke, splashes, sparkles, speed lines and manga sound-effect
 * lettering, plus screen shake and impact flashes. Everything is drawn in
 * code (no images) and switches off with reduced motion.
 *
 * Only `transform`-style work happens per frame, and the loop sleeps when
 * nothing is on screen.
 */

type Kind = 'ray' | 'shard' | 'puff' | 'drop' | 'slash' | 'star' | 'text' | 'speed' | 'ring';

interface P {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // seconds left
  max: number; // total seconds
  size: number;
  angle: number;
  spin: number;
  color: string;
  // slash / ray
  x2?: number;
  y2?: number;
  // text
  text?: string;
  stroke?: string;
}

export type BurstKind = 'impact' | 'slash' | 'smoke' | 'splash' | 'sparkle';

export interface BurstOptions {
  color?: string;
  /** Scale of the effect, 1 = a button tap. */
  size?: number;
  /** Manga sound-effect lettering to pop with the burst. */
  text?: string;
  textColor?: string;
}

const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

class Fx {
  enabled = true;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private flashEl: HTMLElement | null = null;
  private shakeEl: HTMLElement | null = null;
  private ps: P[] = [];
  private raf = 0;
  private last = 0;
  private dpr = 1;

  attach(canvas: HTMLCanvasElement, flashEl: HTMLElement, shakeEl: HTMLElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.flashEl = flashEl;
    this.shakeEl = shakeEl;
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  detach() {
    window.removeEventListener('resize', this.resize);
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.canvas = null;
    this.ctx = null;
  }

  private resize = () => {
    if (!this.canvas) return;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(window.innerWidth * this.dpr);
    this.canvas.height = Math.round(window.innerHeight * this.dpr);
  };

  private add(p: Partial<P> & Pick<P, 'kind' | 'x' | 'y' | 'max'>) {
    if (this.ps.length > 400) return;
    this.ps.push({ vx: 0, vy: 0, life: p.max, size: 10, angle: 0, spin: 0, color: color.paper.DEFAULT, ...p });
    this.start();
  }

  private start() {
    if (this.raf || !this.ctx) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  // -------------------------------------------------------------------------
  // Public effects
  // -------------------------------------------------------------------------

  burst(x: number, y: number, kind: BurstKind = 'impact', opts: BurstOptions = {}) {
    if (!this.enabled) return;
    const s = opts.size ?? 1;
    const c = opts.color ?? color.paper.DEFAULT;
    if (kind === 'impact') {
      const n = Math.round(10 + 6 * s);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rand(-0.12, 0.12);
        this.add({ kind: 'ray', x, y, angle: a, size: rand(18, 34) * s, vx: rand(260, 420) * s, max: rand(0.18, 0.28), color: i % 3 === 0 ? color.spot.DEFAULT : c });
      }
      this.add({ kind: 'ring', x, y, size: 6 * s, vx: 340 * s, max: 0.25, color: c });
      for (let i = 0; i < 6 * s; i++) {
        const a = rand(0, TAU);
        const v = rand(140, 320) * s;
        this.add({ kind: 'shard', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: rand(4, 8) * s, spin: rand(-12, 12), max: rand(0.3, 0.5), color: c });
      }
    } else if (kind === 'smoke') {
      for (let i = 0; i < 10 * s; i++) {
        const a = rand(0, TAU);
        const v = rand(30, 110) * s;
        this.add({ kind: 'puff', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, size: rand(10, 22) * s, max: rand(0.6, 1.1), color: opts.color ?? color.ink[300] });
      }
    } else if (kind === 'splash') {
      for (let i = 0; i < 14 * s; i++) {
        const a = rand(-Math.PI, 0);
        const v = rand(180, 380) * s;
        this.add({ kind: 'drop', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: rand(3, 6) * s, max: rand(0.5, 0.8), color: opts.color ?? color.crimson.DEFAULT });
      }
    } else if (kind === 'sparkle') {
      for (let i = 0; i < 8 * s; i++) {
        const a = rand(0, TAU);
        const r = rand(10, 60) * s;
        this.add({ kind: 'star', x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, size: rand(5, 12) * s, spin: rand(-3, 3), max: rand(0.4, 0.8), color: opts.color ?? color.spot.soft });
      }
    } else if (kind === 'slash') {
      const a = rand(-0.5, -0.2);
      const len = 140 * s;
      this.slash(x - Math.cos(a) * len, y - Math.sin(a) * len, x + Math.cos(a) * len, y + Math.sin(a) * len, c);
    }
    if (opts.text) this.text(x, y - 30 * s, opts.text, { color: opts.textColor ?? c, size: 34 * s });
  }

  /** A blade streak from one point to another. */
  slash(x1: number, y1: number, x2: number, y2: number, c: string = color.paper.DEFAULT) {
    if (!this.enabled) return;
    this.add({ kind: 'slash', x: x1, y: y1, x2, y2, size: 10, max: 0.42, color: c });
  }

  /** Manga sound-effect lettering, for example ドン or ズバッ. */
  text(x: number, y: number, text: string, opts: { color?: string; size?: number; angle?: number } = {}) {
    if (!this.enabled) return;
    this.add({
      kind: 'text',
      x,
      y,
      vy: -40,
      text,
      size: opts.size ?? 40,
      angle: opts.angle ?? rand(-0.25, 0.1),
      max: 0.9,
      color: opts.color ?? color.paper.DEFAULT,
      stroke: '#000000',
    });
  }

  /** Radial speed lines around a point for a moment. */
  speedLines(x = window.innerWidth / 2, y = window.innerHeight / 2, seconds = 0.6, c: string = color.paper.DEFAULT) {
    if (!this.enabled) return;
    for (let i = 0; i < 46; i++) {
      this.add({ kind: 'speed', x, y, angle: rand(0, TAU), size: rand(0.55, 0.95), max: seconds * rand(0.6, 1), color: c });
    }
  }

  /** Shake the whole screen. */
  shake(strength = 8, ms = 260) {
    if (!this.enabled || !this.shakeEl) return;
    const el = this.shakeEl;
    const start = performance.now();
    const step = (t: number) => {
      const k = 1 - (t - start) / ms;
      if (k <= 0) {
        el.style.transform = '';
        return;
      }
      el.style.transform = `translate(${rand(-1, 1) * strength * k}px, ${rand(-1, 1) * strength * k}px)`;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /** An impact frame: the screen flashes (white, or inverted ink). */
  flash(c: string = '#FFFFFF', ms = 140) {
    if (!this.enabled || !this.flashEl) return;
    const el = this.flashEl;
    el.style.transition = 'none';
    el.style.background = c;
    el.style.opacity = '0.85';
    requestAnimationFrame(() => {
      el.style.transition = `opacity ${ms}ms ease-out`;
      el.style.opacity = '0';
    });
  }

  // -------------------------------------------------------------------------
  // Loop
  // -------------------------------------------------------------------------

  private frame = (now: number) => {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) {
      this.raf = 0;
      return;
    }
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = window.innerWidth;
    const h = window.innerHeight;
    const diag = Math.hypot(w, h);
    this.ps = this.ps.filter((p) => (p.life -= dt) > 0);
    for (const p of this.ps) {
      const t = 1 - p.life / p.max; // 0 -> 1
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t * t);
      switch (p.kind) {
        case 'ray': {
          const r0 = p.vx * t * 0.6;
          const r1 = r0 + p.size * (1 - t * 0.5);
          const wdt = 5 * (1 - t);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.moveTo(r0, -wdt / 2);
          ctx.lineTo(r1, 0);
          ctx.lineTo(r0, wdt / 2);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'ring': {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 3 * (1 - t);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size + p.vx * t * 0.35, 0, TAU);
          ctx.stroke();
          break;
        }
        case 'shard': {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 600 * dt;
          p.angle += p.spin * dt;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.lineTo(p.size * 0.6, p.size);
          ctx.lineTo(-p.size * 0.6, p.size * 0.6);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'puff': {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= 0.94;
          p.vy *= 0.94;
          ctx.globalAlpha *= 0.55;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 + t * 1.6), 0, TAU);
          ctx.fill();
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 2;
          ctx.globalAlpha *= 0.6;
          ctx.stroke();
          break;
        }
        case 'drop': {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 900 * dt;
          const a = Math.atan2(p.vy, p.vx);
          ctx.translate(p.x, p.y);
          ctx.rotate(a);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size * 1.8, p.size * 0.8, 0, 0, TAU);
          ctx.fill();
          break;
        }
        case 'star': {
          p.angle += p.spin * dt;
          const k = Math.sin(t * Math.PI);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          ctx.scale(k, k);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const r = i % 2 === 0 ? p.size : p.size * 0.28;
            const a = (i / 8) * TAU;
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'slash': {
          // Draw in fast, then thin out.
          const grow = Math.min(1, t / 0.25);
          const x2 = p.x + (p.x2! - p.x) * grow;
          const y2 = p.y + (p.y2! - p.y) * grow;
          const thick = p.size * (t < 0.25 ? 1 : 1 - (t - 0.25) / 0.75);
          ctx.lineCap = 'round';
          ctx.strokeStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 18;
          ctx.lineWidth = thick * 2.4;
          ctx.globalAlpha *= 0.45;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          ctx.globalAlpha = Math.max(0, 1 - t);
          ctx.shadowBlur = 0;
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = Math.max(1, thick * 0.7);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          break;
        }
        case 'text': {
          p.y += p.vy * dt;
          const pop = t < 0.15 ? 0.4 + (t / 0.15) * 0.9 : t < 0.25 ? 1.3 - ((t - 0.15) / 0.1) * 0.3 : 1;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          ctx.scale(pop, pop);
          ctx.font = `900 ${p.size}px ${font.jp}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineJoin = 'round';
          ctx.lineWidth = p.size * 0.22;
          ctx.strokeStyle = p.stroke ?? '#000';
          ctx.strokeText(p.text!, 0, 0);
          ctx.fillStyle = p.color;
          ctx.fillText(p.text!, 0, 0);
          break;
        }
        case 'speed': {
          const len = diag * 0.18 * p.size;
          const r0 = diag * 0.32 * p.size + Math.sin(t * 20) * 8;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = 0.5 * (1 - t);
          ctx.beginPath();
          ctx.moveTo(r0, -1.5);
          ctx.lineTo(r0 + len, 0);
          ctx.lineTo(r0, 1.5);
          ctx.closePath();
          ctx.fill();
          break;
        }
      }
      ctx.restore();
    }
    if (this.ps.length > 0) this.raf = requestAnimationFrame(this.frame);
    else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.raf = 0;
    }
  };
}

export const fx = new Fx();

/** Burst at the centre of an element (for example a button that was tapped). */
export function burstAt(el: Element | null, kind: BurstKind = 'impact', opts: BurstOptions = {}) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  fx.burst(r.left + r.width / 2, r.top + r.height / 2, kind, opts);
}
