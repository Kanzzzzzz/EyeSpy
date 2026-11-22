import { describe, expect, it } from 'vitest';
import { checkRoleMix, DEFAULT_SETTINGS, viewFor } from '../src';
import { lobby, ofType, rigged } from './helpers';

describe('special roles are opt-in', () => {
  it('are off by default and never dealt unless switched on', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const g = lobby(12, seed);
      g.act('p0', { type: 'start' });
      for (const rs of Object.values(g.state.roles)) {
        expect(['killer', 'sheriff', 'shush', 'snitch', 'judge', 'lover', 'citizen']).toContain(rs.role);
      }
    }
  });

  it('each switched-on role replaces one Citizen', () => {
    const g = lobby(9);
    g.configure({ roles: { judge: 0 }, special: { medium: true, insomniac: true } });
    g.act('p0', { type: 'start' });
    const roles = Object.values(g.state.roles).map((r) => r.role);
    expect(roles.filter((r) => r === 'medium')).toHaveLength(1);
    expect(roles.filter((r) => r === 'insomniac')).toHaveLength(1);
    expect(roles.filter((r) => r === 'citizen')).toHaveLength(1);
  });

  it('cannot be switched on beyond the number of Citizens', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      special: { ...DEFAULT_SETTINGS.special, medium: true, decoy: true },
    };
    expect(checkRoleMix(settings, 5).ok).toBe(false);
  });
});

describe('Drama Queen', () => {
  it('wins alone if winked to death', () => {
    const g = rigged(['killer', 'sheriff', 'dramaQueen', 'citizen', 'citizen', 'citizen']);
    g.wink('p0', 'p2');
    g.advance(3_000);
    expect(g.state.extraWinners).toEqual(['p2']);
    g.arrest('p1', 'p0');
    g.advance(4_500);
    expect(g.state.result!.winner).toBe('town');
    expect(g.state.result!.winners).toContain('p2');
  });

  it('wins alone if arrested, alongside the Killers', () => {
    const g = rigged(['killer', 'sheriff', 'dramaQueen', 'citizen', 'citizen', 'citizen']);
    g.arrest('p1', 'p2');
    g.advance(4_500);
    expect(g.state.result!.winner).toBe('killers');
    expect(g.state.result!.winners.sort()).toEqual(['p0', 'p2']);
  });
});

describe('Bodyguard', () => {
  it('dies in place of the guarded player, once', () => {
    const g = rigged(['killer', 'sheriff', 'bodyguard', 'citizen', 'citizen', 'citizen', 'citizen'], { winkCooldownMs: 0 });
    g.ability('p2', 'guard', 'p3');
    const events = g.wink('p0', 'p3');
    expect(ofType(events, 'Winked')[0]!.to).toEqual(['p2']);
    g.advance(3_000);
    expect(g.player('p2').alive).toBe(false);
    expect(g.player('p3').alive).toBe(true);
    g.wink('p0', 'p3');
    g.advance(3_000);
    expect(g.player('p3').alive).toBe(false);
  });

  it('guarding the Sheriff changes nothing: the Sheriff is immune anyway', () => {
    const g = rigged(['killer', 'sheriff', 'bodyguard', 'citizen', 'citizen', 'citizen']);
    g.ability('p2', 'guard', 'p1');
    const events = g.wink('p0', 'p1');
    expect(ofType(events, 'SheriffWinked')).toHaveLength(1);
    g.advance(3_000);
    expect(g.player('p2').alive).toBe(true);
  });
});

describe('Paparazzi', () => {
  it('learns how many winks a player has sent', () => {
    const g = rigged(['killer', 'sheriff', 'paparazzi', 'citizen', 'citizen', 'citizen', 'citizen'], { winkCooldownMs: 0 });
    g.wink('p0', 'p4');
    g.wink('p0', 'p1');
    const events = g.ability('p2', 'snap', 'p0');
    const snap = ofType(events, 'Snapped');
    expect(snap[0]!.event.winksSent).toBe(2);
    expect(snap[0]!.to).toEqual(['p2']);
    expect(g.tryAbility('p2', 'snap', 'p3').error).toBe('usedUp');
  });
});

describe('Copycat', () => {
  it('becomes the role of the first player to die', () => {
    const g = rigged(['killer', 'sheriff', 'copycat', 'snitch', 'citizen', 'citizen', 'citizen']);
    g.wink('p0', 'p3');
    const events = g.advance(3_000);
    const changed = ofType(events, 'RoleChanged');
    expect(changed[0]!.event).toMatchObject({ playerId: 'p2', role: 'snitch', team: 'town' });
    expect(changed[0]!.to).toEqual(['p2']);
    expect(viewFor(g.state, 'p2').me!.abilities.map((a) => a.id)).toEqual(['tip']);
    // Only the first death counts.
    g.advance(15_000);
    g.wink('p0', 'p4');
    g.advance(3_000);
    expect(g.role('p2')).toBe('snitch');
  });
});

describe('Medium', () => {
  it('each dead player can send the Medium one emoji', () => {
    const g = rigged(['killer', 'sheriff', 'medium', 'citizen', 'citizen', 'citizen', 'citizen']);
    expect(g.try('p4', { type: 'useAbility', abilityId: 'emoji', payload: '🔪' }).error).toBe('unknownAbility');
    g.wink('p0', 'p4');
    g.advance(3_000);
    expect(viewFor(g.state, 'p4').me!.abilities.map((a) => a.id)).toEqual(['emoji']);
    expect(g.try('p4', { type: 'useAbility', abilityId: 'emoji', payload: 'hello' }).error).toBe('notAllowed');
    const events = g.act('p4', { type: 'useAbility', abilityId: 'emoji', payload: '🔪' });
    const msg = ofType(events, 'MediumMessage');
    expect(msg[0]!.event).toEqual({ type: 'MediumMessage', fromId: 'p4', emoji: '🔪' });
    expect(msg[0]!.to).toEqual(['p2', 'p4']);
    expect(g.try('p4', { type: 'useAbility', abilityId: 'emoji', payload: '👀' }).error).toBe('usedUp');
  });
});

describe('Decoy', () => {
  it('sends fake winks: the target counts down, then hears it was a twitch', () => {
    const g = rigged(['killer', 'sheriff', 'decoy', 'citizen', 'citizen', 'citizen']);
    const events = g.ability('p2', 'fakeWink', 'p3');
    const winked = ofType(events, 'Winked');
    expect(winked[0]!.to).toEqual(['p3']);
    // The target cannot tell it apart from a real wink.
    expect(Object.keys(winked[0]!.event).sort()).toEqual(['deadline', 'killerCharacter', 'killerId', 'targetId', 'type']);
    // It even carries a real Killer's character.
    expect(winked[0]!.event.killerCharacter).toBe(g.state.roles.p0!.character);
    expect(g.player('p3').dying).toBe(false);
    const later = g.advance(3_000);
    expect(ofType(later, 'Phew')[0]!.to).toEqual(['p3']);
    expect(g.player('p3').alive).toBe(true);
    expect(g.tryAbility('p2', 'fakeWink', 'p4').error).toBe('cooldown');
  });
});

describe('Insomniac', () => {
  it('feels a nameless buzz on every wink, real or fake', () => {
    const g = rigged(['killer', 'sheriff', 'insomniac', 'decoy', 'citizen', 'citizen', 'citizen']);
    const real = g.wink('p0', 'p4');
    const buzz = ofType(real, 'Buzz');
    expect(buzz).toHaveLength(1);
    expect(buzz[0]!.to).toEqual(['p2']);
    expect(Object.keys(buzz[0]!.event)).toEqual(['type']);
    const fake = g.ability('p3', 'fakeWink', 'p5');
    expect(ofType(fake, 'Buzz')).toHaveLength(1);
  });
});
