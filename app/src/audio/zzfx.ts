/**
 * A TypeScript port of the ZzFX sound generator by Frank Force (MIT licence,
 * https://github.com/KilledByAPixel/ZzFX). Every EyeSpy sound effect is a
 * short list of numbers fed to this function, so all sounds are original
 * and nothing is loaded from disk.
 */

export const SAMPLE_RATE = 44100;

/** [volume, randomness, frequency, attack, sustain, release, shape, shapeCurve,
 *  slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise, modulation,
 *  bitCrush, delay, sustainVolume, decay, tremolo] */
export type ZzfxParams = (number | undefined)[];

/* eslint-disable prefer-const -- ported as-is: only some destructured params are reassigned */
export function zzfxGenerate(params: ZzfxParams, masterVolume = 0.3): Float32Array {
  let [
    volume = 1,
    randomness = 0.05,
    frequency = 220,
    attack = 0,
    sustain = 0,
    release = 0.1,
    shape = 0,
    shapeCurve = 1,
    slide = 0,
    deltaSlide = 0,
    pitchJump = 0,
    pitchJumpTime = 0,
    repeatTime = 0,
    noise = 0,
    modulation = 0,
    bitCrush = 0,
    delay = 0,
    sustainVolume = 1,
    decay = 0,
    tremolo = 0,
  ] = params;

  const R = SAMPLE_RATE;
  const PI2 = Math.PI * 2;
  const sign = (v: number) => (v > 0 ? 1 : -1);
  let startSlide = (slide *= (500 * PI2) / R / R);
  let startFrequency = (frequency *= ((1 + randomness * 2 * Math.random() - randomness) * PI2) / R);
  attack = attack * R + 9;
  decay *= R;
  sustain *= R;
  release *= R;
  delay *= R;
  deltaSlide *= (500 * PI2) / R ** 3;
  modulation *= PI2 / R;
  pitchJump *= PI2 / R;
  pitchJumpTime *= R;
  repeatTime = (repeatTime * R) | 0;

  const length = (attack + decay + sustain + release + delay) | 0;
  const b = new Float32Array(length);
  let t = 0;
  let tm = 0;
  let j = 1;
  let r = 0;
  let c = 0;
  let s = 0;
  const crush = (bitCrush * 100) | 0;

  for (let i = 0; i < length; b[i++] = s) {
    if (!crush || !(++c % crush)) {
      s = shape
        ? shape > 1
          ? shape > 2
            ? shape > 3
              ? Math.sin((t % PI2) ** 3)
              : Math.max(Math.min(Math.tan(t), 1), -1)
            : 1 - (((((2 * t) / PI2) % 2) + 2) % 2)
          : 1 - 4 * Math.abs(Math.round(t / PI2) - t / PI2)
        : Math.sin(t);
      const env =
        i < attack
          ? i / attack
          : i < attack + decay
            ? 1 - ((i - attack) / decay) * (1 - sustainVolume)
            : i < attack + decay + sustain
              ? sustainVolume
              : i < length - delay
                ? ((length - i - delay) / release) * sustainVolume
                : 0;
      s =
        (repeatTime ? 1 - tremolo + tremolo * Math.sin((PI2 * i) / repeatTime) : 1) *
        sign(s) *
        Math.abs(s) ** shapeCurve *
        volume *
        masterVolume *
        env;
      if (delay) s = s / 2 + (delay > i ? 0 : ((i < length - delay ? 1 : (length - i) / delay) * b[(i - delay) | 0]!) / 2);
    }
    const f = (frequency += slide += deltaSlide) * Math.cos(modulation * tm++);
    t += f - f * noise * (1 - (((Math.sin(i) + 1) * 1e9) % 2));
    if (j && ++j > pitchJumpTime) {
      frequency += pitchJump;
      startFrequency += pitchJump;
      j = 0;
    }
    if (repeatTime && !(++r % repeatTime)) {
      frequency = startFrequency;
      slide = startSlide;
      j = j || 1;
    }
  }
  return b;
}
/* eslint-enable prefer-const */
