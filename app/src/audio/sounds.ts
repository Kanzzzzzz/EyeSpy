/**
 * EyeSpy's sound engine. Recorded sound effects from 効果音ラボ
 * (Soundeffect-Lab, free for use inside games; see CREDITS.md) are bundled in
 * public/sfx and layered into cues: pitch shifts, a sub-bass boom and a
 * generated reverb turn a sword slash, a temple bell and a magic swell into
 * an anime-scale moment. Files are never hotlinked.
 */

const FILES = [
  'katana-slash5', 'katana-slash2', 'sword-slash1', 'super-arts-hit1', 'blow3', 'bomb2',
  'magic-attack-darkness1', 'magic-charge1', 'aura2', 'magic-circle1', 'highspeed-movement1', 'magic-wind1',
  'temple-bell1', 'solemnity1', 'jajean1', 'shock5', 'text-impact1', 'hyoushigi1', 'heart2',
  'eye-shine1', 'eye-shine2', 'shakin3', 'drum-japanese1', 'drum-japanese2', 'doon1', 'kotsudumi1', 'door-wood-knock1',
] as const;
type File = (typeof FILES)[number];

interface Layer {
  file?: File;
  /** A synthesised sub-bass drop instead of a file. */
  sub?: { from: number; to: number; dur: number };
  at?: number;
  gain?: number;
  rate?: number;
  /** Reverb send, 0..1. */
  verb?: number;
  reverse?: boolean;
  /** Start offset into the file, seconds. */
  offset?: number;
  dur?: number;
}

const CUES = {
  tap: [{ file: 'hyoushigi1', gain: 0.18, rate: 1.6 }],
  select: [{ file: 'shakin3', gain: 0.22, rate: 1.5, dur: 0.4 }],
  whoosh: [{ file: 'highspeed-movement1', gain: 0.45 }],
  flip: [{ file: 'highspeed-movement1', gain: 0.35, rate: 1.3 }],
  join: [{ file: 'kotsudumi1', gain: 0.5, verb: 0.3 }],
  vote: [{ file: 'hyoushigi1', gain: 0.6, verb: 0.35 }],
  error: [{ file: 'kotsudumi1', gain: 0.35, rate: 0.7 }],
  buzz: [{ sub: { from: 70, to: 55, dur: 0.12 }, gain: 0.35 }],
  eyeContact: [{ file: 'eye-shine1', gain: 0.55, verb: 0.25 }],
  wink: [{ file: 'eye-shine2', gain: 0.6, verb: 0.2 }],
  raise: [{ file: 'eye-shine1', gain: 0.45, rate: 0.8, verb: 0.2 }],
  witness: [{ file: 'text-impact1', gain: 0.8, verb: 0.3 }],
  heartbeat: [{ file: 'heart2', gain: 0.9 }],
  impact: [{ file: 'blow3', gain: 0.9, verb: 0.3 }, { sub: { from: 110, to: 38, dur: 0.5 }, gain: 0.7 }],
  slash: [{ file: 'katana-slash5', gain: 1, verb: 0.35 }, { sub: { from: 140, to: 45, dur: 0.3 }, gain: 0.45, at: 0.03 }],
  winked: [
    { file: 'text-impact1', gain: 0.9, verb: 0.35 },
    { file: 'heart2', gain: 0.8, at: 0.25 },
    { sub: { from: 90, to: 40, dur: 0.8 }, gain: 0.6 },
  ],
  death: [
    { file: 'super-arts-hit1', gain: 1, verb: 0.5 },
    { file: 'bomb2', gain: 0.6, rate: 0.7, verb: 0.4, at: 0.05 },
    { sub: { from: 80, to: 30, dur: 1.4 }, gain: 0.8 },
  ],
  heartbreak: [{ file: 'shock5', gain: 0.6, rate: 1.1, verb: 0.3 }],
  sheriffWinked: [{ file: 'eye-shine2', gain: 0.7, verb: 0.3 }, { file: 'jajean1', gain: 0.6, at: 0.25, verb: 0.3 }],
  shush: [{ file: 'magic-wind1', gain: 0.7, rate: 0.55, verb: 0.6 }, { file: 'solemnity1', gain: 0.25, rate: 1.4, at: 0.2, verb: 0.5 }],
  tip: [{ file: 'shakin3', gain: 0.8, verb: 0.35 }],
  chains: [
    { file: 'sword-slash1', gain: 0.45, rate: 1.9, verb: 0.3 },
    { file: 'eye-shine2', gain: 0.35, rate: 1.4, at: 0.12 },
    { file: 'sword-slash1', gain: 0.4, rate: 2.2, at: 0.25, verb: 0.3 },
  ],
  drumroll: [{ file: 'drum-japanese2', gain: 0.9, verb: 0.35 }, { file: 'doon1', gain: 0.8, at: 1.1, verb: 0.4 }],
  stamp: [{ file: 'drum-japanese1', gain: 0.9, verb: 0.35 }, { file: 'blow3', gain: 0.6 }],
  gavel: [
    { file: 'door-wood-knock1', gain: 0.9, rate: 0.8, verb: 0.55 },
    { file: 'hyoushigi1', gain: 0.8, at: 0.5, verb: 0.6 },
    { sub: { from: 90, to: 50, dur: 0.4 }, gain: 0.5, at: 0.5 },
  ],
  courtSting: [{ file: 'solemnity1', gain: 0.9, verb: 0.6 }, { file: 'drum-japanese1', gain: 0.7, at: 0.05, verb: 0.4 }],
  unlock: [{ file: 'magic-charge1', gain: 0.7, verb: 0.3 }],
  charge: [{ file: 'magic-charge1', gain: 0.6, verb: 0.3 }],
  win: [{ file: 'jajean1', gain: 0.9, verb: 0.35 }, { file: 'doon1', gain: 0.6, verb: 0.4 }],
  lose: [{ file: 'shock5', gain: 0.9, verb: 0.4 }],
  phew: [{ file: 'highspeed-movement1', gain: 0.35, rate: 0.7, verb: 0.3 }],
  // The two exclusive finishers (timed to their motion graphics).
  realm: [
    { file: 'magic-circle1', gain: 0.8, verb: 0.6 },
    { file: 'aura2', gain: 0.7, rate: 0.8, verb: 0.6, at: 0.2 },
    { file: 'temple-bell1', gain: 1, rate: 0.85, verb: 0.75, at: 1.2 },
    { file: 'bomb2', gain: 0.8, rate: 0.75, verb: 0.6, at: 1.2 },
    { sub: { from: 70, to: 28, dur: 2.4 }, gain: 0.9, at: 1.2 },
  ],
  realmCuts: [
    { file: 'katana-slash5', gain: 0.9, verb: 0.4 },
    { file: 'katana-slash2', gain: 0.8, verb: 0.4, at: 0.09, rate: 1.1 },
    { file: 'sword-slash1', gain: 0.7, verb: 0.4, at: 0.18, rate: 0.9 },
    { file: 'katana-slash5', gain: 0.8, verb: 0.4, at: 0.27, rate: 1.2 },
    { file: 'katana-slash2', gain: 0.7, verb: 0.4, at: 0.36 },
    { file: 'super-arts-hit1', gain: 1, verb: 0.6, at: 0.62 },
    { sub: { from: 100, to: 30, dur: 1.2 }, gain: 0.9, at: 0.62 },
  ],
  court: [
    { file: 'magic-attack-darkness1', gain: 0.6, rate: 0.85, verb: 0.6 },
    { file: 'solemnity1', gain: 1, verb: 0.75, at: 1.0 },
    { file: 'door-wood-knock1', gain: 1, rate: 0.75, verb: 0.7, at: 1.9 },
    { sub: { from: 80, to: 40, dur: 0.6 }, gain: 0.6, at: 1.9 },
  ],
  verdict: [{ file: 'text-impact1', gain: 1, verb: 0.5 }, { file: 'drum-japanese1', gain: 1, verb: 0.5 }, { sub: { from: 100, to: 35, dur: 0.9 }, gain: 0.8 }],
  shadow: [{ file: 'magic-attack-darkness1', gain: 0.9, verb: 0.5 }],
} satisfies Record<string, Layer[]>;

export type SoundName = keyof typeof CUES;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let verbIn: GainNode | null = null;
let enabled = true;
const buffers = new Map<File, AudioBuffer>();
const reversed = new Map<File, AudioBuffer>();
let loading: Promise<void> | null = null;

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

export function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 5;
    comp.connect(ctx.destination);
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(comp);
    // A generated hall: a few seconds of decaying stereo noise as the impulse response.
    const conv = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 2.8);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    conv.buffer = ir;
    verbIn = ctx.createGain();
    verbIn.gain.value = 0.55;
    verbIn.connect(conv).connect(master);
  }
  return ctx;
}

/** Browsers start audio suspended until a tap. Call from any tap handler. */
export function unlockAudio() {
  const c = audioContext();
  if (c?.state === 'suspended') void c.resume();
  void preloadSounds();
}

/** Load and decode every recording once (small: about 1.4 MB). */
export function preloadSounds(): Promise<void> {
  const c = audioContext();
  if (!c) return Promise.resolve();
  if (!loading) {
    loading = Promise.all(
      FILES.map(async (f) => {
        try {
          const res = await fetch(`./sfx/${f}.mp3`);
          const buf = await c.decodeAudioData(await res.arrayBuffer());
          buffers.set(f, buf);
        } catch {
          /* missing file: that layer stays silent */
        }
      }),
    ).then(() => undefined);
  }
  return loading;
}

function reversedOf(f: File, b: AudioBuffer): AudioBuffer {
  let r = reversed.get(f);
  if (!r && ctx) {
    r = ctx.createBuffer(b.numberOfChannels, b.length, b.sampleRate);
    for (let ch = 0; ch < b.numberOfChannels; ch++) {
      const src = b.getChannelData(ch);
      const dst = r.getChannelData(ch);
      for (let i = 0; i < src.length; i++) dst[i] = src[src.length - 1 - i]!;
    }
    reversed.set(f, r);
  }
  return r!;
}

function playLayer(c: AudioContext, l: Layer) {
  const t = c.currentTime + (l.at ?? 0);
  const g = c.createGain();
  g.gain.value = l.gain ?? 1;
  g.connect(master!);
  if (l.verb && verbIn) {
    const send = c.createGain();
    send.gain.value = l.verb;
    g.connect(send).connect(verbIn);
  }
  if (l.sub) {
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.frequency.setValueAtTime(l.sub.from, t);
    osc.frequency.exponentialRampToValueAtTime(l.sub.to, t + l.sub.dur);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(1, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t + l.sub.dur);
    osc.connect(env).connect(g);
    osc.start(t);
    osc.stop(t + l.sub.dur + 0.05);
    return;
  }
  const b = l.file && buffers.get(l.file);
  if (!b || !l.file) return;
  const src = c.createBufferSource();
  src.buffer = l.reverse ? reversedOf(l.file, b) : b;
  src.playbackRate.value = l.rate ?? 1;
  src.connect(g);
  src.start(t, l.offset ?? 0, l.dur);
}

export function play(name: SoundName) {
  if (!enabled) return;
  const c = audioContext();
  if (!c || !master) return;
  if (buffers.size === 0) void preloadSounds();
  for (const l of CUES[name] as Layer[]) playLayer(c, l);
}

/** Play one recording on its own (used by the music loop). */
export function playFile(file: File, opts: { at?: number; gain?: number; rate?: number; verb?: number; out?: AudioNode } = {}) {
  const c = audioContext();
  const b = buffers.get(file);
  if (!c || !b || !master) return;
  const g = c.createGain();
  g.gain.value = opts.gain ?? 1;
  g.connect(opts.out ?? master);
  if (opts.verb && verbIn) {
    const send = c.createGain();
    send.gain.value = opts.verb;
    g.connect(send).connect(verbIn);
  }
  const src = c.createBufferSource();
  src.buffer = b;
  src.playbackRate.value = opts.rate ?? 1;
  src.connect(g);
  src.start(opts.at ?? c.currentTime);
}
