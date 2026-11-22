import { describe, expect, it } from 'vitest';
import { viewFor } from '../src';
import { rigged } from './helpers';

const SEVEN = ['killer', 'sheriff', 'shush', 'snitch', 'citizen', 'citizen', 'citizen'] as const;

describe('gaze lock', () => {
  it('holds you on a panel for 1.5 s by default before you can look elsewhere', () => {
    const g = rigged([...SEVEN], { lookLockMs: 1500 });
    g.look('p4', 'p0');
    expect(viewFor(g.state, 'p4').me!.lookLockedUntil).toBe(g.t + 1500);
    g.t += 1000;
    const r = g.try('p4', { type: 'look', targetId: 'p1' });
    expect(r.error).toBe('cooldown');
    expect(g.try('p4', { type: 'look', targetId: null }).error).toBe('cooldown');
    g.t += 500;
    g.look('p4', 'p1');
    expect(viewFor(g.state, 'p4').me!.lookingAt).toBe('p1');
  });

  it('the first look is always free, and so is looking again after looking away', () => {
    const g = rigged([...SEVEN], { lookLockMs: 1500 });
    g.look('p4', 'p0');
    g.t += 1500;
    g.look('p4', null);
    expect(viewFor(g.state, 'p4').me!.lookLockedUntil).toBeNull();
    g.look('p4', 'p2');
  });

  it('gives eye contact time to be acted on: the target cannot dart away mid-wink', () => {
    const g = rigged([...SEVEN], { lookLockMs: 1500 });
    g.look('p4', 'p0');
    g.look('p0', 'p4');
    g.t += 800;
    expect(g.try('p4', { type: 'look', targetId: 'p5' }).error).toBe('cooldown');
    g.act('p0', { type: 'wink', targetId: 'p4' });
    expect(g.player('p4').dying).toBe(true);
  });

  it('ghosts look freely', () => {
    const g = rigged([...SEVEN], { lookLockMs: 1500, winkCooldownMs: 0 });
    g.wink('p0', 'p5');
    g.advance(3000);
    g.look('p5', 'p1');
    g.look('p5', 'p2');
  });

  it('is a host setting from 0 to 5 s', () => {
    const g = rigged([...SEVEN]);
    expect(g.state.settings.lookLockMs).toBe(0);
    const fresh = rigged([...SEVEN], { lookLockMs: 99999 });
    expect(fresh.state.settings.lookLockMs).toBe(5000);
  });
});
