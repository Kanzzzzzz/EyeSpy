import { audioContext } from './sounds';

/**
 * The tension loop: taiko drums, a koto-style pluck in the Japanese "in"
 * scale, and a low drone, composed in code and synthesised live with Web
 * Audio. Original to EyeSpy; nothing is loaded from disk.
 */

const BPM = 96;
const STEP = 60 / BPM / 2; // eighth notes
// Taiko: big hits (2), small hits (1), rests (0), 16 steps.
const TAIKO = [2, 0, 0, 1, 0, 0, 2, 0, 1, 0, 0, 1, 0, 2, 1, 0];
// Pluck melody (MIDI), "in" scale on D: D Eb G A Bb.
const KOTO: (number | null)[] = [74, null, 70, null, 69, null, null, 67, null, 63, null, 62, null, null, 63, null];
const KOTO_B: (number | null)[] = [null, null, 74, null, 75, null, 74, null, 70, null, 69, null, null, null, null, null];

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

let bus: GainNode | null = null;
let drone: OscillatorNode[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let step = 0;
let nextTime = 0;

function taiko(c: AudioContext, out: AudioNode, t: number, big: boolean) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(big ? 110 : 160, t);
  osc.frequency.exponentialRampToValueAtTime(big ? 45 : 70, t + 0.25);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(big ? 0.8 : 0.35, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (big ? 0.5 : 0.25));
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + 0.6);
}

function shaker(c: AudioContext, out: AudioNode, t: number, accent: boolean) {
  const len = 0.06;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * len), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  const g = c.createGain();
  g.gain.value = accent ? 0.06 : 0.03;
  src.connect(hp).connect(g).connect(out);
  src.start(t);
}

function koto(c: AudioContext, out: AudioNode, t: number, note: number) {
  for (const [mult, level] of [
    [1, 0.16],
    [2, 0.05],
    [3, 0.025],
  ] as const) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'triangle';
    const f = midi(note) * mult;
    osc.frequency.setValueAtTime(f * 1.02, t);
    osc.frequency.exponentialRampToValueAtTime(f, t + 0.04);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + 1.3);
  }
}

export function startMusic(volume = 0.35) {
  const c = audioContext();
  if (!c || timer) return;
  bus = c.createGain();
  bus.gain.value = 0;
  bus.gain.linearRampToValueAtTime(volume, c.currentTime + 2);
  bus.connect(c.destination);

  // Drone: a low D and its fifth, slowly breathing.
  const droneGain = c.createGain();
  droneGain.gain.value = 0.06;
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 0.15;
  lfoGain.gain.value = 0.03;
  lfo.connect(lfoGain).connect(droneGain.gain);
  drone = [38, 45].map((n) => {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = midi(n);
    o.connect(droneGain);
    o.start();
    return o;
  });
  lfo.start();
  drone.push(lfo);
  droneGain.connect(bus);

  step = 0;
  nextTime = c.currentTime + 0.1;
  timer = setInterval(() => {
    if (!bus) return;
    while (nextTime < c.currentTime + 0.3) {
      const i = step % 16;
      const bar = Math.floor(step / 16) % 4;
      const hit = TAIKO[i]!;
      if (hit) taiko(c, bus, nextTime, hit === 2);
      shaker(c, bus, nextTime, i % 4 === 2);
      const melody = bar === 3 ? KOTO_B : KOTO;
      const note = melody[i];
      if (note !== null && note !== undefined && bar !== 0) koto(c, bus, nextTime, note);
      nextTime += STEP;
      step++;
    }
  }, 60);
}

export function stopMusic() {
  const c = audioContext();
  if (timer) clearInterval(timer);
  timer = null;
  if (c && bus) {
    const b = bus;
    const ds = drone;
    b.gain.cancelScheduledValues(c.currentTime);
    b.gain.setValueAtTime(b.gain.value, c.currentTime);
    b.gain.linearRampToValueAtTime(0, c.currentTime + 0.8);
    setTimeout(() => {
      ds.forEach((o) => {
        try {
          o.stop();
        } catch {
          /* already stopped */
        }
      });
      b.disconnect();
    }, 1000);
  }
  bus = null;
  drone = [];
}
