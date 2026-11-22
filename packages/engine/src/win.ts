import { getRole } from './roles';
import type { GameState, WinReason } from './types';

export interface WinCheck {
  winner: 'town' | 'killers';
  reason: WinReason;
}

export function isKillerRole(state: GameState, playerId: string): boolean {
  const rs = state.roles[playerId];
  return !!rs && !!getRole(rs.role).isKiller;
}

export function isSheriffRole(state: GameState, playerId: string): boolean {
  const rs = state.roles[playerId];
  return !!rs && !!getRole(rs.role).isSheriff;
}

/**
 * Checks the win conditions that can be true at any moment of play.
 * (A wrong arrest is handled where the arrest resolves.)
 *
 * - Town wins when no Killer is left free (arrested or voted out).
 * - Killers win when only the Sheriffs, the Killers and at most one other
 *   player are alive (with one Killer and one Sheriff: 3 players left).
 */
export function checkWin(state: GameState): WinCheck | null {
  const alive = state.players.filter((p) => p.alive);
  const killers = alive.filter((p) => isKillerRole(state, p.id));
  if (killers.length === 0) return { winner: 'town', reason: 'allKillersCaught' };
  const others = alive.filter((p) => !isKillerRole(state, p.id) && !isSheriffRole(state, p.id));
  if (others.length <= 1) return { winner: 'killers', reason: 'killersOutnumber' };
  return null;
}
