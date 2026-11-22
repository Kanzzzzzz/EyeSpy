import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  SPECIAL_ROLE_IDS,
  type GameState,
  type RoleCounts,
  type Settings,
  type SpecialRoleId,
} from './types';

export const DEFAULT_SETTINGS: Settings = {
  roles: { killer: 1, sheriff: 1, shush: 1, snitch: 1, loverPairs: 0 },
  autoRoles: true,
  special: Object.fromEntries(SPECIAL_ROLE_IDS.map((id) => [id, false])) as Record<SpecialRoleId, boolean>,
  deathDelayMs: 3000,
  winkCooldownMs: 15000,
  raiseCooldownMs: 10000,
  victimsSeeKiller: true,
  revealTimeoutMs: 30000,
  arrestVerdictMs: 4500,
  raisesToUnlock: 3,
  shushLockKills: 2,
};

/** Limits the host can set each number within. */
export const SETTING_LIMITS = {
  deathDelayMs: [1000, 10000],
  winkCooldownMs: [0, 120000],
  raiseCooldownMs: [0, 60000],
  revealTimeoutMs: [5000, 120000],
  arrestVerdictMs: [1500, 15000],
  raisesToUnlock: [1, 10],
  shushLockKills: [1, 5],
} as const;

/** The suggested role mix for a player count, from the design doc. */
export function suggestRoles(players: number): RoleCounts {
  if (players <= 6) return { killer: 1, sheriff: 1, shush: 1, snitch: 1, loverPairs: 0 };
  if (players <= 9) return { killer: 1, sheriff: 1, shush: 1, snitch: 1, loverPairs: 1 };
  if (players <= 14) return { killer: 2, sheriff: 2, shush: 1, snitch: 1, loverPairs: 1 };
  return { killer: 3, sheriff: 3, shush: 1, snitch: 1, loverPairs: 1 };
}

export function enabledSpecialRoles(settings: Settings): SpecialRoleId[] {
  return SPECIAL_ROLE_IDS.filter((id) => settings.special[id]);
}

export interface MixCheck {
  ok: boolean;
  citizens: number;
  problem?: string;
}

/** Validate a role mix for a player count. */
export function checkRoleMix(settings: Settings, players: number): MixCheck {
  const r = settings.roles;
  const special = enabledSpecialRoles(settings).length;
  const dealt = r.killer + r.sheriff + r.shush + r.snitch + r.loverPairs * 2 + special;
  const citizens = players - dealt;
  if (players < MIN_PLAYERS) return { ok: false, citizens, problem: `Needs at least ${MIN_PLAYERS} players.` };
  if (players > MAX_PLAYERS) return { ok: false, citizens, problem: `At most ${MAX_PLAYERS} players.` };
  if (r.killer < 1) return { ok: false, citizens, problem: 'Needs at least one Killer.' };
  if (r.sheriff < 1) return { ok: false, citizens, problem: 'Needs at least one Sheriff.' };
  if (citizens < 0) return { ok: false, citizens, problem: 'More roles than players. Remove a role.' };
  if (players - r.killer - r.sheriff < 2) {
    return { ok: false, citizens, problem: 'Too many Killers and Sheriffs: the Killers would win at once.' };
  }
  return { ok: true, citizens };
}

export function createGame(seed: number, now = 0): GameState {
  return {
    version: 1,
    phase: 'lobby',
    round: 0,
    hostId: null,
    players: [],
    roles: {},
    settings: structuredClone(DEFAULT_SETTINGS),
    rng: seed >>> 0 || 1,
    pendingDeaths: [],
    pendingArrest: null,
    revealDeadline: null,
    shushLockKillsRemaining: 0,
    timers: [],
    nextTimerId: 1,
    killCount: 0,
    deathOrder: [],
    extraWinners: [],
    result: null,
    log: [],
    nextSeq: 1,
    startedAt: null,
    now,
  };
}

/** mulberry32: small, fast, seedable. Returns [value in [0,1), next state]. */
export function nextRandom(rngState: number): [number, number] {
  let t = (rngState + 0x6d2b79f5) >>> 0;
  const next = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

/**
 * Push every pending deadline back by `ms`. Used when a crashed host comes
 * back, so a 3-second countdown doesn't expire while the host was down.
 */
export function shiftTime(state: GameState, ms: number, now: number): GameState {
  const s = structuredClone(state);
  if (ms > 0) {
    for (const d of s.pendingDeaths) d.at += ms;
    for (const t of s.timers) t.at += ms;
    if (s.revealDeadline !== null) s.revealDeadline += ms;
    if (s.pendingArrest) {
      s.pendingArrest.startedAt += ms;
      s.pendingArrest.verdictAt += ms;
    }
    for (const rs of Object.values(s.roles)) {
      if (rs.lastWinkAt !== null) rs.lastWinkAt += ms;
      if (rs.lastRaiseAt !== null) rs.lastRaiseAt += ms;
      for (const k of Object.keys(rs.abilityLastUsedAt)) rs.abilityLastUsedAt[k]! += ms;
    }
  }
  s.now = Math.max(s.now, now);
  return s;
}
