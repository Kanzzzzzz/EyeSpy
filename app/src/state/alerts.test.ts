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

  it('tells a witness who they saw wink, not who was hit', () => {
    const a = eventToAlert(ev({ type: 'SawWink', winkerId: 'leo' }), ctx)!;
    expect(a.title).toBe('You saw Leo wink!');
    expect(a.sfx).toBe('!?');
  });

  it('counts down a wink, names the killer when allowed, and keeps their character for the finisher', () => {
    const a = eventToAlert(ev({ type: 'Winked', targetId: 'me', killerId: 'leo', deadline: 3100, killerCharacter: 'killer.garaku' }), ctx)!;
    expect(a.style).toBe('countdown');
    expect(a.deadline).toBe(3100);
    expect(a.body).toBe('Leo winked at you');
    expect(a.character).toBe('killer.garaku');
    const hidden = eventToAlert(ev({ type: 'Winked', targetId: 'me', killerId: null, deadline: 3100, killerCharacter: null }), ctx)!;
    expect(hidden.body).toBeUndefined();
  });

  it("plays the killer character's finisher when you die", () => {
    const a = eventToAlert(ev({ type: 'PlayerDied', playerId: 'me', cause: 'wink' }), { ...ctx, lastKillerCharacter: 'killer.garaku' })!;
    expect(a.style).toBe('finisher');
    expect(a.finisher).toBe('realm');
    const b = eventToAlert(ev({ type: 'PlayerDied', playerId: 'me', cause: 'wink' }), { ...ctx, lastKillerCharacter: 'killer.kagerou' })!;
    expect(b.finisher).toBe('slash');
  });

  it('tells the Sheriff who the Killer is', () => {
    expect(eventToAlert(ev({ type: 'SheriffWinked', sheriffId: 'me', killerId: 'leo' }), ctx)?.title).toBe("The Killer winked you: it's Leo");
  });

  it('spotlights the Snitch tip without naming the Snitch', () => {
    const a = eventToAlert(ev({ type: 'SnitchTip', suspectId: 'leo', snitchCharacter: 'snitch.yoru' }), ctx)!;
    expect(a.style).toBe('spotlight');
    expect(a.title).toBe("The Snitch thinks it's Leo");
    expect(a.body).toBe('Fox Whisper');
  });

  it('announces hearing results', () => {
    const out = eventToAlert(ev({ type: 'HearingResult', tally: { leo: 3 }, eliminatedId: 'leo', role: 'citizen' }), ctx)!;
    expect(out.title).toBe('Leo is voted out');
    const tie = eventToAlert(ev({ type: 'HearingResult', tally: { leo: 1, ava: 1 }, eliminatedId: null, role: null }), ctx)!;
    expect(tie.title).toBe('Hung jury');
  });

  it('gives every alert its own vibration', () => {
    const patterns = new Set(
      [
        { type: 'EyebrowRaised', byId: 'leo', targetId: 'me' },
        { type: 'Winked', targetId: 'me', killerId: null, deadline: 1, killerCharacter: null },
        { type: 'SheriffWinked', sheriffId: 'me', killerId: 'leo' },
        { type: 'SheriffShushed', kills: 2, shushCharacter: null },
        { type: 'SnitchTip', suspectId: 'leo', snitchCharacter: null },
        { type: 'PlayerDied', playerId: 'me', cause: 'wink' },
        { type: 'SawWink', winkerId: 'leo' },
        { type: 'HearingStarted', endsAt: 1, judgeCharacter: null },
      ].map((e) => JSON.stringify(eventToAlert(ev(e as GameEvent), ctx)!.haptic)),
    );
    expect(patterns.size).toBe(8);
  });

  it('pairs every audible alert with a visible title', () => {
    const events: GameEvent[] = [
      { type: 'PlayerDied', playerId: 'leo', cause: 'heartbreak' },
      { type: 'PlayerDied', playerId: 'leo', cause: 'vote' },
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
