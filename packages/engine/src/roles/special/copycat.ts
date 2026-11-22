import type { RoleDefinition } from '../types';

export const copycat: RoleDefinition = {
  id: 'copycat',
  name: 'Copycat',
  team: 'town',
  special: true,
  summary: 'When the first player dies, you take their role.',
  goal: 'Wait. Then play whatever you become.',
  onEvent(ctx, event, selfId) {
    if (event.type !== 'PlayerDied') return;
    if (!ctx.player(selfId).alive || event.playerId === selfId) return;
    if (ctx.state.deathOrder[0] !== event.playerId) return;
    if (ctx.roleOf(selfId).role !== 'copycat') return;
    ctx.changeRole(selfId, ctx.roleOf(event.playerId).role);
  },
};
