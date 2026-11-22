import { getRole } from './roles';
import { ROSTER } from './roster';
import type { GameState, PlayerId, RoleId, RoleState } from './types';

/**
 * Test-mode tools for the host. These bypass the rules on purpose, so they
 * are never reachable through the protocol: only the host's own app calls
 * them, on its own Room, when admin test tools are switched on.
 * Each returns a new state and leaves the input untouched.
 */

function freshRole(role: RoleId): RoleState {
  return {
    role,
    team: getRole(role).team,
    character: ROSTER[role][0]?.id ?? null,
    knows: [],
    raisesSent: 0,
    winksSent: 0,
    lastWinkAt: null,
    lastRaiseAt: null,
    abilityUses: {},
    abilityLastUsedAt: {},
    data: {},
  };
}

/** Recompute what Killers know and repair Lover pairs after roles move around. */
function tidy(s: GameState): void {
  const killers = Object.keys(s.roles).filter((id) => s.roles[id]!.role === 'killer');
  for (const [id, rs] of Object.entries(s.roles)) {
    rs.knows = rs.role === 'killer' ? killers.filter((k) => k !== id) : [];
    if (rs.role !== 'lover') delete rs.data.partnerId;
  }
  const lovers = Object.keys(s.roles).filter((id) => s.roles[id]!.role === 'lover');
  const unpaired = lovers.filter((id) => {
    const p = s.roles[id]!.data.partnerId as string | undefined;
    return !p || s.roles[p]?.role !== 'lover' || s.roles[p]?.data.partnerId !== id;
  });
  for (const id of unpaired) delete s.roles[id]!.data.partnerId;
  for (let i = 0; i + 1 < unpaired.length; i += 2) {
    s.roles[unpaired[i]!]!.data.partnerId = unpaired[i + 1];
    s.roles[unpaired[i + 1]!]!.data.partnerId = unpaired[i];
  }
}

/**
 * Give a player a role. If someone else holds that role, the two swap, so
 * the role mix stays the same. Otherwise the player simply becomes it.
 */
export function adminSetRole(state: GameState, playerId: PlayerId, role: RoleId): GameState {
  const s = structuredClone(state);
  const mine = s.roles[playerId];
  if (!mine || mine.role === role) return state;
  const holder = Object.keys(s.roles).find((id) => id !== playerId && s.roles[id]!.role === role && s.players.find((p) => p.id === id)?.alive);
  if (holder) {
    const theirs = s.roles[holder]!;
    s.roles[playerId] = { ...freshRole(role), character: theirs.character };
    s.roles[holder] = { ...freshRole(mine.role), character: mine.character };
  } else {
    s.roles[playerId] = freshRole(role);
  }
  tidy(s);
  return s;
}

/** Unlock a player's raise-gated abilities and clear every cooldown and use. */
export function adminUnlock(state: GameState, playerId: PlayerId): GameState {
  const s = structuredClone(state);
  const rs = s.roles[playerId];
  if (!rs) return state;
  rs.raisesSent = Math.max(rs.raisesSent, s.settings.raisesToUnlock);
  rs.lastWinkAt = null;
  rs.lastRaiseAt = null;
  rs.abilityUses = {};
  rs.abilityLastUsedAt = {};
  return s;
}

/** Release players from their gaze lock (so a staged look can happen right away). */
export function adminFreeGaze(state: GameState, ids: PlayerId[]): GameState {
  const s = structuredClone(state);
  for (const p of s.players) if (ids.includes(p.id)) p.lookedAt = null;
  return s;
}

/** Lift the Shush lock (so the Sheriff can arrest right away). */
export function adminLiftShush(state: GameState): GameState {
  if (state.shushLockKillsRemaining === 0) return state;
  return { ...state, shushLockKillsRemaining: 0 };
}

/** Every player's role, for the host's test view. */
export function adminRoles(state: GameState): Record<PlayerId, RoleId> {
  return Object.fromEntries(Object.entries(state.roles).map(([id, rs]) => [id, rs.role]));
}
