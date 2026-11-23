import { clamp, ease, rng } from '../engine';
import type { Vec3 } from './math';

/**
 * The courtroom of "Domain Expansion: Deadly Sentencing", as a kit of pieces
 * that assemble themselves out of the dark: marble tiles rising in a wave,
 * pillars stacking drum by drum, the dock, the bench and the empty judge's
 * chair flying in and locking into place. Pure data and pure functions of
 * time, so every phone builds the same court and it can be tested.
 *
 * World: metres, y up. The dock stands at the origin facing the bench at -z.
 */

export type Mesh = 'box' | 'cyl';
export type Material = 'wood' | 'woodDark' | 'marbleA' | 'marbleB' | 'gold' | 'velvet' | 'stone';
/** How a piece arrives: rising from below, dropping from above, flying in, or a carpet unrolling. */
export type Entry = 'rise' | 'drop' | 'fly' | 'unroll';
/** Pieces that move with an animated part after they arrive. */
export type Parent = 'scales' | 'scalesChain' | 'panL' | 'panR' | 'gavel' | null;

export interface Piece {
  mesh: Mesh;
  mat: Material;
  /** Resting transform (relative to the parent, if any). */
  pos: Vec3;
  rot: Vec3;
  size: Vec3;
  /** Optional: a rod from `pos` to `to` (overrides rot and size.y). */
  to?: Vec3;
  start: number;
  dur: number;
  entry: Entry;
  /** Where it comes from (added to pos at the start) and how it spins in. */
  from: Vec3;
  spin: Vec3;
  parent: Parent;
  /** Gold sparks thrown when it locks into place. */
  sparks: number;
}

export interface Light {
  pos: Vec3;
  target: Vec3;
  /** Outer and inner cone half-angles, degrees. */
  outer: number;
  inner: number;
  color: 'warm' | 'gold' | 'rim';
  intensity: number;
  /** When it strikes on. */
  on: number;
  /** Casts shadows (at most two lights). */
  shadow: boolean;
}

export const SCALES_AT: Vec3 = [0, 0, -6.2];
export const GAVEL_PIVOT: Vec3 = [2.9, 3.26, -9.0];
export const STRIKE: Vec3 = [1.6, 2.86, -9.0];
export const BENCH_FRONT_Z = -8.4;
export const ASSEMBLED_BY = 2.4;

export const LIGHTS: Light[] = [
  { pos: [0, 10, -20], target: [0, 2, -9], outer: 30, inner: 14, color: 'rim', intensity: 2.6, on: 0.75, shadow: false },
  { pos: [0, 13, 2.5], target: [0, 0, 0], outer: 13, inner: 6, color: 'warm', intensity: 5.5, on: 1.0, shadow: true },
  { pos: [0, 15, -5.6], target: [0, 2.2, -9.7], outer: 15, inner: 6, color: 'warm', intensity: 6.5, on: 1.35, shadow: true },
  { pos: [-7.5, 12, -3], target: [-4.6, 0.5, -5.5], outer: 10, inner: 5, color: 'warm', intensity: 4.5, on: 1.6, shadow: false },
  { pos: [7.5, 12, -3], target: [4.6, 0.5, -5.5], outer: 10, inner: 5, color: 'warm', intensity: 4.5, on: 1.7, shadow: false },
  { pos: [0, 17, -6.2], target: [0, 4, -6.2], outer: 8, inner: 4, color: 'gold', intensity: 6, on: 2.0, shadow: false },
];

const V = (x: number, y: number, z: number): Vec3 => [x, y, z];
const R0: Vec3 = [0, 0, 0];

function build(): Piece[] {
  const r = rng(1729);
  const rand = (a: number, b: number) => a + (b - a) * r();
  const out: Piece[] = [];
  const add = (p: Partial<Piece> & Pick<Piece, 'mesh' | 'mat' | 'pos' | 'size' | 'start'>) =>
    out.push({ rot: R0, dur: 0.4, entry: 'fly', from: R0, spin: R0, parent: null, sparks: 0, ...p });

  // Marble floor: tiles rise out of the dark in a wave spreading from the dock.
  const TILE = 1.2;
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 17; j++) {
      const x = -5.4 + i * TILE;
      const z = 6 - j * TILE;
      const d = Math.hypot(x, z);
      add({
        mesh: 'box',
        mat: (i + j) % 2 ? 'marbleA' : 'marbleB',
        pos: V(x, -0.15, z),
        size: V(TILE - 0.03, 0.3, TILE - 0.03),
        start: 0.5 + d * 0.042 + rand(0, 0.05),
        dur: 0.38,
        entry: 'rise',
        from: V(0, -5 - rand(0, 5), 0),
        spin: V(rand(-0.9, 0.9), rand(-0.6, 0.6), rand(-0.9, 0.9)),
        sparks: 2,
      });
    }
  }

  // Pillars: drums drop from the dark and stack.
  const pillarSpots: Vec3[] = [V(-3, 0, -12.6), V(3, 0, -12.6), V(-6, 0, -12.6), V(6, 0, -12.6), V(-6.6, 0, -7.5), V(6.6, 0, -7.5), V(-6.6, 0, -2.5), V(6.6, 0, -2.5), V(-6.6, 0, 2.5), V(6.6, 0, 2.5)];
  pillarSpots.forEach((p, k) => {
    const t0 = 0.75 + k * 0.035;
    add({ mesh: 'box', mat: 'stone', pos: V(p[0], 0.2, p[2]), size: V(1.4, 0.4, 1.4), start: t0, dur: 0.3, entry: 'rise', from: V(0, -3, 0), sparks: 3 });
    for (let d = 0; d < 7; d++) {
      add({ mesh: 'cyl', mat: 'stone', pos: V(p[0], 0.4 + 0.6 + d * 1.2, p[2]), size: V(1.0, 1.18, 1.0), start: t0 + 0.08 + d * 0.075, dur: 0.28, entry: 'drop', from: V(0, 10 + d, 0), spin: V(0, rand(-2, 2), 0), sparks: d === 0 ? 2 : 0 });
    }
    add({ mesh: 'box', mat: 'stone', pos: V(p[0], 8.8 + 0.25, p[2]), size: V(1.45, 0.5, 1.45), start: t0 + 0.65, dur: 0.28, entry: 'drop', from: V(0, 8, 0), sparks: 4 });
  });

  // The dock, where the accused stands.
  add({ mesh: 'box', mat: 'woodDark', pos: V(0, 0.125, 0), size: V(2.0, 0.25, 2.0), start: 0.95, dur: 0.35, entry: 'rise', from: V(0, -3, 0), sparks: 6 });
  add({ mesh: 'box', mat: 'wood', pos: V(-0.94, 0.8, 0), size: V(0.12, 1.1, 2.0), start: 1.05, entry: 'fly', from: V(-7, 3, 1), spin: V(0, 0, 1.6), sparks: 5 });
  add({ mesh: 'box', mat: 'wood', pos: V(0.94, 0.8, 0), size: V(0.12, 1.1, 2.0), start: 1.1, entry: 'fly', from: V(7, 3, 1), spin: V(0, 0, -1.6), sparks: 5 });
  add({ mesh: 'box', mat: 'wood', pos: V(0, 0.8, -0.94), size: V(2.0, 1.1, 0.12), start: 1.15, entry: 'fly', from: V(0, 4, -7), spin: V(1.4, 0, 0), sparks: 5 });
  add({ mesh: 'box', mat: 'gold', pos: V(-0.94, 1.38, 0), size: V(0.2, 0.06, 2.06), start: 1.3, dur: 0.3, from: V(-3, 2, 0), sparks: 3 });
  add({ mesh: 'box', mat: 'gold', pos: V(0.94, 1.38, 0), size: V(0.2, 0.06, 2.06), start: 1.32, dur: 0.3, from: V(3, 2, 0), sparks: 3 });
  add({ mesh: 'box', mat: 'gold', pos: V(0, 1.38, -0.94), size: V(2.06, 0.06, 0.2), start: 1.34, dur: 0.3, from: V(0, 2, -3), sparks: 3 });

  // The carpet from the dock to the bench unrolls.
  add({ mesh: 'box', mat: 'velvet', pos: V(0, 0.02, -4.7), size: V(1.5, 0.04, 7.0), start: 1.2, dur: 0.5, entry: 'unroll' });

  // The bench: dais, body, carved panels, gold trim.
  add({ mesh: 'box', mat: 'stone', pos: V(0, 0.15, -9.7), size: V(8.4, 0.3, 3.6), start: 1.1, dur: 0.35, entry: 'rise', from: V(0, -4, 0), sparks: 8 });
  add({ mesh: 'box', mat: 'stone', pos: V(0, 0.45, -10.0), size: V(7.4, 0.3, 2.8), start: 1.18, dur: 0.35, entry: 'rise', from: V(0, -4, 0), sparks: 6 });
  add({ mesh: 'box', mat: 'wood', pos: V(0, 1.65, -8.55), size: V(7.0, 2.1, 0.3), start: 1.3, dur: 0.38, entry: 'drop', from: V(0, 9, 0), sparks: 12 });
  add({ mesh: 'box', mat: 'wood', pos: V(-3.35, 1.65, -9.3), size: V(0.3, 2.1, 1.8), start: 1.25, entry: 'fly', from: V(-8, 2, 2), spin: V(0, 1.2, 0), sparks: 5 });
  add({ mesh: 'box', mat: 'wood', pos: V(3.35, 1.65, -9.3), size: V(0.3, 2.1, 1.8), start: 1.27, entry: 'fly', from: V(8, 2, 2), spin: V(0, -1.2, 0), sparks: 5 });
  add({ mesh: 'box', mat: 'woodDark', pos: V(0, 2.76, -9.25), size: V(7.5, 0.14, 2.0), start: 1.55, dur: 0.32, entry: 'drop', from: V(0, 7, 0), sparks: 10 });
  add({ mesh: 'box', mat: 'gold', pos: V(0, 2.68, -8.37), size: V(7.55, 0.06, 0.06), start: 1.7, dur: 0.3, from: V(-9, 0, 0), sparks: 4 });
  add({ mesh: 'box', mat: 'gold', pos: V(0, 0.66, -8.37), size: V(7.1, 0.06, 0.06), start: 1.72, dur: 0.3, from: V(9, 0, 0), sparks: 4 });
  for (const [k, x] of [-2.25, 0, 2.25].entries()) {
    add({ mesh: 'box', mat: 'gold', pos: V(x, 1.65, -8.385), size: V(1.95, 1.45, 0.04), start: 1.45 + k * 0.05, dur: 0.32, from: V(0, 0, 5), spin: V(0, 0, rand(-1, 1)), sparks: 3 });
    add({ mesh: 'box', mat: 'woodDark', pos: V(x, 1.65, -8.36), size: V(1.8, 1.3, 0.06), start: 1.5 + k * 0.05, dur: 0.32, from: V(0, 0, 6), spin: V(rand(-1, 1), 0, 0), sparks: 2 });
  }
  add({ mesh: 'cyl', mat: 'gold', pos: V(0, 1.65, -8.31), rot: V(Math.PI / 2, 0, 0), size: V(0.9, 0.06, 0.9), start: 1.75, dur: 0.3, from: V(0, 0, 4), spin: V(0, 0, 6), sparks: 6 });

  // The judge's chair: tall, crimson, empty.
  add({ mesh: 'box', mat: 'woodDark', pos: V(0, 2.3, -10.5), size: V(1.4, 3.4, 0.26), start: 1.6, dur: 0.4, entry: 'rise', from: V(0, -5, 0), sparks: 6 });
  add({ mesh: 'box', mat: 'velvet', pos: V(0, 2.45, -10.36), size: V(1.04, 2.5, 0.05), start: 1.78, dur: 0.3, from: V(0, 0, 3) });
  add({ mesh: 'box', mat: 'gold', pos: V(0, 4.08, -10.5), size: V(1.6, 0.18, 0.34), start: 1.85, dur: 0.3, entry: 'drop', from: V(0, 4, 0), sparks: 5 });

  // Witness stands.
  for (const s of [-1, 1]) {
    add({ mesh: 'box', mat: 'wood', pos: V(s * 4.6, 0.6, -5.5), size: V(1.3, 1.2, 1.3), start: 1.4 + (s > 0 ? 0.08 : 0), dur: 0.4, from: V(s * 7, 1, 0), spin: V(0, s * 1.5, 0), sparks: 5 });
    add({ mesh: 'box', mat: 'gold', pos: V(s * 4.6, 1.23, -5.5), size: V(1.36, 0.06, 1.36), start: 1.6 + (s > 0 ? 0.08 : 0), dur: 0.28, entry: 'drop', from: V(0, 3, 0), sparks: 3 });
  }

  // Gallery pews behind the dock.
  for (const s of [-1, 1]) {
    for (let row = 0; row < 3; row++) {
      const z = 2.4 + row * 1.5;
      const x = s * 3.0;
      const t0 = 1.45 + row * 0.07 + (s > 0 ? 0.04 : 0);
      add({ mesh: 'box', mat: 'wood', pos: V(x, 0.48, z), size: V(2.8, 0.12, 0.6), start: t0, dur: 0.38, from: V(s * 8, 0, 0), sparks: 2 });
      add({ mesh: 'box', mat: 'woodDark', pos: V(x, 0.9, z + 0.32), size: V(2.8, 0.9, 0.1), start: t0 + 0.04, dur: 0.38, from: V(s * 8, 1, 0), sparks: 2 });
    }
  }

  // The gavel and its block arrive on the bench.
  add({ mesh: 'cyl', mat: 'woodDark', pos: V(STRIKE[0], 2.8, STRIKE[2]), size: V(0.75, 0.12, 0.75), start: 1.95, dur: 0.3, entry: 'drop', from: V(0, 3, 0), sparks: 4 });
  add({ mesh: 'box', mat: 'wood', pos: V(-0.65, 0, 0), size: V(1.3, 0.1, 0.1), start: 2.0, dur: 0.3, entry: 'drop', from: V(0, 3, 0), parent: 'gavel' });
  add({ mesh: 'cyl', mat: 'wood', pos: V(-1.3, 0, 0), size: V(0.5, 0.8, 0.5), start: 2.0, dur: 0.3, entry: 'drop', from: V(0, 3, 0), parent: 'gavel', sparks: 4 });
  for (const y of [-0.28, 0.28]) add({ mesh: 'cyl', mat: 'gold', pos: V(-1.3, y, 0), size: V(0.54, 0.07, 0.54), start: 2.0, dur: 0.3, entry: 'drop', from: V(0, 3, 0), parent: 'gavel' });

  // The scales of judgement (they descend with their parent, so they appear without an entry).
  const scale = (p: Partial<Piece> & Pick<Piece, 'mesh' | 'pos' | 'size'>) => add({ mat: 'gold', start: 1.8, dur: 0.01, entry: 'fly', ...p });
  scale({ mesh: 'box', pos: V(0, 4, 0), size: V(0.04, 8, 0.04), parent: 'scalesChain' });
  scale({ mesh: 'cyl', pos: V(0, 0, 0), size: V(0.32, 0.32, 0.32), parent: 'scalesChain' });
  scale({ mesh: 'box', pos: V(0, 0, 0), size: V(2.7, 0.08, 0.08), parent: 'scales' });
  for (const p of ['panL', 'panR'] as const) {
    scale({ mesh: 'cyl', pos: V(0, -1.3, 0), size: V(1.0, 0.05, 1.0), parent: p });
    scale({ mesh: 'cyl', pos: V(0, -1.27, 0), size: V(1.08, 0.04, 1.08), parent: p });
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      scale({ mesh: 'box', pos: V(0, 0, 0), to: V(0.46 * Math.cos(a), -1.27, 0.46 * Math.sin(a)), size: V(0.025, 1, 0.025), parent: p });
    }
  }
  return out;
}

export const PIECES: Piece[] = build();

export interface Pose {
  pos: Vec3;
  rot: Vec3;
  size: Vec3;
  /** 0..1 gold energy: bright while flying in, a flash when it locks. */
  glow: number;
}

/** Where a piece is at time t, or null before it appears. */
export function piecePose(p: Piece, t: number): Pose | null {
  if (t < p.start) return null;
  const k = clamp((t - p.start) / p.dur);
  const land = p.start + p.dur;
  const flash = t >= land ? Math.exp(-(t - land) * 7) : 0;
  const inFlight = 1 - k;
  const glow = Math.max(inFlight * inFlight * 0.85, flash * 0.8);
  if (p.entry === 'unroll') {
    const e = ease.outCubic(k);
    const len = Math.max(0.001, p.size[2] * e);
    return { pos: [p.pos[0], p.pos[1], p.pos[2] + (p.size[2] - len) / 2], rot: p.rot, size: [p.size[0], p.size[1], len], glow: glow * 0.4 };
  }
  // Drops accelerate and slam; the rest decelerate into their slot with a small settle.
  const e = p.entry === 'drop' ? k * k : p.entry === 'rise' ? ease.outCubic(k) : 1 + 1.4 * Math.pow(k - 1, 3) + 0.4 * Math.pow(k - 1, 2);
  const m = 1 - e;
  return {
    pos: [p.pos[0] + p.from[0] * m, p.pos[1] + p.from[1] * m, p.pos[2] + p.from[2] * m],
    rot: [p.rot[0] + p.spin[0] * m, p.rot[1] + p.spin[1] * m, p.rot[2] + p.spin[2] * m],
    size: p.size,
    glow,
  };
}

/** When each piece locks into place. */
export const landTime = (p: Piece) => p.start + p.dur;

/** Strike flicker and the gavel's flare: a light's strength at time t (0 = off). */
export function lightLevel(l: Light, t: number, gavelAt: number): number {
  if (t < l.on) return 0;
  const k = (t - l.on) / 0.2;
  // A theatre lamp striking: on, stutter, on.
  const strike = k < 1 ? [1, 0.15, 0.9, 0.35, 1][Math.floor(k * 5)]! : 1;
  const flare = t >= gavelAt ? 0.9 * Math.exp(-(t - gavelAt) * 5) : 0;
  return strike + flare;
}
