import { audioContext, playFile, preloadSounds } from './sounds';

/**
 * The tension loop: recorded taiko and kotsudumi (from the bundled sound
 * library) over a low, slowly breathing pad. Sparse on purpose: the room is
 * meant to stay silent.
 */

const BPM = 84;
const STEP = 60 / BPM / 2;
// 16 eighth-note steps: B = big taiko, s = small drum, f = taiko fill, . = rest.
const PATTERN = 'B..s..B.s..sf...';

let bus: GainNode | null = null;
let pad: AudioNode[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let step = 0;
let nextTime = 0;

export function startMusic(volume = 0.35) {
  const c = audioContext();
  if (!c || timer) return;
  void preloadSounds();
  bus = c.createGain();
  bus.gain.value = 0;
  bus.gain.linearRampToValueAtTime(volume, c.currentTime + 2.5);
  bus.connect(c.destination);

  // Pad: two detuned saws on a low D, softened and slowly swelling.
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  const padGain = c.createGain();
  padGain.gain.value = 0.05;
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 0.08;
  lfoGain.gain.value = 0.025;
  lfo.connect(lfoGain).connect(padGain.gain);
  const oscs = [73.4, 73.9, 110].map((f) => {
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.connect(lp);
    o.start();
    return o;
  });
  lfo.start();
  lp.connect(padGain).connect(bus);
  pad = [...oscs, lfo];

  step = 0;
  nextTime = c.currentTime + 0.2;
  timer = setInterval(() => {
    if (!bus) return;
    while (nextTime < c.currentTime + 0.35) {
      const ch = PATTERN[step % PATTERN.length];
      const bar = Math.floor(step / PATTERN.length) % 4;
      if (ch === 'B') playFile('drum-japanese1', { at: nextTime, gain: 0.55, verb: 0.3, out: bus });
      if (ch === 's') playFile('kotsudumi1', { at: nextTime, gain: 0.35, verb: 0.35, out: bus });
      if (ch === 'f' && bar === 3) playFile('drum-japanese2', { at: nextTime, gain: 0.5, verb: 0.3, out: bus });
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
    const nodes = pad;
    b.gain.cancelScheduledValues(c.currentTime);
    b.gain.setValueAtTime(b.gain.value, c.currentTime);
    b.gain.linearRampToValueAtTime(0, c.currentTime + 0.8);
    setTimeout(() => {
      for (const n of nodes) {
        try {
          (n as OscillatorNode).stop();
        } catch {
          /* already stopped */
        }
      }
      b.disconnect();
    }, 1000);
  }
  bus = null;
  pad = [];
}
