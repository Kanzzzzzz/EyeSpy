import type { RoleDefinition } from '../types';

export const dramaQueen: RoleDefinition = {
  id: 'dramaQueen',
  name: 'Drama Queen',
  team: 'alone',
  special: true,
  summary: 'You win if the Killer kills you or the Sheriff arrests you. Look as guilty as you can.',
  goal: 'Get winked or arrested.',
  onEvent(ctx, event, selfId) {
    if (event.type === 'PlayerDied' && event.playerId === selfId && event.cause === 'wink') {
      ctx.addSoloWinner(selfId);
    }
    if (event.type === 'ArrestResult' && event.targetId === selfId) {
      ctx.addSoloWinner(selfId);
    }
  },
};
