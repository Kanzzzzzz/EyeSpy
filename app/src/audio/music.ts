import { audioContext } from './sounds';

/**
 * The tension loop: a quiet noir walking bass, brushed hats and the odd
 * vibraphone note, composed in code and synthesised live with Web Audio.
 * Original to EyeSpy; nothing is loaded from disk.
 */

const BPM = 88;
const BEAT = 60 / BPM;
// A minor-ish walk over 4 bars (MIDI notes), with a chromatic approach.
const BASS = [45, 48, 52, 51, 50, 53, 57, 56, 45, 47, 48, 50, 52, 50, 48, 44];
const VIBES: (number | null)[] = [
  69, null, null, 72, null, null, 76, null, 75, null, null, null, 74, null, 72, null,
];

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

let master: GainNode | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let step = 0;
let nextTime = 0;
let noise: AudioBuffer | null = null;

function noiseBuffer(c: AudioContext) {
  if (noise) return noise;
  noise = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noise;
}

function bass(c: AudioContext, out: AudioNode, t: number, note: number) {
  const osc = c.createOscillator();
  const g = c.createGain();
  const lp = c.createBiquadFilter();
  osc.type = 'triangle';
  osc.frequency.value = midi(note);
  lp.type = 'lowpass';
  lp.frequency.value = 600;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + BEAT * 0.9);
  osc.connect(lp).connect(g).connect(out);
  osc.start(t);
  osc.stop(t + BEAT);
}

function hat(c: AudioContext, out: AudioNode, t: number, accent: boolean) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 6000;
  const g = c.createGain();
  g.gain.setValueAtTime(accent ? 0.08 : 0.04, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (accent ? 0.18 : 0.08));
  src.connect(hp).connect(g).connect(out);
  src.start(t);
  src.stop(t + 0.2);
}

function vibe(c: AudioContext, out: AudioNode, t: number, note: number) {
  for (const [mult, level] of [
    [1, 0.18],
    [4, 0.04],
  ] as const) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = midi(note) * mult;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + 1.7);
  }
}

export function startMusic(volume = 0.35) {
  const c = audioContext();
  if (!c || timer) return;
  master = c.createGain();
  master.gain.value = 0;
  master.gain.linearRampToValueAtTime(volume, c.currentTime + 2);
  master.connect(c.destination);
  step = 0;
  nextTime = c.currentTime + 0.1;
  // Schedule a little ahead on a coarse timer (the usual Web Audio pattern).
  timer = setInterval(() => {
    if (!master) return;
    while (nextTime < c.currentTime + 0.3) {
      const i = step % BASS.length;
      bass(c, master, nextTime, BASS[i]!);
      hat(c, master, nextTime, i % 2 === 1);
      hat(c, master, nextTime + BEAT * 0.66, false);
      const v = VIBES[i];
      if (v !== null && v !== undefined && step % 32 < 16) vibe(c, master, nextTime, v);
      nextTime += BEAT;
      step++;
    }
  }, 60);
}

export function stopMusic() {
  const c = audioContext();
  if (timer) clearInterval(timer);
  timer = null;
  if (c && master) {
    const m = master;
    m.gain.cancelScheduledValues(c.currentTime);
    m.gain.setValueAtTime(m.gain.value, c.currentTime);
    m.gain.linearRampToValueAtTime(0, c.currentTime + 0.8);
    setTimeout(() => m.disconnect(), 1000);
  }
  master = null;
}
