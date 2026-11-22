import type { RoleDefinition } from '../types';

export const paparazzi: RoleDefinition = {
  id: 'paparazzi',
  name: 'Paparazzi',
  team: 'town',
  special: true,
  summary: 'Once, snap a player and learn how many winks they have sent.',
  goal: 'Help the Sheriff find the Killers.',
  abilities: [
    {
      id: 'snap',
      label: 'Snap',
      hint: 'Learn how many winks this player has sent so far. Works once.',
      target: 'player',
      uses: 1,
      apply(ctx, userId, targetId) {
        const winksSent = ctx.roleOf(targetId!).winksSent;
        ctx.emit({ type: 'Snapped', targetId: targetId!, winksSent }, [userId]);
      },
    },
  ],
};
