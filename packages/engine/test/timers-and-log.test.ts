import { describe, expect, it } from 'vitest';
import { createGame, hasDueWork, reduce, visibleEvents } from '../src';
import { lobby, rigged } from './helpers';

const SIX = ['killer', 'sheriff', 'shush', 'snitch', 'citizen', 'citizen'] as const;

describe('timers', () => {
  it('come only from the host clock: time never runs backwards', () => {
    const g = rigged([...SIX]);
    g.act('p0', { type: 'wink', targetId: 'p4' });
    const before = g.state.now;
    const r = reduce(g.state, { type: 'tick', by: '__system__', at: before - 10_000 });
    expect(r.state.now).toBe(before);
    expect(g.player('p4').alive).toBe(true);
  });

  it('idle ticks return the same state object, so the host can skip snapshots', () => {
    const g = rigged([...SIX]);
    const r = reduce(g.state, { type: 'tick', by: '__system__', at: g.t + 100 });
    expect(r.state).toBe(g.state);
    expect(hasDueWork(g.state, g.t + 100)).toBe(false);
  });

  it('resolves two deaths due in one tick in time order', () => {
    const g = rigged(['killer', 'killer', 'sheriff', 'sheriff', 'citizen', 'citizen', 'citizen', 'citizen'], {
      winkCooldownMs: 0,
    });
    g.act('p1', { type: 'wink', targetId: 'p5' });
    g.t += 10;
    g.act('p0', { type: 'wink', targetId: 'p4' });
    g.advance(10_000);
    expect(g.state.deathOrder).toEqual(['p5', 'p4']);
  });

  it('stops resolving deaths once the game is won', () => {
    const g = rigged(['killer', 'sheriff', 'shush', 'snitch', 'citizen'], { winkCooldownMs: 0 });
    g.act('p0', { type: 'wink', targetId: 'p4' });
    g.act('p0', { type: 'wink', targetId: 'p3' });
    g.act('p0', { type: 'wink', targetId: 'p2' });
    g.advance(3_000);
    expect(g.state.phase).toBe('ended');
    // Two deaths ended it; the third never happened.
    expect(g.state.players.filter((p) => p.alive)).toHaveLength(3);
  });
});

describe('event log', () => {
  it('numbers every event and lets a phone fetch what it missed', () => {
    const g = rigged([...SIX]);
    const seqs = g.state.log.map((e) => e.seq);
    expect([...seqs].sort((a, b) => a - b)).toEqual(seqs);
    const mark = g.state.log.at(-1)!.seq;
    g.act('p4', { type: 'raiseEyebrow', targetId: 'p5' });
    g.act('p0', { type: 'wink', targetId: 'p5' });
    g.advance(3_000);
    const missed = visibleEvents(g.state, 'p5', mark).map((e) => e.event.type);
    expect(missed).toEqual(['EyebrowRaised', 'Winked', 'PlayerDied']);
    // p3 never sees the private ones.
    expect(visibleEvents(g.state, 'p3', mark).map((e) => e.event.type)).toEqual(['PlayerDied']);
  });

  it('play again returns to the lobby with the same players and fresh roles', () => {
    const g = rigged([...SIX]);
    g.act('p1', { type: 'arrest', targetId: 'p0' });
    g.advance(4_500);
    expect(g.state.phase).toBe('ended');
    expect(g.try('p3', { type: 'playAgain' }).error).toBe('notHost');
    g.act('p0', { type: 'playAgain' });
    expect(g.state.phase).toBe('lobby');
    expect(g.state.players).toHaveLength(6);
    expect(g.state.players.every((p) => p.alive && !p.arrested)).toBe(true);
    expect(g.state.roles).toEqual({});
    g.act('p0', { type: 'start' });
    expect(g.state.round).toBe(2);
  });

  it('state is plain JSON, so snapshots round-trip', () => {
    const g = rigged([...SIX]);
    g.act('p0', { type: 'wink', targetId: 'p4' });
    const restored = JSON.parse(JSON.stringify(g.state));
    expect(restored).toEqual(g.state);
    const a = reduce(g.state, { type: 'tick', by: '__system__', at: g.t + 3000 });
    const b = reduce(restored, { type: 'tick', by: '__system__', at: g.t + 3000 });
    expect(b.state).toEqual(a.state);
  });

  it('rejected actions leave the state untouched', () => {
    const s = createGame(1);
    const r = reduce(s, { type: 'start', by: 'nobody', at: 5 });
    expect(r.error).toBe('unknownPlayer');
    expect(r.state).toBe(s);
  });

  it('settings can be changed between rounds but not mid-game', () => {
    const g = lobby(5);
    g.act('p0', { type: 'start' });
    expect(g.try('p0', { type: 'configure', settings: { deathDelayMs: 5000 } }).error).toBe('wrongPhase');
  });
});
