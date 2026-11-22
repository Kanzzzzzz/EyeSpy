import { describe, expect, it } from 'vitest';
import { checkRoleMix, DEFAULT_SETTINGS, suggestRoles, viewFor, visibleEvents } from '../src';
import { Game, lobby, NAMES, ofType } from './helpers';

describe('lobby', () => {
  it('first joiner hosts and seats follow join order', () => {
    const g = lobby(3);
    expect(g.state.hostId).toBe('p0');
    expect(g.state.players.map((p) => p.seat)).toEqual([0, 1, 2]);
    expect(g.state.phase).toBe('lobby');
  });

  it('rejects duplicate or bad names and a full room', () => {
    const g = lobby(2);
    expect(g.try('__system__', { type: 'join', playerId: 'x', name: ' ava ', avatar: 0 }).error).toBe('nameTaken');
    expect(g.try('__system__', { type: 'join', playerId: 'x', name: '   ', avatar: 0 }).error).toBe('badName');
    expect(g.try('__system__', { type: 'join', playerId: 'x', name: 'x'.repeat(17), avatar: 0 }).error).toBe('badName');
    const full = lobby(20);
    expect(full.try('__system__', { type: 'join', playerId: 'x', name: 'Zed', avatar: 0 }).error).toBe('tooManyPlayers');
  });

  it('only the room logic can add players or tick', () => {
    const g = lobby(2);
    expect(g.try('p1', { type: 'join', playerId: 'x', name: 'Zed', avatar: 0 }).error).toBe('notAllowed');
    expect(g.try('p1', { type: 'tick' }).error).toBe('notAllowed');
  });

  it('host can kick and reorder; others cannot', () => {
    const g = lobby(4);
    expect(g.try('p1', { type: 'kick', playerId: 'p2' }).error).toBe('notHost');
    g.act('p0', { type: 'kick', playerId: 'p2' });
    expect(g.state.players.map((p) => p.id)).toEqual(['p0', 'p1', 'p3']);
    expect(g.state.players.map((p) => p.seat)).toEqual([0, 1, 2]);
    g.act('p0', { type: 'reorder', order: ['p3', 'p0', 'p1'] });
    expect(g.state.players.map((p) => p.id)).toEqual(['p3', 'p0', 'p1']);
    expect(g.try('p0', { type: 'reorder', order: ['p3', 'p0'] }).error).toBe('invalidTarget');
  });

  it('host leaving hands hosting to the next seat', () => {
    const g = lobby(3);
    g.act('p0', { type: 'leave' });
    expect(g.state.hostId).toBe('p1');
  });

  it('role counts follow the suggested mix until the host overrides them', () => {
    const g = lobby(8);
    expect(g.state.settings.roles).toEqual(suggestRoles(8));
    g.configure({ roles: { shush: 0 } });
    expect(g.state.settings.autoRoles).toBe(false);
    expect(g.state.settings.roles.shush).toBe(0);
    g.sys({ type: 'join', playerId: 'p8', name: 'Ivo', avatar: 0 });
    g.sys({ type: 'join', playerId: 'p9', name: 'Jun', avatar: 0 });
    expect(g.state.settings.roles.killer).toBe(1); // not auto-bumped to 2
    g.configure({ autoRoles: true });
    expect(g.state.settings.roles).toEqual(suggestRoles(10));
  });

  it('clamps settings to sensible limits', () => {
    const g = lobby(5);
    g.configure({ deathDelayMs: 50, winkCooldownMs: 1e9, raisesToUnlock: 0 });
    expect(g.state.settings.deathDelayMs).toBe(1000);
    expect(g.state.settings.winkCooldownMs).toBe(120000);
    expect(g.state.settings.raisesToUnlock).toBe(1);
  });
});

describe('suggested role mix', () => {
  it('is valid for every player count from 5 to 20', () => {
    for (let n = 5; n <= 20; n++) {
      const settings = { ...DEFAULT_SETTINGS, roles: suggestRoles(n) };
      const check = checkRoleMix(settings, n);
      expect(check.ok, `n=${n}: ${check.problem}`).toBe(true);
      expect(check.citizens).toBeGreaterThanOrEqual(0);
    }
  });

  it('matches the design doc table', () => {
    expect(suggestRoles(5)).toEqual({ killer: 1, sheriff: 1, shush: 1, snitch: 1, loverPairs: 0 });
    expect(suggestRoles(7)).toEqual({ killer: 1, sheriff: 1, shush: 1, snitch: 1, loverPairs: 1 });
    expect(suggestRoles(12)).toEqual({ killer: 2, sheriff: 2, shush: 1, snitch: 1, loverPairs: 1 });
    expect(suggestRoles(20)).toEqual({ killer: 3, sheriff: 3, shush: 1, snitch: 1, loverPairs: 1 });
  });

  it('rejects mixes that cannot work', () => {
    const base = { ...DEFAULT_SETTINGS };
    expect(checkRoleMix(base, 4).ok).toBe(false);
    expect(checkRoleMix({ ...base, roles: { ...base.roles, killer: 0 } }, 6).ok).toBe(false);
    expect(checkRoleMix({ ...base, roles: { ...base.roles, loverPairs: 3 } }, 6).ok).toBe(false);
    expect(checkRoleMix({ ...base, roles: { killer: 3, sheriff: 2, shush: 0, snitch: 0, loverPairs: 0 } }, 6).ok).toBe(false);
  });
});

describe('start and role reveal', () => {
  it('needs the host and at least 5 players', () => {
    const g = lobby(4);
    expect(g.try('p0', { type: 'start' }).error).toBe('tooFewPlayers');
    g.sys({ type: 'join', playerId: 'p4', name: 'Eli', avatar: 0 });
    expect(g.try('p1', { type: 'start' }).error).toBe('notHost');
    g.act('p0', { type: 'start' });
    expect(g.state.phase).toBe('reveal');
  });

  it('deals exactly the configured roles', () => {
    for (let n = 5; n <= 20; n++) {
      const g = lobby(n, n * 7);
      g.act('p0', { type: 'start' });
      const roles = Object.values(g.state.roles).map((r) => r.role);
      const mix = suggestRoles(n);
      const count = (r: string) => roles.filter((x) => x === r).length;
      expect(count('killer')).toBe(mix.killer);
      expect(count('sheriff')).toBe(mix.sheriff);
      expect(count('shush')).toBe(mix.shush);
      expect(count('snitch')).toBe(mix.snitch);
      expect(count('lover')).toBe(mix.loverPairs * 2);
      expect(roles.length).toBe(n);
    }
  });

  it('pairs Lovers without telling them', () => {
    const g = lobby(8, 3);
    g.act('p0', { type: 'start' });
    const lovers = Object.entries(g.state.roles).filter(([, r]) => r.role === 'lover');
    expect(lovers).toHaveLength(2);
    const [a, ra] = lovers[0]!;
    const [b, rb] = lovers[1]!;
    expect(ra.data.partnerId).toBe(b);
    expect(rb.data.partnerId).toBe(a);
    expect(ra.knows).toEqual([]);
  });

  it('tells each player only their own role; Killers know each other in big games', () => {
    const g = lobby(12, 9);
    const events = g.act('p0', { type: 'start' });
    const assigned = ofType(events, 'RolesAssigned');
    expect(assigned).toHaveLength(12);
    for (const e of assigned) expect(e.to).toEqual([e.event.playerId]);
    const killers = Object.entries(g.state.roles).filter(([, r]) => r.role === 'killer').map(([id]) => id);
    expect(killers).toHaveLength(2);
    for (const k of killers) {
      expect(g.state.roles[k]!.knows).toEqual(killers.filter((x) => x !== k));
    }
    const sheriff = Object.entries(g.state.roles).find(([, r]) => r.role === 'sheriff')![0];
    expect(g.state.roles[sheriff]!.knows).toEqual([]);
  });

  it('starts play once everyone connected is ready', () => {
    const g = lobby(5);
    g.act('p0', { type: 'start' });
    for (const id of ['p0', 'p1', 'p2', 'p3']) g.act(id, { type: 'ready' });
    expect(g.state.phase).toBe('reveal');
    g.sys({ type: 'disconnect', playerId: 'p4' });
    expect(g.state.phase).toBe('playing');
  });

  it('starts play after the reveal timeout', () => {
    const g = lobby(5);
    g.act('p0', { type: 'start' });
    g.advance(29_000);
    expect(g.state.phase).toBe('reveal');
    g.advance(1_000);
    expect(g.state.phase).toBe('playing');
  });

  it('is deterministic for the same seed', () => {
    const a = lobby(10, 123);
    const b = lobby(10, 123);
    a.act('p0', { type: 'start' });
    b.act('p0', { type: 'start' });
    expect(a.state.roles).toEqual(b.state.roles);
  });
});

describe('viewFor', () => {
  it('never shows anyone else their role before the game ends', () => {
    const g = lobby(10, 5);
    g.act('p0', { type: 'start' });
    for (const p of g.state.players) {
      const v = viewFor(g.state, p.id);
      expect(v.me?.role).toBe(g.state.roles[p.id]!.role);
      for (const other of v.players) expect(other.role).toBeUndefined();
      const json = JSON.stringify({ v, e: visibleEvents(g.state, p.id) });
      // No other player's RolesAssigned event leaks.
      for (const q of g.state.players) {
        if (q.id === p.id) continue;
        expect(json).not.toContain(`"RolesAssigned","playerId":"${q.id}"`);
      }
    }
  });

  it('works for spectators who are not in the game', () => {
    const g = lobby(5);
    const v = viewFor(g.state, null);
    expect(v.me).toBeNull();
    expect(v.players).toHaveLength(5);
  });

  it('keeps names stable', () => {
    const g = new Game();
    g.sys({ type: 'join', playerId: 'a', name: '  Maya   Lee ', avatar: 99 });
    expect(g.player('a').name).toBe('Maya Lee');
    expect(g.player('a').avatar).toBe(11);
    expect(NAMES).toHaveLength(20);
  });
});
