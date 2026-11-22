import type { RoleDefinition } from '../types';

export const snitch: RoleDefinition = {
  id: 'snitch',
  name: 'Snitch',
  team: 'town',
  special: false,
  summary: 'After your 3rd eyebrow raise, name who you think the Killer is, once. Every phone shows it.',
  goal: 'Help the Sheriff find the Killers. Nobody knows who you are.',
  abilities: [
    {
      id: 'tip',
      label: 'Tip off the town',
      hint: 'Every phone shows "The Snitch thinks it\'s …". Your name stays secret.',
      target: 'player',
      unlock: 'raises',
      uses: 1,
      apply(ctx, _userId, targetId) {
        ctx.emit({ type: 'SnitchTip', suspectId: targetId! }, 'all');
      },
    },
  ],
};
