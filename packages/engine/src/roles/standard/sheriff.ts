import type { RoleDefinition } from '../types';

export const sheriff: RoleDefinition = {
  id: 'sheriff',
  name: 'Sheriff',
  team: 'town',
  special: false,
  summary: "Arrest the Killer. Arrest anyone else and the town loses. You can't be killed.",
  goal: 'Arrest every Killer.',
  canArrest: true,
  isSheriff: true,
  onWinkAttempt(ctx, { killerId, targetId, selfId }) {
    if (targetId !== selfId) return;
    ctx.emit({ type: 'SheriffWinked', sheriffId: selfId, killerId }, [selfId]);
    return { kind: 'immune' };
  },
};
