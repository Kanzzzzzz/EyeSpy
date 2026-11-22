import { describe, expect, it } from 'vitest';
import { ROSTER, viewFor } from '../src';
import { lobby, ofType, rigged } from './helpers';

// p0 Killer, p1 Sheriff, p2 Judge, p3 Snitch, p4/p5 Lovers, p6..p8 Citizens
const NINE = ['killer', 'sheriff', 'judge', 'snitch', 'lover', 'lover', 'citizen', 'citizen', 'citizen'] as const;

function unlock(g: ReturnType<typeof rigged>, targets = ['p6', 'p7', 'p8'], judge = 'p2') {
  for (const t of targets) {
    g.raise(judge, t);
    g.advance(10_000);
  }
}

function callHearing(g: ReturnType<typeof rigged>) {
  unlock(g);
  return g.act('p2', { type: 'useAbility', abilityId: 'hearing' });
}

describe('Judge', () => {
  it('is dealt automatically from 7 players', () => {
    const six = lobby(6);
    six.act('p0', { type: 'start' });
    expect(Object.values(six.state.roles).some((r) => r.role === 'judge')).toBe(false);
    const seven = lobby(7, 3);
    seven.act('p0', { type: 'start' });
    expect(Object.values(seven.state.roles).filter((r) => r.role === 'judge')).toHaveLength(1);
  });

  it('unlocks the hearing after 3 raises, once', () => {
    const g = rigged([...NINE]);
    expect(g.try('p2', { type: 'useAbility', abilityId: 'hearing' }).error).toBe('locked');
    const events = callHearing(g);
    expect(g.state.phase).toBe('hearing');
    const started = ofType(events, 'HearingStarted')[0]!;
    expect(started.to).toBe('all');
    // The announcement shows the Judge's character, never the player.
    expect(JSON.stringify(started.event)).not.toContain('"p2"');
    expect(started.event.judgeCharacter).toMatch(/^judge\./);
  });

  it('pauses play: no winks or raises during the hearing', () => {
    const g = rigged([...NINE]);
    callHearing(g);
    expect(g.tryWink('p0', 'p6').error).toBe('wrongPhase');
    expect(g.tryRaise('p3', 'p6').error).toBe('wrongPhase');
  });

  it('eliminates whoever gets the most votes once everyone has voted', () => {
    const g = rigged([...NINE]);
    callHearing(g);
    const voters = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
    for (const v of voters.slice(0, 8)) g.vote(v, v === 'p8' ? 'p7' : 'p8');
    expect(g.state.phase).toBe('hearing');
    expect(viewFor(g.state, 'p0').hearing!.voted).toHaveLength(8);
    const events = g.vote('p8', 'p7');
    const result = ofType(events, 'HearingResult')[0]!;
    expect(result.to).toBe('all');
    expect(result.event.eliminatedId).toBe('p8');
    expect(result.event.role).toBe('citizen');
    expect(result.event.tally).toEqual({ p8: 8, p7: 1 });
    expect(g.player('p8').alive).toBe(false);
    expect(g.player('p8').votedOut).toBe(true);
    expect(g.state.phase).toBe('playing');
    // Their role is public now.
    expect(viewFor(g.state, 'p0').players.find((p) => p.id === 'p8')!.role).toBe('citizen');
  });

  it('keeps every ballot secret: only who voted, and the final tally', () => {
    const g = rigged([...NINE]);
    callHearing(g);
    g.vote('p3', 'p0');
    const v = viewFor(g.state, 'p6');
    expect(v.hearing!.voted).toEqual(['p3']);
    expect(v.hearing!.myVote).toBeNull();
    expect(viewFor(g.state, 'p3').hearing!.myVote).toBe('p0');
    expect(JSON.stringify(v)).not.toContain('"votes"');
  });

  it('a tie eliminates nobody', () => {
    const g = rigged([...NINE]);
    callHearing(g);
    g.vote('p0', 'p6');
    g.vote('p1', 'p7');
    g.advance(20_000);
    const result = g.state.log.find((e) => e.event.type === 'HearingResult')!.event;
    expect(result).toMatchObject({ eliminatedId: null });
    expect(g.state.players.every((p) => p.alive)).toBe(true);
    expect(g.state.phase).toBe('playing');
  });

  it('ends when time runs out, counting the votes cast', () => {
    const g = rigged([...NINE]);
    callHearing(g);
    g.vote('p3', 'p6');
    g.advance(19_999);
    expect(g.state.phase).toBe('hearing');
    g.advance(1);
    expect(g.player('p6').alive).toBe(false);
  });

  it('voting out a Sheriff loses the game for the town', () => {
    const g = rigged([...NINE]);
    callHearing(g);
    g.vote('p0', 'p1');
    g.advance(20_000);
    expect(g.state.result).toMatchObject({ winner: 'killers', reason: 'sheriffVotedOut' });
  });

  it('voting out the last Killer wins it for the town', () => {
    const g = rigged([...NINE]);
    callHearing(g);
    g.vote('p3', 'p0');
    g.advance(20_000);
    expect(g.state.result).toMatchObject({ winner: 'town', reason: 'allKillersCaught' });
    expect(g.state.result!.winners).toContain('p2');
  });

  it('a voted-out Lover takes their partner with them', () => {
    const g = rigged([...NINE]);
    callHearing(g);
    g.vote('p3', 'p4');
    g.advance(20_000);
    expect(g.player('p4').alive).toBe(false);
    expect(g.player('p5').alive).toBe(false);
  });

  it('pending wink deaths wait out the hearing', () => {
    const g = rigged([...NINE]);
    unlock(g);
    g.wink('p0', 'p6');
    g.advance(1_000);
    g.act('p2', { type: 'useAbility', abilityId: 'hearing' });
    g.advance(20_000);
    expect(g.player('p6').alive).toBe(true);
    g.advance(2_000);
    expect(g.player('p6').alive).toBe(false);
  });

  it('the dead cannot vote and nobody can vote for themselves', () => {
    const g = rigged([...NINE]);
    g.wink('p0', 'p6');
    g.advance(3_000);
    unlock(g, ['p7', 'p8', 'p3']);
    g.act('p2', { type: 'useAbility', abilityId: 'hearing' });
    expect(g.try('p6', { type: 'vote', targetId: 'p0' }).error).toBe('dead');
    expect(g.try('p3', { type: 'vote', targetId: 'p3' }).error).toBe('invalidTarget');
    expect(g.try('p3', { type: 'vote', targetId: 'p6' }).error).toBe('invalidTarget');
  });
});

describe('characters', () => {
  it('every role has at least 3 characters to pick from', () => {
    for (const [role, list] of Object.entries(ROSTER)) {
      expect(list.length, role).toBeGreaterThanOrEqual(3);
      for (const c of list) expect(c.id.startsWith(`${role}.`)).toBe(true);
    }
    for (const k of ROSTER.killer) expect(k.finisher).toBeDefined();
  });

  it('starts with a random character for your role, and you can pick another on the reveal screen', () => {
    const g = lobby(6);
    g.act('p0', { type: 'start' });
    const role = g.state.roles.p1!.role;
    expect(ROSTER[role].map((c) => c.id)).toContain(g.state.roles.p1!.character);
    const pick = ROSTER[role][2]!.id;
    g.act('p1', { type: 'pickCharacter', characterId: pick });
    expect(viewFor(g.state, 'p1').me!.character).toBe(pick);
    const other = Object.keys(ROSTER).find((r) => r !== role)!;
    expect(g.try('p1', { type: 'pickCharacter', characterId: ROSTER[other as typeof role][0]!.id }).error).toBe('unknownCharacter');
  });

  it('starting characters differ within a role while there are spares', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = lobby(20, seed);
      g.act('p0', { type: 'start' });
      const byRole = new Map<string, string[]>();
      for (const rs of Object.values(g.state.roles)) byRole.set(rs.role, [...(byRole.get(rs.role) ?? []), rs.character!]);
      for (const [role, chars] of byRole) {
        const spare = Math.min(chars.length, ROSTER[role as keyof typeof ROSTER].length);
        expect(new Set(chars).size, `${role} seed ${seed}`).toBe(spare);
      }
    }
  });

  it("stays secret until it's public", () => {
    const g = rigged([...NINE]);
    for (const p of g.state.players) {
      const v = viewFor(g.state, p.id);
      for (const o of v.players) expect(o.character).toBeUndefined();
    }
    g.arrest('p1', 'p0');
    g.advance(4_500);
    const v = viewFor(g.state, 'p6');
    expect(v.phase).toBe('ended');
    for (const o of v.players) expect(o.character).toMatch(/\./);
  });
});
