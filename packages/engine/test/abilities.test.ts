import { describe, expect, it } from 'vitest';
import { viewFor } from '../src';
import { ofType, rigged } from './helpers';

// p0 Killer, p1 Sheriff, p2 Shush, p3 Snitch, p4/p5 Lovers, p6..p8 Citizens
const NINE = ['killer', 'sheriff', 'shush', 'snitch', 'lover', 'lover', 'citizen', 'citizen', 'citizen'] as const;

function raiseN(g: ReturnType<typeof rigged>, by: string, n: number, target = 'p8') {
  for (let i = 0; i < n; i++) {
    g.act(by, { type: 'raiseEyebrow', targetId: target });
    g.advance(10_000);
  }
}

describe('eyebrow raises', () => {
  it('show the target who raised, and nobody else', () => {
    const g = rigged([...NINE]);
    const events = g.act('p6', { type: 'raiseEyebrow', targetId: 'p0' });
    const raised = ofType(events, 'EyebrowRaised');
    expect(raised[0]!.event).toEqual({ type: 'EyebrowRaised', byId: 'p6', targetId: 'p0' });
    expect(raised[0]!.to).toEqual(['p0', 'p6']);
  });

  it('are at least 10 seconds apart', () => {
    const g = rigged([...NINE]);
    g.act('p6', { type: 'raiseEyebrow', targetId: 'p0' });
    g.advance(9_999);
    expect(g.try('p6', { type: 'raiseEyebrow', targetId: 'p1' }).error).toBe('cooldown');
    g.advance(1);
    g.act('p6', { type: 'raiseEyebrow', targetId: 'p1' });
  });

  it('cannot target yourself or the dead', () => {
    const g = rigged([...NINE]);
    expect(g.try('p6', { type: 'raiseEyebrow', targetId: 'p6' }).error).toBe('invalidTarget');
    g.act('p0', { type: 'wink', targetId: 'p7' });
    g.advance(3_000);
    expect(g.try('p6', { type: 'raiseEyebrow', targetId: 'p7' }).error).toBe('invalidTarget');
  });

  it('counts raises for everyone, so the counter gives nothing away', () => {
    const g = rigged([...NINE]);
    raiseN(g, 'p6', 2);
    expect(viewFor(g.state, 'p6').me!.raisesSent).toBe(2);
  });
});

describe('Shush', () => {
  it('unlocks after 3 raises', () => {
    const g = rigged([...NINE]);
    expect(g.try('p2', { type: 'useAbility', abilityId: 'shush' }).error).toBe('locked');
    raiseN(g, 'p2', 2);
    expect(viewFor(g.state, 'p2').me!.abilities[0]!.unlocked).toBe(false);
    g.act('p2', { type: 'raiseEyebrow', targetId: 'p8' });
    const unlocked = g.state.log.filter((e) => e.event.type === 'AbilityUnlocked');
    expect(unlocked).toHaveLength(1);
    expect(unlocked[0]!.to).toEqual(['p2']);
    expect(viewFor(g.state, 'p2').me!.abilities[0]!.unlocked).toBe(true);
  });

  it('a Citizen raising 3 times unlocks nothing', () => {
    const g = rigged([...NINE]);
    raiseN(g, 'p6', 3);
    expect(g.state.log.filter((e) => e.event.type === 'AbilityUnlocked')).toHaveLength(0);
  });

  it('locks arrests for 2 more kills, once, without knowing the Sheriff', () => {
    const g = rigged([...NINE], { winkCooldownMs: 0 });
    raiseN(g, 'p2', 3);
    const events = g.act('p2', { type: 'useAbility', abilityId: 'shush' });
    const shushed = ofType(events, 'SheriffShushed');
    expect(shushed[0]!.to).toEqual(['p1', 'p2']);
    expect(viewFor(g.state, 'p1').me!.shushedKillsLeft).toBe(2);
    expect(g.try('p1', { type: 'arrest', targetId: 'p0' }).error).toBe('shushed');
    expect(g.try('p2', { type: 'useAbility', abilityId: 'shush' }).error).toBe('usedUp');

    g.act('p0', { type: 'wink', targetId: 'p6' });
    g.advance(3_000);
    expect(g.try('p1', { type: 'arrest', targetId: 'p0' }).error).toBe('shushed');
    expect(viewFor(g.state, 'p1').me!.shushedKillsLeft).toBe(1);

    g.act('p0', { type: 'wink', targetId: 'p7' });
    const lifted = g.advance(3_000);
    expect(ofType(lifted, 'ShushLifted')[0]!.to).toEqual(['p1']);
    g.act('p1', { type: 'arrest', targetId: 'p0' });
  });

  it('heartbreak deaths do not count toward the lock', () => {
    const g = rigged([...NINE], { winkCooldownMs: 0 });
    raiseN(g, 'p2', 3);
    g.act('p2', { type: 'useAbility', abilityId: 'shush' });
    g.act('p0', { type: 'wink', targetId: 'p4' }); // Lover: partner p5 dies of heartbreak
    g.advance(3_000);
    expect(g.player('p5').alive).toBe(false);
    expect(g.state.shushLockKillsRemaining).toBe(1);
  });
});

describe('Snitch', () => {
  it('after 3 raises, names a suspect on every phone without revealing the Snitch', () => {
    const g = rigged([...NINE]);
    raiseN(g, 'p3', 3);
    const events = g.act('p3', { type: 'useAbility', abilityId: 'tip', targetId: 'p0' });
    const tip = ofType(events, 'SnitchTip');
    expect(tip).toHaveLength(1);
    expect(tip[0]!.to).toBe('all');
    expect(tip[0]!.event).toEqual({ type: 'SnitchTip', suspectId: 'p0' });
    // Nothing public from the tip names the Snitch.
    const publicEvents = events.filter((e) => e.to === 'all');
    expect(JSON.stringify(publicEvents)).not.toContain('"p3"');
    expect(g.try('p3', { type: 'useAbility', abilityId: 'tip', targetId: 'p1' }).error).toBe('usedUp');
  });

  it('needs a living target', () => {
    const g = rigged([...NINE]);
    raiseN(g, 'p3', 3);
    expect(g.try('p3', { type: 'useAbility', abilityId: 'tip' }).error).toBe('invalidTarget');
    expect(g.try('p3', { type: 'useAbility', abilityId: 'tip', targetId: 'p3' }).error).toBe('invalidTarget');
  });
});

describe('Lovers', () => {
  it('when one dies, the other dies of heartbreak', () => {
    const g = rigged([...NINE]);
    g.act('p0', { type: 'wink', targetId: 'p5' });
    const events = g.advance(3_000);
    const died = ofType(events, 'PlayerDied').map((e) => e.event);
    expect(died).toEqual([
      { type: 'PlayerDied', playerId: 'p5', cause: 'wink' },
      { type: 'PlayerDied', playerId: 'p4', cause: 'heartbreak' },
    ]);
  });

  it('a heartbreak can trigger the Killers win', () => {
    // 6 players: K, S, Lover, Lover, Citizen, Citizen. Others = 4.
    const g = rigged(['killer', 'sheriff', 'lover', 'lover', 'citizen', 'citizen'], { winkCooldownMs: 0 });
    g.act('p0', { type: 'wink', targetId: 'p4' });
    g.advance(3_000);
    g.act('p0', { type: 'wink', targetId: 'p2' }); // takes p3 with them: 1 other left
    g.advance(3_000);
    expect(g.state.result).toMatchObject({ winner: 'killers', reason: 'killersOutnumber' });
  });
});
