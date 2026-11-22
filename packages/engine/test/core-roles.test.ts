import { describe, expect, it } from 'vitest';
import { viewFor, visibleEvents } from '../src';
import { ofType, rigged } from './helpers';

// p0 Killer, p1 Sheriff, p2 Shush, p3 Snitch, p4..p6 Citizens
const SEVEN = ['killer', 'sheriff', 'shush', 'snitch', 'citizen', 'citizen', 'citizen'] as const;

describe('Killer: winks', () => {
  it('kills the target after the death delay, and only the victim sees the countdown', () => {
    const g = rigged([...SEVEN]);
    const events = g.act('p0', { type: 'wink', targetId: 'p4' });
    const winked = ofType(events, 'Winked');
    expect(winked).toHaveLength(1);
    expect(winked[0]!.to).toEqual(['p4']);
    expect(winked[0]!.event.killerId).toBe('p0');
    expect(g.player('p4').alive).toBe(true);
    g.advance(2_999);
    expect(g.player('p4').alive).toBe(true);
    const later = g.advance(1);
    expect(g.player('p4').alive).toBe(false);
    const died = ofType(later, 'PlayerDied');
    expect(died[0]!.event).toEqual({ type: 'PlayerDied', playerId: 'p4', cause: 'wink' });
    expect(died[0]!.to).toBe('all');
  });

  it('hides the killer from the victim when the host turns that off', () => {
    const g = rigged([...SEVEN], { victimsSeeKiller: false });
    const events = g.act('p0', { type: 'wink', targetId: 'p4' });
    expect(ofType(events, 'Winked')[0]!.event.killerId).toBeNull();
  });

  it('has a cooldown between winks', () => {
    const g = rigged([...SEVEN]);
    g.act('p0', { type: 'wink', targetId: 'p4' });
    g.advance(5_000);
    expect(g.try('p0', { type: 'wink', targetId: 'p5' }).error).toBe('cooldown');
    g.advance(10_000);
    g.act('p0', { type: 'wink', targetId: 'p5' });
  });

  it('cannot wink themselves, the dead, or someone already winked', () => {
    const g = rigged([...SEVEN], { winkCooldownMs: 0 });
    expect(g.try('p0', { type: 'wink', targetId: 'p0' }).error).toBe('invalidTarget');
    g.act('p0', { type: 'wink', targetId: 'p4' });
    expect(g.try('p0', { type: 'wink', targetId: 'p4' }).error).toBe('invalidTarget');
    g.advance(3_000);
    expect(g.try('p0', { type: 'wink', targetId: 'p4' }).error).toBe('invalidTarget');
  });

  it('only Killers can wink', () => {
    const g = rigged([...SEVEN]);
    for (const id of ['p1', 'p2', 'p3', 'p4']) {
      expect(g.try(id, { type: 'wink', targetId: 'p5' }).error).toBe('notAllowed');
    }
  });

  it('a winked player cannot act during the countdown', () => {
    const g = rigged([...SEVEN]);
    g.act('p0', { type: 'wink', targetId: 'p3' });
    expect(g.try('p3', { type: 'raiseEyebrow', targetId: 'p0' }).error).toBe('dead');
  });

  it('winking the Sheriff kills nobody and tells only the Sheriff who the Killer is', () => {
    const g = rigged([...SEVEN]);
    const events = g.act('p0', { type: 'wink', targetId: 'p1' });
    const tip = ofType(events, 'SheriffWinked');
    expect(tip).toHaveLength(1);
    expect(tip[0]!.to).toEqual(['p1']);
    expect(tip[0]!.event.killerId).toBe('p0');
    expect(ofType(events, 'Winked')).toHaveLength(0);
    g.advance(5_000);
    expect(g.player('p1').alive).toBe(true);
    expect(g.state.pendingDeaths).toHaveLength(0);
  });

  it('cannot wink a fellow Killer', () => {
    const g = rigged(['killer', 'killer', 'sheriff', 'citizen', 'citizen', 'citizen', 'citizen']);
    expect(g.try('p0', { type: 'wink', targetId: 'p1' }).error).toBe('invalidTarget');
  });
});

describe('Sheriff: arrests', () => {
  it('arresting the Killer wins for the town after the verdict', () => {
    const g = rigged([...SEVEN]);
    const started = g.act('p1', { type: 'arrest', targetId: 'p0' });
    expect(g.state.phase).toBe('arrest');
    expect(ofType(started, 'ArrestStarted')[0]!.to).toBe('all');
    // Arresting does not say who the Sheriff is.
    expect(JSON.stringify(ofType(started, 'ArrestStarted')[0]!.event)).not.toContain('p1');
    g.advance(4_500);
    expect(g.state.phase).toBe('ended');
    expect(g.state.result!.winner).toBe('town');
    expect(g.state.result!.reason).toBe('allKillersArrested');
    // Town wins alive or dead; the Shush (killers' team) does not.
    expect(g.state.result!.winners.sort()).toEqual(['p1', 'p3', 'p4', 'p5', 'p6']);
  });

  it('arresting anyone else loses the game for the town', () => {
    const g = rigged([...SEVEN]);
    g.act('p1', { type: 'arrest', targetId: 'p2' }); // the Shush is not a Killer
    g.advance(4_500);
    expect(g.state.result!.winner).toBe('killers');
    expect(g.state.result!.reason).toBe('wrongArrest');
    expect(g.state.result!.winners.sort()).toEqual(['p0', 'p2']);
  });

  it('pauses the game during the verdict: no winks, and pending deaths wait', () => {
    const g = rigged([...SEVEN]);
    g.act('p0', { type: 'wink', targetId: 'p4' });
    g.advance(1_000);
    g.act('p1', { type: 'arrest', targetId: 'p5' });
    expect(g.try('p0', { type: 'wink', targetId: 'p6' }).error).toBe('wrongPhase');
    expect(g.try('p3', { type: 'raiseEyebrow', targetId: 'p6' }).error).toBe('wrongPhase');
    g.advance(4_000);
    expect(g.player('p4').alive).toBe(true);
  });

  it('pending deaths resume after a correct arrest with more Killers left', () => {
    const roles = ['killer', 'killer', 'sheriff', 'sheriff', 'citizen', 'citizen', 'citizen', 'citizen', 'citizen', 'citizen'] as const;
    const g = rigged([...roles]);
    g.act('p0', { type: 'wink', targetId: 'p4' }); // dies at +3000
    g.advance(1_000);
    g.act('p2', { type: 'arrest', targetId: 'p1' });
    g.advance(4_500); // verdict
    expect(g.state.phase).toBe('playing');
    expect(g.player('p1').alive).toBe(false);
    expect(g.player('p1').arrested).toBe(true);
    expect(g.player('p4').alive).toBe(true); // 2s of countdown left
    g.advance(1_999);
    expect(g.player('p4').alive).toBe(true);
    g.advance(1);
    expect(g.player('p4').alive).toBe(false);
  });

  it('with several Killers, the town needs every one of them', () => {
    const roles = ['killer', 'killer', 'sheriff', 'sheriff', 'citizen', 'citizen', 'citizen', 'citizen', 'citizen', 'citizen'] as const;
    const g = rigged([...roles]);
    g.act('p2', { type: 'arrest', targetId: 'p0' });
    g.advance(4_500);
    expect(g.state.phase).toBe('playing');
    // The arrested Killer's role is public now.
    expect(viewFor(g.state, 'p5').players.find((p) => p.id === 'p0')!.role).toBe('killer');
    g.act('p3', { type: 'arrest', targetId: 'p1' });
    g.advance(4_500);
    expect(g.state.result!.winner).toBe('town');
  });

  it('cannot be killed, and only Sheriffs can arrest', () => {
    const g = rigged([...SEVEN]);
    expect(g.try('p4', { type: 'arrest', targetId: 'p0' }).error).toBe('notAllowed');
    expect(g.try('p0', { type: 'arrest', targetId: 'p4' }).error).toBe('notAllowed');
    expect(g.try('p1', { type: 'arrest', targetId: 'p1' }).error).toBe('invalidTarget');
  });
});

describe('Killers outnumber the room', () => {
  it('Killer wins when only the Sheriff, the Killer and one other are alive', () => {
    // 5 players: K, S, Shush, Snitch, Citizen. Two kills leaves 3.
    const g = rigged(['killer', 'sheriff', 'shush', 'snitch', 'citizen'], { winkCooldownMs: 0 });
    g.act('p0', { type: 'wink', targetId: 'p4' });
    g.advance(3_000);
    expect(g.state.phase).toBe('playing');
    g.act('p0', { type: 'wink', targetId: 'p3' });
    g.advance(3_000);
    expect(g.state.phase).toBe('ended');
    expect(g.state.result).toMatchObject({ winner: 'killers', reason: 'killersOutnumber' });
    expect(g.state.result!.winners.sort()).toEqual(['p0', 'p2']);
  });

  it('with 2 Killers and 2 Sheriffs, wins when only they and one other are alive', () => {
    const g = rigged(['killer', 'killer', 'sheriff', 'sheriff', 'citizen', 'citizen', 'citizen'], { winkCooldownMs: 0 });
    g.act('p0', { type: 'wink', targetId: 'p4' });
    g.act('p1', { type: 'wink', targetId: 'p5' });
    g.advance(3_000);
    expect(g.state.result).toMatchObject({ winner: 'killers', reason: 'killersOutnumber' });
    expect(g.state.players.filter((p) => p.alive)).toHaveLength(5);
  });
});

describe('Citizen', () => {
  it('has no ability but can raise eyebrows', () => {
    const g = rigged([...SEVEN]);
    expect(viewFor(g.state, 'p4').me!.abilities).toEqual([]);
    g.act('p4', { type: 'raiseEyebrow', targetId: 'p0' });
    const e = visibleEvents(g.state, 'p0').filter((x) => x.event.type === 'EyebrowRaised');
    expect(e).toHaveLength(1);
  });
});
