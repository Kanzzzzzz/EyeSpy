import type { RoleDefinition } from '../types';

export const bodyguard: RoleDefinition = {
  id: 'bodyguard',
  name: 'Bodyguard',
  team: 'town',
  special: true,
  summary: 'Once, guard a player. If they are winked, you die in their place.',
  goal: 'Help the Sheriff find the Killers, and protect someone worth it.',
  abilities: [
    {
      id: 'guard',
      label: 'Guard',
      hint: 'If this player is winked, you die instead. Works once.',
      target: 'player',
      uses: 1,
      apply(ctx, userId, targetId) {
        ctx.roleOf(userId).data.guarding = targetId;
        ctx.emit({ type: 'Guarding', targetId: targetId! }, [userId]);
      },
    },
  ],
  onWinkAttempt(ctx, { targetId, selfId }) {
    const data = ctx.roleOf(selfId).data;
    if (data.guarding !== targetId || data.triggered || targetId === selfId) return;
    data.triggered = true;
    ctx.emit({ type: 'GuardTriggered', savedId: targetId }, [selfId]);
    return { kind: 'redirect', victimId: selfId };
  },
};
