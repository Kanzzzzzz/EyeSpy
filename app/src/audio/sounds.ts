import { SAMPLE_RATE, zzfxGenerate, type ZzfxParams } from './zzfx';

/**
 * Every sound effect in the game, as ZzFX parameters. Designed for EyeSpy:
 * short, soft-edged, and readable in a quiet room.
 */
export const SOUNDS = {
  tap: [0.4, 0, 900, 0, 0.01, 0.03, 1, 1.5],
  select: [0.5, 0, 620, 0.005, 0.02, 0.06, 1, 1.2, 0, 0, 240, 0.02],
  wink: [0.7, 0, 520, 0.01, 0.03, 0.12, 0, 1.6, 26, 0, 0, 0, 0, 0, 0, 0, 0.04],
  raise: [0.7, 0, 280, 0.02, 0.06, 0.18, 0, 1, 14, 0, 140, 0.06],
  countdown: [0.5, 0, 880, 0, 0.02, 0.08, 1, 2],
  winked: [0.9, 0, 160, 0.01, 0.12, 0.45, 3, 1.8, -6, 0, 0, 0, 0, 0.4, 4],
  death: [1, 0, 300, 0.02, 0.2, 0.9, 2, 1.4, -9, -0.4, 0, 0, 0, 0.2, 0, 0.1],
  heartbreak: [0.9, 0, 440, 0.01, 0.1, 0.5, 0, 1, -4, 0, -120, 0.12, 0, 0, 6],
  buzz: [0.35, 0, 70, 0, 0.06, 0.06, 3, 1, 0, 0, 0, 0, 0, 0.6],
  sheriffWinked: [0.8, 0, 700, 0.01, 0.08, 0.3, 1, 1, 0, 0, -300, 0.08, 0.16],
  shush: [0.6, 0, 1200, 0.08, 0.25, 0.3, 4, 1, -1, 0, 0, 0, 0, 1],
  tip: [0.8, 0, 660, 0.01, 0.2, 0.6, 1, 1, 0, 0, 330, 0.12, 0, 0, 0, 0, 0.12, 0.6],
  drumroll: [0.6, 0, 90, 0.05, 1.6, 0.2, 3, 1, 0, 0, 0, 0, 0.045, 0.8, 0, 0, 0, 0.8, 0, 0.9],
  stamp: [1, 0, 70, 0, 0.06, 0.4, 3, 1, -2, 0, 0, 0, 0, 0.9, 0, 0.2],
  unlock: [0.7, 0, 500, 0.01, 0.1, 0.3, 0, 1, 0, 0, 250, 0.08, 0.1],
  flip: [0.5, 0, 340, 0.01, 0.04, 0.14, 0, 1, 8, 0, 0, 0, 0, 0.1],
  win: [0.9, 0, 392, 0.02, 0.3, 0.6, 1, 1, 0, 0, 196, 0.1, 0.2, 0, 0, 0, 0.1, 0.8],
  lose: [0.9, 0, 300, 0.02, 0.3, 0.8, 2, 1, -2, 0, -60, 0.2, 0.25],
  error: [0.5, 0, 180, 0, 0.04, 0.1, 2, 1, 0, 0, -40, 0.04],
  join: [0.6, 0, 500, 0.01, 0.04, 0.15, 0, 1, 0, 0, 300, 0.05],
  phew: [0.6, 0, 300, 0.05, 0.2, 0.4, 0, 1, 3, 0, 0, 0, 0, 0.05],
} satisfies Record<string, ZzfxParams>;

export type SoundName = keyof typeof SOUNDS;

let ctx: AudioContext | null = null;
const cache = new Map<SoundName, AudioBuffer>();
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
  }
  return ctx;
}

/** Browsers start audio suspended until a tap. Call from any tap handler. */
export function unlockAudio() {
  const c = audioContext();
  if (c?.state === 'suspended') void c.resume();
}

function buffer(name: SoundName): AudioBuffer | null {
  const c = audioContext();
  if (!c) return null;
  let b = cache.get(name);
  if (!b) {
    const samples = zzfxGenerate(SOUNDS[name]);
    b = c.createBuffer(1, Math.max(1, samples.length), SAMPLE_RATE);
    b.getChannelData(0).set(samples);
    cache.set(name, b);
  }
  return b;
}

/** Render every sound up front (in the lobby) so nothing stutters later. */
export function preloadSounds() {
  for (const name of Object.keys(SOUNDS) as SoundName[]) buffer(name);
}

export function play(name: SoundName) {
  if (!enabled) return;
  const c = audioContext();
  const b = buffer(name);
  if (!c || !b) return;
  const src = c.createBufferSource();
  src.buffer = b;
  src.connect(c.destination);
  src.start();
}
