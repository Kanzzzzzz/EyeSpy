import { describe, expect, it } from 'vitest';
import { adminLiftShush, adminRoles, adminSetRole, adminUnlock, viewFor } from '../src';
import { rigged } from './helpers';

const NINE = ['killer', 'sheriff', 'shush', 'snitch', 'judge', 'lover', 'lover', 'citizen', 'citizen'] as const;

describe('admin test tools', () => {
  it('swap roles with whoever holds the wanted role, keeping the mix', () => {
    const g = rigged([...NINE]);
    const s = adminSetRole(g.state, 'p7', 'killer');
    expect(s.roles.p7!.role).toBe('killer');
    expect(s.roles.p0!.role).toBe('citizen');
    expect(Object.values(adminRoles(s)).sort()).toEqual(Object.values(adminRoles(g.state)).sort());
    expect(g.state.roles.p7!.role).toBe('citizen'); // input untouched
  });

  it('become a role nobody holds (special roles included)', () => {
    const g = rigged([...NINE]);
    const s = adminSetRole(g.state, 'p7', 'medium');
    expect(s.roles.p7!.role).toBe('medium');
    expect(viewFor(s, 'p7').me!.roleName).toBe('Medium');
  });

  it('keeps Lovers paired after a swap', () => {
    const g = rigged([...NINE]);
    const s = adminSetRole(g.state, 'p7', 'lover');
    const partner = s.roles.p7!.data.partnerId as string;
    expect(s.roles[partner]!.role).toBe('lover');
    expect(s.roles[partner]!.data.partnerId).toBe('p7');
  });

  it('updates what Killers know', () => {
    const g = rigged([...NINE]);
    const s = adminSetRole(g.state, 'p8', 'killer');
    expect(s.roles.p8!.knows).toEqual([]);
    const two = adminSetRole(adminSetRole(g.state, 'p8', 'decoy'), 'p8', 'killer');
    expect(two.roles.p8!.role).toBe('killer');
  });

  it('unlocks abilities and clears cooldowns; lifts the Shush lock', () => {
    const g = rigged([...NINE]);
    let s = adminUnlock(g.state, 'p4');
    expect(viewFor(s, 'p4').me!.abilities[0]!.unlocked).toBe(true);
    s = { ...s, shushLockKillsRemaining: 2 };
    expect(adminLiftShush(s).shushLockKillsRemaining).toBe(0);
  });
});
