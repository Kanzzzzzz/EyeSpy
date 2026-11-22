import type { RoleId } from '../types';
import type { RoleDefinition } from './types';
import { killer } from './standard/killer';
import { sheriff } from './standard/sheriff';
import { shush } from './standard/shush';
import { snitch } from './standard/snitch';
import { lover } from './standard/lover';
import { citizen } from './standard/citizen';
import { dramaQueen } from './special/dramaQueen';
import { bodyguard } from './special/bodyguard';
import { paparazzi } from './special/paparazzi';
import { copycat } from './special/copycat';
import { medium } from './special/medium';
import { decoy } from './special/decoy';
import { insomniac } from './special/insomniac';

/** Every role, keyed by id. Adding a role = one file + one line here. */
export const ROLES: Record<RoleId, RoleDefinition> = {
  killer,
  sheriff,
  shush,
  snitch,
  lover,
  citizen,
  dramaQueen,
  bodyguard,
  paparazzi,
  copycat,
  medium,
  decoy,
  insomniac,
};

export function getRole(id: RoleId): RoleDefinition {
  const role = ROLES[id];
  if (!role) throw new Error(`Unknown role: ${id}`);
  return role;
}

export type { RoleDefinition, AbilityDefinition, RoleContext, WinkOutcome, WinkAttempt } from './types';
export { MEDIUM_EMOJI } from './special/medium';
