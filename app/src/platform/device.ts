import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { KeepAwake } from '@capacitor-community/keep-awake';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform() as 'android' | 'ios' | 'web';
export const APP_VERSION = '0.1.0';

// ---------------------------------------------------------------------------
// Preferences (Capacitor Preferences falls back to localStorage on the web)
// ---------------------------------------------------------------------------

export async function loadJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const { value } = await Preferences.get({ key });
    return value ? ({ ...fallback, ...JSON.parse(value) } as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function saveJson(key: string, value: unknown): Promise<void> {
  try {
    await Preferences.set({ key, value: JSON.stringify(value) });
  } catch {
    /* storage can be unavailable in private browsing */
  }
}

// ---------------------------------------------------------------------------
// Haptics: each alert has its own pattern so you can feel it without looking.
// ---------------------------------------------------------------------------

export type HapticPattern = number[];

export const HAPTICS = {
  tick: [12],
  tap: [8],
  raise: [30, 70, 30],
  winked: [500],
  countdown: [40],
  sheriffWinked: [70, 60, 70, 60, 220],
  shushed: [220, 120, 220],
  tip: [40, 50, 40, 50, 40],
  death: [700],
  arrest: [90, 60, 90, 60, 320],
  buzz: [18],
  win: [60, 40, 60, 40, 180],
  error: [25, 40, 25],
  witness: [20, 30, 20, 30, 120],
  eyeContact: [10],
  hearing: [120, 80, 120, 80, 120],
} satisfies Record<string, HapticPattern>;

let hapticsOn = true;
export function setHapticsEnabled(on: boolean) {
  hapticsOn = on;
}

/** Patterns alternate vibrate/pause in ms, like navigator.vibrate. */
export async function vibrate(pattern: HapticPattern): Promise<void> {
  if (!hapticsOn) return;
  if (platform === 'android' || !isNative) {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
        return;
      } catch {
        /* fall through */
      }
    }
    if (!isNative) return;
  }
  // iOS has no vibration patterns from the web view: play them as impacts.
  for (let i = 0; i < pattern.length; i++) {
    const ms = pattern[i]!;
    if (i % 2 === 0) {
      const style = ms >= 300 ? ImpactStyle.Heavy : ms >= 60 ? ImpactStyle.Medium : ImpactStyle.Light;
      if (ms >= 300) await Haptics.vibrate({ duration: ms }).catch(() => {});
      else await Haptics.impact({ style }).catch(() => {});
    }
    await new Promise((r) => setTimeout(r, ms));
  }
}

// ---------------------------------------------------------------------------
// Keep the screen on during a round.
// ---------------------------------------------------------------------------

let wakeLock: { release(): Promise<void> } | null = null;

export async function keepAwake(on: boolean): Promise<void> {
  try {
    if (isNative) {
      if (on) await KeepAwake.keepAwake();
      else await KeepAwake.allowSleep();
      return;
    }
    const nav = navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } };
    if (on && nav.wakeLock && !wakeLock) wakeLock = await nav.wakeLock.request('screen');
    if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    /* not critical */
  }
}
