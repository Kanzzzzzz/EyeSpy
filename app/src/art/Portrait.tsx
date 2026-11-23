import { useReducedMotion } from 'motion/react';
import { memo, useEffect, useId, useMemo, useRef } from 'react';
import type { Crop, Expression, Gaze } from './faceTypes';
import { portrait, portraitAsset, type PortraitData, type PortraitEye } from './portraits';

/**
 * A lobby character drawn from its painted portrait: crops, expressions, gaze,
 * blinking, ghost and villain glow.
 *
 * Layers (inside one <svg>, in base-image pixels):
 *   #face   the brow lift is an SVG displacement map (brows.png), applied only while a brow moves
 *     base   the painted portrait
 *     whites the eye area at 2x with the irises painted out (eyes.webp)
 *     irises per eye, the painted iris (iris<i>.png) masked by the painted eye white (white<i>.png);
 *            looking around slides it, like a Live2D rig, so the art is never stretched
 *     glow   optional iris glow, under the lids
 *     eyes   per eye: eyelid skin (lid.png) clipped to the live lid line, plus lash lines
 *     lids   per eye (painted portraits): a copy of the painted face warped by lidmap<i>.png, so the real
 *            painted upper lash and lid skin slide down over the eye (and the lower lid up), Live2D-style
 *     closed per eye, the painted closed eye (closed<i>.webp), faded in as the lid shuts
 *
 * Lids, brows and gaze are animated imperatively on one shared frame loop, so a
 * blink or wink never re-renders React. Brows only move when an expression asks
 * for it: a raised brow is a game signal, so there are no idle brow flicks.
 */

const ASPECT: Record<Crop, number> = { bust: 240 / 200, face: 160 / 132, eyes: 54 / 112 };

// ---------------------------------------------------------------------------
// Targets for each expression and gaze
// ---------------------------------------------------------------------------

interface Target {
  /** Per eye: upper lid 0 open .. 1 closed, lower lid lift 0..1, happy arc 0..1. */
  up: number[];
  lo: number[];
  arc: number[];
  /** Brows, viewer's left and right: -1 lowered .. 1 raised. */
  bl: number;
  br: number;
  /** Gaze -1..1 (screen left/right, up/down). */
  gx: number;
  gy: number;
}

function targetFor(p: PortraitData, expression: Expression, gaze: Gaze): Target {
  const n = p.eyes.length;
  const up = Array<number>(n).fill(0);
  const lo = Array<number>(n).fill(0);
  const arc = Array<number>(n).fill(0);
  let bl = 0;
  let br = 0;
  const winkLeft = eyeX(p.eyes[p.wink]!) < p.size[0] / 2;
  switch (expression) {
    case 'wink':
      if (p.winked) {
        // her other eye is already painted in a wink: a playful squint and a raised brow
        up.fill(0.3);
        lo.fill(0.14);
        bl = 0.2;
        br = 0.8;
        break;
      }
      for (let i = 0; i < n; i++) {
        up[i] = i === p.wink ? 1 : 0.12;
        lo[i] = i === p.wink ? 0 : 0.12;
      }
      bl = winkLeft ? -0.25 : 0.3;
      br = winkLeft ? 0.3 : -0.25;
      break;
    case 'raise':
      // the classic one-brow raise: right brow up, the other eye narrows so it reads even
      // on characters whose brows sit close to their lashes
      for (let i = 0; i < n; i++) {
        if (eyeX(p.eyes[i]!) < p.size[0] / 2) {
          up[i] = 0.32;
          lo[i] = 0.16;
        }
      }
      bl = -0.3;
      br = 1;
      break;
    case 'happy':
      up.fill(1);
      // with painted closed eyes the gentle closed lids read as happy; the drawn arc is the fallback
      if (!p.eyes.some((e) => e.closed)) arc.fill(1);
      bl = br = 0.35;
      break;
    case 'shock':
      bl = br = 1;
      break;
    case 'dead':
    case 'closed':
      up.fill(1);
      bl = br = expression === 'dead' ? -0.25 : 0;
      break;
    case 'angry':
      up.fill(0.28);
      lo.fill(0.18);
      bl = br = -0.85;
      break;
    case 'sly':
      up.fill(0.38);
      lo.fill(0.16);
      bl = -0.2;
      br = 0.45;
      break;
    default:
      break;
  }
  const [gx, gy] = gaze === 'left' ? [-1, 0] : gaze === 'right' ? [1, 0] : gaze === 'down' ? [0, 1] : gaze === 'up' ? [0, -1] : [0, 0];
  // looking down drops the upper lids a little
  if (gy > 0 && !p.eyes.some((e) => e.away)) for (let i = 0; i < n; i++) if (up[i]! < 0.22) up[i] = 0.22;
  return { up, lo, arc, bl, br, gx, gy };
}

const eyeX = (e: PortraitEye) => (e.I[0] + e.O[0]) / 2;

// ---------------------------------------------------------------------------
// Lid geometry: quadratic curves from the inner to the outer corner
// ---------------------------------------------------------------------------

const fmt = (n: number) => Math.round(n * 10) / 10;

function lidPaths(e: PortraitEye, up: number, lo: number, arc: number) {
  const [ix, iy] = e.I;
  const [ox, oy] = e.O;
  const mx = (ix + ox) / 2;
  const my = (iy + oy) / 2;
  const len = Math.hypot(ox - ix, oy - iy);
  const dx = (ox - ix) / len;
  const dy = (oy - iy) / len;
  const c = (apex: number) => fmt(2 * apex - my); // control y for a curve whose midpoint sits at `apex`
  const i2 = [fmt(ix - dx * 3), fmt(iy - dy * 3)];
  const o2 = [fmt(ox + dx * 3), fmt(oy + dy * 3)];
  const h = e.bot - e.top;
  const open = e.top + e.t / 2;
  const closed = e.bot - e.t * 0.15 + (my - h * 0.28 - (e.bot - e.t * 0.15)) * arc; // happy eyes arch upward
  const A = open + (closed - open) * up;
  const th = e.t * (1 + 0.3 * up);
  const B0 = e.bot - lo * h;
  const B = B0 + (closed + th / 2 - B0) * arc * up;
  const lt = e.t * 0.45;
  return {
    upperClip: `M${i2[0]} ${i2[1]}Q${fmt(mx)} ${c(e.cover)} ${o2[0]} ${o2[1]}L${ox} ${oy}Q${fmt(mx)} ${c(A)} ${ix} ${iy}Z`,
    upperLash: `M${ix} ${iy}Q${fmt(mx)} ${c(A - th / 2)} ${ox} ${oy}Q${fmt(mx)} ${c(A + th / 2)} ${ix} ${iy}Z`,
    // the lower lid skin reaches further down when the eye arches shut, to hide the painted lower lid line
    lowerClip: `M${i2[0]} ${i2[1]}Q${fmt(mx)} ${c(e.bot + 3.5 + 3.5 * arc)} ${o2[0]} ${o2[1]}L${ox} ${oy}Q${fmt(mx)} ${c(B)} ${ix} ${iy}Z`,
    lowerLash: `M${ix} ${iy}Q${fmt(mx)} ${c(B - lt / 2)} ${ox} ${oy}Q${fmt(mx)} ${c(B + lt / 2)} ${ix} ${iy}Z`,
  };
}

/** Clip regions for the warped lid layers, following the eye's real outline. */
function warpClips(e: PortraitEye, up: number, lo: number) {
  const pr = e.prof!;
  const n = pr.length;
  const ext = 6;
  const x0 = pr[0]![0] - ext;
  const x1 = pr[n - 1]![0] + ext;
  const yc0 = (pr[0]![1] + pr[0]![2]) / 2;
  const yc1 = (pr[n - 1]![1] + pr[n - 1]![2]) / 2;
  const P = (pts: (readonly [number, number])[]) => pts.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join('L');
  const topY = Math.min(...pr.map((q) => q[1])) - (e.lidPad ?? 40) - 2;
  const botY = Math.max(...pr.map((q) => q[2])) + (e.lowPad ?? 30) + 2;
  const tw = e.tw ?? pr.map(() => 1);
  const lid = pr.map(([x, t, b], i) => [x, t + up * tw[i]! * (b - t)] as const);
  const low = pr.map(([x, t, b], i) => [x, b - lo * tw[i]! * (b - t)] as const);
  return {
    upper: `M${fmt(x0)} ${fmt(topY)}L${fmt(x1)} ${fmt(topY)}L${fmt(x1)} ${fmt(yc1)}L${P([...lid].reverse())}L${fmt(x0)} ${fmt(yc0)}Z`,
    lower: `M${fmt(x0)} ${fmt(botY)}L${fmt(x1)} ${fmt(botY)}L${fmt(x1)} ${fmt(yc1)}L${P([...low].reverse())}L${fmt(x0)} ${fmt(yc0)}Z`,
  };
}

/**
 * Lids that follow the eye's real outline (e.prof): the upper lid comes down to
 * top + up * (bottom - top) in every column, so it always covers exactly the visible
 * eye white, whatever the eye's shape. The lid skin starts above the painted lash.
 */
function profPaths(e: PortraitEye, up: number, lo: number) {
  const pr = e.prof!;
  const n = pr.length;
  const lw = Math.min(6, Math.max(2.5, (e.lashW ?? 4) * 0.55));
  const pad = (e.lashW ?? 4) + 4;
  const ext = 4; // reach past the corners
  const x0 = pr[0]![0] - ext;
  const x1 = pr[n - 1]![0] + ext;
  const yc0 = (pr[0]![1] + pr[0]![2]) / 2;
  const yc1 = (pr[n - 1]![1] + pr[n - 1]![2]) / 2;
  const lid = pr.map(([x, t, b]) => [x, t + up * (b - t)] as const);
  const low = pr.map(([x, t, b]) => [x, b - lo * (b - t)] as const);
  const P = (pts: readonly (readonly [number, number])[]) => pts.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join('L');
  const top = pr.map(([x, t]) => [x, t - pad] as const);
  const taper = (i: number) => Math.sqrt(Math.sin((Math.PI * (i + 0.5)) / n));
  const lashUp = lid.map(([x, y], i) => [x, y - (lw * taper(i)) / 2] as const);
  const lashDn = lid.map(([x, y], i) => [x, y + (lw * taper(i)) / 2] as const).reverse();
  const bot = pr.map(([x, , b]) => [x, b + 4] as const);
  const llw = lw * 0.45;
  return {
    upperClip: `M${fmt(x0)} ${fmt(yc0)}L${P(top)}L${fmt(x1)} ${fmt(yc1)}L${P([...lid].reverse())}Z`,
    upperLash: `M${fmt(x0 + ext)} ${fmt(lid[0]![1])}L${P(lashUp)}L${P(lashDn)}Z`,
    lowerClip: `M${fmt(x0)} ${fmt(yc0)}L${P(bot)}L${fmt(x1)} ${fmt(yc1)}L${P([...low].reverse())}Z`,
    lowerLash: `M${P(low.map(([x, y], i) => [x, y - (llw * taper(i)) / 2] as const))}L${P(low.map(([x, y], i) => [x, y + (llw * taper(i)) / 2] as const).reverse())}Z`,
  };
}

// ---------------------------------------------------------------------------
// One shared frame loop for every portrait on screen
// ---------------------------------------------------------------------------

type Tick = (now: number, dt: number) => void;
const ticks = new Set<Tick>();
let running = false;
let last = 0;
function loop(now: number) {
  const dt = Math.min(48, now - last);
  last = now;
  for (const t of ticks) t(now, dt);
  if (ticks.size) requestAnimationFrame(loop);
  else running = false;
}
function subscribe(t: Tick) {
  ticks.add(t);
  if (!running) {
    running = true;
    last = performance.now();
    requestAnimationFrame(loop);
  }
  return () => {
    ticks.delete(t);
  };
}

/** A damped spring step (semi-implicit Euler), like motion's spring transitions. */
function spring(x: number, v: number, target: number, k: number, c: number, dt: number): [number, number] {
  const steps = Math.ceil(dt / 8);
  const h = dt / 1000 / steps;
  for (let i = 0; i < steps; i++) {
    v += (k * (target - x) - c * v) * h;
    x += v * h;
  }
  return [x, v];
}

// ---------------------------------------------------------------------------
// The component
// ---------------------------------------------------------------------------

export interface PortraitProps {
  /** Lobby face 0..11. */
  id: number;
  /** Width in px. Height follows the crop's aspect ratio. */
  size?: number;
  crop?: Crop;
  gaze?: Gaze;
  expression?: Expression;
  /** Greyed out (a ghost). */
  ghost?: boolean;
  /** Villain glow in the irises. */
  glowEyes?: boolean;
  /** Blink now and then. */
  blink?: boolean;
  className?: string;
  title?: string;
  /** Show the full head-and-shoulders portrait (home screen, character picker). */
  full?: boolean;
}

interface EyeEls {
  g: SVGGElement;
  cu: SVGPathElement;
  cl: SVGPathElement;
  lu: SVGPathElement;
  ll: SVGPathElement;
  il: SVGImageElement;
}

export const Portrait = memo(function Portrait({
  id,
  size = 120,
  crop = 'bust',
  gaze = 'you',
  expression = 'neutral',
  ghost = false,
  glowEyes = false,
  blink = false,
  className,
  title,
  full = false,
}: PortraitProps) {
  const p0 = portrait(id);
  const useFull = !!(full && p0.full);
  const p: PortraitData = useMemo(() => (useFull ? { ...p0, ...p0.full!, winked: false } : p0), [p0, useFull]);
  const asset = (f: Parameters<typeof portraitAsset>[1]) =>
    portraitAsset(p.id, useFull ? (f === 'base.webp' ? 'full.webp' : f === 'lid.png' ? 'fulllid.png' : f === 'brows.png' ? 'fullbrows.png' : f) : f);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const reduce = useReducedMotion() ?? false;
  const svgRef = useRef<SVGSVGElement>(null);
  const target = useRef<Target>(targetFor(p, expression, gaze));
  const opts = useRef({ blink, reduce });

  useEffect(() => {
    target.current = targetFor(p, expression, gaze);
    opts.current = { blink: blink && expression !== 'dead', reduce };
  }, [p, expression, gaze, blink, reduce]);

  // Drive lids, brows and gaze on the shared frame loop.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const eyes: EyeEls[] = [...svg.querySelectorAll<SVGGElement>('[data-eye]')].map((g) => ({
      g,
      cu: g.querySelector<SVGPathElement>('.cu')!,
      cl: g.querySelector<SVGPathElement>('.cl')!,
      lu: g.querySelector<SVGPathElement>('.lu')!,
      ll: g.querySelector<SVGPathElement>('.ll')!,
      il: g.querySelector<SVGImageElement>('.il')!,
    }));
    const face = svg.querySelector<SVGGElement>('[data-face]')!;
    const irises = [...svg.querySelectorAll<SVGGElement>('[data-iris]')];
    const closedEls = [...svg.querySelectorAll<SVGImageElement>('[data-closed]')];
    const awayEls = [...svg.querySelectorAll<SVGImageElement>('[data-away]')];
    const painted = awayEls.length > 0;
    const warp = (k: string) => ({
      g: svg.querySelector<SVGGElement>(`[data-wl="${k}"]`),
      clip: svg.querySelector<SVGPathElement>(`[data-wc="${k}"]`),
      fx: svg.querySelector<SVGElement>(`[data-wf="${k}"]`),
    });
    const warps = p.eyes.map((_, i) => ({ u: warp(`u${i}`), l: warp(`l${i}`) }));
    const fx = Object.fromEntries([...svg.querySelectorAll<SVGElement>('[data-k]')].map((el) => [el.dataset.k!, el]));
    const filterUrl = `url(#${uid}-warp)`;
    const n = p.eyes.length;
    const s = {
      up: [...target.current.up],
      lo: [...target.current.lo],
      arc: [...target.current.arc],
      bl: target.current.bl,
      br: target.current.br,
      vbl: 0,
      vbr: 0,
      gx: target.current.gx,
      gy: target.current.gy,
      vgx: 0,
      vgy: 0,
      blinkAt: -1,
      nextBlink: performance.now() + 1200 + Math.random() * 3000,
    };
    let drawnEyes = '';
    let drawnWarp = '';
    let drawnGaze = '';

    const tick: Tick = (now, dt) => {
      const t = target.current;
      const { blink: blinkOn, reduce: still } = opts.current;
      // natural blinking
      if (blinkOn && !still && s.blinkAt < 0 && now > s.nextBlink) {
        s.blinkAt = now;
        s.nextBlink = now + 2200 + Math.random() * 3800;
      }
      let b = 0;
      if (s.blinkAt >= 0) {
        const e = now - s.blinkAt;
        b = e < 75 ? (e / 75) ** 2 : e < 110 ? 1 : e < 230 ? (1 - (e - 110) / 120) ** 2 : 0;
        if (e >= 230) s.blinkAt = -1;
      }
      const k = still ? 1 : 1 - Math.exp(-dt / 45);
      for (let i = 0; i < n; i++) {
        s.up[i]! += (t.up[i]! - s.up[i]!) * k;
        s.lo[i]! += (t.lo[i]! - s.lo[i]!) * k;
        s.arc[i]! += (t.arc[i]! - s.arc[i]!) * k;
      }
      if (still) {
        s.bl = t.bl;
        s.br = t.br;
        s.gx = t.gx;
        s.gy = t.gy;
      } else {
        [s.bl, s.vbl] = spring(s.bl, s.vbl, t.bl, 560, 13, dt);
        [s.br, s.vbr] = spring(s.br, s.vbr, t.br, 560, 13, dt);
        [s.gx, s.vgx] = spring(s.gx, s.vgx, t.gx, 380, 26, dt);
        [s.gy, s.vgy] = spring(s.gy, s.vgy, t.gy, 380, 26, dt);
      }

      // eyes
      const ups = s.up.map((u) => u + (1 - u) * b);
      const key = ups.map((u, i) => `${fmt(u * 100)},${fmt(s.lo[i]! * 100)},${fmt(s.arc[i]! * 100)}`).join('|');
      if (key !== drawnEyes) {
        drawnEyes = key;
        for (let i = 0; i < eyes.length; i++) {
          const el = eyes[i]!;
          const up = ups[i]!;
          const lo = s.lo[i]!;
          const arc = s.arc[i]!;
          const ew = p.eyes[i]!;
          if (ew.lidmap && ew.prof && arc < 0.02) {
            // painted lids: slide the real painted lash and lid skin over the eye
            el.g.style.visibility = 'hidden';
            const w = warps[i]!;
            const c = warpClips(ew, up, lo);
            const H = ew.lidH ?? 0;
            const setW = (x: typeof w.u, amount: number, d: string) => {
              if (!x.g || !x.clip || !x.fx) return;
              const on = amount > 0.01;
              x.g.style.visibility = on ? 'visible' : 'hidden';
              if (!on) return;
              x.clip.setAttribute('d', d);
              x.fx.setAttribute('scale', String(fmt(2 * amount * H)));
            };
            const ce0 = closedEls.find((cc) => cc.dataset.closed === String(i));
            const fr = Math.max(0, Math.min(1, (up - 0.78) / 0.17));
            const fade = ce0 ? fr * fr * (3 - 2 * fr) : 0;
            setW(w.u, Math.min(up, 0.985), c.upper);
            setW(w.l, up > 0.92 ? 0 : lo, c.lower);
            // as the painted closed eye fades in, the slid lid fades out (no stretched hair under it)
            if (w.u.g) w.u.g.style.opacity = String(fmt(1 - fade));
            if (w.l.g) w.l.g.style.opacity = String(fmt(1 - fade));
            if (ce0) ce0.style.opacity = String(fmt(fade));
            continue;
          }
          const show = up > 0.015 || lo > 0.015;
          el.g.style.visibility = show ? 'visible' : 'hidden';
          const ce = closedEls.find((c) => c.dataset.closed === String(i));
          if (ce) {
            // the painted closed eye takes over as the lid shuts (not for the happy arc)
            const f = Math.max(0, Math.min(1, (up - 0.8) / 0.17));
            ce.style.opacity = String(fmt(f * f * (3 - 2 * f) * (1 - arc)));
          }
          if (!show) continue;
          const lower = (lo > 0.015 && up <= 0.92) || arc * up > 0.02;
          const ei = p.eyes[i]!;
          const d = ei.prof && arc < 0.02 ? profPaths(ei, up, up > 0.92 ? 0 : lo) : lidPaths(ei, up, up > 0.92 && arc < 0.02 ? 0 : lo, arc);
          el.cu.setAttribute('d', d.upperClip);
          el.lu.setAttribute('d', d.upperLash);
          el.il.style.display = lower ? '' : 'none';
          el.ll.style.display = lower && arc < 0.3 ? '' : 'none';
          if (lower) {
            el.cl.setAttribute('d', d.lowerClip);
            el.ll.setAttribute('d', d.lowerLash);
          }
        }
      }

      // gaze: slide each painted iris inside its eye opening
      const gkey = `${fmt(s.gx * 100)},${fmt(s.gy * 100)}`;
      if (gkey !== drawnGaze) {
        drawnGaze = gkey;
        if (painted) {
          // looking away: the painted look-away eyes fade in over the painted open eyes (nothing slides or warps)
          const a = Math.min(1, Math.abs(s.gx) + Math.abs(s.gy));
          for (const el of awayEls) el.style.opacity = String(fmt(a));
        } else {
          for (let i = 0; i < irises.length; i++) {
            const g = p.eyes[i]!.gaze;
            irises[i]!.setAttribute('transform', `translate(${fmt(s.gx * g.x)} ${fmt(s.gy * g.y)})`);
          }
        }
      }

      // brows: lift with the warp map (clamped to stay fold-free while springing)
      const clampB = (v: number) => Math.max(-0.6, Math.min(1.08, v));
      const L = clampB(s.bl) * p.brows[0].max * 2;
      const R = clampB(s.br) * p.brows[1].max * 2;
      const wkey = `${fmt(L)},${fmt(R)}`;
      if (wkey !== drawnWarp) {
        drawnWarp = wkey;
        if (Math.abs(L) > 0.15 || Math.abs(R) > 0.15) {
          fx.bl?.setAttribute('scale', String(fmt(L)));
          fx.br?.setAttribute('scale', String(fmt(R)));
          face.setAttribute('filter', filterUrl);
        } else face.removeAttribute('filter');
      }
    };
    tick(performance.now(), 0);
    return subscribe(tick);
  }, [p, uid]);

  const [W, H] = p.size;
  const [cx, cy, cw, ch] = p.crops[crop];
  const L = p.lidLayer;
  const lid = asset('lid.png');
  const dead = expression === 'dead';
  const style = ghost
    ? { filter: 'grayscale(1) brightness(0.75)', opacity: 0.6 }
    : dead
      ? { filter: 'grayscale(0.7) brightness(0.85)' }
      : undefined;

  return (
    <svg
      ref={svgRef}
      width={size}
      height={Math.round(size * ASPECT[crop])}
      viewBox={`${cx} ${cy} ${cw} ${ch}`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role="img"
      aria-label={title ?? p.name}
      style={style}
    >
      <defs>
        <filter id={`${uid}-warp`} filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" x={0} y={0} width={W} height={H} colorInterpolationFilters="sRGB">
          <feImage href={asset('brows.png')} x={0} y={0} width={W} height={H} preserveAspectRatio="none" result="bm" />
          <feDisplacementMap data-k="bl" in="SourceGraphic" in2="bm" xChannelSelector="B" yChannelSelector="R" scale={0} result="b1" />
          <feDisplacementMap data-k="br" in="b1" in2="bm" xChannelSelector="B" yChannelSelector="G" scale={0} />
        </filter>
        {p.eyes.map((e, i) => (
          <g key={i}>
            <clipPath id={`${uid}-o${i}`}>
              <path d={e.open} />
            </clipPath>
            {e.mask && (
              <mask id={`${uid}-m${i}`} maskUnits="userSpaceOnUse" x={e.mask[0]} y={e.mask[1]} width={e.mask[2]} height={e.mask[3]}>
                <image href={asset(`white${i}.png`)} x={e.mask[0]} y={e.mask[1]} width={e.mask[2]} height={e.mask[3]} />
              </mask>
            )}
            <radialGradient id={`${uid}-g${i}`}>
              <stop offset="0%" stopColor={p.eyeColor} stopOpacity={0.95} />
              <stop offset="60%" stopColor={p.eyeColor} stopOpacity={0.45} />
              <stop offset="100%" stopColor={p.eyeColor} stopOpacity={0} />
            </radialGradient>
          </g>
        ))}
        {p.eyes.map((e, i) =>
          e.lidmap ? (
            <g key={`w${i}`}>
              {(['u', 'l'] as const).map((k) => (
                <g key={k}>
                  <filter id={`${uid}-wf${k}${i}`} filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" x={e.lidmap![0]} y={e.lidmap![1]} width={e.lidmap![2]} height={e.lidmap![3]} colorInterpolationFilters="sRGB">
                    <feImage href={asset(`lidmap${i}.png`)} x={e.lidmap![0]} y={e.lidmap![1]} width={e.lidmap![2]} height={e.lidmap![3]} preserveAspectRatio="none" result="lm" />
                    <feDisplacementMap data-wf={`${k}${i}`} in="SourceGraphic" in2="lm" xChannelSelector="B" yChannelSelector={k === 'u' ? 'R' : 'G'} scale={0} />
                  </filter>
                  <clipPath id={`${uid}-wc${k}${i}`}>
                    <path data-wc={`${k}${i}`} />
                  </clipPath>
                </g>
              ))}
            </g>
          ) : null,
        )}
      </defs>
      <g data-face="" key={p.id}>
        <g id={`${uid}-st`}>
          <image href={asset('base.webp')} width={W} height={H} />
          {!useFull && <image href={asset('eyes.webp')} x={p.hiEyes[0]} y={p.hiEyes[1]} width={p.hiEyes[2]} height={p.hiEyes[3]} />}
        </g>
        {!useFull &&
          p.eyes.map((e, i) => (
            <g key={i} {...(e.mask ? { mask: `url(#${uid}-m${i})` } : { clipPath: `url(#${uid}-o${i})` })}>
              <g data-iris={i}>
                <image href={asset(`iris${i}.png`)} x={e.iris[0]} y={e.iris[1]} width={e.iris[2]} height={e.iris[3]} />
              </g>
            </g>
          ))}
        {p.eyes.map((e, i) =>
          e.away ? (
            <image key={`a${i}`} data-away={i} href={asset(`away${i}.webp`)} x={e.away[0]} y={e.away[1]} width={e.away[2]} height={e.away[3]} style={{ opacity: 0 }} />
          ) : null,
        )}
        {glowEyes && !useFull &&
          p.eyes.map((e, i) => (
            <ellipse
              key={i}
              cx={e.iris[0] + e.iris[2] / 2}
              cy={e.iris[1] + e.iris[3] / 2}
              rx={e.iris[2] * 0.45}
              ry={e.iris[3] * 0.45}
              fill={`url(#${uid}-g${i})`}
              {...(e.mask ? { mask: `url(#${uid}-m${i})` } : { clipPath: `url(#${uid}-o${i})` })}
              style={{ mixBlendMode: 'screen' }}
            />
          ))}
        {p.eyes.map((e, i) => (
          <g key={i} data-eye={i} visibility="hidden">
            <clipPath id={`${uid}-cu${i}`}>
              <path className="cu" />
            </clipPath>
            <clipPath id={`${uid}-cl${i}`}>
              <path className="cl" />
            </clipPath>
            <image className="il" href={lid} x={L.x} y={L.y} width={L.w} height={L.h} clipPath={`url(#${uid}-cl${i})`} />
            <path className="ll" fill={e.lash} opacity={0.85} />
            <image href={lid} x={L.x} y={L.y} width={L.w} height={L.h} clipPath={`url(#${uid}-cu${i})`} />
            <path className="lu" fill={e.lash} />
          </g>
        ))}
        {p.eyes.map((e, i) =>
          e.lidmap
            ? (['l', 'u'] as const).map((k) => (
                <g key={`${k}${i}`} data-wl={`${k}${i}`} clipPath={`url(#${uid}-wc${k}${i})`} style={{ visibility: 'hidden' }}>
                  <g filter={`url(#${uid}-wf${k}${i})`}>
                    <use href={`#${uid}-st`} />
                  </g>
                </g>
              ))
            : null,
        )}
        {p.eyes.map((e, i) =>
          e.closed ? (
            <image key={i} data-closed={i} href={asset(`closed${i}.webp`)} x={e.closed[0]} y={e.closed[1]} width={e.closed[2]} height={e.closed[3]} style={{ opacity: 0 }} />
          ) : null,
        )}
        {p.overlay?.map((o, i) => <path key={i} d={o.d} fill="none" stroke={o.c} strokeWidth={o.w} strokeLinecap="round" />)}
      </g>
    </svg>
  );
});
