import type { RoleDefinition } from '../types';

export const decoy: RoleDefinition = {
  id: 'decoy',
  name: 'Decoy',
  team: 'killers',
  special: true,
  summary: 'Send fake winks. Your target counts down, then learns it was "just a twitch".',
  goal: 'Help the Killers win by sowing panic.',
  abilities: [
    {
      id: 'fakeWink',
      label: 'Fake wink',
      hint: 'Their phone counts down like a real wink, then says it was just a twitch.',
      target: 'player',
      uses: null,
      cooldownMs: 'wink',
      apply(ctx, userId, targetId) {
        const { settings } = ctx.state;
        const target = targetId!;
        ctx.roleOf(userId).winksSent += 1;
        const deadline = ctx.now + settings.deathDelayMs;
        ctx.emit({ type: 'WinkSent', killerId: userId, targetId: target, fake: true }, [userId]);
        ctx.emit(
          { type: 'Winked', targetId: target, killerId: settings.victimsSeeKiller ? userId : null, deadline },
          [target],
        );
        ctx.schedule(userId, deadline, 'phew', { targetId: target });
      },
    },
  ],
  onTimer(ctx, timer) {
    if (timer.kind !== 'phew') return;
    const targetId = timer.data.targetId as string;
    if (ctx.player(targetId).alive) ctx.emit({ type: 'Phew', targetId }, [targetId]);
  },
};
