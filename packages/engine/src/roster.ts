import type { RoleId } from './types';

/**
 * The secret characters players pick from for their role. Original
 * characters, written for EyeSpy. The app draws them (app/src/art); the host
 * only needs the ids to validate picks and the names for the timeline.
 *
 * A character is never shown to other players while the game is running,
 * since it would give the role away. It appears on the player's own card,
 * in their ability animations, on their victim's screen and at game over.
 */

export type Finisher = 'realm' | 'slash' | 'shadow';

export interface RosterEntry {
  id: string;
  name: string;
  title: string;
  /** Signature move, shown when the role's ability fires. */
  move: string;
  /** Killers only: which kill animation plays on the victim's screen. */
  finisher?: Finisher;
}

const r = (role: RoleId, key: string, name: string, title: string, move: string, finisher?: Finisher): RosterEntry => ({
  id: `${role}.${key}`,
  name,
  title,
  move,
  ...(finisher ? { finisher } : {}),
});

/**
 * For now only two roles have an exclusive character; the others play as
 * their public lobby face. Add a character by adding an entry here and its
 * look in app/src/art/characters.ts.
 */
export const ROSTER: Record<RoleId, RosterEntry[]> = {
  killer: [r('killer', 'shuten', 'Shuten', 'The Cursed Sovereign', 'Realm Unfolded: Thousand-Petal Abattoir', 'realm')],
  judge: [r('judge', 'tenbin', 'Rei Tenbin', 'The Unblinking Magistrate', 'Realm Unfolded: Court of the Unblinking Eye')],
  sheriff: [],
  shush: [],
  snitch: [],
  lover: [],
  citizen: [],
  dramaQueen: [],
  bodyguard: [],
  paparazzi: [],
  copycat: [],
  medium: [],
  decoy: [],
  insomniac: [],
};

const BY_ID = new Map(Object.values(ROSTER).flat().map((c) => [c.id, c]));

export function character(id: string | null | undefined): RosterEntry | null {
  return (id && BY_ID.get(id)) || null;
}

export function isCharacterFor(role: RoleId, id: string): boolean {
  return ROSTER[role].some((c) => c.id === id);
}
