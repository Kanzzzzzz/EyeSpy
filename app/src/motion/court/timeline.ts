import { clamp, ease, lerp, seg } from '../engine';
import type { Vec3 } from './math';
import { LIGHTS, lightLevel } from './set';

/**
 * The shot list for "Domain Expansion: Deadly Sentencing", the Judge's
 * hearing intro. A pure function of time, so every phone plays the same shot
 * and the beats can be tested against the `court` sound cue:
 *
 *  0.00  ink floods the screen from the centre; 領域展開 slams in
 *  0.50  in the dark, marble tiles rise in a wave, pillars stack drum by drum
 *  1.00  the first spotlight strikes on the empty dock (solemn sting)
 *  1.30  the bench, the chair and the stands fly in and lock, throwing sparks;
 *        more spotlights strike; the camera cranes down and sweeps round
 *  1.80  the scales descend from the dark on a chain
 *  2.45  from the dock, facing the bench, the gavel lifts by itself
 *  2.90  the gavel falls: impact frame, shockwave, every light flares
 *  3.00  the domain's name slams in while the gavel raps twice more (3.12, 3.32)
 *  3.90  fade to black; the voting screen takes over at 4.4
 */
export const COURT_DURATION = 4.4;

export const COURT_BEATS = { ink: 0, kanji: 0.2, assemble: 0.5, firstLight: 1.0, scales: 1.8, lift: 2.45, gavel: 2.9, title: 3.0, fade: 3.9 } as const;

/** After the big strike, two quick raps, as a judge calls for order. */
export const GAVEL_RAPS = [3.12, 3.32] as const;

export interface CourtShot {
  cam: { pos: Vec3; target: Vec3; fov: number; roll: number };
  /** Radius of the ink flood (screen heights); large once the screen is covered. */
  ink: number;
  /** Strength of each light in `LIGHTS` (0 = off). */
  lights: number[];
  scalesY: number;
  swing: number;
  /** Gavel lift in radians: 0 is resting on the block. */
  gavel: number;
  /** -1 before the strike, then 0..1 as the shockwave travels. */
  shock: number;
  impact: number;
  flash: number;
  aberration: number;
  fade: number;
}

/** Camera path: keys (time, position, target), joined with a Catmull-Rom spline. */
const KEYS: { t: number; pos: Vec3; target: Vec3 }[] = [
  { t: 0.0, pos: [0, 17, 7.5], target: [0, 0, -2] },
  { t: 0.6, pos: [0.6, 15.5, 7.8], target: [0, 0, -2.5] },
  { t: 1.25, pos: [6.8, 7.5, 7.5], target: [0, 0.6, -4] },
  { t: 1.85, pos: [3.6, 3.0, 4.6], target: [0, 1.8, -7.5] },
  // From inside the dock: the accused's own view up at the bench.
  { t: 2.45, pos: [0.6, 2.45, 1.3], target: [0, 2.9, -9.5] },
  { t: 2.9, pos: [0.35, 2.4, -0.15], target: [0.4, 3.1, -9.5] },
  { t: COURT_DURATION, pos: [0.25, 2.55, 0.9], target: [0.2, 3.05, -9.5] },
];

/** The gavel lifts by itself, slams on the beat, then raps twice more. */
function gavelAngle(t: number): number {
  const B = COURT_BEATS;
  if (t < 2.78) return 1.15 * ease.outCubic(seg(t, B.lift, 2.72));
  if (t <= B.gavel) return 1.15 * (1 - ease.inExpo(seg(t, 2.78, B.gavel)));
  let prev: number = B.gavel;
  for (const r of GAVEL_RAPS) {
    if (t <= r) {
      const top = prev + (r - prev) * 0.55;
      const height = r === GAVEL_RAPS[0] ? 0.5 : 0.42;
      return t < top ? height * ease.outCubic(seg(t, prev + 0.02, top)) : height * (1 - ease.inExpo(seg(t, top, r)));
    }
    prev = r;
  }
  return 0;
}

function catmull(p0: number, p1: number, p2: number, p3: number, u: number) {
  const u2 = u * u;
  const u3 = u2 * u;
  return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
}

function along(t: number, pick: (k: (typeof KEYS)[number]) => Vec3): Vec3 {
  let i = 0;
  while (i < KEYS.length - 2 && t > KEYS[i + 1]!.t) i++;
  const a = KEYS[Math.max(0, i - 1)]!;
  const b = KEYS[i]!;
  const c = KEYS[i + 1]!;
  const d = KEYS[Math.min(KEYS.length - 1, i + 2)]!;
  const u = clamp((t - b.t) / (c.t - b.t));
  const [pa, pb, pc, pd] = [pick(a), pick(b), pick(c), pick(d)];
  return [0, 1, 2].map((j) => catmull(pa[j]!, pb[j]!, pc[j]!, pd[j]!, u)) as Vec3;
}

export function courtShot(time: number): CourtShot {
  const t = clamp(time, 0, COURT_DURATION);
  const B = COURT_BEATS;
  let pos = along(t, (k) => k.pos);
  let target = along(t, (k) => k.target);

  const after = seg(t, B.gavel, 3.7);
  const struck = t >= B.gavel;
  let fov = 55 - (struck ? 8 * Math.exp(-after * 9) : 0);
  const strikeShake = struck ? Math.pow(1 - seg(t, B.gavel, 3.35), 2) : 0;
  // Each heavy piece landing nudges the camera while the court assembles.
  const buildShake = 0.35 * Math.sin(Math.PI * seg(t, 0.9, 2.1));
  const shake = 0.14 * strikeShake + 0.035 * buildShake;
  pos = [pos[0] + Math.sin(t * 97) * shake, pos[1] + Math.cos(t * 89) * shake, pos[2]];
  target = [target[0] + Math.sin(t * 83) * shake * 0.5, target[1] + Math.cos(t * 79) * shake * 0.5, target[2]];
  const roll = 0.06 * Math.sin(Math.PI * seg(t, 0.6, 2.4)) + Math.sin(t * 71) * shake * 0.1;
  fov += 4 * Math.sin(Math.PI * seg(t, 0.5, 1.6));

  const gavel = gavelAngle(t);
  // Each rap jolts the camera a little.
  const rapJolt = GAVEL_RAPS.reduce((s, r) => s + (t >= r ? Math.exp(-(t - r) * 25) : 0), 0);
  pos = [pos[0], pos[1] - 0.03 * rapJolt, pos[2]];

  return {
    cam: { pos, target, fov, roll },
    ink: t < 0.62 ? 0.66 * ease.inOutCubic(seg(t, 0.02, 0.58)) : 99,
    lights: LIGHTS.map((l) => lightLevel(l, t, B.gavel)),
    scalesY: lerp(17, 5.4, ease.outCubic(seg(t, B.scales, 2.35))),
    swing: 0.32 * (t < B.scales ? 1 : ease.swing(seg(t, B.scales, COURT_DURATION), 1.4, 2.6)),
    gavel,
    shock: struck ? seg(t, B.gavel, 3.75) : -1,
    impact: struck && t < B.gavel + 0.065 ? 1 : 0,
    flash: struck && t >= B.gavel + 0.065 ? 0.75 * (1 - ease.outCubic(seg(t, B.gavel + 0.065, 3.15))) : 0,
    aberration: 0.0012 + (struck ? 0.012 * Math.exp(-after * 7) : 0) + 0.003 * Math.sin(Math.PI * seg(t, 0.0, 0.6)),
    fade: seg(t, B.fade, COURT_DURATION),
  };
}
