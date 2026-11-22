import type { RoleDefinition } from '../types';

export const judge: RoleDefinition = {
  id: 'judge',
  name: 'Judge',
  team: 'town',
  special: false,
  summary: 'After your 3rd eyebrow raise, call one hearing: everyone alive votes, and the most votes is out.',
  goal: "Help the town catch the Killers. If the town votes out a Sheriff, the town loses.",
  canRaise: true,
  abilities: [
    {
      id: 'hearing',
      label: 'Call a hearing',
      hint: 'Play stops and every living player votes someone out. Ties free everyone. Works once.',
      target: 'none',
      unlock: 'raises',
      uses: 1,
      apply(ctx, userId) {
        ctx.startHearing(userId);
      },
    },
  ],
};
