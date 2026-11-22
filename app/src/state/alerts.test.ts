import { describe, expect, it } from 'vitest';
import type { GameEvent, LoggedEvent } from '@eyespy/engine';
import { eventToAlert } from './alerts';

const ctx = {
  me: 'me',
  players: { me: { name: 'Maya', avatar: 1 }, leo: { name: 'Leo', avatar: 2 }, ava: { name: 'Ava', avatar: 3 } },
};
const ev = (event: GameEvent, seq = 1): LoggedEvent => ({ seq, at: 100, to: 'all', event });

describe('eventToAlert', () => {
  it('shows who raised an eyebrow, only to the target', () => {
    expect(eventToAlert(ev({ type: 'EyebrowRaised', byId: 'leo', targetId: 'me' }), ctx)?.title).toBe('Leo raised an eyebrow at you');
    expect(eventToAlert(ev({ type: 'EyebrowRaised', byId: 'me', targetId: 'leo' }), ctx)).toBeNull();
  });

  it('counts down a wink and names the killer when allowed', () => {
    const a = eventToAlert(ev({ type: 'Winked', targetId: 'me', killerId: 'leo', deadline: 3100 }), ctx)!;
    expect(a.style).toBe('countdown');
    expect(a.deadline).toBe(3100);
    expect(a.body).toBe('Leo winked at you');
    const hidden = eventToAlert(ev({ type: 'Winked', targetId: 'me', killerId: null, deadline: 3100 }), ctx)!;
    expect(hidden.body).toBeUndefined();
  });

  it('tells the Sheriff who the Killer is', () => {
    expect(eventToAlert(ev({ type: 'SheriffWinked', sheriffId: 'me', killerId: 'leo' }), ctx)?.title).toBe("The Killer winked you: it's Leo");
  });

  it('spotlights the Snitch tip without naming the Snitch', () => {
    const a = eventToAlert(ev({ type: 'SnitchTip', suspectId: 'leo' }), ctx)!;
    expect(a.style).toBe('spotlight');
    expect(a.title).toBe("The Snitch thinks it's Leo");
  });

  it('gives every alert its own vibration', () => {
    const patterns = new Set(
      [
        { type: 'EyebrowRaised', byId: 'leo', targetId: 'me' },
        { type: 'Winked', targetId: 'me', killerId: null, deadline: 1 },
        { type: 'SheriffWinked', sheriffId: 'me', killerId: 'leo' },
        { type: 'SheriffShushed', kills: 2 },
        { type: 'SnitchTip', suspectId: 'leo' },
        { type: 'PlayerDied', playerId: 'me', cause: 'wink' },
      ].map((e) => JSON.stringify(eventToAlert(ev(e as GameEvent), ctx)!.haptic)),
    );
    expect(patterns.size).toBe(6);
  });

  it('pairs every audible alert with a visible title', () => {
    const events: GameEvent[] = [
      { type: 'PlayerDied', playerId: 'leo', cause: 'heartbreak' },
      { type: 'Buzz' },
      { type: 'Phew', targetId: 'me' },
      { type: 'ArrestResult', targetId: 'leo', correct: true, role: 'killer' },
      { type: 'MediumMessage', fromId: 'leo', emoji: '🔪' },
    ];
    for (const e of events) {
      const a = eventToAlert(ev(e), ctx)!;
      expect(a.title.length).toBeGreaterThan(0);
    }
  });
});
