import { SAMPLE_RATE, zzfxGenerate, type ZzfxParams } from './zzfx';

/**
 * Every sound in EyeSpy, synthesised live: short ZzFX blips for UI, and
 * layered Web Audio for the anime moments (the blade "shing", the realm
 * gong, chains, the gavel, the courtroom sting). All original; nothing is
 * loaded from disk.
 */

const ZZFX = {
  tap: [0.35, 0, 760, 0, 0.01, 0.04, 1, 1.6],
  select: [0.45, 0, 620, 0.005, 0.02, 0.06, 1, 1.2, 0, 0, 260, 0.02],
  raise: [0.6, 0, 300, 0.02, 0.05, 0.16, 0, 1, 16, 0, 160, 0.05],
  wink: [0.6, 0, 540, 0.01, 0.03, 0.12, 0, 1.6, 26, 0, 0, 0, 0, 0, 0, 0, 0.04],
  buzz: [0.35, 0, 70, 0, 0.06, 0.06, 3, 1, 0, 0, 0, 0, 0, 0.6],
  error: [0.45, 0, 180, 0, 0.04, 0.1, 2, 1, 0, 0, -40, 0.04],
  join: [0.55, 0, 520, 0.01, 0.04, 0.15, 0, 1, 0, 0, 320, 0.05],
  flip: [0.5, 0, 340, 0.01, 0.04, 0.14, 0, 1, 8, 0, 0, 0, 0, 0.1],
  vote: [0.5, 0, 420, 0, 0.02, 0.08, 1, 1, 0, 0, 220, 0.03],
} satisfies Record<string, ZzfxParams>;

export type SoundName =
  | keyof typeof ZZFX
  | 'impact'
  | 'slash'
  | 'realm'
  | 'shadow'
  | 'eyeContact'
  | 'witness'
  | 'heartbeat'
  | 'winked'
  | 'death'
  | 'heartbreak'
  | 'sheriffWinked'
  | 'shush'
  | 'tip'
  | 'chains'
  | 'drumroll'
  | 'stamp'
  | 'gavel'
  | 'courtSting'
  | 'unlock'
  | 'win'
  | 'lose'
  | 'phew'
  | 'whoosh'
  | 'charge';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
const cache = new Map<string, AudioBuffer>();
let enabled = true;

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

export function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.9;
    // A gentle limiter so stacked effects never clip.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.ratio.value = 6;
    master.connect(comp).connect(ctx.destination);
  }
  return ctx;
}

/** Browsers start audio suspended until a tap. Call from any tap handler. */
export function unlockAudio() {
  const c = audioContext();
  if (c?.state === 'suspended') void c.resume();
}

function out(): AudioNode {
  return master!;
}

function noise(c: AudioContext): AudioBuffer {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

interface ToneOpts {
  type?: OscillatorType;
  freq: number;
  to?: number;
  at?: number;
  dur: number;
  gain?: number;
  attack?: number;
}

function tone(c: AudioContext, o: ToneOpts) {
  const t = c.currentTime + (o.at ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t + o.dur);
  const peak = o.gain ?? 0.3;
  const a = o.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(g).connect(out());
  osc.start(t);
  osc.stop(t + o.dur + 0.05);
}

interface NoiseOpts {
  at?: number;
  dur: number;
  gain?: number;
  attack?: number;
  filter?: BiquadFilterType;
  freq?: number;
  to?: number;
  q?: number;
}

function hiss(c: AudioContext, o: NoiseOpts) {
  const t = c.currentTime + (o.at ?? 0);
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const f = c.createBiquadFilter();
  f.type = o.filter ?? 'bandpass';
  f.frequency.setValueAtTime(o.freq ?? 1000, t);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
  f.Q.value = o.q ?? 1;
  const g = c.createGain();
  const peak = o.gain ?? 0.3;
  const a = o.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(f).connect(g).connect(out());
  src.start(t, Math.random());
  src.stop(t + o.dur + 0.05);
}

function zzfxBuffer(name: keyof typeof ZZFX): AudioBuffer | null {
  const c = audioContext();
  if (!c) return null;
  let b = cache.get(name);
  if (!b) {
    const samples = zzfxGenerate(ZZFX[name]);
    b = c.createBuffer(1, Math.max(1, samples.length), SAMPLE_RATE);
    b.getChannelData(0).set(samples);
    cache.set(name, b);
  }
  return b;
}

const SYNTHS: Record<Exclude<SoundName, keyof typeof ZZFX>, (c: AudioContext) => void> = {
  impact(c) {
    tone(c, { freq: 140, to: 38, dur: 0.38, gain: 0.9 });
    hiss(c, { dur: 0.16, gain: 0.45, filter: 'lowpass', freq: 900 });
  },
  slash(c) {
    // The blade "shing": a bright noise rip plus a ringing edge.
    hiss(c, { dur: 0.14, gain: 0.6, filter: 'highpass', freq: 2500, to: 9000 });
    tone(c, { freq: 2600, to: 3500, dur: 0.32, gain: 0.14 });
    tone(c, { freq: 5300, dur: 0.2, gain: 0.05, at: 0.01 });
    tone(c, { freq: 120, to: 50, dur: 0.22, gain: 0.5, at: 0.05 });
  },
  realm(c) {
    // The realm closes in: a rising swell, then a huge gong.
    hiss(c, { dur: 1.2, gain: 0.32, attack: 1.15, freq: 300, to: 2600, q: 0.7 });
    tone(c, { type: 'sawtooth', freq: 55, to: 110, dur: 1.2, gain: 0.08, attack: 1.1 });
    for (const [f, g] of [
      [55, 0.55],
      [82.4, 0.3],
      [138.6, 0.18],
      [207.7, 0.1],
      [311, 0.06],
    ] as const) {
      tone(c, { freq: f, dur: 3.2, gain: g, at: 1.2, attack: 0.01 });
    }
    hiss(c, { at: 1.2, dur: 0.5, gain: 0.5, filter: 'lowpass', freq: 1200 });
  },
  shadow(c) {
    hiss(c, { dur: 1.6, gain: 0.5, attack: 0.6, filter: 'lowpass', freq: 160 });
    hiss(c, { dur: 1.2, gain: 0.12, attack: 0.4, filter: 'highpass', freq: 5000, at: 0.2 });
    tone(c, { freq: 300, to: 70, dur: 1.4, gain: 0.18, attack: 0.3 });
  },
  eyeContact(c) {
    tone(c, { freq: 1568, dur: 0.35, gain: 0.16 });
    tone(c, { freq: 2349, dur: 0.3, gain: 0.08, at: 0.03 });
  },
  witness(c) {
    hiss(c, { dur: 0.22, gain: 0.3, freq: 500, to: 3200, attack: 0.15 });
    tone(c, { type: 'square', freq: 880, to: 1320, dur: 0.12, gain: 0.08, at: 0.2 });
  },
  heartbeat(c) {
    tone(c, { freq: 62, to: 40, dur: 0.14, gain: 0.9 });
    tone(c, { freq: 58, to: 38, dur: 0.16, gain: 0.7, at: 0.2 });
  },
  winked(c) {
    SYNTHS.impact(c);
    tone(c, { type: 'sawtooth', freq: 98, dur: 0.9, gain: 0.16, at: 0.05, attack: 0.04 });
    tone(c, { type: 'sawtooth', freq: 92.5, dur: 0.9, gain: 0.12, at: 0.05, attack: 0.04 });
  },
  death(c) {
    SYNTHS.impact(c);
    hiss(c, { dur: 1.1, gain: 0.35, filter: 'lowpass', freq: 2000, to: 120, at: 0.05 });
    tone(c, { freq: 440, to: 110, dur: 1.0, gain: 0.12, at: 0.1 });
  },
  heartbreak(c) {
    tone(c, { type: 'triangle', freq: 660, to: 330, dur: 0.6, gain: 0.2 });
    tone(c, { type: 'triangle', freq: 523, to: 262, dur: 0.7, gain: 0.15, at: 0.12 });
  },
  sheriffWinked(c) {
    SYNTHS.witness(c);
    tone(c, { type: 'triangle', freq: 784, dur: 0.25, gain: 0.18, at: 0.3 });
    tone(c, { type: 'triangle', freq: 1047, dur: 0.4, gain: 0.18, at: 0.42 });
  },
  shush(c) {
    hiss(c, { dur: 1.0, gain: 0.38, attack: 0.18, freq: 3400, q: 0.9 });
  },
  tip(c) {
    [1047, 1319, 1568, 2093].forEach((f, i) => tone(c, { freq: f, dur: 0.4, gain: 0.12, at: i * 0.07 }));
  },
  chains(c) {
    for (let i = 0; i < 8; i++) {
      const f = 1700 + Math.random() * 1600;
      tone(c, { type: 'square', freq: f, dur: 0.07, gain: 0.05, at: i * 0.07 + Math.random() * 0.03 });
      hiss(c, { dur: 0.05, gain: 0.08, filter: 'highpass', freq: 4000, at: i * 0.07 });
    }
  },
  drumroll(c) {
    // A taiko roll that speeds up.
    let t = 0;
    for (let i = 0; i < 18; i++) {
      tone(c, { freq: 90 + (i % 2) * 10, to: 45, dur: 0.14, gain: 0.35 + i * 0.02, at: t });
      t += Math.max(0.05, 0.16 - i * 0.007);
    }
  },
  stamp(c) {
    SYNTHS.impact(c);
    hiss(c, { dur: 0.25, gain: 0.4, filter: 'bandpass', freq: 600, at: 0.02 });
  },
  gavel(c) {
    [0, 0.32, 0.64].forEach((at, i) => {
      tone(c, { freq: 240, to: 150, dur: 0.09, gain: i === 2 ? 0.8 : 0.5, at });
      hiss(c, { dur: 0.03, gain: 0.3, filter: 'highpass', freq: 2200, at });
    });
  },
  courtSting(c) {
    const notes: [number, number, number][] = [
      [110, 0, 0.22],
      [103.8, 0.26, 0.22],
      [87.3, 0.52, 1.1],
    ];
    for (const [f, at, dur] of notes) {
      tone(c, { type: 'sawtooth', freq: f, dur, gain: 0.16, at, attack: 0.02 });
      tone(c, { type: 'sawtooth', freq: f * 2.003, dur, gain: 0.06, at, attack: 0.02 });
    }
  },
  unlock(c) {
    tone(c, { type: 'sawtooth', freq: 220, to: 880, dur: 0.35, gain: 0.08 });
    SYNTHS.tip(c);
  },
  win(c) {
    [523, 659, 784, 1047].forEach((f, i) => tone(c, { type: 'triangle', freq: f, dur: 0.22, gain: 0.2, at: i * 0.1 }));
    [523, 659, 784].forEach((f) => tone(c, { type: 'triangle', freq: f * 2, dur: 1.0, gain: 0.1, at: 0.42 }));
  },
  lose(c) {
    [392, 370, 349, 330].forEach((f, i) => tone(c, { type: 'sawtooth', freq: f / 2, dur: 0.4, gain: 0.12, at: i * 0.22 }));
  },
  phew(c) {
    hiss(c, { dur: 0.6, gain: 0.25, attack: 0.08, freq: 1400, to: 500 });
  },
  whoosh(c) {
    hiss(c, { dur: 0.35, gain: 0.3, attack: 0.12, freq: 300, to: 2400 });
  },
  charge(c) {
    tone(c, { type: 'sawtooth', freq: 110, to: 880, dur: 0.6, gain: 0.07, attack: 0.3 });
    hiss(c, { dur: 0.6, gain: 0.15, attack: 0.5, freq: 800, to: 5000 });
  },
};

/** Render the short sounds up front (in the lobby) so nothing stutters later. */
export function preloadSounds() {
  const c = audioContext();
  if (!c) return;
  noise(c);
  for (const name of Object.keys(ZZFX) as (keyof typeof ZZFX)[]) zzfxBuffer(name);
}

export function play(name: SoundName) {
  if (!enabled) return;
  const c = audioContext();
  if (!c || !master) return;
  if (name in ZZFX) {
    const b = zzfxBuffer(name as keyof typeof ZZFX);
    if (!b) return;
    const src = c.createBufferSource();
    src.buffer = b;
    src.connect(master);
    src.start();
    return;
  }
  SYNTHS[name as Exclude<SoundName, keyof typeof ZZFX>](c);
}
