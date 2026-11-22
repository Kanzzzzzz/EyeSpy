import { describe, expect, it } from 'vitest';
import { reduce, viewFor, visibleEvents } from '../src';
import { ofType, rigged } from './helpers';

// p0 Killer, p1 Sheriff, p2 Shush, p3 Snitch, p4..p6 Citizens
const SEVEN = ['killer', 'sheriff', 'shush', 'snitch', 'citizen', 'citizen', 'citizen'] as const;

describe('looking', () => {
  it('opens one panel at a time; looking elsewhere closes the last one', () => {
    const g = rigged([...SEVEN]);
    g.look('p4', 'p0');
    expect(viewFor(g.state, 'p4').me!.lookingAt).toBe('p0');
    g.look('p4', 'p1');
    expect(viewFor(g.state, 'p4').me!.lookingAt).toBe('p1');
    g.look('p4', null);
    expect(viewFor(g.state, 'p4').me!.lookingAt).toBeNull();
  });

  it('cannot look at yourself, or before the round starts', () => {
    const g = rigged([...SEVEN]);
    expect(g.try('p4', { type: 'look', targetId: 'p4' }).error).toBe('invalidTarget');
    expect(g.try('p4', { type: 'look', targetId: 'nobody' }).error).toBe('unknownPlayer');
  });

  it('looking at the same panel again changes nothing', () => {
    const g = rigged([...SEVEN]);
    g.look('p4', 'p0');
    const r = reduce(g.state, { type: 'look', targetId: 'p0', by: 'p4', at: g.t });
    expect(r.state).toBe(g.state);
  });

  it('shows eye contact only when the other person looks back', () => {
    const g = rigged([...SEVEN]);
    g.look('p4', 'p0');
    expect(viewFor(g.state, 'p4').me!.eyeContact).toBe(false);
    g.look('p0', 'p4');
    expect(viewFor(g.state, 'p4').me!.eyeContact).toBe(true);
    expect(viewFor(g.state, 'p0').me!.eyeContact).toBe(true);
  });

  it('counts how many living players are watching you, without saying who', () => {
    const g = rigged([...SEVEN]);
    g.look('p4', 'p0');
    g.look('p5', 'p0');
    g.look('p6', 'p1');
    expect(viewFor(g.state, 'p0').me!.watchers).toBe(2);
    expect(viewFor(g.state, 'p1').me!.watchers).toBe(1);
    expect(viewFor(g.state, 'p2').me!.watchers).toBe(0);
  });

  it('never tells a phone where anyone else is looking', () => {
    const g = rigged([...SEVEN]);
    g.look('p4', 'p0');
    g.look('p5', 'p2');
    for (const p of g.state.players) {
      const json = JSON.stringify(viewFor(g.state, p.id));
      expect(json).not.toContain('"lookingAt":"p0"'.replace('p0', p.id === 'p4' ? 'zzz' : 'p0'));
      // Only your own gaze appears in your view.
      const v = viewFor(g.state, p.id);
      for (const other of v.players) expect(other).not.toHaveProperty('lookingAt');
    }
  });
});

describe('winks need eye contact', () => {
  it('fails when you are not looking at them', () => {
    const g = rigged([...SEVEN]);
    expect(g.try('p0', { type: 'wink', targetId: 'p4' }).error).toBe('notLooking');
  });

  it('fails when they are not looking back', () => {
    const g = rigged([...SEVEN]);
    g.look('p0', 'p4');
    g.look('p4', 'p5');
    const r = g.try('p0', { type: 'wink', targetId: 'p4' });
    expect(r.error).toBe('noEyeContact');
    expect(r.message).toContain("isn't looking at you");
  });

  it('lands with eye contact and carries the Killer character for the kill animation', () => {
    const g = rigged([...SEVEN]);
    g.contact('p0', 'p4');
    const events = g.act('p0', { type: 'wink', targetId: 'p4' });
    const winked = ofType(events, 'Winked')[0]!;
    expect(winked.event.killerCharacter).toBe(g.state.roles.p0!.character);
    expect(winked.event.killerCharacter).toMatch(/^killer\./);
  });

  it('eyebrow raises need eye contact too', () => {
    const g = rigged([...SEVEN]);
    g.look('p3', 'p0');
    expect(g.try('p3', { type: 'raiseEyebrow', targetId: 'p0' }).error).toBe('noEyeContact');
  });

  it('the Sheriff arrests whoever they are looking at; no eye contact needed', () => {
    const g = rigged([...SEVEN]);
    expect(g.try('p1', { type: 'arrest', targetId: 'p0' }).error).toBe('notLooking');
    g.look('p1', 'p0');
    g.look('p0', 'p5');
    g.act('p1', { type: 'arrest', targetId: 'p0' });
    expect(g.state.phase).toBe('arrest');
  });
});

describe('witnesses', () => {
  it('everyone looking at the Killer sees the wink, but not who it hit', () => {
    const g = rigged([...SEVEN]);
    g.look('p5', 'p0');
    g.look('p6', 'p0');
    g.look('p1', 'p2'); // looking elsewhere: sees nothing
    g.contact('p0', 'p4');
    const events = g.act('p0', { type: 'wink', targetId: 'p4' });
    const saw = ofType(events, 'SawWink');
    expect(saw).toHaveLength(1);
    expect(saw[0]!.to).toEqual(['p5', 'p6']);
    expect(saw[0]!.event).toEqual({ type: 'SawWink', winkerId: 'p0' });
    expect(visibleEvents(g.state, 'p1').some((e) => e.event.type === 'SawWink')).toBe(false);
  });

  it('a wink at the Sheriff is still seen by watchers', () => {
    const g = rigged([...SEVEN]);
    g.look('p5', 'p0');
    g.contact('p0', 'p1');
    const events = g.act('p0', { type: 'wink', targetId: 'p1' });
    expect(ofType(events, 'SawWink')[0]!.to).toEqual(['p5']);
    expect(ofType(events, 'SheriffWinked')).toHaveLength(1);
  });

  it('nobody watching means nobody saw', () => {
    const g = rigged([...SEVEN]);
    g.contact('p0', 'p4');
    const events = g.act('p0', { type: 'wink', targetId: 'p4' });
    expect(ofType(events, 'SawWink')).toHaveLength(0);
  });

  it('watchers see eyebrow raises too', () => {
    const g = rigged([...SEVEN]);
    g.look('p6', 'p3');
    g.contact('p3', 'p4');
    const events = g.act('p3', { type: 'raiseEyebrow', targetId: 'p4' });
    expect(ofType(events, 'SawRaise')[0]!.to).toEqual(['p6']);
  });

  it("a Decoy's fake wink needs eye contact and is seen like a real one", () => {
    const g = rigged(['killer', 'sheriff', 'decoy', 'citizen', 'citizen', 'citizen']);
    expect(g.tryAbility('p2', 'fakeWink', 'p3').error).toBeUndefined();
    g.look('p3', null);
    g.advance(15_000);
    g.look('p2', 'p4');
    g.look('p4', 'p5');
    expect(g.try('p2', { type: 'useAbility', abilityId: 'fakeWink', targetId: 'p4' }).error).toBe('noEyeContact');
    g.look('p5', 'p2');
    g.contact('p2', 'p4');
    const events = g.act('p2', { type: 'useAbility', abilityId: 'fakeWink', targetId: 'p4' });
    expect(ofType(events, 'SawWink')[0]!.to).toEqual(['p5']);
  });

  it('targeted abilities act on the panel you have open', () => {
    const g = rigged(['killer', 'sheriff', 'paparazzi', 'citizen', 'citizen', 'citizen']);
    expect(g.try('p2', { type: 'useAbility', abilityId: 'snap', targetId: 'p0' }).error).toBe('notLooking');
    g.look('p2', 'p0');
    g.act('p2', { type: 'useAbility', abilityId: 'snap', targetId: 'p0' });
  });
});
